import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { extractText, normalizeText } from '@/lib/document-processor'

// Supabase Admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Document Canonicalizer - Convierte documento a formato estándar
 */
function canonicalizeDocument(filename, docType, extractedText, extractionResult) {
  const cleanText = normalizeText(extractedText || '')
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
      extraction_method: extractionResult.method || null,
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

    console.log(`📤 Ingesta: Procesando ${file.name} (tipo: ${docType})`)

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

    // 2. Extraer texto del documento usando el procesador mejorado
    console.log('🔍 Extrayendo texto del documento...')
    const extractionResult = await extractText(buffer, file.name)
    
    console.log(`📊 Resultado extracción: success=${extractionResult.success}, método=${extractionResult.method || 'N/A'}`)
    
    if (!extractionResult.success && (!extractionResult.text || extractionResult.text.length < 10)) {
      return NextResponse.json({
        error: `Error al extraer texto: ${extractionResult.error}`,
        suggestion: extractionResult.suggestion || 'Intente con un archivo diferente',
        success: false
      }, { status: 400 })
    }

    // 3. Canonicalizar documento
    const canonical = canonicalizeDocument(
      file.name,
      docType,
      extractionResult.text,
      extractionResult
    )

    console.log(`📝 Documento canonicalizado: ${canonical.metadata.word_count} palabras`)

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
      extraction_success: extractionResult.success,
      extraction_method: extractionResult.method || null
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
        canonical,
        extraction: {
          success: extractionResult.success,
          method: extractionResult.method,
          wordCount: canonical.metadata.word_count
        }
      })
    }

    console.log(`✅ Documento guardado exitosamente: ${fileId}`)

    return NextResponse.json({
      success: true,
      document,
      canonical,
      extraction: {
        success: extractionResult.success,
        method: extractionResult.method,
        wordCount: canonical.metadata.word_count,
        charCount: canonical.metadata.char_count,
        pageCount: canonical.metadata.page_count
      }
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
