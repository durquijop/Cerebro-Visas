-- Migración: Agregar campos de estrategia RFE a visa_cases
-- Ejecutar en Supabase SQL Editor

-- Agregar columna para almacenar la estrategia RFE generada
ALTER TABLE visa_cases 
ADD COLUMN IF NOT EXISTS rfe_strategy JSONB;

-- Agregar columna para timestamp de cuando se generó la estrategia
ALTER TABLE visa_cases 
ADD COLUMN IF NOT EXISTS strategy_generated_at TIMESTAMPTZ;

-- Crear índice para búsquedas en estrategia
CREATE INDEX IF NOT EXISTS idx_visa_cases_strategy_generated 
ON visa_cases(strategy_generated_at) 
WHERE strategy_generated_at IS NOT NULL;

-- Comentarios descriptivos
COMMENT ON COLUMN visa_cases.rfe_strategy IS 'Estrategia de respuesta RFE generada por IA en formato JSON';
COMMENT ON COLUMN visa_cases.strategy_generated_at IS 'Fecha y hora de generación de la estrategia';
