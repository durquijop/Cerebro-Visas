import { createClient } from '@/lib/supabase/server'
import { generateDocumentEmbeddings } from '@/lib/embeddings'
import { NextResponse } from 'next/server'

// Endpoint para generar embeddings de todos los documentos existentes
export async function POST(request) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticación
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const results = {
      documents: { processed: 0, success: 0, failed: 0 },
      caseDocuments: { processed: 0, success: 0, failed: 0 }
    }

    // 1. Procesar documentos de la tabla 'documents'
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id, name, doc_type, text_content')
      .not('text_content', 'is', null)

    if (docsError) {
      console.error('Error fetching documents:', docsError)
    } else if (documents) {
      for (const doc of documents) {
        results.documents.processed++
        const result = await generateDocumentEmbeddings(supabase, doc, false)
        if (result.success) {
          results.documents.success++
        } else {
          results.documents.failed++
        }
      }
    }

    // 2. Procesar documentos de la tabla 'case_documents'
    const { data: caseDocuments, error: caseDocsError } = await supabase
      .from('case_documents')
      .select('id, original_name, doc_type, text_content')
      .not('text_content', 'is', null)

    if (caseDocsError) {
      console.error('Error fetching case_documents:', caseDocsError)
    } else if (caseDocuments) {
      for (const doc of caseDocuments) {
        results.caseDocuments.processed++
        // Adaptar campos para que sean consistentes
        const adaptedDoc = {
          ...doc,
          name: doc.original_name
        }
        const result = await generateDocumentEmbeddings(supabase, adaptedDoc, true)
        if (result.success) {
          results.caseDocuments.success++
        } else {
          results.caseDocuments.failed++
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Embeddings generados',
      results
    })

  } catch (error) {
    console.error('Error in generate-all:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

// GET para verificar estado
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Contar embeddings existentes
    const { count: embeddingsCount } = await supabase
      .from('document_embeddings')
      .select('*', { count: 'exact', head: true })

    // Contar documentos totales
    const { count: docsCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .not('text_content', 'is', null)

    const { count: caseDocsCount } = await supabase
      .from('case_documents')
      .select('*', { count: 'exact', head: true })
      .not('text_content', 'is', null)

    return NextResponse.json({
      embeddings_count: embeddingsCount || 0,
      documents_with_text: docsCount || 0,
      case_documents_with_text: caseDocsCount || 0,
      total_documents: (docsCount || 0) + (caseDocsCount || 0)
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
