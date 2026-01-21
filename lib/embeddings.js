/**
 * Servicio de Embeddings usando OpenRouter
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const EMBEDDING_MODEL = 'openai/text-embedding-3-small'

/**
 * Genera embedding para un texto usando OpenRouter
 */
export async function generateEmbedding(text) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY no configurada')
  }

  // Limpiar y truncar texto si es muy largo (max ~8000 tokens)
  const cleanText = text
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 30000) // ~8000 tokens aproximadamente

  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      'X-Title': 'Cerebro Visas'
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: cleanText
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Error generating embedding:', error)
    throw new Error(`Error generando embedding: ${response.status}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

/**
 * Divide texto en chunks para documentos largos
 */
export function chunkText(text, maxChunkSize = 2000, overlap = 200) {
  const chunks = []
  const sentences = text.split(/(?<=[.!?])\s+/)
  
  let currentChunk = ''
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      // Overlap: mantener últimas palabras
      const words = currentChunk.split(' ')
      currentChunk = words.slice(-Math.floor(overlap / 5)).join(' ') + ' ' + sentence
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks.length > 0 ? chunks : [text.substring(0, maxChunkSize)]
}

/**
 * Genera embeddings para un documento y los guarda en la BD
 */
export async function generateDocumentEmbeddings(supabase, document, isFromCase = false) {
  const textContent = document.text_content
  
  if (!textContent || textContent.length < 50) {
    console.log(`Documento ${document.id} sin suficiente texto para embeddings`)
    return { success: false, reason: 'insufficient_text' }
  }

  try {
    // Dividir en chunks
    const chunks = chunkText(textContent)
    console.log(`Generando ${chunks.length} embeddings para documento ${document.id}`)

    // Eliminar embeddings anteriores de este documento
    const deleteColumn = isFromCase ? 'case_document_id' : 'document_id'
    await supabase
      .from('document_embeddings')
      .delete()
      .eq(deleteColumn, document.id)

    // Generar y guardar embeddings para cada chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      
      try {
        const embedding = await generateEmbedding(chunk)
        
        const embeddingRecord = {
          content_chunk: chunk,
          chunk_index: i,
          embedding: JSON.stringify(embedding),
          metadata: {
            doc_type: document.doc_type || document.outcome_type,
            original_name: document.name || document.original_name,
            chunk_of: chunks.length
          }
        }

        // Asignar la referencia correcta
        if (isFromCase) {
          embeddingRecord.case_document_id = document.id
        } else {
          embeddingRecord.document_id = document.id
        }

        const { error } = await supabase
          .from('document_embeddings')
          .insert(embeddingRecord)

        if (error) {
          console.error(`Error guardando embedding chunk ${i}:`, error)
        }

        // Rate limiting - esperar un poco entre llamadas
        if (i < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 100))
        }
      } catch (embError) {
        console.error(`Error en chunk ${i}:`, embError)
      }
    }

    return { success: true, chunks: chunks.length }
  } catch (error) {
    console.error('Error generating document embeddings:', error)
    return { success: false, error: error.message }
  }
}
