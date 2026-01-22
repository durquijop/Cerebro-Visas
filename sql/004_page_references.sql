-- =====================================================
-- MIGRACIÓN: Agregar page_ref a document_embeddings
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- Agregar columnas de referencia de página
ALTER TABLE document_embeddings 
ADD COLUMN IF NOT EXISTS page_start INTEGER,
ADD COLUMN IF NOT EXISTS page_end INTEGER,
ADD COLUMN IF NOT EXISTS page_ref VARCHAR(50);

-- Agregar columna de párrafo (opcional)
ALTER TABLE document_embeddings 
ADD COLUMN IF NOT EXISTS paragraph_index INTEGER;

-- Actualizar la función de búsqueda para incluir page_ref
CREATE OR REPLACE FUNCTION search_similar_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  case_document_id uuid,
  content_chunk text,
  page_ref varchar(50),
  page_start integer,
  page_end integer,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.id,
    de.document_id,
    de.case_document_id,
    de.content_chunk,
    de.page_ref,
    de.page_start,
    de.page_end,
    de.metadata,
    1 - (de.embedding <=> query_embedding) AS similarity
  FROM document_embeddings de
  WHERE 1 - (de.embedding <=> query_embedding) > match_threshold
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Índice para búsquedas por página
CREATE INDEX IF NOT EXISTS idx_embeddings_page ON document_embeddings(page_start, page_end);

COMMENT ON COLUMN document_embeddings.page_start IS 'Página de inicio del chunk';
COMMENT ON COLUMN document_embeddings.page_end IS 'Página de fin del chunk';
COMMENT ON COLUMN document_embeddings.page_ref IS 'Referencia legible (ej: "Pág. 3-5")';
