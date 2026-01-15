import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { extractText, normalizeText } from '@/lib/document-processor'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const caseId = formData.get('case_id')
    const docType = formData.get('doc_type') || 'other'

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }

    if (!caseId) {
      return NextResponse.json({ error: 'case_id es requerido' }, { status: 400 })
    }

    console.log(`📤 Subiendo archivo: ${file.name} para caso ${caseId}`)

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const fileId = uuidv4()
    const fileExt = file.name.split('.').pop().toLowerCase()
    const storagePath = `casos/${caseId}/${fileId}.${fileExt}`

    // Subir a storage
    const { error: storageError } = await supabaseAdmin.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: '3600'
      })

    if (storageError) {
      console.error('Storage error:', storageError)
      // Continuar aunque falle el storage - el texto aún se puede procesar
    }

    // Extraer texto usando el procesador mejorado
    console.log('🔍 Extrayendo texto del documento...')
    const extraction = await extractText(buffer, file.name)
    
    // Normalizar el texto extraído
    const cleanText = normalizeText(extraction.text || '')
    const wordCount = cleanText.split(/\s+/).filter(w => w.length > 0).length

    console.log(`📊 Extracción: success=${extraction.success}, palabras=${wordCount}, método=${extraction.method || 'N/A'}`)

    // Guardar en BD
    const { data: document, error: dbError } = await supabaseAdmin
      .from('case_documents')
      .insert({
        id: fileId,
        case_id: caseId,
        original_name: file.name,
        doc_type: docType,
        file_type: fileExt,
        storage_path: storagePath,
        text_content: cleanText.substring(0, 100000),
        char_count: cleanText.length,
        word_count: wordCount,
        page_count: extraction.numPages || null,
        extraction_success: extraction.success,
        extraction_method: extraction.method || null,
        extraction_error: extraction.error || null
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      throw dbError
    }

    console.log(`✅ Documento guardado: ${fileId}`)

    return NextResponse.json({ 
      success: true, 
      document,
      extraction: {
        success: extraction.success,
        wordCount,
        charCount: cleanText.length,
        pageCount: extraction.numPages,
        method: extraction.method,
        error: extraction.error,
        suggestion: extraction.suggestion
      }
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ 
      error: error.message,
      details: 'Error al procesar el documento'
    }, { status: 500 })
  }
}
