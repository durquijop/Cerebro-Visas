import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function extractTextFromPDF(buffer) {
  try {
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)
    return { success: true, text: data.text, numPages: data.numpages }
  } catch (error) {
    return { success: false, error: error.message, text: '' }
  }
}

async function extractTextFromDOCX(buffer) {
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return { success: true, text: result.value }
  } catch (error) {
    return { success: false, error: error.message, text: '' }
  }
}

async function extractText(buffer, filename) {
  const ext = filename.toLowerCase().split('.').pop()
  switch (ext) {
    case 'pdf': return await extractTextFromPDF(buffer)
    case 'docx': return await extractTextFromDOCX(buffer)
    case 'txt': return { success: true, text: buffer.toString('utf-8') }
    default: return { success: false, error: 'Formato no soportado', text: '' }
  }
}

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

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const fileId = uuidv4()
    const fileExt = file.name.split('.').pop().toLowerCase()
    const storagePath = `casos/${caseId}/${fileId}.${fileExt}`

    // Subir a storage
    await supabaseAdmin.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: '3600'
      })

    // Extraer texto
    const extraction = await extractText(buffer, file.name)
    const cleanText = extraction.text?.replace(/\s+/g, ' ').trim() || ''
    const wordCount = cleanText.split(/\s+/).filter(w => w.length > 0).length

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
        extraction_success: extraction.success
      })
      .select()
      .single()

    if (dbError) throw dbError

    return NextResponse.json({ success: true, document })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
