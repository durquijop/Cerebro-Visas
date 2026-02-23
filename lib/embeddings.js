/**
 * Embeddings Service v4 - Embeddings REALES con OpenAI
 * Usa text-embedding-3-small (1536 dimensiones)
 */

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536

/**
 * Genera embedding real usando OpenAI API
 */
async function generateEmbedding(text) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada')
  
  // Limpiar y truncar texto (máximo ~8000 tokens ≈ 32000 chars)
  const cleanText = text.replace(/\s+/g, ' ').trim().substring(0, 30000)
  
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: cleanText,
      dimensions: EMBEDDING_DIMENSIONS
    })
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || `HTTP ${response.status}`)
  }
  
  const data = await response.json()
  const embedding = data.data?.[0]?.embedding
  
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error('Respuesta de embedding inválida')
  }
  
  return embedding
}

/**
 * Divide texto en chunks de tamaño óptimo
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
  
  // Si no hay chunks válidos, dividir por tamaño fijo
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
  console.log(`   Modelo: ${EMBEDDING_MODEL}`)
  console.log(`   Dimensiones: ${EMBEDDING_DIMENSIONS}`)
  console.log(`   Texto: ${text_content.length} caracteres`)
  
  try {
    // Dividir en chunks
    const chunks = chunkText(text_content)
    console.log(`   Chunks: ${chunks.length}`)
    
    // Eliminar embeddings anteriores de este documento
    await supabase
      .from('document_embeddings')
      .delete()
      .eq('document_id', id)
    
    let savedCount = 0
    
    for (let i = 0; i < chunks.length; i++) {
      try {
        console.log(`   Procesando chunk ${i + 1}/${chunks.length}...`)
        
        const embedding = await generateEmbedding(chunks[i])
        
        // Verificar que el embedding sea válido
        if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
          console.log(`   ⚠️ Chunk ${i}: embedding inválido (${embedding?.length} dims)`)
          continue
        }
        
        // Guardar en Supabase
        const { error } = await supabase
          .from('document_embeddings')
          .insert({
            document_id: id,
            content_chunk: chunks[i].substring(0, 10000), // Limitar tamaño del chunk guardado
            embedding: embedding,
            chunk_index: i,
            metadata: {
              doc_type,
              original_name,
              chunk_of: chunks.length,
              model: EMBEDDING_MODEL,
              dimensions: EMBEDDING_DIMENSIONS
            }
          })
        
        if (error) {
          console.error(`   ❌ Error guardando chunk ${i}:`, error.message)
        } else {
          savedCount++
          console.log(`   ✓ Chunk ${i + 1}: guardado (${EMBEDDING_DIMENSIONS} dims)`)
        }
        
        // Pausa entre requests
        if (i < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 500))
        }
        
      } catch (embError) {
        console.error(`   ❌ Error en chunk ${i}:`, embError.message)
      }
    }
    
    console.log(`✅ EMBEDDINGS: ${savedCount}/${chunks.length} guardados`)
    return { success: savedCount > 0, chunks: savedCount }
    
  } catch (error) {
    console.error('❌ Error generando embeddings:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Busca documentos similares usando embeddings
 */
export async function searchSimilarDocuments(supabase, queryText, limit = 10) {
  try {
    console.log('🔍 Buscando documentos similares...')
    
    const queryEmbedding = await generateEmbedding(queryText)
    
    // Usar función RPC de Supabase para búsqueda por similitud
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.3,
      match_count: limit
    })
    
    if (error) {
      console.error('Error en búsqueda:', error)
      return []
    }
    
    console.log(`   Encontrados: ${data?.length || 0} documentos`)
    return data || []
    
  } catch (error) {
    console.error('Error buscando documentos:', error)
    return []
  }
}

/**
 * Regenera embeddings para un documento específico
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
