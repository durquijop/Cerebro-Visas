import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { generateEmbedding } from '@/lib/embeddings'
import { NextResponse } from 'next/server'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

// Función para obtener cliente admin (lazy initialization)
function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

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
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
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

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
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
 * Si falla el embedding, usa búsqueda por texto o responde con conocimiento general
 */
async function generateRAGResponse(message, conversationHistory) {
  const supabaseAdmin = getSupabaseAdmin()
  let context = ''
  const sources = []
  let searchMethod = 'none'

  // Intentar búsqueda con embeddings (si funciona)
  try {
    console.log('🔍 RAG: Intentando búsqueda con embeddings...')
    const queryEmbedding = await generateEmbedding(message)
    console.log('✅ Embedding generado, dimensiones:', queryEmbedding.length)
    
    const embeddingStr = JSON.stringify(queryEmbedding)
    
    const { data: similarDocs, error: searchError } = await supabaseAdmin
      .rpc('search_similar_documents', {
        query_embedding: embeddingStr,
        match_threshold: 0.2,
        match_count: 10
      })

    if (!searchError && similarDocs && similarDocs.length > 0) {
      searchMethod = 'embeddings'
      context = '### DOCUMENTOS RELEVANTES ENCONTRADOS:\n\n'
      
      for (const doc of similarDocs) {
        const metadata = doc.metadata || {}
        const docName = metadata.document_name || metadata.name || 'Documento'
        const docType = metadata.doc_type || 'unknown'
        const pageRef = metadata.page_number ? ` (Página ${metadata.page_number})` : ''
        
        context += `**${docName}${pageRef}** [${docType}]\n`
        context += `${doc.text_chunk}\n\n`
        
        sources.push({
          name: docName,
          type: docType,
          page: metadata.page_number,
          similarity: doc.similarity
        })
      }
      console.log('📊 Documentos encontrados con embeddings:', similarDocs.length)
    }
  } catch (embeddingError) {
    console.log('⚠️ Embeddings no disponibles:', embeddingError.message)
  }

  // Si no hay embeddings, buscar por texto en TODOS los documentos
  if (!context) {
    try {
      console.log('🔍 RAG: Usando búsqueda por texto en todos los documentos...')
      
      // Extraer palabras clave del mensaje
      const keywords = message.toLowerCase()
        .replace(/[¿?¡!.,]/g, '')
        .split(' ')
        .filter(w => w.length > 3)
        .slice(0, 8)
      
      console.log('🔑 Palabras clave:', keywords)
      
      // Buscar en TODOS los documentos que tengan texto
      const { data: docs, error: docsError } = await supabaseAdmin
        .from('case_documents')
        .select('id, original_name, doc_type, text_content, word_count')
        .not('text_content', 'is', null)
        .gt('word_count', 50)
        .order('word_count', { ascending: false })
        .limit(50)

      if (!docsError && docs && docs.length > 0) {
        console.log(`📚 Total documentos con texto: ${docs.length}`)
        
        // Calcular relevancia por coincidencias de palabras clave
        const scoredDocs = docs.map(doc => {
          const text = (doc.text_content || '').toLowerCase()
          let score = 0
          let matchedKeywords = []
          
          for (const kw of keywords) {
            const matches = (text.match(new RegExp(kw, 'gi')) || []).length
            if (matches > 0) {
              score += matches
              matchedKeywords.push(kw)
            }
          }
          
          // Bonus para documentos RFE/NOID
          if (['RFE', 'NOID', 'Denial', 'rfe_document', 'noid_document'].includes(doc.doc_type)) {
            score *= 1.5
          }
          
          return {
            ...doc,
            relevanceScore: score,
            matchedKeywords
          }
        })
        .filter(d => d.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 8)

        if (scoredDocs.length > 0) {
          searchMethod = 'text-search'
          context = '### INFORMACIÓN DE DOCUMENTOS RELEVANTES:\n\n'
          
          for (const doc of scoredDocs) {
            context += `**${doc.original_name}** [${doc.doc_type}]\n`
            
            // Extraer fragmento relevante basado en palabras clave encontradas
            const textLower = doc.text_content.toLowerCase()
            let relevantSnippet = ''
            
            for (const kw of doc.matchedKeywords) {
              const idx = textLower.indexOf(kw)
              if (idx !== -1) {
                const start = Math.max(0, idx - 150)
                const end = Math.min(doc.text_content.length, idx + 400)
                relevantSnippet = '...' + doc.text_content.substring(start, end) + '...'
                break
              }
            }
            
            if (!relevantSnippet && doc.text_content) {
              relevantSnippet = doc.text_content.substring(0, 800) + '...'
            }
            
            context += `${relevantSnippet}\n\n`
            
            // Calcular porcentaje de relevancia (0-100)
            const maxScore = keywords.length * 10
            const relevancePercent = Math.min(100, Math.round((doc.relevanceScore / maxScore) * 100))
            
            sources.push({
              name: doc.original_name,
              type: doc.doc_type,
              relevance: relevancePercent
            })
          }
          console.log(`📊 Documentos relevantes encontrados: ${scoredDocs.length}`)
        } else {
          // No hay coincidencias, mostrar los documentos más grandes
          console.log('⚠️ Sin coincidencias de keywords, usando documentos principales')
          const topDocs = docs.slice(0, 5)
          
          searchMethod = 'browse'
          context = '### DOCUMENTOS DISPONIBLES EN EL SISTEMA:\n\n'
          
          for (const doc of topDocs) {
            context += `**${doc.original_name}** [${doc.doc_type}] - ${doc.word_count} palabras\n`
            context += `${doc.text_content?.substring(0, 500) || 'Sin contenido'}...\n\n`
            
            sources.push({
              name: doc.original_name,
              type: doc.doc_type,
              relevance: 50
            })
          }
        }
      } else {
        console.log('⚠️ No hay documentos con texto en la base de datos')
      }
    } catch (textSearchError) {
      console.log('⚠️ Búsqueda por texto falló:', textSearchError.message)
    }
  }

  // Si aún no hay contexto, responder con conocimiento general
  if (!context) {
    console.log('ℹ️ Sin documentos disponibles, usando conocimiento general')
    context = 'No se encontraron documentos específicos. Respondiendo con conocimiento general sobre EB-2 NIW.'
    searchMethod = 'general'
  }

  // 4. Generar respuesta con contexto
  const systemPrompt = `Eres un asistente experto en casos de inmigración EB-2 NIW.

Tu rol es ayudar a abogados y analistas basándote en los documentos proporcionados.

IMPORTANTE:
- Basa tus respuestas en los documentos proporcionados cuando estén disponibles
- Si no encuentras información relevante, responde con conocimiento general
- Responde en español
- Sé conciso pero completo
- Cita las fuentes cuando sea posible

CONTEXTO:
${context}`

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-6).map(m => ({
      role: m.role,
      content: m.content
    })),
    { role: 'user', content: message }
  ]

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1',
      messages,
      temperature: 0.7,
      max_tokens: 2000
    })
  })

  if (!response.ok) {
    throw new Error('Error generating RAG response')
  }

  const data = await response.json()
  const responseText = data.choices[0]?.message?.content || 'No pude generar una respuesta.'

  return {
    response: responseText,
    sources: sources,
    searchMethod: searchMethod
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
        const ragResult = await generateRAGResponse(message, conversationHistory)
        response = {
          message: ragResult.response,
          sources: ragResult.sources,
          searchMethod: ragResult.searchMethod,
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
          searchMethod: 'direct',
          intent,
          intentReason: reason
        }
        break

      default:
        // Por defecto, hacer RAG
        console.log('📚 Intent desconocido, usando RAG...')
        const defaultResult = await generateRAGResponse(message, conversationHistory)
        response = {
          message: defaultResult.response,
          sources: defaultResult.sources,
          searchMethod: defaultResult.searchMethod,
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
