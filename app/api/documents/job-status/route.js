import { NextResponse } from 'next/server'

// Importar el Map de jobs del módulo de upload-async
// Como no podemos compartir el Map entre archivos en serverless,
// usaremos Supabase para almacenar el estado de los jobs

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * GET /api/documents/job-status
 * Verifica el estado de un job de procesamiento
 * También puede verificar por nombre de archivo si no hay jobId
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('jobId')
  const filename = searchParams.get('filename')

  // Si hay jobId, redirigir al endpoint de upload-async
  if (jobId) {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/documents/upload-async?jobId=${jobId}`,
        { cache: 'no-store' }
      )
      const data = await response.json()
      return NextResponse.json(data)
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // Si hay filename, buscar documento reciente
  if (filename) {
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
      .gte('created_at', thirtyMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({ 
        found: false,
        status: 'not_found',
        message: 'Documento no encontrado'
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

    const isProcessed = textContent.length > 100

    return NextResponse.json({
      found: true,
      status: isProcessed ? 'completed' : 'processing',
      progress: isProcessed ? 100 : 50,
      result: {
        documentId: doc.id,
        documentName: doc.name,
        docType: doc.doc_type,
        visaCategory: doc.visa_category || structuredData?.document_info?.visa_category,
        textLength: textContent.length,
        extractionSuccess: isProcessed,
        issuesCount: structuredData?.issues?.length || 0,
        requestsCount: structuredData?.requests?.length || 0,
        embeddingsCount: embeddingsCount || 0,
        preview: textContent.substring(0, 500)
      }
    })
  }

  return NextResponse.json({ 
    error: 'Se requiere jobId o filename' 
  }, { status: 400 })
}
