/**
 * OCR Module v12 - Extrae texto de PDFs usando GPT-4o Vision
 * Usa pdfjs-dist para renderizar y sharp para optimizar imágenes
 */

import { PDFDocument } from 'pdf-lib'

const MAX_PAGES_PER_REQUEST = 4  // Máximo de imágenes por request a OpenAI
const PAGE_TIMEOUT = 90000       // 90 segundos por request
const MAX_RETRIES = 3            // Reintentos por lote
const MAX_IMAGE_SIZE = 1500      // Tamaño máximo de imagen (px)

/**
 * Renderiza una página de PDF a imagen usando Canvas (Node.js)
 * Retorna base64 de la imagen
 */
async function renderPdfPageToImage(pdfBuffer, pageNumber) {
  try {
    // Importar dinámicamente para evitar problemas de SSR
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const { createCanvas } = await import('canvas')
    
    // Cargar el PDF
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) })
    const pdfDoc = await loadingTask.promise
    
    // Obtener la página
    const page = await pdfDoc.getPage(pageNumber)
    
    // Calcular escala para que la imagen no sea muy grande
    const originalViewport = page.getViewport({ scale: 1.0 })
    const maxDimension = Math.max(originalViewport.width, originalViewport.height)
    const scale = maxDimension > MAX_IMAGE_SIZE ? MAX_IMAGE_SIZE / maxDimension : 1.5
    
    const viewport = page.getViewport({ scale })
    
    // Crear canvas
    const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height))
    const context = canvas.getContext('2d')
    
    // Fondo blanco
    context.fillStyle = 'white'
    context.fillRect(0, 0, canvas.width, canvas.height)
    
    // Renderizar la página
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    }
    
    await page.render(renderContext).promise
    
    // Convertir a PNG base64
    const buffer = canvas.toBuffer('image/png')
    const base64 = buffer.toString('base64')
    
    // Limpiar recursos
    page.cleanup()
    
    console.log(`      Página ${pageNumber}: ${canvas.width}x${canvas.height}px, ${Math.round(base64.length/1024)}KB`)
    
    return {
      success: true,
      base64: base64,
      width: canvas.width,
      height: canvas.height
    }
  } catch (error) {
    console.error(`   ❌ Error renderizando página ${pageNumber}:`, error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Extrae texto de un PDF usando GPT-4o Vision
 */
export async function extractTextWithOCR(pdfBuffer) {
  console.log('🔍 Iniciando OCR con GPT-4o Vision...')
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
    // Obtener número de páginas
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true })
    const totalPages = pdfDoc.getPageCount()
    console.log(`📄 PDF tiene ${totalPages} páginas`)

    // Procesar todas las páginas
    return await processAllPages(pdfBuffer, totalPages, OPENAI_API_KEY)

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
 * Procesa todas las páginas del PDF
 */
async function processAllPages(pdfBuffer, totalPages, apiKey) {
  const allText = []
  let successfulPages = 0
  let consecutiveErrors = 0
  
  // Procesar en lotes
  for (let startPage = 1; startPage <= totalPages; startPage += MAX_PAGES_PER_REQUEST) {
    const endPage = Math.min(startPage + MAX_PAGES_PER_REQUEST - 1, totalPages)
    const pageRange = startPage === endPage ? `${startPage}` : `${startPage}-${endPage}`
    
    console.log(`📄 Procesando páginas ${pageRange} de ${totalPages}...`)
    
    let retryCount = 0
    let success = false
    
    while (!success && retryCount < MAX_RETRIES) {
      try {
        // Renderizar páginas a imágenes
        const images = []
        console.log(`   📸 Renderizando páginas a imágenes...`)
        
        for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
          const result = await renderPdfPageToImage(pdfBuffer, pageNum)
          if (result.success) {
            images.push({
              pageNumber: pageNum,
              base64: result.base64
            })
          }
        }
        
        if (images.length === 0) {
          console.log(`   ❌ No se pudieron renderizar las páginas`)
          success = true
          continue
        }
        
        console.log(`   🤖 Enviando ${images.length} imágenes a GPT-4o...`)
        
        // Construir mensaje con imágenes
        const content = [
          {
            type: 'text',
            text: `Extrae TODO el texto de estas ${images.length} página(s) de un documento de inmigración (USCIS).

INSTRUCCIONES IMPORTANTES:
1. Extrae CADA palabra visible, exactamente como aparece
2. Incluye: fechas, números de caso (como IOE...), nombres, direcciones
3. Marca cada página: "--- PÁGINA ${startPage} ---", "--- PÁGINA ${startPage + 1} ---", etc.
4. NO resumas ni interpretes - extrae el texto LITERAL y COMPLETO
5. Mantén el formato (párrafos, listas, bullets)

DEVUELVE SOLO el texto extraído:`
          }
        ]
        
        // Agregar imágenes
        for (const img of images) {
          content.push({
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${img.base64}`,
              detail: 'high'
            }
          })
        }
        
        // Request a OpenAI
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
            messages: [{ role: 'user', content }],
            max_tokens: 16000,
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
          } catch (e) {
            errorMessage = `HTTP ${statusCode}`
          }
          
          console.log(`   📛 Error ${statusCode}: ${errorMessage}`)
          
          if ((statusCode === 429 || statusCode === 503 || statusCode === 502) && retryCount < MAX_RETRIES - 1) {
            retryCount++
            const waitTime = statusCode === 429 ? retryCount * 20000 : retryCount * 5000
            console.log(`   ⏳ Reintentando en ${waitTime/1000}s... (intento ${retryCount + 1})`)
            await new Promise(r => setTimeout(r, waitTime))
            continue
          }
          
          success = true
          continue
        }

        // Éxito
        consecutiveErrors = 0
        const data = await response.json()
        const pageText = data.choices?.[0]?.message?.content || ''
        
        if (pageText.length > 50) {
          allText.push(pageText)
          successfulPages += images.length
          console.log(`   ✅ Extraídos ${pageText.length} caracteres`)
        } else {
          console.log(`   ⚠️ Poco texto extraído: ${pageText.length} chars`)
        }
        
        success = true
        
      } catch (error) {
        consecutiveErrors++
        
        if (error.name === 'AbortError') {
          console.log(`   ⚠️ Timeout en páginas ${pageRange}`)
          success = true
        } else {
          retryCount++
          console.log(`   ⚠️ Error: ${error.message}`)
          if (retryCount < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, 5000))
          } else {
            success = true
          }
        }
      }
    }
    
    // Abortar si hay muchos errores
    if (consecutiveErrors >= 3) {
      console.log(`   ⛔ Demasiados errores, abortando OCR`)
      break
    }
    
    // Pausa entre requests
    if (startPage + MAX_PAGES_PER_REQUEST <= totalPages) {
      await new Promise(r => setTimeout(r, 2000))
    }
  }
  
  const combinedText = allText.join('\n\n')
  
  console.log(`📊 OCR completado: ${successfulPages}/${totalPages} páginas`)
  console.log(`📊 Total: ${combinedText.length} caracteres`)
  
  return {
    success: combinedText.length > 100,
    text: combinedText,
    method: 'gpt-4o-vision',
    pages: totalPages,
    pagesProcessed: successfulPages
  }
}
