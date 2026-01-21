import { createClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/embeddings'
import { NextResponse } from 'next/server'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

export async function POST(request) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticación
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { message, conversationHistory = [] } = await request.json()

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })
    }

    // 1. Generar embedding de la pregunta del usuario
    console.log('Generando embedding para:', message.substring(0, 50) + '...')
    const queryEmbedding = await generateEmbedding(message)

    // 2. Buscar documentos similares usando la función de Supabase
    const { data: similarDocs, error: searchError } = await supabase
      .rpc('search_similar_documents', {
        query_embedding: JSON.stringify(queryEmbedding),
        match_threshold: 0.5,
        match_count: 8
      })

    if (searchError) {
      console.error('Error searching documents:', searchError)
    }

    // 3. Construir contexto con los documentos encontrados
    let context = ''
    const sources = []

    if (similarDocs && similarDocs.length > 0) {
      context = '### DOCUMENTOS RELEVANTES ENCONTRADOS:\n\n'
      
      for (const doc of similarDocs) {
        const metadata = doc.metadata || {}
        const docName = metadata.original_name || 'Documento'
        const docType = metadata.doc_type || 'N/A'
        
        context += `--- DOCUMENTO: ${docName} (${docType}) ---\n`
        context += `Relevancia: ${(doc.similarity * 100).toFixed(1)}%\n`
        context += `Contenido:\n${doc.content_chunk}\n\n`
        
        sources.push({
          id: doc.document_id || doc.case_document_id,
          name: docName,
          type: docType,
          similarity: doc.similarity,
          isFromCase: !!doc.case_document_id
        })
      }
    } else {
      context = 'No se encontraron documentos relevantes en la base de datos.\n'
    }

    // 4. Construir el prompt del sistema
    const systemPrompt = `Eres un asistente experto en casos de inmigración de Estados Unidos, especializado en visas EB-2 NIW (National Interest Waiver).

Tu rol es ayudar a abogados y analistas a:
- Responder preguntas sobre casos, RFEs, NOIDs y denegaciones
- Identificar patrones en los issues detectados por USCIS
- Sugerir estrategias basadas en casos similares
- Explicar los requisitos de los 3 prongs del test Dhanasar

IMPORTANTE:
- Basa tus respuestas en los documentos proporcionados cuando sea posible
- Si no encuentras información relevante, indícalo claramente
- Responde en español
- Sé conciso pero completo
- Cita los documentos fuente cuando uses información específica

${context}`

    // 5. Construir mensajes para el LLM
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-6).map(m => ({
        role: m.role,
        content: m.content
      })),
      { role: 'user', content: message }
    ]

    // 6. Llamar al LLM
    const llmResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        'X-Title': 'Cerebro Visas Chat'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages,
        temperature: 0.7,
        max_tokens: 2000
      })
    })

    if (!llmResponse.ok) {
      const error = await llmResponse.text()
      console.error('LLM error:', error)
      throw new Error('Error al generar respuesta')
    }

    const llmData = await llmResponse.json()
    const assistantMessage = llmData.choices[0]?.message?.content || 'No pude generar una respuesta.'

    return NextResponse.json({
      message: assistantMessage,
      sources: sources.slice(0, 5), // Máximo 5 fuentes
      documentsFound: similarDocs?.length || 0
    })

  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
