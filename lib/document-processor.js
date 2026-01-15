// ===========================================
// PROCESADOR DE DOCUMENTOS
// Extrae texto de PDFs y DOCX
// ===========================================

/**
 * Extrae texto de un archivo PDF usando pdf-parse
 */
export async function extractTextFromPDF(buffer) {
  try {
    // Dynamic import para evitar problemas con SSR
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
    const data = await pdfParse(buffer)
    
    return {
      success: true,
      text: data.text,
      numPages: data.numpages,
      info: data.info,
      metadata: data.metadata
    }
  } catch (error) {
    console.error('Error extracting PDF:', error)
    return {
      success: false,
      error: error.message,
      text: ''
    }
  }
}

/**
 * Extrae texto de un archivo DOCX usando mammoth
 */
export async function extractTextFromDOCX(buffer) {
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    
    return {
      success: true,
      text: result.value,
      messages: result.messages
    }
  } catch (error) {
    console.error('Error extracting DOCX:', error)
    return {
      success: false,
      error: error.message,
      text: ''
    }
  }
}

/**
 * Detecta el tipo de archivo y extrae el texto
 */
export async function extractText(buffer, filename) {
  const extension = filename.toLowerCase().split('.').pop()
  
  switch (extension) {
    case 'pdf':
      return await extractTextFromPDF(buffer)
    case 'docx':
      return await extractTextFromDOCX(buffer)
    case 'doc':
      // .doc requiere conversión adicional, por ahora retornamos error
      return {
        success: false,
        error: 'Formato .doc no soportado. Por favor convierta a .docx o .pdf',
        text: ''
      }
    case 'txt':
      return {
        success: true,
        text: buffer.toString('utf-8')
      }
    default:
      return {
        success: false,
        error: `Formato .${extension} no soportado`,
        text: ''
      }
  }
}

/**
 * Limpia y normaliza el texto extraído
 */
export function normalizeText(text) {
  return text
    // Remover múltiples espacios en blanco
    .replace(/\s+/g, ' ')
    // Remover caracteres especiales problemáticos
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    // Normalizar saltos de línea
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remover líneas vacías múltiples
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Divide el texto en chunks para procesamiento
 */
export function chunkText(text, maxChunkSize = 8000) {
  const chunks = []
  const paragraphs = text.split('\n\n')
  let currentChunk = ''
  
  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
      }
      currentChunk = paragraph
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks
}
