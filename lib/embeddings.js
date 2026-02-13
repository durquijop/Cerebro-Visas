/**
 * Embeddings Service v3 - Generación simplificada de embeddings
 * Usa pseudo-embeddings basados en keywords extraídas con LLM
 */

const EMBEDDING_DIMENSIONS = 1536

/**
 * Genera embedding para un texto usando keywords
 */
async function generateEmbedding(text) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada')
  
  // Extraer keywords del texto
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: [{
        role: 'user',
        content: `Extract 20-30 key terms from this text. Return only comma-separated keywords:\n\n${text.substring(0, 3000)}`
      }],
      max_tokens: 200,
      temperature: 0
    })
  })
  
  if (!response.ok) {
    const error = await response.text()
    console.error('Error en OpenAI:', error)
    throw new Error(`Error generando embedding: ${response.status}`)
  }
  
  const data = await response.json()
  const keywords = data.choices?.[0]?.message?.content || ''
  
  // Convertir keywords a vector de dimensiones fijas
  return keywordsToVector(keywords)
}

/**
 * Convierte keywords a un vector de dimensiones fijas
 */
function keywordsToVector(keywords) {
  const vector = new Array(EMBEDDING_DIMENSIONS).fill(0)
  const terms = keywords.toLowerCase().split(/[,\s]+/).filter(t => t.length > 2)
  
  for (const term of terms) {
    // Usar hash simple para distribuir valores
    let hash = 0
    for (let i = 0; i < term.length; i++) {
      hash = ((hash << 5) - hash) + term.charCodeAt(i)
      hash = hash & hash
    }
    
    // Distribuir en múltiples posiciones
    for (let i = 0; i < 10; i++) {
      const pos = Math.abs((hash + i * 137) % EMBEDDING_DIMENSIONS)
      vector[pos] += (1 / (i + 1)) * (hash > 0 ? 1 : -1)
    }
  }
  
  // Normalizar
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= magnitude
    }
  }
  
  return vector
}

/**
 * Divide texto en chunks
 */
function chunkText(text, maxSize = 4000) {
  const chunks = []
  const sentences = text.split(/(?<=[.!?])\s+/)
  let currentChunk = ''
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = ''
    }
    currentChunk += (currentChunk ? ' ' : '') + sentence
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks.length > 0 ? chunks : [text.substring(0, maxSize)]
}

/**
 * Genera y guarda embeddings para un documento
 */
export async function generateDocumentEmbeddings(supabase, document) {
  const { id, text_content, doc_type, original_name } = document
  
  if (!text_content || text_content.length < 100) {
    console.log('⚠️ Texto insuficiente para embeddings')
    return { success: false, reason: 'Texto insuficiente' }
  }
  
  console.log(`📝 Generando embeddings para documento ${id}`)
  console.log(`   📏 Dimensiones configuradas: ${EMBEDDING_DIMENSIONS}`)
  
  try {
    // Dividir en chunks
    const chunks = chunkText(text_content)
    console.log(`   Chunks: ${chunks.length}`)
    
    let savedCount = 0
    
    for (let i = 0; i < chunks.length; i++) {
      try {
        const embedding = await generateEmbedding(chunks[i])
        console.log(`   Chunk ${i}: embedding con ${embedding.length} dimensiones`)
        
        // Guardar en Supabase
        const { error } = await supabase
          .from('document_embeddings')
          .insert({
            document_id: id,
            content_chunk: chunks[i],
            embedding: embedding,
            chunk_index: i,
            metadata: {
              doc_type,
              original_name,
              chunk_of: chunks.length
            }
          })
        
        if (error) {
          console.error(`   Error guardando chunk ${i}:`, error.message)
        } else {
          savedCount++
        }
        
        // Pausa entre requests para evitar rate limiting
        if (i < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 1000))
        }
        
      } catch (embError) {
        console.error(`Error en chunk ${i}:`, embError.message)
      }
    }
    
    console.log(`✅ Guardados ${savedCount}/${chunks.length} embeddings`)
    return { success: true, chunks: savedCount }
    
  } catch (error) {
    console.error('Error generando embeddings:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Busca documentos similares
 */
export async function searchSimilarDocuments(supabase, queryText, limit = 10) {
  try {
    const queryEmbedding = await generateEmbedding(queryText)
    
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.3,
      match_count: limit
    })
    
    if (error) throw error
    return data || []
    
  } catch (error) {
    console.error('Error buscando documentos:', error)
    return []
  }
}
