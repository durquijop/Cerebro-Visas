/**
 * Embeddings Service v5 - Sistema híbrido
 * 
 * Intenta usar OpenAI embeddings, si falla usa pseudo-embeddings locales
 * Los pseudo-embeddings usan TF-IDF simplificado para generar vectores
 */

const EMBEDDING_DIMENSIONS = 1536

/**
 * Genera embedding - intenta OpenAI primero, luego fallback local
 */
async function generateEmbedding(text) {
  const apiKey = process.env.OPENAI_API_KEY
  
  // Intentar OpenAI si hay API key
  if (apiKey) {
    try {
      const embedding = await generateOpenAIEmbedding(text, apiKey)
      if (embedding) return { embedding, method: 'openai' }
    } catch (e) {
      console.log(`   ⚠️ OpenAI embeddings no disponible: ${e.message}`)
    }
  }
  
  // Fallback: pseudo-embedding local
  console.log('   📊 Usando pseudo-embeddings locales')
  return { embedding: generateLocalEmbedding(text), method: 'local' }
}

/**
 * Genera embedding con OpenAI
 */
async function generateOpenAIEmbedding(text, apiKey) {
  const cleanText = text.replace(/\s+/g, ' ').trim().substring(0, 8000)
  
  // Intentar con diferentes modelos
  const models = ['text-embedding-3-small', 'text-embedding-ada-002']
  
  for (const model of models) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model, input: cleanText })
      })
      
      if (response.ok) {
        const data = await response.json()
        const embedding = data.data?.[0]?.embedding
        if (embedding && embedding.length > 0) {
          return embedding
        }
      }
    } catch (e) {
      // Continuar con siguiente modelo
    }
  }
  
  return null
}

/**
 * Genera pseudo-embedding local usando TF-IDF simplificado
 * Produce vectores de 1536 dimensiones basados en características del texto
 */
function generateLocalEmbedding(text) {
  const vector = new Float32Array(EMBEDDING_DIMENSIONS).fill(0)
  
  // Normalizar texto
  const normalized = text.toLowerCase()
    .replace(/[^a-záéíóúñü0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  
  // Extraer palabras y n-gramas
  const words = normalized.split(' ').filter(w => w.length > 2)
  const bigrams = []
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(words[i] + '_' + words[i + 1])
  }
  
  // Contar frecuencias
  const freq = {}
  for (const word of [...words, ...bigrams]) {
    freq[word] = (freq[word] || 0) + 1
  }
  
  // Generar características del vector
  const terms = Object.keys(freq)
  
  for (const term of terms) {
    const tf = freq[term] / words.length // Term frequency
    const weight = tf * Math.log(1 + 1 / (freq[term] || 1)) // TF-IDF aproximado
    
    // Hash del término para determinar posiciones
    let hash = 0
    for (let i = 0; i < term.length; i++) {
      hash = ((hash << 5) - hash) + term.charCodeAt(i)
      hash = hash & hash
    }
    
    // Distribuir en múltiples posiciones del vector
    const numPositions = Math.min(20, Math.ceil(term.length / 2))
    for (let i = 0; i < numPositions; i++) {
      const pos = Math.abs((hash * (i + 1) * 31) % EMBEDDING_DIMENSIONS)
      const sign = ((hash >> i) & 1) ? 1 : -1
      vector[pos] += weight * sign / (i + 1)
    }
  }
  
  // Agregar características estadísticas del documento
  const docFeatures = [
    words.length / 1000,                    // Longitud normalizada
    terms.length / 500,                     // Vocabulario único
    text.split('\n').length / 100,          // Número de líneas
    (text.match(/[A-Z]/g) || []).length / text.length, // Ratio mayúsculas
    (text.match(/\d/g) || []).length / text.length,    // Ratio números
  ]
  
  for (let i = 0; i < docFeatures.length; i++) {
    vector[i] = docFeatures[i]
  }
  
  // Normalizar vector (L2 norm)
  let magnitude = 0
  for (let i = 0; i < vector.length; i++) {
    magnitude += vector[i] * vector[i]
  }
  magnitude = Math.sqrt(magnitude)
  
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= magnitude
    }
  }
  
  return Array.from(vector)
}

/**
 * Divide texto en chunks
 */
function chunkText(text, maxSize = 4000) {
  const chunks = []
  const paragraphs = text.split(/\n\n+/)
  let currentChunk = ''
  
  for (const para of paragraphs) {
    if ((currentChunk + para).length > maxSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = ''
    }
    currentChunk += (currentChunk ? '\n\n' : '') + para
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }
  
  if (chunks.length === 0) {
    for (let i = 0; i < text.length; i += maxSize) {
      chunks.push(text.substring(i, i + maxSize).trim())
    }
  }
  
  return chunks
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
  
  console.log(`\n📝 GENERANDO EMBEDDINGS para ${id}`)
  console.log(`   Texto: ${text_content.length} caracteres`)
  
  try {
    const chunks = chunkText(text_content)
    console.log(`   Chunks: ${chunks.length}`)
    
    // Eliminar embeddings anteriores
    await supabase
      .from('document_embeddings')
      .delete()
      .eq('document_id', id)
    
    let savedCount = 0
    let embeddingMethod = 'unknown'
    
    for (let i = 0; i < chunks.length; i++) {
      try {
        console.log(`   Procesando chunk ${i + 1}/${chunks.length}...`)
        
        const { embedding, method } = await generateEmbedding(chunks[i])
        embeddingMethod = method
        
        if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
          console.log(`   ⚠️ Embedding inválido`)
          continue
        }
        
        const { error } = await supabase
          .from('document_embeddings')
          .insert({
            document_id: id,
            content_chunk: chunks[i].substring(0, 10000),
            embedding: embedding,
            chunk_index: i,
            metadata: {
              doc_type,
              original_name,
              chunk_of: chunks.length,
              method: embeddingMethod,
              dimensions: EMBEDDING_DIMENSIONS
            }
          })
        
        if (error) {
          console.error(`   ❌ Error guardando:`, error.message)
        } else {
          savedCount++
          console.log(`   ✓ Chunk ${i + 1}: guardado (${method})`)
        }
        
        if (i < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 300))
        }
        
      } catch (embError) {
        console.error(`   ❌ Error en chunk ${i}:`, embError.message)
      }
    }
    
    console.log(`✅ EMBEDDINGS: ${savedCount}/${chunks.length} guardados (${embeddingMethod})`)
    return { success: savedCount > 0, chunks: savedCount, method: embeddingMethod }
    
  } catch (error) {
    console.error('❌ Error generando embeddings:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Busca documentos similares
 */
export async function searchSimilarDocuments(supabase, queryText, limit = 10) {
  try {
    console.log('🔍 Buscando documentos similares...')
    
    const { embedding } = await generateEmbedding(queryText)
    
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: 0.3,
      match_count: limit
    })
    
    if (error) {
      console.error('Error en búsqueda:', error)
      return []
    }
    
    return data || []
    
  } catch (error) {
    console.error('Error buscando documentos:', error)
    return []
  }
}

/**
 * Regenera embeddings para un documento
 */
export async function regenerateEmbeddings(supabase, documentId) {
  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, text_content, doc_type, name')
    .eq('id', documentId)
    .single()
  
  if (error || !doc) {
    return { success: false, error: 'Documento no encontrado' }
  }
  
  return generateDocumentEmbeddings(supabase, {
    id: doc.id,
    text_content: doc.text_content,
    doc_type: doc.doc_type,
    original_name: doc.name
  })
}
