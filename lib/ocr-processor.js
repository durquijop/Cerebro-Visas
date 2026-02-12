/**
 * OCR Module v10 - Extrae texto de PDFs página por página
 * Optimizado para producción con timeouts cortos
 */

import { PDFDocument } from 'pdf-lib'

const MAX_PAGES_PER_BATCH = 2  // Menos páginas por lote para evitar timeouts
const PAGE_TIMEOUT = 45000     // 45 segundos por lote (más corto)
const MAX_RETRIES = 3          // Reintentos por lote

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
    console.error('❌ OPENAI_API_KEY no configurada')
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

    // Para archivos pequeños (<3MB) y pocas páginas (<5), procesar completo
    if (sizeMB < 3 && totalPages <= 5) {
      console.log(`📦 PDF pequeño (${sizeMB.toFixed(2)}MB, ${totalPages} págs), procesando completo...`)
      return await processFullPDF(pdfBuffer, OPENAI_API_KEY, totalPages)
    }

    // Para todo lo demás, procesar por lotes de páginas (más seguro)
    console.log(`📦 Procesando por lotes de ${MAX_PAGES_PER_BATCH} páginas...`)
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
 * Incluye reintentos automáticos para errores temporales
 */
async function processFullPDF(pdfBuffer, apiKey, totalPages, retryCount = 0) {
  const MAX_RETRIES = 3
  const pdfBase64 = pdfBuffer.toString('base64')
  
  console.log(`📤 Procesando PDF completo con GPT-4.1... ${retryCount > 0 ? `(intento ${retryCount + 1})` : ''}`)
  
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

    // Manejar errores temporales con reintento
    if (!response.ok) {
      const statusCode = response.status
      
      // Errores temporales que se pueden reintentar (503, 502, 429, 500)
      if ((statusCode === 503 || statusCode === 502 || statusCode === 429 || statusCode === 500) && retryCount < MAX_RETRIES) {
        const waitTime = (retryCount + 1) * 5000 // 5s, 10s, 15s
        console.log(`⚠️ Error ${statusCode} de OpenAI, reintentando en ${waitTime/1000}s...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        return processFullPDF(pdfBuffer, apiKey, totalPages, retryCount + 1)
      }
      
      throw new Error(`API Error: ${statusCode}`)
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
    
    // Si hay error y aún podemos reintentar
    if (retryCount < MAX_RETRIES && error.message.includes('503')) {
      const waitTime = (retryCount + 1) * 5000
      console.log(`⚠️ Error de red, reintentando en ${waitTime/1000}s...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      return processFullPDF(pdfBuffer, apiKey, totalPages, retryCount + 1)
    }
    
    throw error
  }
}

/**
 * Procesa el PDF página por página (para archivos grandes)
 * Incluye reintentos automáticos para errores temporales con backoff exponencial
 */
async function processPageByPage(pdfBuffer, pdfDoc, apiKey, totalPages) {
  const allText = []
  let successfulPages = 0
  let consecutiveErrors = 0
  
  // Procesar en lotes
  for (let startPage = 0; startPage < totalPages; startPage += MAX_PAGES_PER_BATCH) {
    const endPage = Math.min(startPage + MAX_PAGES_PER_BATCH, totalPages)
    const pageRange = `${startPage + 1}-${endPage}`
    
    console.log(`📄 Procesando páginas ${pageRange} de ${totalPages}...`)
    
    let retryCount = 0
    let success = false
    
    while (!success && retryCount < MAX_RETRIES) {
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
            model: 'gpt-4o',
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

        // Manejar errores temporales con reintento y backoff exponencial
        if (!response.ok) {
          const statusCode = response.status
          consecutiveErrors++
          
          // Para 429 (rate limit), esperar más tiempo
          if (statusCode === 429 && retryCount < MAX_RETRIES - 1) {
            retryCount++
            const waitTime = Math.min(retryCount * 10000, 30000) // Hasta 30s para rate limit
            console.log(`   ⚠️ Rate limit (429), esperando ${waitTime/1000}s... (intento ${retryCount + 1})`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          }
          
          // Para otros errores temporales
          if ((statusCode === 503 || statusCode === 502 || statusCode === 500) && retryCount < MAX_RETRIES - 1) {
            retryCount++
            const waitTime = retryCount * 5000
            console.log(`   ⚠️ Error ${statusCode}, reintentando en ${waitTime/1000}s... (intento ${retryCount + 1})`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          }
          
          console.log(`   ❌ Páginas ${pageRange}: Error ${statusCode}`)
          success = true // Salir del loop pero marcar como fallo
          continue
        }

        // Éxito - resetear contador de errores consecutivos
        consecutiveErrors = 0
        
        const data = await response.json()
        const pageText = data.choices?.[0]?.message?.content || ''
        
        if (pageText.length > 50) {
          allText.push(pageText)
          successfulPages += (endPage - startPage)
          console.log(`   ✅ Páginas ${pageRange}: ${pageText.length} caracteres`)
        } else {
          console.log(`   ⚠️ Páginas ${pageRange}: poco texto extraído`)
        }
        
        success = true
        
      } catch (error) {
        consecutiveErrors++
        
        if (error.name === 'AbortError') {
          console.log(`   ⚠️ Páginas ${pageRange}: Timeout`)
          success = true // No reintentar timeouts, continuar con siguiente lote
        } else {
          retryCount++
          if (retryCount < MAX_RETRIES) {
            const waitTime = Math.min(retryCount * 5000, 15000)
            console.log(`   ⚠️ Error: ${error.message}, reintentando en ${waitTime/1000}s...`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
          } else {
            console.log(`   ❌ Páginas ${pageRange}: ${error.message}`)
            success = true
          }
        }
      }
    }
    
    // Si hay muchos errores consecutivos, abortar para no perder tiempo
    if (consecutiveErrors >= 3) {
      console.log(`   ⛔ Demasiados errores consecutivos (${consecutiveErrors}), abortando OCR`)
      break
    }
    
    // Pequeña pausa entre lotes exitosos para evitar rate limiting
    if (success && startPage + MAX_PAGES_PER_BATCH < totalPages) {
      await new Promise(r => setTimeout(r, 2000)) // 2 segundos entre lotes
    }
  }
  
  const combinedText = allText.join('\n\n')
  
  console.log(`📊 Resultado OCR: ${successfulPages}/${totalPages} páginas procesadas`)
  console.log(`📊 Total caracteres extraídos: ${combinedText.length}`)
  
  return {
    success: combinedText.length > 100,
    text: combinedText,
    method: 'gpt-4.1-pages',
    pages: totalPages,
    pagesProcessed: successfulPages
  }
}
