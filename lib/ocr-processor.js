/**
 * OCR Module v13 - Extrae texto de PDFs usando GPT-4o Vision
 * Usa pdf-poppler para convertir PDF a imágenes (más robusto)
 */

import { PDFDocument } from 'pdf-lib'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)

const MAX_PAGES_PER_REQUEST = 4
const PAGE_TIMEOUT = 90000
const MAX_RETRIES = 3

/**
 * Convierte un PDF a imágenes PNG usando pdftoppm (poppler)
 * Si no está disponible, usa método alternativo con sharp
 */
async function convertPdfToImages(pdfBuffer, totalPages) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-ocr-'))
  const pdfPath = path.join(tempDir, 'input.pdf')
  const images = []
  
  try {
    // Guardar PDF temporal
    await fs.writeFile(pdfPath, pdfBuffer)
    
    // Intentar usar pdftoppm (poppler-utils)
    try {
      const outputPrefix = path.join(tempDir, 'page')
      await execAsync(`pdftoppm -png -r 150 "${pdfPath}" "${outputPrefix}"`, { timeout: 60000 })
      
      // Leer las imágenes generadas
      const files = await fs.readdir(tempDir)
      const pngFiles = files.filter(f => f.endsWith('.png')).sort()
      
      for (let i = 0; i < pngFiles.length; i++) {
        const imgPath = path.join(tempDir, pngFiles[i])
        const imgBuffer = await fs.readFile(imgPath)
        const base64 = imgBuffer.toString('base64')
        images.push({
          pageNumber: i + 1,
          base64: base64,
          size: Math.round(base64.length / 1024)
        })
        console.log(`      Página ${i + 1}: ${images[i].size}KB`)
      }
    } catch (popplerError) {
      console.log('   ⚠️ pdftoppm no disponible, usando método alternativo...')
      // Método alternativo: usar pdf.js con canvas
      return await convertWithPdfJs(pdfBuffer, totalPages)
    }
    
  } finally {
    // Limpiar archivos temporales
    try {
      const files = await fs.readdir(tempDir)
      for (const file of files) {
        await fs.unlink(path.join(tempDir, file))
      }
      await fs.rmdir(tempDir)
    } catch (e) {
      // Ignorar errores de limpieza
    }
  }
  
  return images
}

/**
 * Método alternativo usando pdf.js (si poppler no está disponible)
 */
async function convertWithPdfJs(pdfBuffer, totalPages) {
  const images = []
  
  try {
    // Importar módulos
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const { createCanvas } = await import('canvas')
    
    // Crear una copia del buffer como Uint8Array
    const data = new Uint8Array(pdfBuffer)
    
    // Cargar documento
    const loadingTask = pdfjs.getDocument({ 
      data: data,
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0
    })
    const doc = await loadingTask.promise
    
    for (let pageNum = 1; pageNum <= Math.min(totalPages, 20); pageNum++) {
      try {
        const page = await doc.getPage(pageNum)
        const viewport = page.getViewport({ scale: 1.5 })
        
        const canvas = createCanvas(
          Math.floor(viewport.width), 
          Math.floor(viewport.height)
        )
        const context = canvas.getContext('2d')
        
        // Fondo blanco
        context.fillStyle = 'white'
        context.fillRect(0, 0, canvas.width, canvas.height)
        
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise
        
        const buffer = canvas.toBuffer('image/png')
        const base64 = buffer.toString('base64')
        
        images.push({
          pageNumber: pageNum,
          base64: base64,
          size: Math.round(base64.length / 1024)
        })
        
        console.log(`      Página ${pageNum}: ${images[images.length-1].size}KB`)
        
      } catch (pageError) {
        console.log(`      ⚠️ Error en página ${pageNum}: ${pageError.message}`)
      }
    }
    
  } catch (error) {
    console.error('   ❌ Error con pdf.js:', error.message)
  }
  
  return images
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
    return { success: false, text: '', error: 'OPENAI_API_KEY no configurada' }
  }

  try {
    // Obtener número de páginas
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true })
    const totalPages = pdfDoc.getPageCount()
    console.log(`📄 PDF tiene ${totalPages} páginas`)

    // Convertir PDF a imágenes
    console.log('📸 Convirtiendo páginas a imágenes...')
    const allImages = await convertPdfToImages(pdfBuffer, totalPages)
    
    if (allImages.length === 0) {
      console.log('❌ No se pudieron convertir las páginas a imágenes')
      return { success: false, text: '', error: 'No se pudieron convertir las páginas' }
    }
    
    console.log(`✅ ${allImages.length} páginas convertidas a imágenes`)

    // Procesar imágenes con GPT-4o Vision
    return await processImagesWithVision(allImages, totalPages, OPENAI_API_KEY)

  } catch (error) {
    console.error('❌ Error en OCR:', error.message)
    return { success: false, text: '', error: error.message }
  }
}

/**
 * Procesa las imágenes con GPT-4o Vision
 */
async function processImagesWithVision(images, totalPages, apiKey) {
  const allText = []
  let successfulPages = 0
  
  // Procesar en lotes
  for (let i = 0; i < images.length; i += MAX_PAGES_PER_REQUEST) {
    const batch = images.slice(i, i + MAX_PAGES_PER_REQUEST)
    const pageRange = batch.length === 1 
      ? `${batch[0].pageNumber}` 
      : `${batch[0].pageNumber}-${batch[batch.length-1].pageNumber}`
    
    console.log(`📄 Enviando páginas ${pageRange} a GPT-4o Vision...`)
    
    let retryCount = 0
    let success = false
    
    while (!success && retryCount < MAX_RETRIES) {
      try {
        // Construir contenido con imágenes
        const content = [
          {
            type: 'text',
            text: `Extrae TODO el texto de estas ${batch.length} página(s) de un documento de inmigración USCIS.

INSTRUCCIONES:
1. Extrae CADA palabra visible exactamente como aparece
2. Incluye fechas, números de caso (IOE...), nombres, direcciones
3. Marca cada página: "--- PÁGINA X ---"
4. NO resumas - extrae el texto COMPLETO y LITERAL
5. Mantén el formato (párrafos, listas)

SOLO devuelve el texto extraído:`
          }
        ]
        
        // Agregar imágenes
        for (const img of batch) {
          content.push({
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${img.base64}`,
              detail: 'high'
            }
          })
        }
        
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

        if (!response.ok) {
          const statusCode = response.status
          let errorMsg = `HTTP ${statusCode}`
          try {
            const err = await response.json()
            errorMsg = err.error?.message || errorMsg
          } catch (e) {}
          
          console.log(`   📛 Error: ${errorMsg}`)
          
          if ((statusCode === 429 || statusCode === 503 || statusCode === 502) && retryCount < MAX_RETRIES - 1) {
            retryCount++
            const wait = statusCode === 429 ? 20000 * retryCount : 5000 * retryCount
            console.log(`   ⏳ Reintentando en ${wait/1000}s...`)
            await new Promise(r => setTimeout(r, wait))
            continue
          }
          success = true
          continue
        }

        const data = await response.json()
        const text = data.choices?.[0]?.message?.content || ''
        
        if (text.length > 50) {
          allText.push(text)
          successfulPages += batch.length
          console.log(`   ✅ Extraídos ${text.length} caracteres`)
        } else {
          console.log(`   ⚠️ Poco texto: ${text.length} chars`)
        }
        
        success = true
        
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log(`   ⚠️ Timeout`)
        } else {
          console.log(`   ⚠️ Error: ${error.message}`)
        }
        retryCount++
        if (retryCount < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 5000))
        } else {
          success = true
        }
      }
    }
    
    // Pausa entre lotes
    if (i + MAX_PAGES_PER_REQUEST < images.length) {
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
