import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { extractText, normalizeText } from '@/lib/document-processor'
import { generateDocumentEmbeddings } from '@/lib/embeddings'
import { v4 as uuidv4 } from 'uuid'

// Cliente admin para operaciones de embeddings
function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
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

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No se enviaron archivos' }, { status: 400 })
    }

    console.log(`📦 Bulk upload: Procesando ${files.length} archivos para usuario ${user.id}...`)

    const results = []
    const errors = []

    for (const file of files) {
      try {
        console.log(`📄 Procesando: ${file.name}`)
        
        // 1. Leer el archivo
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // 2. Extraer texto CON información de páginas
        const extractResult = await extractText(buffer, file.name)
        
        if (!extractResult.success || !extractResult.text || extractResult.text.length < 50) {
          errors.push({ file: file.name, error: extractResult.error || 'No se pudo extraer texto suficiente' })
          continue
        }

        const textContent = normalizeText(extractResult.text)
        const pageTexts = extractResult.pageTexts || null // Textos por página si están disponibles
        const numPages = extractResult.numPages || 0

        console.log(`   📖 Extraídos ${textContent.length} caracteres, ${numPages} páginas`)
        if (pageTexts) {
          console.log(`   📑 ${pageTexts.length} páginas con texto detectadas`)
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
          // Continuar aunque falle el storage
        }

        // 4. Guardar en base de datos
        const { data: docRecord, error: dbError } = await supabaseAdmin
          .from('documents')
          .insert({
            id: fileId,
            name: file.name,
            doc_type: docType,
            storage_path: storagePath,
            text_content: textContent.substring(0, 50000),
            created_by: user.id
          })
          .select('id, name')
          .single()

        if (dbError) {
          console.error('DB Error:', dbError)
          errors.push({ file: file.name, error: dbError.message })
          continue
        }

        let embeddingsGenerated = 0

        // 5. Generar embeddings si se solicitó - AHORA CON PÁGINAS
        if (generateEmbeddings && docRecord) {
          console.log(`🧠 Generando embeddings para: ${file.name}`)
          const embResult = await generateDocumentEmbeddings(
            supabaseAdmin,
            { 
              id: docRecord.id, 
              text_content: textContent, 
              page_texts: pageTexts, // Pasar textos de página
              name: file.name, 
              doc_type: docType 
            },
            false // No es de caso
          )
          if (embResult.success) {
            embeddingsGenerated = embResult.chunks || 0
          }
        }

        results.push({
          file: file.name,
          id: docRecord.id,
          textLength: textContent.length,
          numPages: numPages,
          hasPageRefs: !!pageTexts,
          embeddingsGenerated,
          success: true
        })

        console.log(`✅ ${file.name}: guardado con ${embeddingsGenerated} embeddings ${pageTexts ? '(con refs de página)' : ''}`)

      } catch (fileError) {
        console.error(`Error procesando ${file.name}:`, fileError)
        errors.push({ file: file.name, error: fileError.message })
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      failed: errors.length,
      results,
      errors
    })

  } catch (error) {
    console.error('Bulk upload error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
