/**
 * OCR Module v11 - Extrae texto de PDFs usando GPT-4o Vision
 * Convierte páginas PDF a imágenes para procesamiento correcto
 */

import { PDFDocument } from 'pdf-lib'
import { createCanvas } from 'canvas'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

const MAX_PAGES_PER_BATCH = 2  // Páginas por lote
const PAGE_TIMEOUT = 60000     // 60 segundos por lote
const MAX_RETRIES = 3          // Reintentos por lote
const IMAGE_SCALE = 1.5        // Escala para renderizar (balance calidad/tamaño)

/**
 * Convierte una página de PDF a imagen base64
 */
async function pdfPageToImage(pdfBuffer, pageNumber) {
  try {
    // Cargar el PDF con pdf.js
    const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer })
    const pdfDoc = await loadingTask.promise
    
    // Obtener la página (1-indexed)
    const page = await pdfDoc.getPage(pageNumber)
    
    // Obtener dimensiones
    const viewport = page.getViewport({ scale: IMAGE_SCALE })
    
    // Crear canvas
    const canvas = createCanvas(viewport.width, viewport.height)
    const context = canvas.getContext('2d')
    
    // Renderizar la página
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise
    
    // Convertir a base64 PNG
    const imageBase64 = canvas.toDataURL('image/png').split(',')[1]
    
    return {
      success: true,
      base64: imageBase64,
      width: viewport.width,
      height: viewport.height
    }
  } catch (error) {
    console.error(`Error convirtiendo página ${pageNumber} a imagen:`, error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Extrae texto de un PDF usando IA via OpenAI GPT-4o Vision
 */
export async function extractTextWithOCR(pdfBuffer) {
  console.log('🔍 Iniciando extracción de PDF con GPT-4o Vision...')
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

    // Procesar por lotes de páginas
    console.log(`📦 Procesando por lotes de ${MAX_PAGES_PER_BATCH} páginas...`)
    return await processPageByPage(pdfBuffer, totalPages, OPENAI_API_KEY)

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
 * Procesa el PDF página por página, convirtiendo a imágenes
 */
async function processPageByPage(pdfBuffer, totalPages, apiKey) {
  const allText = []
  let successfulPages = 0
  let consecutiveErrors = 0
  
  // Procesar en lotes
  for (let startPage = 1; startPage <= totalPages; startPage += MAX_PAGES_PER_BATCH) {
    const endPage = Math.min(startPage + MAX_PAGES_PER_BATCH - 1, totalPages)
    const pageRange = startPage === endPage ? `${startPage}` : `${startPage}-${endPage}`
    
    console.log(`📄 Procesando páginas ${pageRange} de ${totalPages}...`)
    
    let retryCount = 0
    let success = false
    
    while (!success && retryCount < MAX_RETRIES) {
      try {
        // Convertir páginas a imágenes
        const images = []
        for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
          console.log(`   📸 Convirtiendo página ${pageNum} a imagen...`)
          const imageResult = await pdfPageToImage(pdfBuffer, pageNum)
          if (imageResult.success) {
            images.push({
              pageNumber: pageNum,
              base64: imageResult.base64
            })
          } else {
            console.log(`   ⚠️ No se pudo convertir página ${pageNum}`)
          }
        }
        
        if (images.length === 0) {
          console.log(`   ❌ No se pudieron convertir las páginas ${pageRange}`)
          success = true
          continue
        }
        
        // Construir el mensaje con imágenes
        const content = [
          {
            type: 'text',
            text: `Extrae TODO el texto visible de estas ${images.length} página(s) de un documento legal/inmigración.

INSTRUCCIONES:
1. Extrae CADA palabra visible exactamente como aparece
2. Incluye fechas, números de caso, nombres, direcciones
3. Para cada página, marca con "--- Página ${startPage} ---", etc.
4. NO resumas ni interpretes - extrae el texto COMPLETO y LITERAL
5. Mantén el formato original (párrafos, listas)

Devuelve SOLO el texto extraído:`
          }
        ]
        
        // Agregar cada imagen
        for (const img of images) {
          content.push({
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${img.base64}`,
              detail: 'high'
            }
          })
        }
        
        // Hacer la solicitud a OpenAI
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
                content: content
              }
            ],
            max_tokens: 8000,
            temperature: 0
          }),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        // Manejar errores
        if (!response.ok) {
          const statusCode = response.status
          consecutiveErrors++
          
          let errorMessage = ''
          try {
            const errorBody = await response.json()
            errorMessage = errorBody.error?.message || JSON.stringify(errorBody)
            console.log(`   📛 API Error: ${errorMessage}`)
          } catch (e) {
            errorMessage = `HTTP ${statusCode}`
          }
          
          // Para 429 (rate limit), esperar más tiempo
          if (statusCode === 429 && retryCount < MAX_RETRIES - 1) {
            retryCount++
            const waitTime = Math.min(retryCount * 15000, 45000)
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
          
          console.log(`   ❌ Páginas ${pageRange}: Error ${statusCode} - ${errorMessage}`)
          success = true
          continue
        }

        // Éxito
        consecutiveErrors = 0
        
        const data = await response.json()
        const pageText = data.choices?.[0]?.message?.content || ''
        
        if (pageText.length > 50) {
          allText.push(pageText)
          successfulPages += (endPage - startPage + 1)
          console.log(`   ✅ Páginas ${pageRange}: ${pageText.length} caracteres`)
        } else {
          console.log(`   ⚠️ Páginas ${pageRange}: poco texto extraído (${pageText.length} chars)`)
        }
        
        success = true
        
      } catch (error) {
        consecutiveErrors++
        
        if (error.name === 'AbortError') {
          console.log(`   ⚠️ Páginas ${pageRange}: Timeout`)
          success = true
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
    
    // Si hay muchos errores consecutivos, abortar
    if (consecutiveErrors >= 3) {
      console.log(`   ⛔ Demasiados errores consecutivos (${consecutiveErrors}), abortando OCR`)
      break
    }
    
    // Pausa entre lotes para evitar rate limiting
    if (success && startPage + MAX_PAGES_PER_BATCH <= totalPages) {
      await new Promise(r => setTimeout(r, 2000))
    }
  }
  
  const combinedText = allText.join('\n\n')
  
  console.log(`📊 Resultado OCR: ${successfulPages}/${totalPages} páginas procesadas`)
  console.log(`📊 Total caracteres extraídos: ${combinedText.length}`)
  
  return {
    success: combinedText.length > 100,
    text: combinedText,
    method: 'gpt-4o-vision',
    pages: totalPages,
    pagesProcessed: successfulPages
  }
}
