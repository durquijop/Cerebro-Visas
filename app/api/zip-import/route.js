import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { extractText, normalizeText } from '@/lib/document-processor'
import { generateDocumentEmbeddings } from '@/lib/embeddings'
import { detectDocumentType } from '@/lib/google-drive'
import { v4 as uuidv4 } from 'uuid'
import AdmZip from 'adm-zip'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Extensiones procesables
const PROCESSABLE_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.rtf']

/**
 * POST /api/zip-import
 * Importa documentos desde un archivo ZIP
 */
export async function POST(request) {
  try {
    const supabase = getSupabaseAdmin()
    const formData = await request.formData()
    
    const zipFile = formData.get('file')
    const clientName = formData.get('client_name')
    const generateEmbeddings = formData.get('generate_embeddings') === 'true'
    const action = formData.get('action') || 'import'

    if (!zipFile) {
      return NextResponse.json({ error: 'No se envió archivo ZIP' }, { status: 400 })
    }

    // Validar tamaño máximo (300MB para evitar problemas de memoria)
    const MAX_ZIP_SIZE = 300 * 1024 * 1024 // 300MB
    if (zipFile.size > MAX_ZIP_SIZE) {
      return NextResponse.json({ 
        error: `El archivo ZIP es demasiado grande (${formatBytes(zipFile.size)}). El tamaño máximo es 300MB. Por favor divide el ZIP en partes más pequeñas o usa la opción de "Subir Archivos" para subir los documentos directamente.`,
        size: zipFile.size,
        maxSize: MAX_ZIP_SIZE,
        suggestion: 'Divide el ZIP en partes de ~200MB cada una'
      }, { status: 413 })
    }

    console.log(`📦 Procesando ZIP: ${zipFile.name} (${formatBytes(zipFile.size)})`)

    // Leer el ZIP
    const zipBuffer = Buffer.from(await zipFile.arrayBuffer())
    const zip = new AdmZip(zipBuffer)
    const zipEntries = zip.getEntries()

    // Filtrar archivos procesables (no carpetas, no archivos ocultos)
    const processableEntries = zipEntries.filter(entry => {
      if (entry.isDirectory) return false
      
      const fileName = entry.name.toLowerCase()
      const entryName = entry.entryName.toLowerCase()
      
      // Ignorar archivos ocultos y de sistema
      if (fileName.startsWith('.') || fileName.startsWith('__')) return false
      if (entryName.includes('__macosx')) return false
      if (entryName.includes('.ds_store')) return false
      
      // Solo procesar extensiones válidas
      return PROCESSABLE_EXTENSIONS.some(ext => fileName.endsWith(ext))
    })

    console.log(`📂 Encontrados ${processableEntries.length} archivos procesables de ${zipEntries.length} total`)

    // Si es solo preview, devolver lista de archivos
    if (action === 'preview') {
      const filesPreview = processableEntries.map(entry => {
        const pathParts = entry.entryName.split('/')
        const fileName = pathParts.pop()
        const folderPath = pathParts.join('/')
        const parentFolder = pathParts.length > 0 ? pathParts[pathParts.length - 1] : ''
        
        return {
          name: fileName,
          path: entry.entryName,
          folder: folderPath,
          parentFolder: parentFolder,
          size: entry.header.size,
          sizeFormatted: formatBytes(entry.header.size),
          detectedType: detectDocumentType(fileName, parentFolder)
        }
      })

      // Agrupar por tipo
      const byType = {}
      filesPreview.forEach(file => {
        if (!byType[file.detectedType]) {
          byType[file.detectedType] = []
        }
        byType[file.detectedType].push(file)
      })

      // Obtener carpetas únicas
      const folders = [...new Set(processableEntries
        .map(e => e.entryName.split('/').slice(0, -1).join('/'))
        .filter(f => f)
      )]

      return NextResponse.json({
        success: true,
        zip_name: zipFile.name,
        total_entries: zipEntries.length,
        processable_files: processableEntries.length,
        folders: folders,
        files: filesPreview,
        files_by_type: byType
      })
    }

    // Acción: Importar
    if (!clientName) {
      return NextResponse.json({ error: 'Nombre del cliente requerido' }, { status: 400 })
    }

    // Crear el caso
    const { data: newCase, error: caseError } = await supabase
      .from('visa_cases')
      .insert({
        id: uuidv4(),
        title: clientName,
        beneficiary_name: clientName,
        visa_category: 'EB2-NIW',
        outcome: 'pending'
      })
      .select('id')
      .single()

    if (caseError) {
      console.error('Error creating case:', caseError)
      return NextResponse.json({ error: caseError.message }, { status: 500 })
    }

    const caseId = newCase.id
    console.log(`📋 Caso creado: ${caseId}`)

    const results = []
    const errors = []
    const RAG_TYPES = ['RFE', 'NOID', 'Denial']

    // Procesar cada archivo
    for (let i = 0; i < processableEntries.length; i++) {
      const entry = processableEntries[i]
      const pathParts = entry.entryName.split('/')
      const fileName = pathParts.pop()
      const parentFolder = pathParts.length > 0 ? pathParts[pathParts.length - 1] : ''

      try {
        console.log(`📄 [${i + 1}/${processableEntries.length}] Procesando: ${fileName}`)

        // Extraer contenido del ZIP
        const fileBuffer = entry.getData()

        // Extraer texto
        const extractResult = await extractText(fileBuffer, fileName)

        if (!extractResult.success || !extractResult.text || extractResult.text.length < 50) {
          errors.push({ file: fileName, error: 'No se pudo extraer texto' })
          continue
        }

        const textContent = normalizeText(extractResult.text)
        const pageTexts = extractResult.pageTexts || null
        const docType = detectDocumentType(fileName, parentFolder)
        const docId = uuidv4()

        // Guardar en case_documents
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
          console.error('Error saving document:', docError)
          errors.push({ file: fileName, error: docError.message })
          continue
        }

        // Generar embeddings solo para RFE/NOID/Denial
        let embeddingsGenerated = 0
        if (generateEmbeddings && RAG_TYPES.includes(docType)) {
          const embResult = await generateDocumentEmbeddings(
            supabase,
            {
              id: docId,
              text_content: textContent,
              page_texts: pageTexts,
              name: fileName,
              doc_type: docType
            },
            true
          )
          if (embResult.success) {
            embeddingsGenerated = embResult.chunks || 0
          }
        }

        results.push({
          file: fileName,
          path: entry.entryName,
          docType,
          textLength: textContent.length,
          embeddingsGenerated,
          success: true
        })

        console.log(`✅ ${fileName} → ${docType}`)

      } catch (fileError) {
        console.error(`Error procesando ${fileName}:`, fileError)
        errors.push({ file: fileName, error: fileError.message })
      }
    }

    console.log(`🎉 Importación completada: ${results.length} éxitos, ${errors.length} errores`)

    return NextResponse.json({
      success: true,
      case_id: caseId,
      case_name: clientName,
      processed: results.length,
      failed: errors.length,
      results,
      errors
    })

  } catch (error) {
    console.error('ZIP import error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
