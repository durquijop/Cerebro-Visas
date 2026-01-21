import { createClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/embeddings'
import { NextResponse } from 'next/server'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

/**
 * Clasifica la intención del mensaje para decidir si necesita buscar en documentos
 */
async function classifyIntent(message, conversationHistory) {
  const recentContext = conversationHistory.slice(-4).map(m => 
    `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content.substring(0, 200)}`
  ).join('\n')

  const classificationPrompt = `Eres un clasificador de intenciones para un sistema de consulta de documentos de inmigración (EB-2 NIW).

CONTEXTO DE CONVERSACIÓN RECIENTE:
${recentContext || 'Sin conversación previa'}

MENSAJE ACTUAL DEL USUARIO:
"${message}"

Clasifica este mensaje en UNA de estas categorías:

1. "DOCUMENTS" - El usuario pregunta algo que REQUIERE buscar en documentos:
   - Preguntas sobre casos específicos, RFEs, NOIDs
   - Preguntas sobre evidencia, issues, patrones
   - "¿Qué dice el documento sobre...?"
   - "¿Cuáles son los issues más comunes?"
   - "Dame ejemplos de..."

2. "CONVERSATION" - El mensaje se puede responder con el contexto de la conversación:
   - "Explica más el punto 2"
   - "¿Puedes dar más detalles?"
   - "Resume lo anterior"
   - "¿Qué significa eso?"
   - Preguntas de seguimiento sobre algo ya dicho

3. "GENERAL" - Preguntas generales que NO requieren documentos específicos:
   - "¿Qué es una visa EB-2 NIW?"
   - "¿Cuáles son los 3 prongs?"
   - Definiciones, conceptos generales
   - Saludos, agradecimientos ("hola", "gracias")

4. "CLARIFICATION" - El mensaje es ambiguo y necesitas pedir clarificación:
   - Mensajes muy cortos sin contexto claro
   - Peticiones vagas

Responde SOLO con la categoría (DOCUMENTS, CONVERSATION, GENERAL, o CLARIFICATION) y una breve razón.
Formato: CATEGORIA|razón breve`

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-lite-001', // Modelo ligero y rápido
        messages: [{ role: 'user', content: classificationPrompt }],
        temperature: 0,
        max_tokens: 50
      })
    })

    if (!response.ok) {
      console.error('Classification failed, defaulting to DOCUMENTS')
      return { intent: 'DOCUMENTS', reason: 'Classification failed' }
    }

    const data = await response.json()
    const result = data.choices[0]?.message?.content?.trim() || 'DOCUMENTS|default'
    const [intent, reason] = result.split('|')
    
    return { 
      intent: intent.trim().toUpperCase(), 
      reason: reason?.trim() || 'No reason provided' 
    }
  } catch (error) {
    console.error('Intent classification error:', error)
    return { intent: 'DOCUMENTS', reason: 'Error in classification' }
  }
}

/**
 * Genera respuesta sin buscar documentos (conversación o general)
 */
async function generateDirectResponse(message, conversationHistory, responseType) {
  const systemPrompts = {
    CONVERSATION: `Eres un asistente experto en inmigración EB-2 NIW. 
El usuario está haciendo una pregunta de seguimiento basada en la conversación anterior.
Responde basándote en el contexto de la conversación. Sé conciso y útil.
Responde en español.`,
    
    GENERAL: `Eres un asistente experto en inmigración de Estados Unidos, especializado en visas EB-2 NIW.
Responde preguntas generales sobre:
- Los 3 prongs del test Dhanasar
- Requisitos de EB-2 NIW
- Proceso de petición
- Conceptos generales de inmigración

Sé informativo pero conciso. Responde en español.
Si el usuario saluda o agradece, responde amablemente.`,

    CLARIFICATION: `Eres un asistente de inmigración EB-2 NIW. 
El mensaje del usuario no es claro. Pide amablemente que aclare su pregunta.
Sugiere ejemplos de preguntas que puedes responder.
Responde en español.`
  }

  const messages = [
    { role: 'system', content: systemPrompts[responseType] || systemPrompts.GENERAL },
    ...conversationHistory.slice(-6).map(m => ({
      role: m.role,
      content: m.content
    })),
    { role: 'user', content: message }
  ]

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-001',
      messages,
      temperature: 0.7,
      max_tokens: 1500
    })
  })

  if (!response.ok) {
    throw new Error('Error generating response')
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || 'No pude generar una respuesta.'
}

/**
 * Busca en documentos y genera respuesta con RAG
 */
async function generateRAGResponse(message, conversationHistory, supabase) {
  // 1. Generar embedding de la pregunta
  console.log('🔍 RAG: Generando embedding para búsqueda...')
  const queryEmbedding = await generateEmbedding(message)

  // 2. Buscar documentos similares
  const { data: similarDocs, error: searchError } = await supabase
    .rpc('search_similar_documents', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: 0.5,
      match_count: 6
    })

  if (searchError) {
    console.error('Error searching documents:', searchError)
  }

  // 3. Construir contexto
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

  // 4. Generar respuesta con contexto
  const systemPrompt = `Eres un asistente experto en casos de inmigración EB-2 NIW.

Tu rol es ayudar a abogados y analistas basándote en los documentos proporcionados.

IMPORTANTE:
- Basa tus respuestas en los documentos proporcionados
- Si no encuentras información relevante, indícalo claramente
- Responde en español
- Sé conciso pero completo
- Cita los documentos fuente cuando uses información específica

${context}`

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-6).map(m => ({
      role: m.role,
      content: m.content
    })),
    { role: 'user', content: message }
  ]

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-001',
      messages,
      temperature: 0.7,
      max_tokens: 2000
    })
  })

  if (!response.ok) {
    throw new Error('Error generating RAG response')
  }

  const data = await response.json()
  return {
    message: data.choices[0]?.message?.content || 'No pude generar una respuesta.',
    sources: sources.slice(0, 5),
    documentsFound: similarDocs?.length || 0
  }
}

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

    // 1. CLASIFICAR INTENCIÓN
    console.log('🧠 Clasificando intención del mensaje...')
    const { intent, reason } = await classifyIntent(message, conversationHistory)
    console.log(`📋 Intención: ${intent} - ${reason}`)

    let response

    // 2. EJECUTAR SEGÚN INTENCIÓN
    switch (intent) {
      case 'DOCUMENTS':
        // Búsqueda RAG completa
        console.log('📚 Ejecutando búsqueda en documentos...')
        const ragResult = await generateRAGResponse(message, conversationHistory, supabase)
        response = {
          message: ragResult.message,
          sources: ragResult.sources,
          documentsFound: ragResult.documentsFound,
          intent: 'DOCUMENTS',
          intentReason: reason
        }
        break

      case 'CONVERSATION':
      case 'GENERAL':
      case 'CLARIFICATION':
        // Respuesta directa sin buscar documentos
        console.log(`💬 Generando respuesta directa (${intent})...`)
        const directMessage = await generateDirectResponse(message, conversationHistory, intent)
        response = {
          message: directMessage,
          sources: [],
          documentsFound: 0,
          intent,
          intentReason: reason
        }
        break

      default:
        // Por defecto, hacer RAG
        console.log('📚 Intent desconocido, usando RAG...')
        const defaultResult = await generateRAGResponse(message, conversationHistory, supabase)
        response = {
          message: defaultResult.message,
          sources: defaultResult.sources,
          documentsFound: defaultResult.documentsFound,
          intent: 'DOCUMENTS',
          intentReason: 'Default fallback'
        }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
