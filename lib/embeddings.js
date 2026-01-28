/**
 * Servicio de Embeddings usando OpenAI
 * VERSIÓN 3: Usando API directa de OpenAI
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings'
const EMBEDDING_MODEL = 'text-embedding-3-small'

/**
 * Genera embedding para un texto usando OpenAI
 */
export async function generateEmbedding(text) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY no configurada')
  }

  // Limpiar y truncar texto si es muy largo (max ~8000 tokens)
  const cleanText = text
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 30000) // ~8000 tokens aproximadamente

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
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
 * Divide texto en chunks CON información de página
 * @param {string} text - Texto completo
 * @param {Array} pageTexts - Array de {pageNumber, text} por página (opcional)
 * @param {number} maxChunkSize - Tamaño máximo de chunk
 * @param {number} overlap - Solapamiento entre chunks
 */
export function chunkTextWithPages(text, pageTexts = null, maxChunkSize = 2000, overlap = 200) {
  const chunks = []
  
  // Si tenemos texto por página, hacer chunking inteligente
  if (pageTexts && pageTexts.length > 0) {
    let currentChunk = ''
    let chunkStartPage = pageTexts[0].pageNumber
    let chunkEndPage = pageTexts[0].pageNumber
    
    for (const page of pageTexts) {
      const pageText = page.text
      
      // Si agregar esta página excede el límite, guardar chunk actual
      if ((currentChunk + ' ' + pageText).length > maxChunkSize && currentChunk.length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          pageStart: chunkStartPage,
          pageEnd: chunkEndPage,
          pageRef: chunkStartPage === chunkEndPage 
            ? `Pág. ${chunkStartPage}` 
            : `Págs. ${chunkStartPage}-${chunkEndPage}`
        })
        
        // Comenzar nuevo chunk con overlap
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
    
    // Agregar último chunk
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
      
      // Overlap: mantener últimas palabras
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
 * VERSIÓN 2: Con referencias de página
 */
export async function generateDocumentEmbeddings(supabase, document, isFromCase = false) {
  const textContent = document.text_content
  const pageTexts = document.page_texts || null
  
  if (!textContent || textContent.length < 50) {
    console.log(`Documento ${document.id} sin suficiente texto para embeddings`)
    return { success: false, reason: 'insufficient_text' }
  }

  try {
    // Dividir en chunks CON información de página
    const chunks = chunkTextWithPages(textContent, pageTexts)
    console.log(`📝 Generando ${chunks.length} embeddings para documento ${document.id}`)
    
    if (pageTexts) {
      console.log(`   📖 Con referencias de página (${pageTexts.length} páginas detectadas)`)
    }

    // Eliminar embeddings anteriores de este documento
    const deleteColumn = isFromCase ? 'case_document_id' : 'document_id'
    await supabase
      .from('document_embeddings')
      .delete()
      .eq(deleteColumn, document.id)

    // Generar y guardar embeddings para cada chunk
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
        } else {
          savedCount++
        }

        // Rate limiting - esperar un poco entre llamadas
        if (i < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 100))
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
 * Busca documentos similares y devuelve con referencias de página
 */
export async function searchWithPageReferences(supabase, queryEmbedding, options = {}) {
  const { matchThreshold = 0.5, matchCount = 10 } = options
  
  const { data, error } = await supabase.rpc('search_similar_documents', {
    query_embedding: queryEmbedding,
    match_threshold: matchThreshold,
    match_count: matchCount
  })
  
  if (error) {
    console.error('Error en búsqueda:', error)
    return []
  }
  
  // Formatear resultados con referencias de página legibles
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
