import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { extractText, normalizeText } from '@/lib/document-processor'
import { extractStructuredData, saveStructuredData } from '@/lib/case-miner'
import { generateDocumentEmbeddings } from '@/lib/embeddings'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Almacén temporal de trabajos en memoria (en producción usar Redis)
const jobs = new Map()

/**
 * POST /api/documents/upload-async
 * Sube un documento y lo procesa en segundo plano
 * Crea el registro en DB inmediatamente con status 'pending'
 * Devuelve inmediatamente un jobId para hacer polling
 */
export async function POST(request) {
  const jobId = uuidv4()
  const docId = uuidv4()
  
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const docType = formData.get('docType') || 'RFE'
    const processWithAI = formData.get('processWithAI') !== 'false'
    const caseId = formData.get('caseId')

    if (!file) {
      return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
    }

    const filename = file.name

    // Leer el archivo
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 1. Crear registro en DB INMEDIATAMENTE con status 'pending'
    const fileExt = filename.split('.').pop()
    const storagePath = `documents/${docId}.${fileExt}`

    const { data: docRecord, error: dbError } = await supabaseAdmin
      .from('documents')
      .insert({
        id: docId,
        name: filename,
        doc_type: docType,
        storage_path: storagePath,
        case_id: caseId && caseId !== 'none' ? caseId : null,
        extraction_status: 'pending',
        text_content: ''
      })
      .select()
      .single()

    if (dbError) {
      console.error('Error creando documento:', dbError.message)
      return NextResponse.json({ error: `Error creando documento: ${dbError.message}` }, { status: 500 })
    }

    console.log(`📄 Documento creado: ${docId} (${filename}) - Status: pending`)

    // 2. Inicializar estado del trabajo
    jobs.set(jobId, {
      status: 'pending',
      progress: 5,
      filename,
      startedAt: new Date().toISOString(),
      documentId: docId,
      error: null,
      message: 'Documento registrado. Iniciando procesamiento...'
    })

    // 3. Iniciar procesamiento en segundo plano (no await)
    processDocumentAsync(jobId, docId, buffer, filename, storagePath, docType, processWithAI)
      .catch(err => {
        console.error(`Job ${jobId} failed:`, err)
        const job = jobs.get(jobId)
        if (job) {
          jobs.set(jobId, { ...job, status: 'failed', error: err.message })
        }
        // Marcar documento como fallido en DB
        supabaseAdmin
          .from('documents')
          .update({ extraction_status: 'failed' })
          .eq('id', docId)
          .then(() => {})
      })

    // Devolver inmediatamente el jobId Y documentId
    return NextResponse.json({
      success: true,
      jobId,
      documentId: docId,
      message: 'Documento registrado. Procesamiento iniciado.',
      pollUrl: `/api/documents/upload-async?jobId=${jobId}`
    })

  } catch (error) {
    console.error('Error iniciando upload:', error)
    jobs.set(jobId, { status: 'failed', error: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Procesa el documento en segundo plano
 * El registro ya existe en DB con status 'pending'
 */
async function processDocumentAsync(jobId, docId, buffer, filename, storagePath, docType, processWithAI) {
  const updateJob = (updates) => {
    const current = jobs.get(jobId) || {}
    jobs.set(jobId, { ...current, ...updates })
  }

  // Helper para actualizar status en DB
  const updateDocStatus = async (status, extraFields = {}) => {
    await supabaseAdmin
      .from('documents')
      .update({ extraction_status: status, ...extraFields })
      .eq('id', docId)
  }

  try {
    console.log(`\n📤 Job ${jobId}: Iniciando procesamiento de ${filename}`)
    
    // 1. Extraer texto
    updateJob({ status: 'extracting', progress: 20, message: 'Extrayendo texto...' })
    await updateDocStatus('extracting')
    
    const extractResult = await extractText(buffer, filename)
    const textContent = extractResult.success ? normalizeText(extractResult.text) : ''
    
    updateJob({ 
      status: 'extracted', 
      progress: 50, 
      textLength: textContent.length,
      extractionMethod: extractResult.method
    })
    
    console.log(`   ✓ Texto extraído: ${textContent.length} caracteres (${extractResult.method})`)

    // 2. Subir archivo a Supabase Storage
    updateJob({ status: 'saving', progress: 55, message: 'Guardando archivo...' })
    
    const { error: uploadError } = await supabaseAdmin.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: `application/${filename.split('.').pop()}`,
        upsert: true
      })
    
    if (uploadError) {
      console.log(`   ⚠️ Error subiendo a storage: ${uploadError.message}`)
    }

    // 3. Actualizar registro con texto extraído
    updateJob({ status: 'saving_db', progress: 60 })
    
    await supabaseAdmin
      .from('documents')
      .update({
        text_content: textContent,
        extraction_status: textContent.length > 0 ? 'analyzing' : 'failed'
      })
      .eq('id', docId)

    updateJob({ documentId: docId, progress: 65 })
    console.log(`   ✓ Documento actualizado: ${docId}`)

    // 4. Análisis con AI (si está habilitado y hay texto)
    let issuesCount = 0
    let requestsCount = 0

    if (processWithAI && textContent.length > 200) {
      updateJob({ status: 'analyzing', progress: 70, message: 'Analizando con AI...' })
      
      try {
        const extractResult = await extractStructuredData(textContent, docType)
        
        // extractStructuredData retorna { success, data, visaType }
        // Los issues/requests están dentro de extractResult.data
        if (extractResult && extractResult.success && extractResult.data) {
          const analysisData = extractResult.data
          
          issuesCount = analysisData.issues?.length || 0
          requestsCount = analysisData.requests?.length || 0
          
          // Guardar structured_data en el documento
          await supabaseAdmin
            .from('documents')
            .update({ 
              structured_data: analysisData,
              analyzed_at: new Date().toISOString(),
              visa_category: analysisData.document_info?.visa_category,
              service_center: analysisData.document_info?.service_center
            })
            .eq('id', docRecord.id)
          
          // Guardar issues y requests en tablas separadas
          const saveResult = await saveStructuredData(supabaseAdmin, docRecord.id, analysisData)
          
          if (saveResult.success) {
            console.log(`   ✓ Análisis AI: ${issuesCount} issues, ${requestsCount} requests (DB: ${saveResult.issuesSaved || 0} issues, ${saveResult.requestsSaved || 0} requests guardados)`)
          } else {
            console.error(`   ⚠️ Error guardando datos: ${saveResult.error}`)
            console.log(`   ✓ Análisis AI: ${issuesCount} issues, ${requestsCount} requests (datos en structured_data, fallo en tablas separadas)`)
          }
        } else {
          console.log(`   ⚠️ Extracción no exitosa: ${extractResult?.error || 'sin datos'}`)
        }
      } catch (aiError) {
        console.error(`   ⚠️ Error en análisis AI: ${aiError.message}`)
      }
      
      updateJob({ progress: 85, issuesCount, requestsCount })
    }

    // 5. Generar embeddings
    let embeddingsCount = 0
    if (textContent.length > 100) {
      updateJob({ status: 'embeddings', progress: 90, message: 'Generando embeddings...' })
      
      try {
        const embResult = await generateDocumentEmbeddings(supabaseAdmin, {
          id: docRecord.id,
          text_content: textContent,
          doc_type: docType,
          original_name: filename
        })
        
        if (embResult.success) {
          embeddingsCount = embResult.chunks || 0
          console.log(`   ✓ Embeddings: ${embeddingsCount} chunks`)
        }
      } catch (embError) {
        console.error(`   ⚠️ Error en embeddings: ${embError.message}`)
      }
    }

    // 6. Completado
    updateJob({
      status: 'completed',
      progress: 100,
      message: 'Procesamiento completado',
      completedAt: new Date().toISOString(),
      result: {
        documentId: docRecord.id,
        documentName: filename,
        docType,
        textLength: textContent.length,
        extractionMethod: extractResult.method,
        extractionSuccess: extractResult.success,
        issuesCount,
        requestsCount,
        embeddingsCount,
        preview: textContent.substring(0, 500)
      }
    })

    console.log(`✅ Job ${jobId}: Completado exitosamente`)

  } catch (error) {
    console.error(`❌ Job ${jobId}: Error - ${error.message}`)
    updateJob({
      status: 'failed',
      error: error.message,
      failedAt: new Date().toISOString()
    })
  }
}

/**
 * GET /api/documents/upload-async
 * Obtiene el estado de un trabajo
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('jobId')

  if (!jobId) {
    return NextResponse.json({ error: 'jobId requerido' }, { status: 400 })
  }

  const job = jobs.get(jobId)

  if (!job) {
    return NextResponse.json({ 
      error: 'Trabajo no encontrado',
      jobId 
    }, { status: 404 })
  }

  return NextResponse.json({
    jobId,
    ...job
  })
}
