import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { processDocument } from '@/lib/document-processor'
import { generateDocumentEmbeddings } from '@/lib/embeddings'

// Este es un endpoint de PRUEBA - eliminar en producción
// Usa service role para bypass auth

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function POST(request) {
  try {
    console.log('🧪 TEST: Iniciando prueba de bulk upload...')
    
    const supabaseAdmin = getSupabaseAdmin()
    
    const formData = await request.formData()
    const files = formData.getAll('files')
    const docType = formData.get('docType') || 'RFE'
    const generateEmbeddings = formData.get('generateEmbeddings') === 'true'

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No se enviaron archivos' }, { status: 400 })
    }

    console.log(`🧪 TEST: Procesando ${files.length} archivos...`)

    const results = []
    const errors = []

    for (const file of files) {
      try {
        console.log(`📄 Procesando: ${file.name}`)
        
        // 1. Leer el archivo
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // 2. Extraer texto
        const textContent = await processDocument(buffer, file.name)
        
        if (!textContent || textContent.length < 50) {
          errors.push({ file: file.name, error: 'No se pudo extraer texto suficiente' })
          continue
        }

        console.log(`✅ Texto extraído: ${textContent.length} caracteres`)

        // 3. Guardar en base de datos (sin storage para test)
        const { data: docRecord, error: dbError } = await supabaseAdmin
          .from('documents')
          .insert({
            name: file.name,
            doc_type: docType,
            file_path: null,
            text_content: textContent,
            uploaded_by: null // Test - sin usuario
          })
          .select('id, name')
          .single()

        if (dbError) {
          console.error('Error DB:', dbError)
          errors.push({ file: file.name, error: dbError.message })
          continue
        }

        console.log(`✅ Guardado en DB con ID: ${docRecord.id}`)

        let embeddingsGenerated = 0

        // 4. Generar embeddings si se solicitó
        if (generateEmbeddings && docRecord) {
          console.log(`🧠 Generando embeddings para: ${file.name}`)
          const embResult = await generateDocumentEmbeddings(
            supabaseAdmin,
            { id: docRecord.id, text_content: textContent, name: file.name, doc_type: docType },
            false
          )
          if (embResult.success) {
            embeddingsGenerated = embResult.chunks || 0
          }
          console.log(`✅ Embeddings generados: ${embeddingsGenerated}`)
        }

        results.push({
          file: file.name,
          id: docRecord.id,
          textLength: textContent.length,
          embeddingsGenerated,
          success: true
        })

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
    console.error('Test bulk upload error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
