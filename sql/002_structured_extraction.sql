-- =====================================================
-- SCHEMA PARA EXTRACCIÓN ESTRUCTURADA - Cerebro de Visas
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. TAXONOMÍA DE ISSUES (el corazón del sistema)
CREATE TABLE IF NOT EXISTS taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) UNIQUE NOT NULL,
  level1 VARCHAR(100) NOT NULL,
  level2 VARCHAR(200) NOT NULL,
  level3 VARCHAR(200),
  description TEXT,
  prong VARCHAR(20), -- P1, P2, P3, EVIDENCE, COHERENCE
  severity_default VARCHAR(20) DEFAULT 'medium', -- critical, high, medium, low
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ISSUES EXTRAÍDOS DE DOCUMENTOS
CREATE TABLE IF NOT EXISTS document_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  taxonomy_code VARCHAR(100) REFERENCES taxonomy(code),
  severity VARCHAR(20) DEFAULT 'medium',
  extracted_quote TEXT,
  page_ref VARCHAR(50),
  paragraph_ref VARCHAR(50),
  prong_affected VARCHAR(20),
  officer_reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. REQUESTS (qué pide USCIS)
CREATE TABLE IF NOT EXISTS document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  request_text TEXT NOT NULL,
  evidence_type VARCHAR(100),
  prong_mapping VARCHAR(20),
  priority VARCHAR(20) DEFAULT 'required', -- required, recommended, optional
  page_ref VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ANÁLISIS ESTRUCTURADO DEL DOCUMENTO
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS document_date DATE,
ADD COLUMN IF NOT EXISTS outcome_type VARCHAR(50), -- RFE, NOID, Denial, Approval
ADD COLUMN IF NOT EXISTS visa_category VARCHAR(50), -- EB2-NIW, EB1A, etc
ADD COLUMN IF NOT EXISTS service_center VARCHAR(100),
ADD COLUMN IF NOT EXISTS field_office VARCHAR(100),
ADD COLUMN IF NOT EXISTS officer_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS a_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS beneficiary_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS response_deadline DATE,
ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
ADD COLUMN IF NOT EXISTS structured_data JSONB,
ADD COLUMN IF NOT EXISTS ai_analysis JSONB,
ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ;

-- 5. INSERTAR TAXONOMÍA INICIAL NIW
INSERT INTO taxonomy (code, level1, level2, level3, description, prong, severity_default) VALUES
-- PRONG 1: Mérito sustancial e importancia nacional
('NIW.P1.MERITO.IMPACTO_NO_CUANTIFICADO', 'Prong 1 - Mérito/Importancia', 'Impacto económico', 'No cuantificado', 'El impacto económico del endeavor no está cuantificado con datos específicos', 'P1', 'high'),
('NIW.P1.MERITO.ALCANCE_LOCAL', 'Prong 1 - Mérito/Importancia', 'Alcance geográfico', 'Limitado/Local', 'El alcance del endeavor se percibe como local o regional, no nacional', 'P1', 'critical'),
('NIW.P1.MERITO.PROBLEMA_COMUN', 'Prong 1 - Mérito/Importancia', 'Problema descrito', 'Normal/Común', 'El problema que resuelve se describe como común o no urgente', 'P1', 'high'),
('NIW.P1.MERITO.SIN_IMPORTANCIA_NACIONAL', 'Prong 1 - Mérito/Importancia', 'Importancia nacional', 'No demostrada', 'No se demuestra por qué el endeavor tiene importancia nacional', 'P1', 'critical'),
('NIW.P1.MERITO.BENEFICIO_LIMITADO', 'Prong 1 - Mérito/Importancia', 'Beneficio', 'Limitado a clientes', 'El beneficio se limita a clientes/empleador, no a la nación', 'P1', 'high'),

-- PRONG 2: Bien posicionado
('NIW.P2.POSICION.EDUCACION_INSUFICIENTE', 'Prong 2 - Bien Posicionado', 'Educación', 'Insuficiente', 'La educación no demuestra que está bien posicionado para el endeavor', 'P2', 'high'),
('NIW.P2.POSICION.EXPERIENCIA_NO_RELACIONADA', 'Prong 2 - Bien Posicionado', 'Experiencia', 'No relacionada', 'La experiencia laboral no se relaciona directamente con el endeavor propuesto', 'P2', 'high'),
('NIW.P2.POSICION.SIN_TRACK_RECORD', 'Prong 2 - Bien Posicionado', 'Track record', 'No demostrado', 'No hay evidencia de éxito previo en esfuerzos similares', 'P2', 'critical'),
('NIW.P2.POSICION.PLAN_VAGO', 'Prong 2 - Bien Posicionado', 'Plan futuro', 'Vago/Incompleto', 'El plan para avanzar el endeavor es vago o incompleto', 'P2', 'high'),
('NIW.P2.POSICION.SIN_PROGRESO', 'Prong 2 - Bien Posicionado', 'Progreso', 'No demostrado', 'No hay evidencia de progreso hacia el endeavor', 'P2', 'medium'),
('NIW.P2.POSICION.SIN_RECURSOS', 'Prong 2 - Bien Posicionado', 'Recursos', 'No demostrados', 'No se demuestran recursos (financieros, partnerships) para ejecutar', 'P2', 'medium'),
('NIW.P2.POSICION.SIN_INTERES_TERCEROS', 'Prong 2 - Bien Posicionado', 'Interés externo', 'No demostrado', 'No hay cartas de interés de clientes, inversores o gobierno', 'P2', 'medium'),

-- PRONG 3: Balance test
('NIW.P3.BALANCE.PERM_NO_JUSTIFICADO', 'Prong 3 - Balance', 'Waiver PERM', 'No justificado', 'No se justifica por qué se debe eximir del proceso PERM', 'P3', 'critical'),
('NIW.P3.BALANCE.TRABAJADORES_US', 'Prong 3 - Balance', 'Trabajadores US', 'Perjuicio no descartado', 'No se descarta perjuicio a trabajadores estadounidenses', 'P3', 'high'),
('NIW.P3.BALANCE.ESCASEZ_NO_DEMOSTRADA', 'Prong 3 - Balance', 'Escasez talento', 'No demostrada', 'No se demuestra escasez de talento similar en USA', 'P3', 'medium'),
('NIW.P3.BALANCE.URGENCIA_NO_DEMOSTRADA', 'Prong 3 - Balance', 'Urgencia', 'No demostrada', 'No se demuestra urgencia que justifique saltar PERM', 'P3', 'medium'),

-- EVIDENCIA: Cartas
('NIW.EV.CARTAS.GENERICAS', 'Evidencia - Cartas', 'Contenido', 'Genérico', 'Las cartas de recomendación son genéricas sin ejemplos específicos', 'EVIDENCE', 'high'),
('NIW.EV.CARTAS.SIN_VERIFICABLES', 'Evidencia - Cartas', 'Ejemplos', 'No verificables', 'Las cartas no incluyen ejemplos verificables del impacto', 'EVIDENCE', 'high'),
('NIW.EV.CARTAS.AUTORES_NO_CALIFICADOS', 'Evidencia - Cartas', 'Autores', 'No calificados', 'Los autores de las cartas no tienen credenciales relevantes', 'EVIDENCE', 'medium'),
('NIW.EV.CARTAS.RELACION_PERSONAL', 'Evidencia - Cartas', 'Relación', 'Personal/Cercana', 'Las cartas son de personas con relación personal, no independientes', 'EVIDENCE', 'medium'),

-- EVIDENCIA: Publicaciones/Citas
('NIW.EV.PUBS.IRRELEVANTES', 'Evidencia - Publicaciones', 'Relevancia', 'No relacionadas al endeavor', 'Las publicaciones no se relacionan con el endeavor propuesto', 'EVIDENCE', 'high'),
('NIW.EV.PUBS.POCAS_CITAS', 'Evidencia - Publicaciones', 'Impacto', 'Pocas citaciones', 'Las publicaciones tienen pocas citaciones o impacto', 'EVIDENCE', 'medium'),
('NIW.EV.PUBS.SIN_INFLUENCIA', 'Evidencia - Publicaciones', 'Influencia', 'No demostrada', 'No se demuestra influencia en el campo', 'EVIDENCE', 'medium'),

-- EVIDENCIA: Business Plan
('NIW.EV.BP.NUMEROS_SIN_METODOLOGIA', 'Evidencia - Business Plan', 'Proyecciones', 'Sin metodología', 'Las proyecciones financieras no tienen metodología clara', 'EVIDENCE', 'high'),
('NIW.EV.BP.SUPUESTOS_NO_SOPORTADOS', 'Evidencia - Business Plan', 'Supuestos', 'No soportados', 'Los supuestos del plan no están respaldados con datos', 'EVIDENCE', 'high'),
('NIW.EV.BP.MERCADO_NO_VALIDADO', 'Evidencia - Business Plan', 'Mercado', 'No validado', 'El análisis de mercado no está validado con fuentes', 'EVIDENCE', 'medium'),

-- EVIDENCIA: Econométrico
('NIW.EV.ECON.METODOLOGIA_DEBIL', 'Evidencia - Econométrico', 'Metodología', 'Débil/Cuestionable', 'La metodología del estudio econométrico es débil', 'EVIDENCE', 'high'),
('NIW.EV.ECON.SUPUESTOS_IRREALES', 'Evidencia - Econométrico', 'Supuestos', 'Irreales', 'Los supuestos del modelo son poco realistas', 'EVIDENCE', 'high'),

-- EVIDENCIA: Patentes
('NIW.EV.PAT.SIN_USO', 'Evidencia - Patentes', 'Uso', 'Sin uso comercial', 'Las patentes no tienen uso comercial demostrado', 'EVIDENCE', 'medium'),
('NIW.EV.PAT.SIN_LICENCIAS', 'Evidencia - Patentes', 'Licencias', 'Sin licencias', 'No hay licencias o transferencias de tecnología', 'EVIDENCE', 'medium'),

-- COHERENCIA
('NIW.COH.CONTRADICCIONES', 'Coherencia', 'Consistencia', 'Contradicciones internas', 'Hay contradicciones entre diferentes partes del expediente', 'COHERENCE', 'critical'),
('NIW.COH.CRONOLOGIA_CONFUSA', 'Coherencia', 'Cronología', 'Confusa', 'La cronología de eventos es confusa o inconsistente', 'COHERENCE', 'high'),
('NIW.COH.CLAIMS_VS_EXHIBITS', 'Coherencia', 'Claims vs Evidencia', 'Desproporción', 'Los claims son grandes pero los exhibits son pequeños/débiles', 'COHERENCE', 'high'),

-- PROCEDURAL
('NIW.PROC.GRADO_NO_EQUIVALENTE', 'Procedural', 'Educación', 'Grado no equivalente', 'El grado extranjero no tiene equivalencia a advanced degree USA', 'PROCEDURAL', 'critical'),
('NIW.PROC.TRANSCRIPTS_FALTANTES', 'Procedural', 'Documentos', 'Transcripts faltantes', 'Faltan transcripts o evaluación de credenciales', 'PROCEDURAL', 'high'),
('NIW.PROC.TRADUCCION_FALTANTE', 'Procedural', 'Documentos', 'Traducción faltante', 'Documentos en otro idioma sin traducción certificada', 'PROCEDURAL', 'medium')

ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = NOW();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_document_issues_doc ON document_issues(document_id);
CREATE INDEX IF NOT EXISTS idx_document_issues_taxonomy ON document_issues(taxonomy_code);
CREATE INDEX IF NOT EXISTS idx_document_requests_doc ON document_requests(document_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_prong ON taxonomy(prong);
CREATE INDEX IF NOT EXISTS idx_taxonomy_level1 ON taxonomy(level1);
CREATE INDEX IF NOT EXISTS idx_documents_outcome ON documents(outcome_type);
CREATE INDEX IF NOT EXISTS idx_documents_visa ON documents(visa_category);
