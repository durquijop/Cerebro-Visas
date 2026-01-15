import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extractDocumentInfo } from '@/lib/llm-client'

// Supabase Admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { document_id, text } = await request.json()

    let textToAnalyze = text

    // Si se proporciona document_id, obtener el texto de la BD
    if (document_id && !text) {
      const { data: document, error } = await supabaseAdmin
        .from('documents')
        .select('text_content, doc_type')
        .eq('id', document_id)
        .single()

      if (error || !document) {
        return NextResponse.json(
          { error: 'Documento no encontrado' },
          { status: 404 }
        )
      }

      textToAnalyze = document.text_content
    }

    if (!textToAnalyze || textToAnalyze.length < 100) {
      return NextResponse.json(
        { error: 'Texto insuficiente para análisis' },
        { status: 400 }
      )
    }

    // Analizar con LLM
    const result = await extractDocumentInfo(textToAnalyze)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Error en el análisis' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      analysis: result.data
    })

  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
