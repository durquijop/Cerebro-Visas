// ===========================================
// PROCESADOR DE DOCUMENTOS - v6
// Extrae texto de PDFs y DOCX con múltiples métodos
// ===========================================

/**
 * Método 1: Extraer texto usando pdf-parse v2 (API correcta)
 */
async function extractWithPdfParseV2(buffer) {
  try {
    const { PDFParse } = require('pdf-parse')
    
    // pdf-parse v2 acepta { data: buffer } para buffers
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    
    // Limpiar recursos
    await parser.destroy()
    
    console.log(`📊 pdf-parse v2 extrajo ${(result.text || '').length} caracteres`)
    
    return {
      success: result.text && result.text.length > 0,
      text: result.text || '',
      numPages: result.total || 0,
      method: 'pdf-parse-v2'
    }
  } catch (error) {
    console.error('❌ pdf-parse v2 extraction failed:', error.message)
    return {
      success: false,
      error: error.message,
      text: '',
      method: 'pdf-parse-v2'
    }
  }
}

/**
 * Método 2: Extraer texto usando unpdf
 */
async function extractWithUnpdf(buffer) {
  try {
    const { extractText: unpdfExtract, getDocumentProxy } = await import('unpdf')
    
    const uint8Array = new Uint8Array(buffer)
    const pdf = await getDocumentProxy(uint8Array)
    const numPages = pdf.numPages
    const { text } = await unpdfExtract(uint8Array)
    
    console.log(`📊 unpdf extrajo ${(text || '').length} caracteres de ${numPages} páginas`)
    
    return {
      success: text && text.length > 0,
      text: text || '',
      numPages,
      method: 'unpdf'
    }
  } catch (error) {
    console.error('❌ unpdf extraction failed:', error.message)
    return {
      success: false,
      error: error.message,
      text: '',
      method: 'unpdf'
    }
  }
}

/**
 * Método 3: Extraer texto usando pdfjs-dist
 */
async function extractWithPdfJs(buffer) {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    
    const uint8Array = new Uint8Array(buffer)
    
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0
    })
    
    const pdf = await loadingTask.promise
    const numPages = pdf.numPages
    let fullText = ''
    
    for (let i = 1; i <= numPages; i++) {
      try {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items.map(item => item.str).join(' ')
        fullText += pageText + '\n\n'
      } catch (pageError) {
        console.error(`   Error en página ${i}:`, pageError.message)
      }
    }
    
    await pdf.destroy()
    
    const trimmedText = fullText.trim()
    console.log(`📊 pdfjs-dist extrajo ${trimmedText.length} caracteres de ${numPages} páginas`)
    
    return {
      success: trimmedText.length > 0,
      text: trimmedText,
      numPages,
      method: 'pdfjs-dist'
    }
  } catch (error) {
    console.error('❌ pdfjs-dist extraction failed:', error.message)
    return {
      success: false,
      error: error.message,
      text: '',
      method: 'pdfjs-dist'
    }
  }
}

/**
 * Extrae texto de un archivo PDF usando múltiples métodos
 * Intenta en orden: pdf-parse v2 -> unpdf -> pdfjs-dist
 */
export async function extractTextFromPDF(buffer) {
  console.log('📄 Iniciando extracción de PDF...')
  console.log(`   Tamaño del buffer: ${buffer.length} bytes`)
  
  // Método 1: Intentar con pdf-parse v2 (más simple y directo)
  console.log('🔄 Intentando con pdf-parse v2...')
  let result = await extractWithPdfParseV2(buffer)
  
  if (result.success && result.text && result.text.trim().length > 10) {
    console.log(`✅ Extracción exitosa con ${result.method}`)
    return result
  }
  
  // Método 2: Intentar con unpdf
  console.log('🔄 Intentando con unpdf...')
  result = await extractWithUnpdf(buffer)
  
  if (result.success && result.text && result.text.trim().length > 10) {
    console.log(`✅ Extracción exitosa con ${result.method}`)
    return result
  }
  
  // Método 3: Intentar con pdfjs-dist
  console.log('🔄 Intentando con pdfjs-dist...')
  result = await extractWithPdfJs(buffer)
  
  if (result.success && result.text && result.text.trim().length > 10) {
    console.log(`✅ Extracción exitosa con ${result.method}`)
    return result
  }
  
  // Si ninguno funcionó
  console.log('❌ No se pudo extraer texto del PDF con ningún método')
  return {
    success: false,
    error: 'No se pudo extraer texto del PDF. El archivo puede estar escaneado (imagen) o protegido.',
    text: '',
    numPages: result.numPages || 0,
    suggestion: 'Si el PDF es escaneado, necesita OCR para extraer texto.',
    method: 'none'
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
