/**
 * Servicio de Embeddings usando OpenAI
 * VERSIÓN 4: Usa OpenAI directamente con técnica de pseudo-embeddings
 * Genera vectores semánticos usando GPT para extraer características
 */

const EMBEDDING_DIMENSIONS = 1536 // Dimensiones del vector (compatible con OpenAI)

/**
 * Genera embedding para un texto usando OpenAI GPT
 * Técnica: Extrae palabras clave semánticas y genera un vector hash
 */
export async function generateEmbedding(text) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  
  if (!OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY no configurada')
    throw new Error('Embeddings no disponibles - API key no configurada')
  }

  // Limpiar y truncar texto
  const cleanText = text
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 8000)

  try {
    // Usar GPT para extraer características semánticas del texto
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: `Extrae exactamente 50 palabras clave semánticas del texto. 
Devuelve SOLO las palabras separadas por comas, sin explicaciones.
Incluye: conceptos legales, términos técnicos, nombres, fechas, números de caso.
Formato: palabra1, palabra2, palabra3, ...`
          },
          {
            role: 'user',
            content: cleanText
          }
        ],
        temperature: 0,
        max_tokens: 500
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Error en OpenAI:', error)
      throw new Error(`Error generando embedding: ${response.status}`)
    }

    const data = await response.json()
    const keywords = data.choices[0]?.message?.content || ''
    
    // Convertir keywords a vector numérico usando hash consistente
    const embedding = keywordsToVector(keywords, cleanText)
    
    return embedding
  } catch (error) {
    console.error('Error generating embedding:', error)
    throw error
  }
}

/**
 * Convierte keywords y texto a un vector numérico usando hash
 * Genera vectores de 1536 dimensiones para compatibilidad con OpenAI
 */
function keywordsToVector(keywords, originalText) {
  const vector = new Array(EMBEDDING_DIMENSIONS).fill(0)
  
  // Procesar keywords
  const words = keywords.toLowerCase()
    .split(/[,\s]+/)
    .filter(w => w.length > 2)
  
  // También incluir palabras importantes del texto original
  const textWords = originalText.toLowerCase()
    .replace(/[^a-záéíóúñ0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 200) // Más palabras para mejor distribución
  
  const allWords = [...new Set([...words, ...textWords])]
  
  // Generar vector usando múltiples hashes por palabra
  for (const word of allWords) {
    // Usar múltiples posiciones por palabra para mejor distribución
    for (let i = 0; i < 5; i++) {
      const hash = simpleHash(word + i.toString())
      const index = Math.abs(hash) % EMBEDDING_DIMENSIONS
      const value = ((hash % 1000) / 1000)
      vector[index] += value
      
      // Agregar variación a índices cercanos
      const spread = Math.floor(EMBEDDING_DIMENSIONS / 100)
      for (let j = 1; j <= 3; j++) {
        const idx1 = (index + j * spread) % EMBEDDING_DIMENSIONS
        const idx2 = (index + EMBEDDING_DIMENSIONS - j * spread) % EMBEDDING_DIMENSIONS
        vector[idx1] += value * (0.5 / j)
        vector[idx2] += value * (0.5 / j)
      }
    }
  }
  
  // Normalizar el vector
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] = vector[i] / magnitude
    }
  }
  
  return vector
}

/**
 * Hash simple pero consistente para strings
 */
function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convertir a 32bit integer
  }
  return hash
}

/**
 * Divide texto en chunks CON información de página
 */
export function chunkTextWithPages(text, pageTexts = null, maxChunkSize = 2000, overlap = 200) {
  const chunks = []
  
  if (pageTexts && pageTexts.length > 0) {
    let currentChunk = ''
    let chunkStartPage = pageTexts[0].pageNumber
    let chunkEndPage = pageTexts[0].pageNumber
    
    for (const page of pageTexts) {
      const pageText = page.text
      
      if ((currentChunk + ' ' + pageText).length > maxChunkSize && currentChunk.length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          pageStart: chunkStartPage,
          pageEnd: chunkEndPage,
          pageRef: chunkStartPage === chunkEndPage 
            ? `Pág. ${chunkStartPage}` 
            : `Págs. ${chunkStartPage}-${chunkEndPage}`
        })
        
        const words = currentChunk.split(' ')
        const overlapText = words.slice(-Math.floor(overlap / 5)).join(' ')
        currentChunk = overlapText + ' ' + pageText
        chunkStartPage = page.pageNumber
        chunkEndPage = page.pageNumber
      } else {
        currentChunk += (currentChunk ? ' ' : '') + pageText
        chunkEndPage = page.pageNumber
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        pageStart: chunkStartPage,
        pageEnd: chunkEndPage,
        pageRef: chunkStartPage === chunkEndPage 
          ? `Pág. ${chunkStartPage}` 
          : `Págs. ${chunkStartPage}-${chunkEndPage}`
      })
    }
    
    return chunks
  }
  
  // Fallback: chunking sin información de página
  const sentences = text.split(/(?<=[.!?])\s+/)
  let currentChunk = ''
  let chunkIndex = 0
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        pageStart: null,
        pageEnd: null,
        pageRef: null,
        chunkIndex: chunkIndex++
      })
      
      const words = currentChunk.split(' ')
      currentChunk = words.slice(-Math.floor(overlap / 5)).join(' ') + ' ' + sentence
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      pageStart: null,
      pageEnd: null,
      pageRef: null,
      chunkIndex: chunkIndex
    })
  }
  
  return chunks.length > 0 ? chunks : [{
    text: text.substring(0, maxChunkSize),
    pageStart: null,
    pageEnd: null,
    pageRef: null,
    chunkIndex: 0
  }]
}

/**
 * Función legacy para compatibilidad
 */
export function chunkText(text, maxChunkSize = 2000, overlap = 200) {
  const chunksWithMeta = chunkTextWithPages(text, null, maxChunkSize, overlap)
  return chunksWithMeta.map(c => c.text)
}

/**
 * Genera embeddings para un documento y los guarda en la BD
 */
export async function generateDocumentEmbeddings(supabase, document, isFromCase = false) {
  const textContent = document.text_content
  const pageTexts = document.page_texts || null
  
  if (!textContent || textContent.length < 50) {
    console.log(`Documento ${document.id} sin suficiente texto para embeddings`)
    return { success: false, reason: 'insufficient_text' }
  }

  try {
    const chunks = chunkTextWithPages(textContent, pageTexts)
    console.log(`📝 Generando ${chunks.length} embeddings para documento ${document.id}`)
    
    if (pageTexts) {
      console.log(`   📖 Con referencias de página (${pageTexts.length} páginas detectadas)`)
    }

    // Eliminar embeddings anteriores
    const deleteColumn = isFromCase ? 'case_document_id' : 'document_id'
    await supabase
      .from('document_embeddings')
      .delete()
      .eq(deleteColumn, document.id)

    let savedCount = 0
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      
      try {
        const embedding = await generateEmbedding(chunk.text)
        
        const embeddingRecord = {
          content_chunk: chunk.text,
          chunk_index: i,
          embedding: JSON.stringify(embedding),
          page_start: chunk.pageStart,
          page_end: chunk.pageEnd,
          page_ref: chunk.pageRef,
          metadata: {
            doc_type: document.doc_type || document.outcome_type,
            original_name: document.name || document.original_name,
            chunk_of: chunks.length,
            has_page_ref: !!chunk.pageRef
          }
        }

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
        } else {
          savedCount++
        }

        // Rate limiting
        if (i < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 200))
        }
      } catch (embError) {
        console.error(`Error en chunk ${i}:`, embError)
      }
    }

    console.log(`✅ Guardados ${savedCount}/${chunks.length} embeddings`)
    return { success: true, chunks: savedCount }
  } catch (error) {
    console.error('Error generating document embeddings:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Busca documentos similares
 */
export async function searchWithPageReferences(supabase, queryEmbedding, options = {}) {
  const { matchThreshold = 0.3, matchCount = 10 } = options
  
  const { data, error } = await supabase.rpc('search_similar_documents', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_threshold: matchThreshold,
    match_count: matchCount
  })
  
  if (error) {
    console.error('Error en búsqueda:', error)
    return []
  }
  
  return (data || []).map(item => ({
    ...item,
    citation: formatCitation(item)
  }))
}

/**
 * Formatea una cita con página
 */
function formatCitation(item) {
  const docName = item.metadata?.original_name || 'Documento'
  const docType = item.metadata?.doc_type || ''
  
  let citation = docName
  
  if (item.page_ref) {
    citation += ` (${item.page_ref})`
  }
  
  if (docType) {
    citation = `[${docType}] ${citation}`
  }
  
  return citation
}
