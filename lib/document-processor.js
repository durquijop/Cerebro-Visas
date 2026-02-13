/**
 * Document Processor v2 - Extracción de texto de documentos
 * Soporta: PDF (con texto o escaneados), DOCX, TXT
 */

import { PDFDocument } from 'pdf-lib'

/**
 * Extrae texto de un documento según su tipo
 */
export async function extractText(buffer, filename) {
  const ext = filename.toLowerCase().split('.').pop()
  
  console.log(`📂 Procesando: ${filename} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`)
  
  try {
    if (ext === 'pdf') {
      return await extractFromPDF(buffer)
    } else if (ext === 'docx') {
      return await extractFromDOCX(buffer)
    } else if (ext === 'txt') {
      return { success: true, text: buffer.toString('utf-8'), method: 'txt' }
    } else {
      return { success: false, text: '', error: `Formato no soportado: ${ext}` }
    }
  } catch (error) {
    console.error('❌ Error extrayendo texto:', error.message)
    return { success: false, text: '', error: error.message }
  }
}

/**
 * Extrae texto de PDF - primero intenta pdf-parse, si falla usa OCR
 */
async function extractFromPDF(buffer) {
  console.log('📄 Extrayendo texto de PDF...')
  
  // Paso 1: Intentar con pdf-parse (para PDFs con texto seleccionable)
  try {
    const pdf = require('pdf-parse')
    const data = await pdf(buffer)
    const text = data.text || ''
    
    console.log(`   pdf-parse extrajo ${text.length} caracteres de ${data.numpages} páginas`)
    
    // Si hay suficiente texto, usar este resultado
    if (text.trim().length > 100) {
      console.log('✅ Texto extraído con pdf-parse')
      return {
        success: true,
        text: text,
        numPages: data.numpages,
        method: 'pdf-parse'
      }
    }
    
    console.log('⚠️ PDF sin texto seleccionable, intentando OCR...')
  } catch (parseError) {
    console.log('⚠️ pdf-parse falló:', parseError.message)
  }
  
  // Paso 2: Usar OCR para PDFs escaneados
  return await extractWithOCR(buffer)
}

/**
 * OCR usando GPT-4o Vision
 */
async function extractWithOCR(pdfBuffer) {
  console.log('🔍 Iniciando OCR con GPT-4o...')
  
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return { success: false, text: '', error: 'OPENAI_API_KEY no configurada' }
  }
  
  try {
    // Obtener número de páginas
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true })
    const totalPages = pdfDoc.getPageCount()
    console.log(`   PDF tiene ${totalPages} páginas`)
    
    // Convertir PDF a imágenes usando pdftoppm
    const images = await convertPdfToImages(pdfBuffer)
    
    if (images.length === 0) {
      return { success: false, text: '', error: 'No se pudieron convertir las páginas a imágenes' }
    }
    
    console.log(`   ${images.length} páginas convertidas a imágenes`)
    
    // Procesar imágenes con GPT-4o (2 páginas a la vez)
    const allText = []
    
    for (let i = 0; i < images.length; i += 2) {
      const batch = images.slice(i, i + 2)
      const pageNums = batch.map(img => img.page).join('-')
      
      console.log(`   Procesando páginas ${pageNums}...`)
      
      const text = await processImagesWithGPT4o(batch, apiKey)
      
      if (text && text.length > 50) {
        allText.push(text)
        console.log(`   ✅ Páginas ${pageNums}: ${text.length} caracteres`)
      } else {
        console.log(`   ⚠️ Páginas ${pageNums}: poco texto`)
      }
      
      // Pausa entre requests
      if (i + 2 < images.length) {
        await sleep(2000)
      }
    }
    
    const combinedText = allText.join('\n\n')
    console.log(`📊 OCR completado: ${combinedText.length} caracteres totales`)
    
    return {
      success: combinedText.length > 100,
      text: combinedText,
      numPages: totalPages,
      method: 'gpt-4o-ocr'
    }
    
  } catch (error) {
    console.error('❌ Error en OCR:', error.message)
    return { success: false, text: '', error: error.message }
  }
}

/**
 * Convierte PDF a imágenes JPEG usando pdftoppm
 */
async function convertPdfToImages(pdfBuffer) {
  const { exec } = require('child_process')
  const { promisify } = require('util')
  const fs = require('fs').promises
  const path = require('path')
  const os = require('os')
  
  const execAsync = promisify(exec)
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-'))
  const pdfPath = path.join(tempDir, 'input.pdf')
  const images = []
  
  try {
    await fs.writeFile(pdfPath, pdfBuffer)
    
    // Convertir a JPEG con baja resolución (rápido y pequeño)
    const outputPrefix = path.join(tempDir, 'page')
    await execAsync(`/usr/bin/pdftoppm -jpeg -r 72 -jpegopt quality=60 "${pdfPath}" "${outputPrefix}"`, {
      timeout: 60000
    })
    
    // Leer imágenes generadas
    const files = await fs.readdir(tempDir)
    const jpgFiles = files.filter(f => f.endsWith('.jpg')).sort()
    
    for (let i = 0; i < jpgFiles.length; i++) {
      const imgPath = path.join(tempDir, jpgFiles[i])
      const imgBuffer = await fs.readFile(imgPath)
      images.push({
        page: i + 1,
        base64: imgBuffer.toString('base64')
      })
    }
    
  } catch (error) {
    console.error('Error convirtiendo PDF:', error.message)
  } finally {
    // Limpiar archivos temporales
    try {
      const files = await fs.readdir(tempDir)
      for (const file of files) {
        await fs.unlink(path.join(tempDir, file)).catch(() => {})
      }
      await fs.rmdir(tempDir).catch(() => {})
    } catch (e) {}
  }
  
  return images
}

/**
 * Procesa imágenes con GPT-4o Vision
 */
async function processImagesWithGPT4o(images, apiKey) {
  const content = [
    {
      type: 'text',
      text: 'Please transcribe all visible text from these document images. Copy every word exactly as shown. Output only the transcribed text.'
    }
  ]
  
  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${img.base64}`,
        detail: 'high'
      }
    })
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content }],
        max_tokens: 8000,
        temperature: 0
      })
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      console.error('   GPT-4o error:', error.error?.message || response.status)
      return ''
    }
    
    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
    
  } catch (error) {
    console.error('   Error llamando GPT-4o:', error.message)
    return ''
  }
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
      text: result.value,
      method: 'mammoth'
    }
  } catch (error) {
    return { success: false, text: '', error: error.message }
  }
}

/**
 * Normaliza el texto extraído
 */
export function normalizeText(text) {
  if (!text) return ''
  
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
