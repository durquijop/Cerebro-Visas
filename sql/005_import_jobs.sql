-- =============================================
-- TABLA: import_jobs
-- Rastrea importaciones de archivos en segundo plano
-- =============================================

CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Información del trabajo
  client_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, uploading, processing, completed, failed
  
  -- Archivo ZIP
  zip_file_name TEXT,
  zip_file_size BIGINT,
  storage_path TEXT, -- Ruta en Supabase Storage
  
  -- Caso creado
  case_id UUID REFERENCES visa_cases(id) ON DELETE SET NULL,
  
  -- Progreso
  total_files INTEGER DEFAULT 0,
  processed_files INTEGER DEFAULT 0,
  successful_files INTEGER DEFAULT 0,
  failed_files INTEGER DEFAULT 0,
  current_file TEXT, -- Archivo siendo procesado actualmente
  
  -- Resultados
  results JSONB DEFAULT '[]'::jsonb, -- Array de resultados por archivo
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Usuario
  user_id UUID
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_user_id ON import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON import_jobs(created_at DESC);

-- RLS
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS "Allow read for authenticated" ON import_jobs;
CREATE POLICY "Allow read for authenticated" ON import_jobs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow all for service" ON import_jobs;
CREATE POLICY "Allow all for service" ON import_jobs
  FOR ALL TO service_role USING (true);

-- Comentarios
COMMENT ON TABLE import_jobs IS 'Trabajos de importación de archivos ZIP en segundo plano';
COMMENT ON COLUMN import_jobs.status IS 'pending=esperando, uploading=subiendo, processing=procesando, completed=listo, failed=error';
