import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { 
  extractDriveId, 
  listDriveFolder, 
  downloadDriveFile, 
  detectDocumentType,
  filterProcessableFiles 
} from '@/lib/google-drive'
import { extractText, normalizeText } from '@/lib/document-processor'
import { generateDocumentEmbeddings } from '@/lib/embeddings'
import { v4 as uuidv4 } from 'uuid'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

/**
 * POST /api/drive-import
 * Importa documentos de una carpeta de Google Drive
 */
export async function POST(request) {
  try {
    const supabase = getSupabaseAdmin()
    const body = await request.json()
    const { drive_url, client_name, case_id, action } = body

    // Acción: Listar archivos (preview)
    if (action === 'preview') {
      const driveInfo = extractDriveId(drive_url)
      if (!driveInfo) {
        return NextResponse.json({ 
          error: 'URL de Google Drive inválida' 
        }, { status: 400 })
      }

      console.log(`📂 Listando carpeta de Drive: ${driveInfo.id}`)
      
      try {
        const { files, folders } = await listDriveFolder(driveInfo.id, true)
        
        // Filtrar archivos procesables
        const processableFiles = filterProcessableFiles(files)
        
        // Detectar tipos de documentos
        const filesWithTypes = processableFiles.map(file => ({
          ...file,
          detectedType: detectDocumentType(file.name, file.parentFolderName || ''),
          sizeFormatted: formatBytes(file.size)
        }))

        // Agrupar por tipo
        const byType = {}
        filesWithTypes.forEach(file => {
          if (!byType[file.detectedType]) {
            byType[file.detectedType] = []
          }
          byType[file.detectedType].push(file)
        })

        return NextResponse.json({
          success: true,
          folder_id: driveInfo.id,
          total_files: files.length,
          processable_files: processableFiles.length,
          folders_scanned: folders.length,
          files: filesWithTypes,
          files_by_type: byType,
          folders: folders
        })
      } catch (driveError) {
        console.error('Drive error:', driveError)
        return NextResponse.json({ 
          error: driveError.message || 'Error accediendo a Google Drive'
        }, { status: 500 })
      }
    }

    // Acción: Importar archivos
    if (action === 'import') {
      const { folder_id, files_to_import, generate_embeddings } = body
      
      if (!folder_id || !files_to_import || files_to_import.length === 0) {
        return NextResponse.json({ 
          error: 'Faltan parámetros: folder_id y files_to_import' 
        }, { status: 400 })
      }

      // Crear el caso si no existe
      let targetCaseId = case_id
      if (!targetCaseId && client_name) {
        const { data: newCase, error: caseError } = await supabase
          .from('visa_cases')
          .insert({
            id: uuidv4(),
            title: client_name,
            beneficiary_name: client_name,
            visa_category: 'EB2-NIW',
            outcome: 'pending'
          })
          .select('id')
          .single()

        if (caseError) {
          console.error('Error creating case:', caseError)
          return NextResponse.json({ error: caseError.message }, { status: 500 })
        }
        targetCaseId = newCase.id
        console.log(`📋 Caso creado: ${targetCaseId}`)
      }

      const results = []
      const errors = []
      const RAG_TYPES = ['RFE', 'NOID', 'Denial']

      for (const fileInfo of files_to_import) {
        try {
          console.log(`📄 Descargando: ${fileInfo.name}`)
          
          // Descargar archivo
          const { buffer, mimeType } = await downloadDriveFile(fileInfo.id, fileInfo.mimeType)
          
          // Extraer texto
          const extractResult = await extractText(buffer, fileInfo.name)
          
          if (!extractResult.success || !extractResult.text || extractResult.text.length < 50) {
            errors.push({ 
              file: fileInfo.name, 
              error: 'No se pudo extraer texto' 
            })
            continue
          }

          const textContent = normalizeText(extractResult.text)
          const pageTexts = extractResult.pageTexts || null
          const docType = fileInfo.detectedType || detectDocumentType(fileInfo.name, '')

          // Guardar en case_documents si hay caso
          if (targetCaseId) {
            const docId = uuidv4()
            const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length
            
            const { error: docError } = await supabase
              .from('case_documents')
              .insert({
                id: docId,
                case_id: targetCaseId,
                original_name: fileInfo.name,
                doc_type: docType,
                file_type: fileInfo.name.split('.').pop()?.toLowerCase() || 'pdf',
                text_content: textContent.substring(0, 100000),
                word_count: wordCount
              })

            if (docError) {
              console.error('Error saving document:', docError)
              errors.push({ file: fileInfo.name, error: docError.message })
              continue
            }

            // Generar embeddings solo para RFE/NOID/Denial
            let embeddingsGenerated = 0
            if (generate_embeddings && RAG_TYPES.includes(docType)) {
              const embResult = await generateDocumentEmbeddings(
                supabase,
                { 
                  id: docId, 
                  text_content: textContent, 
                  page_texts: pageTexts,
                  name: fileInfo.name, 
                  doc_type: docType 
                },
                true // Es de caso
              )
              if (embResult.success) {
                embeddingsGenerated = embResult.chunks || 0
              }
            }

            results.push({
              file: fileInfo.name,
              docType,
              textLength: textContent.length,
              embeddingsGenerated,
              documentId: docId,
              success: true
            })
          }

          console.log(`✅ ${fileInfo.name} importado como ${docType}`)

        } catch (fileError) {
          console.error(`Error procesando ${fileInfo.name}:`, fileError)
          errors.push({ file: fileInfo.name, error: fileError.message })
        }
      }

      return NextResponse.json({
        success: true,
        case_id: targetCaseId,
        processed: results.length,
        failed: errors.length,
        results,
        errors
      })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  } catch (error) {
    console.error('Drive import error:', error)
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
