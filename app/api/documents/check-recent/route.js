import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * GET /api/documents/check-recent
 * Verifica si un documento se procesó recientemente (últimos 5 minutos)
 * Parámetros: filename (nombre del archivo)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const filename = searchParams.get('filename')
    
    if (!filename) {
      return NextResponse.json({ error: 'Filename requerido' }, { status: 400 })
    }
    
    // Buscar documento reciente con ese nombre (últimos 30 minutos)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    
    const { data: documents, error } = await supabase
      .from('documents')
      .select(`
        id,
        name,
        doc_type,
        visa_category,
        text_content,
        structured_data,
        created_at,
        analyzed_at
      `)
      .ilike('name', `%${filename.replace(/[%_]/g, '')}%`)
      .gte('created_at', fiveMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1)
    
    if (error) {
      console.error('Error buscando documento:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    if (!documents || documents.length === 0) {
      return NextResponse.json({ 
        found: false,
        message: 'Documento no encontrado en los últimos 5 minutos'
      })
    }
    
    const doc = documents[0]
    const textContent = doc.text_content || ''
    const structuredData = typeof doc.structured_data === 'string' 
      ? JSON.parse(doc.structured_data) 
      : doc.structured_data
    
    // Contar embeddings
    const { count: embeddingsCount } = await supabase
      .from('document_embeddings')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', doc.id)
    
    // Determinar si el procesamiento fue exitoso
    const processingSuccess = textContent.length > 100
    const aiAnalysisSuccess = structuredData && (structuredData.issues?.length > 0 || structuredData.requests?.length > 0)
    
    return NextResponse.json({
      found: true,
      processed: processingSuccess,
      document: {
        id: doc.id,
        name: doc.name,
        doc_type: doc.doc_type,
        visa_category: doc.visa_category || structuredData?.document_info?.visa_category,
        created_at: doc.created_at
      },
      extraction: {
        success: processingSuccess,
        textLength: textContent.length,
        preview: textContent.substring(0, 500) + (textContent.length > 500 ? '...' : ''),
        method: textContent.length > 0 ? 'ocr' : 'none'
      },
      structuredData: structuredData ? {
        issues_count: structuredData.issues?.length || 0,
        requests_count: structuredData.requests?.length || 0,
        document_info: structuredData.document_info,
        issues: structuredData.issues?.slice(0, 5), // Primeros 5 issues
        requests: structuredData.requests?.slice(0, 5) // Primeros 5 requests
      } : null,
      embeddings: {
        generated: embeddingsCount > 0,
        chunks: embeddingsCount || 0
      },
      aiAnalysis: aiAnalysisSuccess ? {
        completed: true,
        issues_count: structuredData?.issues?.length || 0,
        requests_count: structuredData?.requests?.length || 0
      } : null
    })
    
  } catch (error) {
    console.error('Error en check-recent:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
