-- =====================================================
-- SCHEMA P0 ADICIONAL - Claims y Drift Detection
-- Ejecutar en Supabase SQL Editor después de 002
-- =====================================================

-- ============================================
-- 1. CLAIMS (Claims del expediente)
-- ============================================
CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES visa_cases(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  claim_text TEXT NOT NULL,
  claim_type VARCHAR(50), -- main, supporting, counter
  prong_mapping VARCHAR(20), -- P1, P2, P3
  criticality VARCHAR(20) DEFAULT 'medium', -- critical, high, medium, low
  evidence_strength_score DECIMAL(3,2), -- 0.00 - 1.00
  status VARCHAR(50) DEFAULT 'pending', -- pending, validated, weak, missing_evidence
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. CLAIM_EVIDENCE (Mapeo claim ↔ evidencia)
-- ============================================
CREATE TABLE IF NOT EXISTS claim_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
  evidence_doc_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  case_document_id UUID REFERENCES case_documents(id) ON DELETE SET NULL,
  exhibit_ref VARCHAR(100), -- "Exhibit A", "Tab 3", etc.
  evidence_type VARCHAR(100), -- letter, publication, patent, business_plan, etc.
  strength_score DECIMAL(3,2) DEFAULT 0.50, -- 0.00 - 1.00
  rationale TEXT, -- Por qué esta evidencia soporta el claim
  gaps_identified TEXT[], -- Brechas identificadas
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. DRIFT SNAPSHOTS (Para detección de cambios)
-- ============================================
CREATE TABLE IF NOT EXISTS drift_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  window_days INTEGER NOT NULL, -- 30, 60, 90, 180
  taxonomy_code VARCHAR(100) REFERENCES taxonomy(code),
  issue_count INTEGER DEFAULT 0,
  percentage DECIMAL(5,2), -- % del total de issues en esa ventana
  avg_severity DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. DRIFT ALERTS (Alertas de cambio de criterio)
-- ============================================
CREATE TABLE IF NOT EXISTS drift_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taxonomy_code VARCHAR(100) REFERENCES taxonomy(code),
  alert_type VARCHAR(50), -- increase, decrease, new_pattern
  short_window_days INTEGER, -- 30, 60
  long_window_days INTEGER, -- 90, 180
  short_window_count INTEGER,
  long_window_count INTEGER,
  short_window_pct DECIMAL(5,2),
  long_window_pct DECIMAL(5,2),
  change_pct DECIMAL(5,2), -- % de cambio
  severity VARCHAR(20), -- critical, high, medium
  description TEXT,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. COHORT ANALYSIS (Para análisis de cohortes)
-- ============================================
CREATE TABLE IF NOT EXISTS cohort_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_type VARCHAR(50), -- industry, endeavor_type, service_center, drafter
  cohort_value VARCHAR(200),
  period_start DATE,
  period_end DATE,
  total_cases INTEGER,
  rfe_count INTEGER,
  noid_count INTEGER,
  denial_count INTEGER,
  approval_count INTEGER,
  rfe_rate DECIMAL(5,2),
  denial_rate DECIMAL(5,2),
  top_issues JSONB, -- Array de {taxonomy_code, count, percentage}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_claims_case ON claims(case_id);
CREATE INDEX IF NOT EXISTS idx_claims_prong ON claims(prong_mapping);
CREATE INDEX IF NOT EXISTS idx_claim_evidence_claim ON claim_evidence(claim_id);
CREATE INDEX IF NOT EXISTS idx_drift_snapshots_date ON drift_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_drift_snapshots_taxonomy ON drift_snapshots(taxonomy_code);
CREATE INDEX IF NOT EXISTS idx_drift_alerts_taxonomy ON drift_alerts(taxonomy_code);
CREATE INDEX IF NOT EXISTS idx_drift_alerts_created ON drift_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cohort_metrics_type ON cohort_metrics(cohort_type, cohort_value);

-- ============================================
-- FUNCIÓN: Calcular drift entre ventanas
-- ============================================
CREATE OR REPLACE FUNCTION calculate_issue_drift(
  p_short_window INTEGER DEFAULT 60,
  p_long_window INTEGER DEFAULT 180,
  p_threshold DECIMAL DEFAULT 20.0
)
RETURNS TABLE (
  taxonomy_code VARCHAR(100),
  short_count BIGINT,
  long_count BIGINT,
  short_pct DECIMAL,
  long_pct DECIMAL,
  drift_pct DECIMAL,
  alert_type VARCHAR(50)
) AS $$
BEGIN
  RETURN QUERY
  WITH short_window AS (
    SELECT 
      di.taxonomy_code,
      COUNT(*) as cnt,
      COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER(), 0) as pct
    FROM document_issues di
    JOIN documents d ON di.document_id = d.id
    WHERE d.created_at >= NOW() - (p_short_window || ' days')::INTERVAL
    GROUP BY di.taxonomy_code
  ),
  long_window AS (
    SELECT 
      di.taxonomy_code,
      COUNT(*) as cnt,
      COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER(), 0) as pct
    FROM document_issues di
    JOIN documents d ON di.document_id = d.id
    WHERE d.created_at >= NOW() - (p_long_window || ' days')::INTERVAL
      AND d.created_at < NOW() - (p_short_window || ' days')::INTERVAL
    GROUP BY di.taxonomy_code
  )
  SELECT 
    COALESCE(s.taxonomy_code, l.taxonomy_code) as taxonomy_code,
    COALESCE(s.cnt, 0) as short_count,
    COALESCE(l.cnt, 0) as long_count,
    COALESCE(s.pct, 0) as short_pct,
    COALESCE(l.pct, 0) as long_pct,
    CASE 
      WHEN COALESCE(l.pct, 0) = 0 THEN 100
      ELSE ((COALESCE(s.pct, 0) - COALESCE(l.pct, 0)) / COALESCE(l.pct, 1)) * 100
    END as drift_pct,
    CASE 
      WHEN COALESCE(s.pct, 0) > COALESCE(l.pct, 0) + p_threshold THEN 'increase'
      WHEN COALESCE(s.pct, 0) < COALESCE(l.pct, 0) - p_threshold THEN 'decrease'
      WHEN COALESCE(l.cnt, 0) = 0 AND COALESCE(s.cnt, 0) > 0 THEN 'new_pattern'
      ELSE 'stable'
    END as alert_type
  FROM short_window s
  FULL OUTER JOIN long_window l ON s.taxonomy_code = l.taxonomy_code
  WHERE ABS(COALESCE(s.pct, 0) - COALESCE(l.pct, 0)) >= p_threshold
     OR (COALESCE(l.cnt, 0) = 0 AND COALESCE(s.cnt, 0) > 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCIÓN: Issue frequency por período
-- ============================================
CREATE OR REPLACE FUNCTION get_issue_frequency(
  p_period VARCHAR DEFAULT 'month', -- week, month, quarter
  p_limit INTEGER DEFAULT 12
)
RETURNS TABLE (
  period_start DATE,
  taxonomy_code VARCHAR(100),
  issue_count BIGINT,
  percentage DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE_TRUNC(p_period, d.created_at)::DATE as period_start,
    di.taxonomy_code,
    COUNT(*) as issue_count,
    COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER(PARTITION BY DATE_TRUNC(p_period, d.created_at)), 0) as percentage
  FROM document_issues di
  JOIN documents d ON di.document_id = d.id
  WHERE d.created_at >= NOW() - (p_limit || ' ' || p_period || 's')::INTERVAL
  GROUP BY DATE_TRUNC(p_period, d.created_at), di.taxonomy_code
  ORDER BY period_start DESC, issue_count DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_metrics ENABLE ROW LEVEL SECURITY;

-- Permitir lectura a usuarios autenticados
CREATE POLICY "Allow read for authenticated" ON claims FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read for authenticated" ON claim_evidence FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read for authenticated" ON drift_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read for authenticated" ON drift_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read for authenticated" ON cohort_metrics FOR SELECT TO authenticated USING (true);

-- Permitir insert/update a service role
CREATE POLICY "Allow all for service" ON claims FOR ALL TO service_role USING (true);
CREATE POLICY "Allow all for service" ON claim_evidence FOR ALL TO service_role USING (true);
CREATE POLICY "Allow all for service" ON drift_snapshots FOR ALL TO service_role USING (true);
CREATE POLICY "Allow all for service" ON drift_alerts FOR ALL TO service_role USING (true);
CREATE POLICY "Allow all for service" ON cohort_metrics FOR ALL TO service_role USING (true);
