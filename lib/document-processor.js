// ===========================================
// PROCESADOR DE DOCUMENTOS - v8
// Extrae texto de PDFs y DOCX
// Incluye OCR para PDFs escaneados
// ===========================================

/**
 * Importación dinámica del módulo OCR para evitar conflictos
 */
async function getOCRProcessor() {
  const { extractTextWithOCR } = await import('./ocr-processor.js')
  return extractTextWithOCR
}

/**
 * Extrae texto de un archivo PDF usando pdf-parse v1
 * Si el PDF es escaneado, usa OCR automáticamente
 * OPTIMIZADO: Usa menos memoria para archivos grandes
 */
export async function extractTextFromPDF(buffer, useOCRFallback = true) {
  console.log('📄 Iniciando extracción de PDF...')
  const bufferSizeMB = (buffer.length / 1024 / 1024).toFixed(2)
  console.log(`   Tamaño del buffer: ${bufferSizeMB} MB`)
  
  // Para archivos muy grandes (>10MB), usar extracción simplificada
  const isLargeFile = buffer.length > 10 * 1024 * 1024
  
  try {
    // pdf-parse v1 - API simple: pdf(buffer) returns promise
    const pdf = require('pdf-parse')
    
    // Configuración simplificada para archivos grandes
    const options = isLargeFile ? {
      // Sin pagerender personalizado para ahorrar memoria
      max: 100 // Limitar a 100 páginas máximo
    } : {
      pagerender: function(pageData) {
        return pageData.getTextContent().then(function(textContent) {
          let lastY, text = '';
          for (let item of textContent.items) {
            if (lastY == item.transform[5] || !lastY) {
              text += item.str;
            } else {
              text += '\n' + item.str;
            }
            lastY = item.transform[5];
          }
          return text;
        });
      }
    }
    
    const data = await pdf(buffer, options)
    
    const text = data.text || ''
    const numPages = data.numpages || 0
    
    console.log(`📊 pdf-parse extrajo ${text.length} caracteres de ${numPages} páginas`)
    
    // Para archivos grandes, no extraer por página (ahorra memoria)
    let pageTexts = null
    if (!isLargeFile && text && text.trim().length > 50) {
      pageTexts = [{
        pageNumber: 1,
        text: text.substring(0, 50000), // Limitar tamaño
        isFullDocument: true
      }]
    }
    
    if (text && text.trim().length > 50) {
      console.log(`✅ Extracción exitosa`)
      return {
        success: true,
        text: text,
        numPages: numPages,
        pageTexts: pageTexts,
        info: data.info,
        method: 'pdf-parse'
      }
    }
    
    // Si no hay texto suficiente y el archivo NO es muy grande, intentar OCR
    if (useOCRFallback && !isLargeFile) {
      console.log('⚠️ PDF sin texto extraíble. Intentando OCR...')
      try {
        const extractTextWithOCR = await getOCRProcessor()
        const ocrResult = await extractTextWithOCR(buffer)
        
        if (ocrResult.success && ocrResult.text.length > 50) {
          return {
            success: true,
            text: ocrResult.text,
            numPages: numPages,
            pageTexts: ocrResult.pageTexts || null,
            method: ocrResult.method || 'ocr'
          }
        }
      } catch (ocrError) {
        console.error('⚠️ Error en OCR:', ocrError.message)
      }
    } else if (isLargeFile) {
      console.log('⚠️ Archivo muy grande, OCR deshabilitado para ahorrar memoria')
    }
    
    // Si OCR también falla o no se intentó
    console.log('⚠️ No se pudo extraer texto del PDF')
    return {
      success: false,
      error: isLargeFile 
        ? 'PDF grande sin texto extraíble (OCR no disponible para archivos >10MB)'
        : 'El PDF no contiene texto extraíble y OCR no pudo procesarlo.',
      text: '',
      numPages: numPages,
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

/**
 * Procesa un documento y extrae su contenido de texto
 * Esta es la función principal que se usa para bulk upload
 */
export async function processDocument(buffer, filename) {
  console.log(`🔄 processDocument: Procesando ${filename}`)
  
  const result = await extractText(buffer, filename)
  
  if (!result.success) {
    throw new Error(result.error || 'No se pudo extraer texto del documento')
  }
  
  const normalizedText = normalizeText(result.text)
  console.log(`✅ processDocument: Extraído ${normalizedText.length} caracteres`)
  
  return normalizedText
}
