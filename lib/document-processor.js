/**
 * Document Processor v3 - Extracción robusta de texto
 * 
 * ESTRATEGIA:
 * 1. PDFs con texto seleccionable → pdf-parse (rápido)
 * 2. PDFs escaneados → Google Cloud Vision OCR (confiable)
 * 
 * NO depende de herramientas del sistema (poppler, ghostscript, etc.)
 */

import { PDFDocument } from 'pdf-lib'

// Configuración
const GOOGLE_VISION_API_KEY = process.env.GOOGLE_CLOUD_VISION_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

/**
 * Función principal: extrae texto de cualquier documento
 */
export async function extractText(buffer, filename) {
  const ext = filename.toLowerCase().split('.').pop()
  const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2)
  
  console.log(`\n${'='.repeat(50)}`)
  console.log(`📂 PROCESANDO: ${filename}`)
  console.log(`   Tamaño: ${fileSizeMB} MB | Tipo: ${ext}`)
  console.log(`${'='.repeat(50)}`)
  
  try {
    switch (ext) {
      case 'pdf':
        return await extractFromPDF(buffer, filename)
      case 'docx':
        return await extractFromDOCX(buffer)
      case 'txt':
        return { success: true, text: buffer.toString('utf-8'), method: 'txt-direct' }
      default:
        return { success: false, text: '', error: `Formato no soportado: ${ext}` }
    }
  } catch (error) {
    console.error(`❌ Error fatal: ${error.message}`)
    return { success: false, text: '', error: error.message }
  }
}

/**
 * Extrae texto de PDF
 * Paso 1: Intenta pdf-parse (para PDFs con texto)
 * Paso 2: Si falla o hay poco texto, usa OCR
 */
async function extractFromPDF(buffer, filename) {
  console.log('\n📄 Paso 1: Intentando extracción directa con pdf-parse...')
  
  // Intentar pdf-parse primero
  try {
    const pdf = require('pdf-parse')
    const data = await pdf(buffer)
    const rawText = data.text || ''
    const cleanText = normalizeText(rawText)
    
    console.log(`   ✓ pdf-parse: ${data.numpages} páginas, ${cleanText.length} caracteres`)
    
    // Si hay suficiente texto (más de 200 chars por página promedio), usar este resultado
    const avgCharsPerPage = cleanText.length / data.numpages
    if (avgCharsPerPage > 200) {
      console.log(`   ✅ ÉXITO: Texto extraído directamente (${avgCharsPerPage.toFixed(0)} chars/página)`)
      return {
        success: true,
        text: cleanText,
        numPages: data.numpages,
        method: 'pdf-parse'
      }
    }
    
    console.log(`   ⚠️ Poco texto (${avgCharsPerPage.toFixed(0)} chars/página) - PDF probablemente escaneado`)
  } catch (parseError) {
    console.log(`   ⚠️ pdf-parse falló: ${parseError.message}`)
  }
  
  // Paso 2: Usar OCR
  console.log('\n🔍 Paso 2: Iniciando OCR...')
  return await performOCR(buffer, filename)
}

/**
 * Realiza OCR usando Google Cloud Vision o GPT-4o como fallback
 */
async function performOCR(pdfBuffer, filename) {
  // Obtener información del PDF
  let numPages = 1
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true })
    numPages = pdfDoc.getPageCount()
    console.log(`   📑 PDF tiene ${numPages} páginas`)
  } catch (e) {
    console.log(`   ⚠️ No se pudo leer metadata del PDF`)
  }
  
  // Convertir PDF a imágenes usando pdf-lib + canvas (100% JavaScript)
  console.log('   🖼️ Convirtiendo páginas a imágenes...')
  const images = await convertPDFToImagesJS(pdfBuffer, numPages)
  
  if (images.length === 0) {
    return { success: false, text: '', error: 'No se pudieron convertir las páginas a imágenes' }
  }
  
  console.log(`   ✓ ${images.length} imágenes generadas`)
  
  // Intentar Google Cloud Vision primero (más rápido y económico)
  if (GOOGLE_VISION_API_KEY) {
    console.log('\n   🌐 Usando Google Cloud Vision OCR...')
    try {
      const text = await ocrWithGoogleVision(images)
      if (text && text.length > 100) {
        console.log(`   ✅ Google Vision: ${text.length} caracteres extraídos`)
        return {
          success: true,
          text: normalizeText(text),
          numPages: numPages,
          method: 'google-vision-ocr'
        }
      }
    } catch (visionError) {
      console.log(`   ⚠️ Google Vision falló: ${visionError.message}`)
    }
  }
  
  // Fallback: GPT-4o Vision
  if (OPENAI_API_KEY) {
    console.log('\n   🤖 Usando GPT-4o Vision como fallback...')
    try {
      const text = await ocrWithGPT4o(images)
      if (text && text.length > 50) {
        console.log(`   ✅ GPT-4o: ${text.length} caracteres extraídos`)
        return {
          success: true,
          text: normalizeText(text),
          numPages: numPages,
          method: 'gpt4o-vision-ocr'
        }
      }
    } catch (gptError) {
      console.log(`   ⚠️ GPT-4o falló: ${gptError.message}`)
    }
  }
  
  return { success: false, text: '', error: 'OCR falló con todos los métodos disponibles' }
}

/**
 * Convierte PDF a imágenes usando pdf.js + canvas (100% JavaScript, sin dependencias del sistema)
 */
async function convertPDFToImagesJS(pdfBuffer, numPages) {
  const images = []
  
  try {
    // Importar dinámicamente para evitar problemas de ESM
    const { createCanvas } = require('canvas')
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    
    // Cargar el documento PDF
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0
    })
    
    const pdfDoc = await loadingTask.promise
    const totalPages = Math.min(pdfDoc.numPages, 10) // Máximo 10 páginas para OCR
    
    console.log(`   📄 Renderizando ${totalPages} páginas...`)
    
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        const page = await pdfDoc.getPage(pageNum)
        
        // Escala para buena calidad pero no excesiva (1.5 = ~108 DPI)
        const scale = 1.5
        const viewport = page.getViewport({ scale })
        
        // Crear canvas
        const canvas = createCanvas(viewport.width, viewport.height)
        const context = canvas.getContext('2d')
        
        // Fondo blanco
        context.fillStyle = 'white'
        context.fillRect(0, 0, viewport.width, viewport.height)
        
        // Renderizar página
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise
        
        // Convertir a JPEG base64
        const jpegBuffer = canvas.toBuffer('image/jpeg', { quality: 0.8 })
        const base64 = jpegBuffer.toString('base64')
        
        images.push({
          page: pageNum,
          base64: base64,
          width: viewport.width,
          height: viewport.height
        })
        
        console.log(`      ✓ Página ${pageNum}/${totalPages} renderizada`)
        
      } catch (pageError) {
        console.log(`      ⚠️ Error en página ${pageNum}: ${pageError.message}`)
      }
    }
    
  } catch (error) {
    console.error(`   ❌ Error convirtiendo PDF: ${error.message}`)
    
    // Plan B: Enviar el PDF directamente como base64 a Google Vision
    // Google Vision puede procesar PDFs directamente
    console.log('   🔄 Intentando enviar PDF directamente...')
    images.push({
      page: 1,
      base64: pdfBuffer.toString('base64'),
      isPDF: true
    })
  }
  
  return images
}

/**
 * OCR con Google Cloud Vision API (REST)
 */
async function ocrWithGoogleVision(images) {
  const allText = []
  
  for (const img of images) {
    try {
      const requestBody = {
        requests: [{
          image: {
            content: img.base64
          },
          features: [{
            type: 'DOCUMENT_TEXT_DETECTION',
            maxResults: 1
          }],
          imageContext: {
            languageHints: ['en', 'es']
          }
        }]
      }
      
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      )
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || `HTTP ${response.status}`)
      }
      
      const data = await response.json()
      const annotation = data.responses?.[0]?.fullTextAnnotation
      
      if (annotation?.text) {
        allText.push(annotation.text)
        console.log(`      ✓ Página ${img.page}: ${annotation.text.length} chars`)
      }
      
      // Pequeña pausa entre requests
      if (images.indexOf(img) < images.length - 1) {
        await sleep(500)
      }
      
    } catch (error) {
      console.log(`      ⚠️ Error en página ${img.page}: ${error.message}`)
    }
  }
  
  return allText.join('\n\n')
}

/**
 * OCR con GPT-4o Vision (fallback)
 */
async function ocrWithGPT4o(images) {
  const allText = []
  
  // Procesar en lotes de 2 páginas
  for (let i = 0; i < images.length; i += 2) {
    const batch = images.slice(i, i + 2)
    
    const content = [
      {
        type: 'text',
        text: 'Extract and transcribe ALL text from these document images. Copy every word exactly as shown, maintaining the original structure. Output only the transcribed text, nothing else.'
      }
    ]
    
    for (const img of batch) {
      if (!img.isPDF) {
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${img.base64}`,
            detail: 'high'
          }
        })
      }
    }
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content }],
          max_tokens: 4096,
          temperature: 0
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || `HTTP ${response.status}`)
      }
      
      const data = await response.json()
      const text = data.choices?.[0]?.message?.content || ''
      
      if (text.length > 50) {
        allText.push(text)
        console.log(`      ✓ Páginas ${batch.map(b => b.page).join('-')}: ${text.length} chars`)
      }
      
      // Pausa entre requests
      if (i + 2 < images.length) {
        await sleep(2000)
      }
      
    } catch (error) {
      console.log(`      ⚠️ Error GPT-4o: ${error.message}`)
    }
  }
  
  return allText.join('\n\n')
}

/**
 * Extrae texto de DOCX
 */
async function extractFromDOCX(buffer) {
  try {
    const mammoth = require('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return {
      success: true,
      text: normalizeText(result.value),
      method: 'mammoth-docx'
    }
  } catch (error) {
    return { success: false, text: '', error: error.message }
  }
}

/**
 * Normaliza y limpia el texto extraído
 */
export function normalizeText(text) {
  if (!text) return ''
  
  return text
    // Normalizar saltos de línea
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Eliminar múltiples espacios
    .replace(/[ \t]+/g, ' ')
    // Eliminar líneas vacías múltiples
    .replace(/\n{3,}/g, '\n\n')
    // Eliminar espacios al inicio/final de líneas
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Trim final
    .trim()
}

/**
 * Helper: sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
