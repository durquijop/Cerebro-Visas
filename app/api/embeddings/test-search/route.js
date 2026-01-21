import { createClient } from '@supabase/supabase-js'
import { generateEmbedding } from '@/lib/embeddings'
import { NextResponse } from 'next/server'

// Usar service role para bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    // 1. Contar embeddings con service role (bypasses RLS)
    const { count: embCount, error: countError } = await supabaseAdmin
      .from('document_embeddings')
      .select('*', { count: 'exact', head: true })

    // 2. Ver samples
    const { data: samples, error: samplesError } = await supabaseAdmin
      .from('document_embeddings')
      .select('id, content_chunk, metadata, embedding')
      .limit(3)

    // 3. Probar búsqueda con query simple
    const testQuery = "RFE evidencia USCIS"
    const testEmbedding = await generateEmbedding(testQuery)
    
    const { data: searchResults, error: searchError } = await supabaseAdmin
      .rpc('search_similar_documents', {
        query_embedding: JSON.stringify(testEmbedding),
        match_threshold: 0.2,
        match_count: 5
      })

    return NextResponse.json({
      embeddings_count: embCount,
      count_error: countError?.message,
      samples_error: samplesError?.message,
      samples: samples?.map(s => ({
        id: s.id,
        content_preview: s.content_chunk?.substring(0, 200),
        metadata: s.metadata,
        has_embedding: s.embedding ? true : false,
        embedding_type: typeof s.embedding,
        embedding_preview: s.embedding ? (Array.isArray(s.embedding) ? `Array[${s.embedding.length}]` : String(s.embedding).substring(0, 50)) : null
      })),
      test_query: testQuery,
      embedding_dimensions: testEmbedding?.length,
      search_results_count: searchResults?.length || 0,
      search_error: searchError?.message,
      search_results: searchResults?.map(r => ({
        similarity: r.similarity,
        content_preview: r.content_chunk?.substring(0, 150)
      }))
    })
  } catch (error) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 })
  }
}
