// ===========================================
// PROCESADOR DE DOCUMENTOS - v7
// Extrae texto de PDFs y DOCX
// Usa pdf-parse v1 (más estable)
// ===========================================

/**
 * Extrae texto de un archivo PDF usando pdf-parse v1
 */
export async function extractTextFromPDF(buffer) {
  console.log('📄 Iniciando extracción de PDF...')
  console.log(`   Tamaño del buffer: ${buffer.length} bytes`)
  
  try {
    // pdf-parse v1 - API simple: pdf(buffer) returns promise
    const pdf = require('pdf-parse')
    const data = await pdf(buffer)
    
    const text = data.text || ''
    const numPages = data.numpages || 0
    
    console.log(`📊 pdf-parse extrajo ${text.length} caracteres de ${numPages} páginas`)
    
    if (text && text.trim().length > 10) {
      console.log(`✅ Extracción exitosa`)
      return {
        success: true,
        text: text,
        numPages: numPages,
        info: data.info,
        method: 'pdf-parse'
      }
    }
    
    // Si no hay texto suficiente
    console.log('⚠️ PDF no contiene texto extraíble')
    return {
      success: false,
      error: 'El PDF no contiene texto extraíble. Puede ser un documento escaneado (imagen).',
      text: '',
      numPages: numPages,
      suggestion: 'Si el PDF es escaneado, necesita OCR para extraer texto.',
      method: 'pdf-parse'
    }
    
  } catch (error) {
    console.error('❌ Error en extracción de PDF:', error.message)
    return {
      success: false,
      error: error.message,
      text: '',
      numPages: 0,
      method: 'pdf-parse'
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
    
    console.log(`✅ DOCX extraído: ${result.value.length} caracteres`)
    
    return {
      success: true,
      text: result.value,
      messages: result.messages,
      method: 'mammoth'
    }
  } catch (error) {
    console.error('Error extracting DOCX:', error)
    return {
      success: false,
      error: error.message,
      text: '',
      method: 'mammoth'
    }
  }
}

/**
 * Detecta el tipo de archivo y extrae el texto
 */
export async function extractText(buffer, filename) {
  const extension = filename.toLowerCase().split('.').pop()
  console.log(`📂 Procesando archivo: ${filename} (tipo: .${extension}, tamaño: ${buffer.length} bytes)`)
  
  switch (extension) {
    case 'pdf':
      return await extractTextFromPDF(buffer)
    case 'docx':
      return await extractTextFromDOCX(buffer)
    case 'doc':
      return {
        success: false,
        error: 'Formato .doc no soportado. Por favor convierta a .docx o .pdf',
        text: '',
        method: 'none'
      }
    case 'txt':
      const text = buffer.toString('utf-8')
      console.log(`✅ TXT leído: ${text.length} caracteres`)
      return {
        success: true,
        text: text,
        method: 'plaintext'
      }
    default:
      return {
        success: false,
        error: `Formato .${extension} no soportado`,
        text: '',
        method: 'none'
      }
  }
}

/**
 * Limpia y normaliza el texto extraído
 */
export function normalizeText(text) {
  if (!text) return ''
  
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Divide el texto en chunks para procesamiento
 */
export function chunkText(text, maxChunkSize = 8000) {
  if (!text) return []
  
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
