import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

// Supabase Admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Extrae texto de un PDF usando pdf-parse
 */
async function extractTextFromPDF(buffer) {
  try {
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)
    return {
      success: true,
      text: data.text,
      numPages: data.numpages,
      info: data.info
    }
  } catch (error) {
    console.error('Error extracting PDF:', error)
    return { success: false, error: error.message, text: '' }
  }
}

/**
 * Extrae texto de un DOCX usando mammoth
 */
async function extractTextFromDOCX(buffer) {
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return {
      success: true,
      text: result.value,
      messages: result.messages
    }
  } catch (error) {
    console.error('Error extracting DOCX:', error)
    return { success: false, error: error.message, text: '' }
  }
}

/**
 * Extrae texto según el tipo de archivo
 */
async function extractText(buffer, filename) {
  const extension = filename.toLowerCase().split('.').pop()
  
  switch (extension) {
    case 'pdf':
      return await extractTextFromPDF(buffer)
    case 'docx':
      return await extractTextFromDOCX(buffer)
    case 'doc':
      return { success: false, error: 'Formato .doc no soportado. Convierta a .docx o .pdf', text: '' }
    case 'txt':
      return { success: true, text: buffer.toString('utf-8') }
    default:
      return { success: false, error: `Formato .${extension} no soportado`, text: '' }
  }
}

/**
 * Limpia y normaliza el texto
 */
function normalizeText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Document Canonicalizer - Convierte documento a formato estándar
 */
function canonicalizeDocument(filename, docType, extractedText, extractionResult) {
  const cleanText = normalizeText(extractedText)
  const words = cleanText.split(/\s+/).filter(w => w.length > 0)
  
  return {
    // Identificador único
    id: uuidv4(),
    
    // Metadatos del documento
    metadata: {
      original_filename: filename,
      doc_type: docType,
      file_type: filename.split('.').pop().toLowerCase(),
      extracted_at: new Date().toISOString(),
      page_count: extractionResult.numPages || null,
      char_count: cleanText.length,
      word_count: words.length,
      extraction_success: extractionResult.success,
      extraction_error: extractionResult.error || null
    },
    
    // Texto limpio normalizado
    text_clean: cleanText,
    
    // Texto original sin modificar
    text_raw: extractedText,
    
    // Secciones detectadas (básico)
    sections: detectSections(cleanText),
    
    // Hash para detectar duplicados
    content_hash: simpleHash(cleanText)
  }
}

/**
 * Detecta secciones básicas en el documento
 */
function detectSections(text) {
  const sections = []
  const patterns = [
    { name: 'USCIS Header', pattern: /U\.?S\.?\s*Citizenship\s*and\s*Immigration\s*Services/i },
    { name: 'Receipt Number', pattern: /Receipt\s*Number[:\s]*([A-Z]{3}\d{10})/i },
    { name: 'Re/Subject', pattern: /^Re:|^Subject:/im },
    { name: 'Prong 1 Discussion', pattern: /prong\s*(one|1|i)\b|substantial\s*merit|national\s*importance/i },
    { name: 'Prong 2 Discussion', pattern: /prong\s*(two|2|ii)\b|well\s*positioned/i },
    { name: 'Prong 3 Discussion', pattern: /prong\s*(three|3|iii)\b|balance|waiver/i },
    { name: 'Evidence Request', pattern: /evidence|documentation|submit|provide/i },
    { name: 'Deadline', pattern: /\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|within\s*\d+\s*days/i }
  ]
  
  patterns.forEach(({ name, pattern }) => {
    const match = text.match(pattern)
    if (match) {
      sections.push({
        name,
        found: true,
        match: match[0].substring(0, 100),
        position: match.index
      })
    }
  })
  
  return sections.sort((a, b) => a.position - b.position)
}

/**
 * Hash simple para detectar duplicados
 */
function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(16)
}

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const docType = formData.get('doc_type') || 'Other'

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }

    // Convertir archivo a buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generar ID único
    const fileId = uuidv4()
    const fileExt = file.name.split('.').pop().toLowerCase()
    const storagePath = `ingesta/${fileId}.${fileExt}`

    // 1. Subir archivo a Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: '3600'
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      // Continuar aunque falle el storage, igual procesamos el texto
    }

    // 2. Extraer texto del documento
    const extractionResult = await extractText(buffer, file.name)
    
    if (!extractionResult.success && !extractionResult.text) {
      return NextResponse.json(
        { error: `Error al extraer texto: ${extractionResult.error}` },
        { status: 400 }
      )
    }

    // 3. Canonicalizar documento
    const canonical = canonicalizeDocument(
      file.name,
      docType,
      extractionResult.text,
      extractionResult
    )

    // 4. Guardar en base de datos
    const documentRecord = {
      id: fileId,
      original_name: file.name,
      doc_type: docType,
      file_type: fileExt,
      storage_path: storagePath,
      text_content: canonical.text_clean.substring(0, 100000), // Limitar a 100k chars
      page_count: canonical.metadata.page_count,
      char_count: canonical.metadata.char_count,
      word_count: canonical.metadata.word_count,
      content_hash: canonical.content_hash,
      sections: canonical.sections,
      extraction_success: extractionResult.success
    }

    const { data: document, error: dbError } = await supabaseAdmin
      .from('ingesta_documents')
      .insert(documentRecord)
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      // Retornar el canonical aunque falle la BD
      return NextResponse.json({
        success: true,
        warning: 'Documento procesado pero no guardado en BD: ' + dbError.message,
        document: { id: fileId, original_name: file.name },
        canonical
      })
    }

    return NextResponse.json({
      success: true,
      document,
      canonical
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
