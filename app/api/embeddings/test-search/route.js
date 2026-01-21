import { createClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/embeddings'
import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const supabase = await createClient()
    
    // 1. Contar embeddings
    const { count: embCount } = await supabase
      .from('document_embeddings')
      .select('*', { count: 'exact', head: true })

    // 2. Ver samples
    const { data: samples } = await supabase
      .from('document_embeddings')
      .select('id, content_chunk, metadata')
      .limit(3)

    // 3. Verificar que tienen vector
    const { data: withVector, error: vecError } = await supabase
      .from('document_embeddings')
      .select('id, embedding')
      .limit(1)

    // 4. Probar búsqueda con query simple
    const testQuery = "RFE evidencia USCIS"
    const testEmbedding = await generateEmbedding(testQuery)
    
    const { data: searchResults, error: searchError } = await supabase
      .rpc('search_similar_documents', {
        query_embedding: JSON.stringify(testEmbedding),
        match_threshold: 0.2,
        match_count: 5
      })

    return NextResponse.json({
      embeddings_count: embCount,
      samples: samples?.map(s => ({
        id: s.id,
        content_preview: s.content_chunk?.substring(0, 200),
        metadata: s.metadata
      })),
      has_vector: withVector?.[0]?.embedding ? 'YES' : 'NO',
      vector_error: vecError?.message,
      test_query: testQuery,
      search_results_count: searchResults?.length || 0,
      search_error: searchError?.message,
      search_results: searchResults?.map(r => ({
        similarity: r.similarity,
        content_preview: r.content_chunk?.substring(0, 150)
      }))
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
