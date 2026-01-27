import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import AdmZip from 'adm-zip'
import pdf from 'pdf-parse'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Detectar tipo de documento por nombre
function detectDocType(filename) {
  const lower = filename.toLowerCase()
  if (lower.includes('rfe') || lower.includes('request for evidence')) return 'RFE'
  if (lower.includes('noid') || lower.includes('notice of intent')) return 'NOID'
  if (lower.includes('denial')) return 'Denial'
  if (lower.includes('carta') || lower.includes('recommendation') || lower.includes('letter')) return 'Carta de Recomendación'
  if (lower.includes('business') || lower.includes('plan')) return 'Business Plan'
  if (lower.includes('cv') || lower.includes('resume') || lower.includes('curriculum')) return 'CV/Resume'
  if (lower.includes('petition') || lower.includes('i-140')) return 'Petition Letter'
  return 'Otro'
}

// Extraer texto de un buffer de PDF
async function extractTextFromPdf(buffer) {
  try {
    const data = await pdf(buffer)
    return data.text || ''
  } catch (error) {
    console.error('Error extracting PDF text:', error)
    return ''
  }
}

/**
 * POST /api/import-jobs/[id]/process
 * Procesa el ZIP de un trabajo de importación
 * Diseñado para ejecutarse en segundo plano
 */
export async function POST(request, { params }) {
  const supabase = getSupabaseAdmin()
  const { id: jobId } = params
  
  console.log(`🚀 Iniciando procesamiento del job: ${jobId}`)

  try {
    // 1. Obtener el job
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      throw new Error('Job no encontrado')
    }

    if (job.status === 'completed') {
      return NextResponse.json({ message: 'Job ya completado' })
    }

    // 2. Actualizar estado a "processing"
    await supabase
      .from('import_jobs')
      .update({ 
        status: 'processing',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    // 3. Descargar el ZIP desde Storage
    console.log(`📥 Descargando ZIP desde: ${job.storage_path}`)
    
    const { data: zipData, error: downloadError } = await supabase.storage
      .from('imports')
      .download(job.storage_path)

    if (downloadError || !zipData) {
      throw new Error(`Error descargando ZIP: ${downloadError?.message}`)
    }

    // 4. Procesar el ZIP
    const zipBuffer = Buffer.from(await zipData.arrayBuffer())
    const zip = new AdmZip(zipBuffer)
    const zipEntries = zip.getEntries()

    // Filtrar solo archivos procesables
    const processableEntries = zipEntries.filter(entry => {
      if (entry.isDirectory) return false
      const name = entry.entryName.toLowerCase()
      if (name.includes('__macosx') || name.includes('.ds_store')) return false
      return name.endsWith('.pdf') || name.endsWith('.txt') || 
             name.endsWith('.doc') || name.endsWith('.docx')
    })

    console.log(`📂 Encontrados ${processableEntries.length} archivos procesables`)

    // 5. Crear el caso
    const caseId = uuidv4()
    const { error: caseError } = await supabase
      .from('visa_cases')
      .insert({
        id: caseId,
        title: job.client_name,
        beneficiary_name: job.client_name,
        visa_category: 'EB2-NIW',
        outcome: 'pending'
      })

    if (caseError) {
      throw new Error(`Error creando caso: ${caseError.message}`)
    }

    // Actualizar job con case_id y total_files
    await supabase
      .from('import_jobs')
      .update({ 
        case_id: caseId,
        total_files: processableEntries.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    // 6. Procesar cada archivo
    const results = []
    let successCount = 0
    let failCount = 0

    for (let i = 0; i < processableEntries.length; i++) {
      const entry = processableEntries[i]
      const fileName = entry.entryName.split('/').pop()
      
      console.log(`📄 Procesando (${i + 1}/${processableEntries.length}): ${fileName}`)

      // Actualizar progreso
      await supabase
        .from('import_jobs')
        .update({ 
          processed_files: i + 1,
          current_file: fileName,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)

      try {
        const fileBuffer = entry.getData()
        let textContent = ''

        // Extraer texto según tipo de archivo
        if (fileName.toLowerCase().endsWith('.pdf')) {
          textContent = await extractTextFromPdf(fileBuffer)
        } else if (fileName.toLowerCase().endsWith('.txt')) {
          textContent = fileBuffer.toString('utf-8')
        } else {
          textContent = `[Archivo ${fileName} - extracción de texto no soportada]`
        }

        // Detectar tipo de documento
        const docType = detectDocType(fileName)

        // Guardar en case_documents
        const docId = uuidv4()
        const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length
        
        const { error: docError } = await supabase
          .from('case_documents')
          .insert({
            id: docId,
            case_id: caseId,
            original_name: fileName,
            doc_type: docType,
            file_type: fileName.split('.').pop()?.toLowerCase() || 'pdf',
            text_content: textContent.substring(0, 100000),
            word_count: wordCount
          })

        if (docError) {
          throw new Error(docError.message)
        }

        results.push({ name: fileName, success: true, docId, docType })
        successCount++

      } catch (fileError) {
        console.error(`❌ Error procesando ${fileName}:`, fileError)
        results.push({ name: fileName, success: false, error: fileError.message })
        failCount++
      }

      // Pequeña pausa para no sobrecargar
      await new Promise(r => setTimeout(r, 100))
    }

    // 7. Finalizar job
    await supabase
      .from('import_jobs')
      .update({
        status: 'completed',
        successful_files: successCount,
        failed_files: failCount,
        results: results,
        current_file: null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    // 8. Limpiar el ZIP de Storage (opcional, para ahorrar espacio)
    await supabase.storage
      .from('imports')
      .remove([job.storage_path])

    console.log(`✅ Job ${jobId} completado: ${successCount} éxitos, ${failCount} fallos`)

    return NextResponse.json({
      success: true,
      jobId,
      caseId,
      processed: processableEntries.length,
      successful: successCount,
      failed: failCount
    })

  } catch (error) {
    console.error(`❌ Error en job ${jobId}:`, error)

    // Marcar job como fallido
    await supabase
      .from('import_jobs')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
