import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { extractText, normalizeText } from '@/lib/document-processor'
import { generateDocumentEmbeddings } from '@/lib/embeddings'
import { extractStructuredData, saveStructuredData } from '@/lib/case-miner'
import { v4 as uuidv4 } from 'uuid'

// Cliente admin para operaciones
function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Tamaño máximo de archivo: 20MB
const MAX_FILE_SIZE = 20 * 1024 * 1024

/**
 * Extrae la fecha del documento del texto
 */
function extractDocumentDate(text) {
  if (!text) return null
  
  const header = text.substring(0, 1000)
  
  const patterns = [
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i,
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i,
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/,
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
          month = monthMap[match[1].toLowerCase()]
          day = match[2].padStart(2, '0')
          year = match[3]
        } else if (pattern === patterns[1]) {
          day = match[1].padStart(2, '0')
          month = monthMap[match[2].toLowerCase()]
          year = match[3]
        } else if (pattern === patterns[2]) {
          month = match[1].padStart(2, '0')
          day = match[2].padStart(2, '0')
          year = match[3]
        } else if (pattern === patterns[3]) {
          year = match[1]
          month = match[2].padStart(2, '0')
          day = match[3].padStart(2, '0')
        }
        
        if (year && month && day) {
          const dateStr = `${year}-${month}-${day}`
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

/**
 * Detecta tipo de documento por nombre de archivo
 */
function detectDocType(filename, defaultType) {
  const lowerName = filename.toLowerCase()
  
  if (lowerName.includes('rfe') || lowerName.includes('request for evidence')) {
    return 'RFE'
  }
  if (lowerName.includes('noid') || lowerName.includes('notice of intent to deny')) {
    return 'NOID'
  }
  if (lowerName.includes('denial') || lowerName.includes('denied') || lowerName.includes('denegacion')) {
    return 'Denial'
  }
  if (lowerName.includes('approval') || lowerName.includes('approved') || lowerName.includes('aprobado')) {
    return 'Approval'
  }
  
  return defaultType
}

export async function POST(request) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = getSupabaseAdmin()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const files = formData.getAll('files')
    const docType = formData.get('docType') || 'RFE'
    const generateEmbeddings = formData.get('generateEmbeddings') === 'true'
    const processWithAI = formData.get('processWithAI') !== 'false' // Por defecto true

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No se enviaron archivos' }, { status: 400 })
    }

    console.log(`📦 Bulk upload: Procesando ${files.length} archivos para usuario ${user.id}...`)
    console.log(`   Opciones: generateEmbeddings=${generateEmbeddings}, processWithAI=${processWithAI}`)

    const results = []
    const errors = []

    for (const file of files) {
      try {
        // Validar tamaño
        if (file.size > MAX_FILE_SIZE) {
          errors.push({ file: file.name, error: `Archivo muy grande (máx. ${MAX_FILE_SIZE / 1024 / 1024}MB)` })
          continue
        }

        // Detectar tipo automáticamente
        const detectedDocType = detectDocType(file.name, docType)
        const isLargeFile = file.size > 5 * 1024 * 1024
        
        console.log(`📄 Procesando: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB, tipo: ${detectedDocType})`)
        
        // 1. Leer el archivo
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // 2. Extraer texto CON información de páginas (incluye OCR para escaneados)
        const extractResult = await extractText(buffer, file.name)
        
        if (!extractResult.success || !extractResult.text || extractResult.text.length < 50) {
          errors.push({ file: file.name, error: extractResult.error || 'No se pudo extraer texto suficiente' })
          continue
        }

        const textContent = normalizeText(extractResult.text)
        const pageTexts = extractResult.pageTexts || null
        const numPages = extractResult.numPages || 0

        console.log(`   📖 Extraídos ${textContent.length} caracteres, ${numPages} páginas`)

        // 2.5 Extraer fecha del documento
        let documentDate = null
        if (textContent && textContent.length > 20) {
          documentDate = extractDocumentDate(textContent)
          if (documentDate) {
            console.log(`   📅 Fecha detectada: ${documentDate}`)
          }
        }

        // 3. Subir archivo a storage
        const fileId = uuidv4()
        const fileExt = file.name.split('.').pop().toLowerCase()
        const storagePath = `bulk/${user.id}/${fileId}.${fileExt}`

        const { error: uploadError } = await supabaseAdmin.storage
          .from('documents')
          .upload(storagePath, buffer, {
            contentType: file.type || 'application/octet-stream',
            cacheControl: '3600'
          })

        if (uploadError) {
          console.error('Storage error:', uploadError)
        }

        // 4. Guardar en base de datos
        const { data: docRecord, error: dbError } = await supabaseAdmin
          .from('documents')
          .insert({
            id: fileId,
            name: file.name,
            doc_type: detectedDocType,
            storage_path: storagePath,
            text_content: textContent.substring(0, 50000),
            created_by: user.id,
            document_date: documentDate
          })
          .select('id, name')
          .single()

        if (dbError) {
          console.error('DB Error:', dbError)
          errors.push({ file: file.name, error: dbError.message })
          continue
        }

        let embeddingsGenerated = 0
        let structuredData = null
        let issuesCount = 0
        let requestsCount = 0

        // 5. Procesar con IA (Case Miner) - igual que upload individual
        const RAG_DOCUMENT_TYPES = ['RFE', 'NOID', 'Denial']
        const shouldProcessWithAI = processWithAI && RAG_DOCUMENT_TYPES.includes(detectedDocType)
        const textForProcessing = isLargeFile ? textContent.substring(0, 30000) : textContent.substring(0, 50000)

        if (shouldProcessWithAI && textForProcessing.length > 100) {
          console.log(`   🔬 Procesando con Case Miner...`)
          try {
            const extractionResult = await extractStructuredData(textForProcessing, detectedDocType)
            
            if (extractionResult.success) {
              structuredData = extractionResult.data
              issuesCount = structuredData.issues?.length || 0
              requestsCount = structuredData.requests?.length || 0
              
              // Guardar datos estructurados
              await saveStructuredData(supabaseAdmin, fileId, structuredData)
              
              console.log(`   ✅ Issues: ${issuesCount}, Requests: ${requestsCount}`)
            }
          } catch (aiError) {
            console.error(`   ⚠️ Error en Case Miner:`, aiError.message)
          }
        }

        // 6. Generar embeddings
        const shouldGenerateEmbeddings = generateEmbeddings && 
                                          docRecord && 
                                          RAG_DOCUMENT_TYPES.includes(detectedDocType)
        
        const textForEmbeddings = isLargeFile ? textContent.substring(0, 30000) : textForProcessing

        if (shouldGenerateEmbeddings && textForEmbeddings.length > 100) {
          console.log(`   🧠 Generando embeddings...`)
          try {
            const embResult = await generateDocumentEmbeddings(
              supabaseAdmin,
              { 
                id: docRecord.id, 
                text_content: textForEmbeddings, 
                page_texts: pageTexts,
                name: file.name, 
                doc_type: detectedDocType 
              },
              false
            )
            if (embResult.success) {
              embeddingsGenerated = embResult.chunks || 0
              console.log(`   ✅ ${embeddingsGenerated} embeddings generados`)
            }
          } catch (embError) {
            console.error(`   ⚠️ Error en embeddings:`, embError.message)
          }
        }

        results.push({
          file: file.name,
          id: docRecord.id,
          textLength: textContent.length,
          numPages: numPages,
          hasPageRefs: !!pageTexts,
          embeddingsGenerated,
          embeddingsSkipped: generateEmbeddings && !shouldGenerateEmbeddings,
          docType: detectedDocType,
          docTypeDetected: detectedDocType !== docType,
          documentDate,
          issuesCount,
          requestsCount,
          processedWithAI: shouldProcessWithAI && structuredData !== null,
          success: true
        })

        console.log(`✅ ${file.name}: completado`)

      } catch (fileError) {
        console.error(`Error procesando ${file.name}:`, fileError)
        errors.push({ file: file.name, error: fileError.message })
      }
    }

    // Calcular totales
    const totalEmbeddings = results.reduce((sum, r) => sum + (r.embeddingsGenerated || 0), 0)
    const totalIssues = results.reduce((sum, r) => sum + (r.issuesCount || 0), 0)
    const totalRequests = results.reduce((sum, r) => sum + (r.requestsCount || 0), 0)

    return NextResponse.json({
      success: true,
      processed: results.length,
      failed: errors.length,
      totals: {
        embeddings: totalEmbeddings,
        issues: totalIssues,
        requests: totalRequests
      },
      results,
      errors
    })

  } catch (error) {
    console.error('Bulk upload error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
