import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extractText, normalizeText } from '@/lib/document-processor'
import { extractStructuredData, saveStructuredData } from '@/lib/case-miner'
import { generateDocumentEmbeddings } from '@/lib/embeddings'
import { v4 as uuidv4 } from 'uuid'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  console.log('📤 Nuevo upload recibido')
  
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const docType = formData.get('doc_type') || 'RFE'
    const processWithAI = formData.get('processWithAI') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }

    // Validaciones
    const maxSize = 20 * 1024 * 1024 // 20MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Archivo muy grande (máx 20MB)' }, { status: 400 })
    }

    console.log(`📁 Archivo: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`)

    // Leer archivo
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generar ID único
    const fileId = uuidv4()
    const fileExt = file.name.split('.').pop()
    const storagePath = `documents/${fileId}.${fileExt}`

    // 1. Subir a Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('documents')
      .upload(storagePath, buffer, { contentType: file.type })

    if (uploadError) {
      console.error('Error subiendo archivo:', uploadError)
    }

    // 2. Extraer texto
    const extraction = await extractText(buffer, file.name)
    const textContent = extraction.success ? normalizeText(extraction.text) : ''
    
    console.log(`📝 Extracción: ${extraction.success ? 'Exitosa' : 'Fallida'} - ${textContent.length} caracteres`)

    // 3. Guardar documento en DB
    const { data: document, error: dbError } = await supabaseAdmin
      .from('documents')
      .insert({
        id: fileId,
        name: file.name,
        doc_type: docType,
        storage_path: storagePath,
        text_content: textContent.substring(0, 50000)
      })
      .select()
      .single()

    if (dbError) {
      console.error('Error guardando documento:', dbError)
      return NextResponse.json({ error: 'Error guardando documento' }, { status: 500 })
    }

    // Variables para respuesta
    let structuredData = null
    let embeddingsResult = { generated: false, chunks: 0 }

    // 4. Procesar con IA (si hay texto y se solicitó)
    if (processWithAI && textContent.length > 100) {
      console.log('🔬 Procesando con IA...')
      try {
        const result = await extractStructuredData(textContent.substring(0, 30000), docType)
        if (result.success) {
          structuredData = result.data
          await saveStructuredData(supabaseAdmin, fileId, structuredData)
          console.log(`✅ Issues: ${structuredData.issues?.length || 0}, Requests: ${structuredData.requests?.length || 0}`)
        }
      } catch (aiError) {
        console.error('Error procesando con IA:', aiError.message)
      }
    }

    // 5. Generar embeddings (si hay texto)
    if (textContent.length > 100) {
      console.log('🧠 Generando embeddings...')
      try {
        const embResult = await generateDocumentEmbeddings(supabaseAdmin, {
          id: fileId,
          text_content: textContent,
          doc_type: docType,
          original_name: file.name
        })
        embeddingsResult = { generated: embResult.success, chunks: embResult.chunks || 0 }
      } catch (embError) {
        console.error('Error generando embeddings:', embError.message)
      }
    }

    console.log('✅ Upload completado')

    // Respuesta
    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        name: document.name,
        doc_type: document.doc_type,
        storage_path: document.storage_path
      },
      extraction: {
        success: extraction.success,
        textLength: textContent.length,
        method: extraction.method,
        preview: textContent.substring(0, 500)
      },
      structuredData: structuredData ? {
        issues_count: structuredData.issues?.length || 0,
        requests_count: structuredData.requests?.length || 0
      } : null,
      embeddings: embeddingsResult
    })

  } catch (error) {
    console.error('❌ Error en upload:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
