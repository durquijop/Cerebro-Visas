/**
 * OCR Module v9 - Extrae texto de PDFs página por página
 * Procesa cada página individualmente para manejar archivos grandes
 */

import { PDFDocument } from 'pdf-lib'

const MAX_PAGES_PER_BATCH = 3  // Páginas por lote
const PAGE_TIMEOUT = 60000     // 60 segundos por lote

/**
 * Extrae texto de un PDF usando IA via OpenAI
 * Procesa página por página para archivos grandes
 */
export async function extractTextWithOCR(pdfBuffer) {
  console.log('🔍 Iniciando extracción de PDF con OpenAI...')
  const sizeMB = pdfBuffer.length / 1024 / 1024
  console.log(`   Tamaño del PDF: ${sizeMB.toFixed(2)} MB`)
  
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  
  if (!OPENAI_API_KEY) {
    return {
      success: false,
      text: '',
      error: 'OPENAI_API_KEY no configurada'
    }
  }

  try {
    // Cargar el PDF para obtener número de páginas
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true })
    const totalPages = pdfDoc.getPageCount()
    console.log(`📄 PDF tiene ${totalPages} páginas`)

    // Si es pequeño (< 5MB), procesar completo
    if (sizeMB < 5) {
      console.log(`📦 PDF pequeño, procesando completo...`)
      return await processFullPDF(pdfBuffer, OPENAI_API_KEY, totalPages)
    }

    // Para PDFs grandes, procesar por lotes de páginas
    console.log(`📦 PDF grande, procesando por lotes de ${MAX_PAGES_PER_BATCH} páginas...`)
    return await processPageByPage(pdfBuffer, pdfDoc, OPENAI_API_KEY, totalPages)

  } catch (error) {
    console.error('❌ Error en OCR:', error.message)
    return {
      success: false,
      text: '',
      error: error.message
    }
  }
}

/**
 * Procesa el PDF completo (para archivos pequeños)
 */
async function processFullPDF(pdfBuffer, apiKey, totalPages) {
  const pdfBase64 = pdfBuffer.toString('base64')
  
  console.log(`📤 Procesando PDF completo con GPT-4.1...`)
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 180000) // 3 minutos
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                file: {
                  filename: 'document.pdf',
                  file_data: `data:application/pdf;base64,${pdfBase64}`
                }
              },
              {
                type: 'text',
                text: `Extrae TODO el texto de este documento PDF (${totalPages} páginas).

INSTRUCCIONES:
1. Extrae CADA palabra de TODAS las páginas
2. Incluye fechas, números de caso, nombres
3. Marca cada página con "--- Página X ---"
4. NO resumas - extrae el texto COMPLETO

Devuelve solo el texto extraído:`
              }
            ]
          }
        ],
        max_tokens: 16000,
        temperature: 0
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`)
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''
    
    console.log(`✅ Extracción completada: ${text.length} caracteres`)
    
    return {
      success: text.length > 100,
      text: text,
      method: 'gpt-4.1-full',
      pages: totalPages
    }
    
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error.name === 'AbortError') {
      console.log('⚠️ Timeout en PDF completo, intentando por páginas...')
      // Si falla, intentar por páginas
      const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true })
      return await processPageByPage(pdfBuffer, pdfDoc, apiKey, totalPages)
    }
    
    throw error
  }
}

/**
 * Procesa el PDF página por página (para archivos grandes)
 */
async function processPageByPage(pdfBuffer, pdfDoc, apiKey, totalPages) {
  const allText = []
  let successfulPages = 0
  
  // Procesar en lotes
  for (let startPage = 0; startPage < totalPages; startPage += MAX_PAGES_PER_BATCH) {
    const endPage = Math.min(startPage + MAX_PAGES_PER_BATCH, totalPages)
    const pageRange = `${startPage + 1}-${endPage}`
    
    console.log(`📄 Procesando páginas ${pageRange} de ${totalPages}...`)
    
    try {
      // Crear un nuevo PDF con solo las páginas del lote
      const batchPdf = await PDFDocument.create()
      const pagesToCopy = []
      
      for (let i = startPage; i < endPage; i++) {
        pagesToCopy.push(i)
      }
      
      const copiedPages = await batchPdf.copyPages(pdfDoc, pagesToCopy)
      copiedPages.forEach(page => batchPdf.addPage(page))
      
      const batchBuffer = await batchPdf.save()
      const batchBase64 = Buffer.from(batchBuffer).toString('base64')
      
      // Procesar el lote
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), PAGE_TIMEOUT)
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4.1',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'file',
                  file: {
                    filename: `pages_${pageRange}.pdf`,
                    file_data: `data:application/pdf;base64,${batchBase64}`
                  }
                },
                {
                  type: 'text',
                  text: `Extrae TODO el texto de estas páginas (${startPage + 1} a ${endPage} de ${totalPages}).

INSTRUCCIONES:
1. Extrae CADA palabra visible
2. Incluye fechas, números, nombres
3. Marca "--- Página ${startPage + 1} ---", "--- Página ${startPage + 2} ---", etc.
4. NO resumas ni omitas nada

Devuelve solo el texto extraído:`
                }
              ]
            }
          ],
          max_tokens: 8000,
          temperature: 0
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        const pageText = data.choices?.[0]?.message?.content || ''
        
        if (pageText.length > 50) {
          allText.push(pageText)
          successfulPages += (endPage - startPage)
          console.log(`   ✅ Páginas ${pageRange}: ${pageText.length} caracteres`)
        } else {
          console.log(`   ⚠️ Páginas ${pageRange}: poco texto extraído`)
        }
      } else {
        console.log(`   ❌ Páginas ${pageRange}: Error ${response.status}`)
      }
      
      // Pequeña pausa entre lotes
      if (endPage < totalPages) {
        await new Promise(r => setTimeout(r, 1000))
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`   ⚠️ Páginas ${pageRange}: Timeout`)
      } else {
        console.log(`   ❌ Páginas ${pageRange}: ${error.message}`)
      }
    }
  }
  
  const combinedText = allText.join('\n\n')
  
  console.log(`📊 Resultado: ${successfulPages}/${totalPages} páginas procesadas`)
  console.log(`📊 Total caracteres: ${combinedText.length}`)
  
  return {
    success: combinedText.length > 100,
    text: combinedText,
    method: 'gpt-4.1-pages',
    pages: totalPages,
    pagesProcessed: successfulPages
  }
}
