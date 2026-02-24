/**
 * Document Processor v6 - Con OpenRouter
 * 
 * ESTRATEGIA:
 * 1. PDFs con texto → pdf-parse (instantáneo)
 * 2. PDFs escaneados → pdftoppm + OpenRouter Vision OCR
 * 
 * Conversión PDF→Imágenes: usa pdftoppm (poppler-utils)
 * OCR: OpenRouter (GPT-4o o Claude) - más económico y confiable
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)

// Configuración - Priorizar OpenRouter
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const GOOGLE_VISION_API_KEY = process.env.GOOGLE_CLOUD_VISION_API_KEY

/**
 * Función principal: extrae texto de cualquier documento
 */
export async function extractText(buffer, filename) {
  const ext = filename.toLowerCase().split('.').pop()
  const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2)
  
  console.log(`\n${'='.repeat(60)}`)
  console.log(`📂 PROCESANDO: ${filename}`)
  console.log(`   Tamaño: ${fileSizeMB} MB | Tipo: ${ext}`)
  console.log(`${'='.repeat(60)}`)
  
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
  console.log('\n📄 PASO 1: Intentando extracción directa...')
  
  let numPages = 1
  
  // Intentar pdf-parse primero (para PDFs con texto digital)
  try {
    const pdf = require('pdf-parse')
    const data = await pdf(buffer)
    const rawText = data.text || ''
    const cleanText = normalizeText(rawText)
    numPages = data.numpages || 1
    
    const avgPerPage = cleanText.length / numPages
    console.log(`   pdf-parse: ${numPages} págs, ${cleanText.length} chars (${avgPerPage.toFixed(0)}/pág)`)
    
    // Si hay texto suficiente, usarlo
    if (avgPerPage > 150) {
      console.log(`   ✅ PDF CON TEXTO DIGITAL - Extracción exitosa`)
      return {
        success: true,
        text: cleanText,
        numPages: numPages,
        method: 'pdf-parse'
      }
    }
    
    console.log(`   ⚠️ Poco texto - Es un PDF escaneado`)
  } catch (e) {
    console.log(`   ⚠️ pdf-parse error: ${e.message}`)
  }
  
  // PASO 2: OCR para PDFs escaneados
  console.log('\n🔍 PASO 2: OCR para PDF escaneado...')
  
  // Asegurar que pdftoppm esté disponible
  const pdftoppmPath = await ensurePdftoppm()
  if (!pdftoppmPath) {
    return { success: false, text: '', error: 'No se pudo instalar pdftoppm para conversión de PDF' }
  }
  
  // Convertir PDF a imágenes
  console.log('   🖼️ Convirtiendo páginas a imágenes...')
  const images = await convertPdfToImages(buffer, pdftoppmPath)
  
  if (images.length === 0) {
    return { success: false, text: '', error: 'No se pudieron generar imágenes del PDF' }
  }
  
  console.log(`   ✓ ${images.length} imágenes generadas`)
  
  // OCR con GPT-4o
  console.log('\n   🤖 Ejecutando OCR con GPT-4o Vision...')
  const ocrText = await performOCRWithGPT4o(images)
  
  if (ocrText && ocrText.length > 50) {
    console.log(`   ✅ OCR EXITOSO: ${ocrText.length} caracteres`)
    return {
      success: true,
      text: normalizeText(ocrText),
      numPages: numPages,
      method: 'gpt4o-vision-ocr'
    }
  }
  
  return { success: false, text: '', error: 'OCR no pudo extraer texto' }
}

/**
 * Asegura que pdftoppm esté disponible
 */
async function ensurePdftoppm() {
  // Verificar si ya está instalado
  try {
    await execAsync('which pdftoppm')
    console.log('   ✓ pdftoppm disponible')
    return 'pdftoppm'
  } catch (e) {
    // No está instalado
  }
  
  // Intentar ruta absoluta
  try {
    await execAsync('/usr/bin/pdftoppm -v')
    console.log('   ✓ pdftoppm en /usr/bin/')
    return '/usr/bin/pdftoppm'
  } catch (e) {
    // No está en ruta absoluta
  }
  
  // Intentar instalar
  console.log('   ⏳ Instalando poppler-utils...')
  try {
    await execAsync('apt-get update && apt-get install -y poppler-utils', { timeout: 60000 })
    console.log('   ✓ poppler-utils instalado')
    return '/usr/bin/pdftoppm'
  } catch (e) {
    console.log(`   ❌ No se pudo instalar: ${e.message}`)
    return null
  }
}

/**
 * Convierte PDF a imágenes JPEG usando pdftoppm
 */
async function convertPdfToImages(pdfBuffer, pdftoppmPath) {
  const images = []
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-ocr-'))
  const pdfPath = path.join(tempDir, 'input.pdf')
  const outputPrefix = path.join(tempDir, 'page')
  
  try {
    // Guardar PDF temporalmente
    await fs.writeFile(pdfPath, pdfBuffer)
    
    // Convertir a JPEG (100 DPI, calidad 70 - optimizado para velocidad)
    const cmd = `${pdftoppmPath} -jpeg -r 100 -jpegopt quality=70 "${pdfPath}" "${outputPrefix}"`
    await execAsync(cmd, { timeout: 120000 })
    
    // Leer imágenes generadas
    const files = await fs.readdir(tempDir)
    const jpgFiles = files.filter(f => f.endsWith('.jpg')).sort()
    
    for (let i = 0; i < jpgFiles.length && i < 10; i++) { // Máximo 10 páginas
      const imgPath = path.join(tempDir, jpgFiles[i])
      const imgBuffer = await fs.readFile(imgPath)
      const sizeKB = (imgBuffer.length / 1024).toFixed(0)
      
      images.push({
        page: i + 1,
        base64: imgBuffer.toString('base64')
      })
      
      console.log(`      Página ${i + 1}: ${sizeKB} KB`)
    }
    
  } catch (error) {
    console.error(`   ❌ Error en conversión: ${error.message}`)
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
 * Realiza OCR usando OpenRouter (GPT-4o, Claude, etc.)
 */
async function performOCRWithGPT4o(images) {
  // Priorizar OpenRouter, luego OpenAI
  const useOpenRouter = !!OPENROUTER_API_KEY
  const apiKey = useOpenRouter ? OPENROUTER_API_KEY : OPENAI_API_KEY
  const apiUrl = useOpenRouter 
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions'
  const model = useOpenRouter ? 'openai/gpt-4o' : 'gpt-4o'
  
  if (!apiKey) {
    throw new Error('No hay API key configurada (OPENROUTER_API_KEY o OPENAI_API_KEY)')
  }
  
  console.log(`   📡 Usando ${useOpenRouter ? 'OpenRouter' : 'OpenAI'} para OCR...`)
  
  const allText = []
  
  // Procesar páginas de 2 en 2 para eficiencia
  for (let i = 0; i < images.length; i += 2) {
    const batch = images.slice(i, i + 2)
    const pageNums = batch.map(img => img.page).join('-')
    
    // Construir mensaje con imágenes
    const content = [
      {
        type: 'text',
        text: `You are a professional OCR system. Extract ALL text from these document images.

INSTRUCTIONS:
- Transcribe every word exactly as shown
- Preserve paragraph structure and formatting
- Include ALL content: headers, dates, addresses, body text, signatures
- For forms, include field labels and their values
- Output ONLY the extracted text, no commentary or explanations
- If text is unclear, make your best interpretation`
      }
    ]
    
    for (const img of batch) {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${img.base64}`,
          detail: 'high'
        }
      })
    }
    
    try {
      const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
      
      // Headers adicionales para OpenRouter
      if (useOpenRouter) {
        headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_BASE_URL || 'https://cerebro-visas.com'
        headers['X-Title'] = 'Cerebro Visas OCR'
      }
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content }],
          max_tokens: 4096,
          temperature: 0
        })
      })
      
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error?.message || `HTTP ${response.status}`)
      }
      
      const data = await response.json()
      const text = data.choices?.[0]?.message?.content || ''
      
      // Verificar que no sea una negativa
      const lowerText = text.toLowerCase()
      if (lowerText.includes("can't assist") || 
          lowerText.includes("cannot assist") ||
          lowerText.includes("i'm sorry, but i can't") ||
          lowerText.includes("i cannot help")) {
        console.log(`      ⚠️ Páginas ${pageNums}: Modelo rechazó (probando prompts alternativos)`)
        
        // Intentar con prompt más simple
        const simpleText = await trySimpleOCRPrompt(batch)
        if (simpleText && simpleText.length > 50) {
          allText.push(simpleText)
          console.log(`      ✓ Páginas ${pageNums}: ${simpleText.length} chars (prompt simple)`)
        }
      } else if (text.length > 50) {
        allText.push(text)
        console.log(`      ✓ Páginas ${pageNums}: ${text.length} caracteres`)
      }
      
      // Pausa entre requests
      if (i + 2 < images.length) {
        await sleep(1500)
      }
      
    } catch (error) {
      console.log(`      ❌ Error páginas ${pageNums}: ${error.message}`)
    }
  }
  
  return allText.join('\n\n--- PÁGINA ---\n\n')
}

/**
 * Intenta OCR con prompt más simple si el primero es rechazado
 */
async function trySimpleOCRPrompt(images) {
  const useOpenRouter = !!OPENROUTER_API_KEY
  const apiKey = useOpenRouter ? OPENROUTER_API_KEY : OPENAI_API_KEY
  const apiUrl = useOpenRouter 
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions'
  const model = useOpenRouter ? 'openai/gpt-4o' : 'gpt-4o'
  
  if (!apiKey) return ''
  
  const content = [
    {
      type: 'text',
      text: 'What text do you see in these images? Please list all visible text.'
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
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
    
    if (useOpenRouter) {
      headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_BASE_URL || 'https://cerebro-visas.com'
      headers['X-Title'] = 'Cerebro Visas OCR'
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content }],
        max_tokens: 4096,
        temperature: 0
      })
    })
    
    if (!response.ok) return ''
    
    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  } catch (e) {
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
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim()
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
