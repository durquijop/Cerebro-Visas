import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extractText, normalizeText } from '@/lib/document-processor'
import { extractStructuredData, saveStructuredData } from '@/lib/case-miner'
import { generateDocumentEmbeddings } from '@/lib/embeddings'
import { v4 as uuidv4 } from 'uuid'

// Supabase Admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Extrae la fecha del documento del texto
 * Busca patrones comunes de fecha al inicio del documento
 */
function extractDocumentDate(text) {
  if (!text) return null
  
  // Tomar solo los primeros 1000 caracteres para buscar la fecha
  const header = text.substring(0, 1000)
  
  // Patrones de fecha comunes en documentos USCIS
  const patterns = [
    // December 22, 2025
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i,
    // 22 December 2025
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i,
    // 12/22/2025 or 12-22-2025
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/,
    // 2025-12-22
    /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/
  ]
  
  const monthMap = {
    'january': '01', 'february': '02', 'march': '03', 'april': '04',
    'may': '05', 'june': '06', 'july': '07', 'august': '08',
    'september': '09', 'october': '10', 'november': '11', 'december': '12'
  }
  
  for (const pattern of patterns) {
    const match = header.match(pattern)
    if (match) {
      try {
        let year, month, day
        
        if (pattern === patterns[0]) {
          // December 22, 2025
          month = monthMap[match[1].toLowerCase()]
          day = match[2].padStart(2, '0')
          year = match[3]
        } else if (pattern === patterns[1]) {
          // 22 December 2025
          day = match[1].padStart(2, '0')
          month = monthMap[match[2].toLowerCase()]
          year = match[3]
        } else if (pattern === patterns[2]) {
          // 12/22/2025
          month = match[1].padStart(2, '0')
          day = match[2].padStart(2, '0')
          year = match[3]
        } else if (pattern === patterns[3]) {
          // 2025-12-22
          year = match[1]
          month = match[2].padStart(2, '0')
          day = match[3].padStart(2, '0')
        }
        
        if (year && month && day) {
          const dateStr = `${year}-${month}-${day}`
          // Validar que sea una fecha válida
          const date = new Date(dateStr)
          if (!isNaN(date.getTime())) {
            return dateStr
          }
        }
      } catch (e) {
        console.error('Error parsing date:', e)
      }
    }
  }
  
  return null
}

// Tamaño máximo de archivo: 20MB
const MAX_FILE_SIZE = 20 * 1024 * 1024

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const caseId = formData.get('case_id')
    const docType = formData.get('doc_type') || 'RFE'
    const userId = formData.get('user_id')
    const processWithAI = formData.get('processWithAI') === 'true'

    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó archivo' },
        { status: 400 }
      )
    }

    // Validar tamaño de archivo
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Archivo demasiado grande. Máximo permitido: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      )
    }

    // Validar tipo de archivo
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
    if (!validTypes.includes(file.type) && !file.name.endsWith('.pdf') && !file.name.endsWith('.docx')) {
      return NextResponse.json(
        { error: 'Tipo de archivo no soportado. Use PDF, DOCX o TXT.' },
        { status: 400 }
      )
    }

    console.log(`📁 Procesando archivo: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`)

    // Convertir archivo a buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generar nombre único para el archivo
    const fileId = uuidv4()
    const fileExt = file.name.split('.').pop()
    const storagePath = `${caseId || 'uncategorized'}/${fileId}.${fileExt}`

    // 1. Subir archivo a Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: '3600'
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { error: `Error al subir archivo: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // 2. Extraer texto del documento
    const extractionResult = await extractText(buffer, file.name)
    let textContent = ''
    let extractionSuccess = false

    if (extractionResult.success) {
      textContent = normalizeText(extractionResult.text)
      extractionSuccess = true
    }

    // 2.5 Extraer fecha del documento del texto
    let documentDate = null
    if (textContent && textContent.length > 20) {
      documentDate = extractDocumentDate(textContent)
      if (documentDate) {
        console.log(`📅 Fecha del documento detectada: ${documentDate}`)
      }
    }

    // 3. Crear registro en la base de datos
    const documentRecord = {
      id: fileId,
      name: file.name,
      doc_type: docType,
      case_id: caseId || null,
      storage_path: storagePath,
      text_content: textContent.substring(0, 50000), // Limitar a 50k caracteres
      created_by: userId || null,
      document_date: documentDate
    }

    const { data: document, error: dbError } = await supabaseAdmin
      .from('documents')
      .insert(documentRecord)
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: `Error al guardar documento: ${dbError.message}` },
        { status: 500 }
      )
    }

    // 4. Procesar con IA si se solicitó y hay texto (EXTRACCIÓN ESTRUCTURADA)
    let aiAnalysis = null
    let structuredData = null
    let embeddingsGenerated = 0
    
    // Para archivos grandes (>5MB), limitar el procesamiento
    const isLargeFile = file.size > 5 * 1024 * 1024
    const maxTextForAI = isLargeFile ? 30000 : 50000 // Limitar texto para IA
    const textForProcessing = textContent.substring(0, maxTextForAI)
    
    console.log(`📋 processWithAI: ${processWithAI}, textContent length: ${textContent?.length || 0}, isLargeFile: ${isLargeFile}`)
    
    // Case Miner solo si se solicita y el archivo no es muy grande
    if (processWithAI && textForProcessing && textForProcessing.length > 100) {
      console.log('✅ Condiciones cumplidas, procesando con Case Miner...')
      try {
        console.log('🔬 Iniciando extracción estructurada con Case Miner...')
        
        // Usar el Case Miner para extracción estructurada
        const extractionResult = await extractStructuredData(textForProcessing, docType)
        
        if (extractionResult.success) {
          structuredData = extractionResult.data
          aiAnalysis = structuredData
          
          // Guardar datos estructurados (issues, requests, metadata)
          await saveStructuredData(supabaseAdmin, fileId, structuredData)
          
          console.log(`✅ Extracción estructurada completada:`)
          console.log(`   - Issues encontrados: ${structuredData.issues?.length || 0}`)
          console.log(`   - Requests de USCIS: ${structuredData.requests?.length || 0}`)
          console.log(`   - Prongs afectados: P1=${structuredData.summary?.prongs_affected?.P1}, P2=${structuredData.summary?.prongs_affected?.P2}, P3=${structuredData.summary?.prongs_affected?.P3}`)
        } else {
          console.error('❌ Error en extracción estructurada:', extractionResult.error)
        }
      } catch (aiError) {
        console.error('AI analysis error:', aiError)
        // No falla el upload si el AI falla
      }
    }
    
    // Generar embeddings solo si no es un archivo muy grande (para ahorrar memoria)
    // Para archivos grandes, se pueden generar después
    if (textForProcessing && textForProcessing.length > 100 && !isLargeFile) {
      console.log('🧠 Iniciando generación de embeddings...')
      try {
        const docForEmbedding = {
          id: fileId,
          text_content: textForProcessing,
          doc_type: docType,
          original_name: file.name
        }
        
        console.log(`   Documento ID: ${fileId}`)
        console.log(`   Texto: ${textForProcessing.length} caracteres`)
        
        const embResult = await generateDocumentEmbeddings(supabaseAdmin, docForEmbedding, false)
        
        console.log(`   Resultado embeddings:`, embResult)
        
        if (embResult.success) {
          embeddingsGenerated = embResult.chunks || 0
          console.log(`✅ Embeddings generados: ${embeddingsGenerated} chunks`)
        } else {
          console.log(`⚠️ No se generaron embeddings: ${embResult.reason || embResult.error}`)
        }
      } catch (embError) {
        console.error('❌ Error generando embeddings:', embError.message)
        console.error(embError.stack)
      }
    } else {
      console.log(`⚠️ Sin texto suficiente para embeddings: ${textContent?.length || 0} caracteres`)
    }

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        name: document.name,
        doc_type: document.doc_type,
        storage_path: document.storage_path,
        created_at: document.created_at,
        document_date: documentDate
      },
      extraction: {
        success: extractionSuccess,
        textLength: textContent.length,
        preview: textContent.substring(0, 500) + (textContent.length > 500 ? '...' : ''),
        fullText: textContent // Texto completo
      },
      structuredData: structuredData ? {
        document_info: structuredData.document_info,
        issues_count: structuredData.issues?.length || 0,
        requests_count: structuredData.requests?.length || 0,
        prongs_affected: structuredData.summary?.prongs_affected,
        overall_severity: structuredData.summary?.overall_severity,
        executive_summary: structuredData.summary?.executive_summary
      } : null,
      embeddings: {
        generated: embeddingsGenerated > 0,
        chunks: embeddingsGenerated
      },
      aiAnalysis
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
