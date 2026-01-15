// ===========================================
// PROCESADOR DE DOCUMENTOS - v3
// Extrae texto de PDFs y DOCX con múltiples métodos
// ===========================================

/**
 * Método 1: Extraer texto usando pdfjs-dist (Mozilla PDF.js)
 * Más robusto y compatible que pdf-parse
 */
async function extractWithPdfJs(buffer) {
  try {
    // Import pdfjs-dist para Node.js (ESM)
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    
    // Convertir buffer a Uint8Array
    const uint8Array = new Uint8Array(buffer)
    
    // Cargar el documento
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0
    })
    
    const pdf = await loadingTask.promise
    const numPages = pdf.numPages
    let fullText = ''
    
    console.log(`📄 PDF tiene ${numPages} páginas`)
    
    // Extraer texto de cada página
    for (let i = 1; i <= numPages; i++) {
      try {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        
        // Concatenar todos los items de texto
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ')
        
        fullText += pageText + '\n\n'
        console.log(`   Página ${i}: ${pageText.length} caracteres`)
      } catch (pageError) {
        console.error(`   Error en página ${i}:`, pageError.message)
      }
    }
    
    // Limpiar recursos
    await pdf.destroy()
    
    const trimmedText = fullText.trim()
    console.log(`📊 pdfjs-dist extrajo ${trimmedText.length} caracteres totales`)
    
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
 * Método 2 (Fallback): Extraer texto usando pdf-parse
 */
async function extractWithPdfParse(buffer) {
  try {
    // Usar require para CommonJS
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)
    
    console.log(`📊 pdf-parse extrajo ${(data.text || '').length} caracteres`)
    
    return {
      success: data.text && data.text.length > 0,
      text: data.text || '',
      numPages: data.numpages,
      info: data.info,
      method: 'pdf-parse'
    }
  } catch (error) {
    console.error('❌ pdf-parse extraction failed:', error.message)
    return {
      success: false,
      error: error.message,
      text: '',
      method: 'pdf-parse'
    }
  }
}

/**
 * Extrae texto de un archivo PDF usando múltiples métodos
 * Intenta primero con pdfjs-dist, luego con pdf-parse como fallback
 */
export async function extractTextFromPDF(buffer) {
  console.log('📄 Iniciando extracción de PDF...')
  console.log(`   Tamaño del buffer: ${buffer.length} bytes`)
  
  // Método 1: Intentar con pdfjs-dist (más robusto)
  let result = await extractWithPdfJs(buffer)
  
  // Verificar si tuvo éxito y extrajo texto
  if (result.success && result.text && result.text.trim().length > 10) {
    console.log(`✅ Extracción exitosa con ${result.method}: ${result.text.length} caracteres, ${result.numPages} páginas`)
    return result
  }
  
  console.log('⚠️ pdfjs-dist no extrajo suficiente texto, intentando con pdf-parse...')
  
  // Método 2: Intentar con pdf-parse como fallback
  result = await extractWithPdfParse(buffer)
  
  if (result.success && result.text && result.text.trim().length > 10) {
    console.log(`✅ Extracción exitosa con ${result.method}: ${result.text.length} caracteres`)
    return result
  }
  
  // Si ninguno funcionó, retornar el resultado con información útil
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
