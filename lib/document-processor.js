/**
 * Document Processor v4 - Extracción robusta de texto
 * 
 * ESTRATEGIA:
 * 1. PDFs con texto seleccionable → pdf-parse (rápido)
 * 2. PDFs escaneados → pdf-to-img + Google Cloud Vision OCR
 * 
 * 100% JavaScript - NO depende de herramientas del sistema
 */

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
 */
async function extractFromPDF(buffer, filename) {
  console.log('\n📄 Paso 1: Intentando extracción directa con pdf-parse...')
  
  // Intentar pdf-parse primero
  let numPages = 1
  try {
    const pdf = require('pdf-parse')
    const data = await pdf(buffer)
    const rawText = data.text || ''
    const cleanText = normalizeText(rawText)
    numPages = data.numpages || 1
    
    console.log(`   ✓ pdf-parse: ${numPages} páginas, ${cleanText.length} caracteres`)
    
    // Si hay suficiente texto (más de 150 chars por página promedio), usar este resultado
    const avgCharsPerPage = cleanText.length / numPages
    if (avgCharsPerPage > 150) {
      console.log(`   ✅ ÉXITO: Texto extraído directamente (${avgCharsPerPage.toFixed(0)} chars/página)`)
      return {
        success: true,
        text: cleanText,
        numPages: numPages,
        method: 'pdf-parse'
      }
    }
    
    console.log(`   ⚠️ Poco texto (${avgCharsPerPage.toFixed(0)} chars/página) - PDF probablemente escaneado`)
  } catch (parseError) {
    console.log(`   ⚠️ pdf-parse falló: ${parseError.message}`)
  }
  
  // Paso 2: Usar OCR
  console.log('\n🔍 Paso 2: Iniciando OCR con imágenes...')
  return await performOCR(buffer, numPages)
}

/**
 * Realiza OCR convirtiendo PDF a imágenes
 */
async function performOCR(pdfBuffer, numPages) {
  console.log('   🖼️ Convirtiendo PDF a imágenes con pdf-to-img...')
  
  // Convertir PDF a imágenes
  const images = await convertPDFToImages(pdfBuffer)
  
  if (images.length === 0) {
    console.log('   ❌ No se pudieron generar imágenes')
    return { success: false, text: '', error: 'No se pudieron convertir las páginas a imágenes' }
  }
  
  console.log(`   ✓ ${images.length} imágenes generadas`)
  
  // Intentar Google Cloud Vision primero (más económico)
  if (GOOGLE_VISION_API_KEY) {
    console.log('\n   🌐 Intentando Google Cloud Vision OCR...')
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
      console.log('   ⚠️ Google Vision: poco texto extraído')
    } catch (visionError) {
      console.log(`   ⚠️ Google Vision error: ${visionError.message}`)
    }
  } else {
    console.log('   ⚠️ GOOGLE_CLOUD_VISION_API_KEY no configurada')
  }
  
  // Fallback: GPT-4o Vision
  if (OPENAI_API_KEY) {
    console.log('\n   🤖 Usando GPT-4o Vision OCR...')
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
      console.log(`   ⚠️ GPT-4o error: ${gptError.message}`)
    }
  }
  
  return { success: false, text: '', error: 'OCR falló con todos los métodos' }
}

/**
 * Convierte PDF a imágenes usando pdf-to-img (100% JavaScript)
 */
async function convertPDFToImages(pdfBuffer) {
  const images = []
  
  try {
    // Importar pdf-to-img dinámicamente (es ESM)
    const { pdf } = await import('pdf-to-img')
    
    // Convertir buffer a Uint8Array
    const pdfData = new Uint8Array(pdfBuffer)
    
    // Generar imágenes (máximo 10 páginas)
    let pageNum = 0
    const maxPages = 10
    
    for await (const image of await pdf(pdfData, { scale: 1.5 })) {
      pageNum++
      if (pageNum > maxPages) {
        console.log(`      ⚠️ Limitado a ${maxPages} páginas`)
        break
      }
      
      // image es un Buffer PNG
      const base64 = image.toString('base64')
      images.push({
        page: pageNum,
        base64: base64,
        mimeType: 'image/png'
      })
      
      console.log(`      ✓ Página ${pageNum} convertida (${(image.length / 1024).toFixed(0)} KB)`)
    }
    
  } catch (error) {
    console.error(`   ❌ Error en pdf-to-img: ${error.message}`)
    
    // Si falla, intentar enviar el PDF directamente (Google Vision puede leer PDFs)
    if (GOOGLE_VISION_API_KEY) {
      console.log('   🔄 Plan B: Enviando PDF directamente a Google Vision...')
      images.push({
        page: 1,
        base64: pdfBuffer.toString('base64'),
        mimeType: 'application/pdf',
        isPDF: true
      })
    }
  }
  
  return images
}

/**
 * OCR con Google Cloud Vision API (REST directo)
 */
async function ocrWithGoogleVision(images) {
  const allText = []
  
  for (const img of images) {
    try {
      // Google Vision puede procesar PDFs directamente o imágenes
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
      
      // Verificar si hay error en la respuesta
      if (data.responses?.[0]?.error) {
        throw new Error(data.responses[0].error.message)
      }
      
      const annotation = data.responses?.[0]?.fullTextAnnotation
      
      if (annotation?.text) {
        allText.push(annotation.text)
        console.log(`      ✓ Página ${img.page}: ${annotation.text.length} caracteres`)
      } else {
        console.log(`      ⚠️ Página ${img.page}: sin texto detectado`)
      }
      
      // Pequeña pausa entre requests
      if (images.indexOf(img) < images.length - 1) {
        await sleep(300)
      }
      
    } catch (error) {
      console.log(`      ⚠️ Error página ${img.page}: ${error.message}`)
      // Si es error de billing, propagarlo para que se intente GPT-4o
      if (error.message.includes('billing')) {
        throw error
      }
    }
  }
  
  return allText.join('\n\n--- PÁGINA ---\n\n')
}

/**
 * OCR con GPT-4o Vision (fallback)
 */
async function ocrWithGPT4o(images) {
  const allText = []
  
  // Filtrar solo imágenes (no PDFs crudos)
  const imageOnly = images.filter(img => !img.isPDF)
  
  if (imageOnly.length === 0) {
    throw new Error('No hay imágenes para procesar con GPT-4o')
  }
  
  // Procesar en lotes de 2 páginas para eficiencia
  for (let i = 0; i < imageOnly.length; i += 2) {
    const batch = imageOnly.slice(i, i + 2)
    const pageNums = batch.map(b => b.page).join(', ')
    
    const content = [
      {
        type: 'text',
        text: `You are an OCR assistant. Extract ALL text from these scanned document page(s). 
Rules:
- Copy every word EXACTLY as shown
- Maintain paragraph structure
- Include headers, dates, addresses, all content
- Output ONLY the extracted text, no commentary
- If you see a form, extract all filled-in values`
      }
    ]
    
    for (const img of batch) {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:${img.mimeType || 'image/png'};base64,${img.base64}`,
          detail: 'high'
        }
      })
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
      
      // Verificar que no sea una negativa
      if (text.toLowerCase().includes("can't assist") || 
          text.toLowerCase().includes("cannot assist") ||
          text.toLowerCase().includes("i'm sorry")) {
        console.log(`      ⚠️ GPT-4o rechazó procesar páginas ${pageNums}`)
        continue
      }
      
      if (text.length > 50) {
        allText.push(text)
        console.log(`      ✓ Páginas ${pageNums}: ${text.length} caracteres`)
      }
      
      // Pausa entre requests
      if (i + 2 < imageOnly.length) {
        await sleep(1500)
      }
      
    } catch (error) {
      console.log(`      ⚠️ Error GPT-4o páginas ${pageNums}: ${error.message}`)
    }
  }
  
  return allText.join('\n\n--- PÁGINA ---\n\n')
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
