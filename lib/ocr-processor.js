/**
 * OCR Module - Extrae texto de PDFs escaneados usando Gemini Vision
 */

import { pdf } from 'pdf-to-img'
import sharp from 'sharp'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

/**
 * Convierte páginas de PDF a imágenes base64
 */
async function pdfToImages(pdfBuffer, maxPages = 10) {
  const images = []
  
  try {
    const document = await pdf(pdfBuffer, { scale: 1.5 })
    let pageNum = 0
    
    for await (const image of document) {
      if (pageNum >= maxPages) break
      
      // Convertir a JPEG comprimido para reducir tamaño
      const compressedImage = await sharp(image)
        .jpeg({ quality: 70 })
        .resize({ width: 1200, withoutEnlargement: true })
        .toBuffer()
      
      const base64 = compressedImage.toString('base64')
      images.push({
        page: pageNum + 1,
        base64,
        mimeType: 'image/jpeg'
      })
      
      pageNum++
    }
    
    console.log(`📸 Convertidas ${images.length} páginas a imágenes`)
    return images
  } catch (error) {
    console.error('Error convirtiendo PDF a imágenes:', error)
    throw error
  }
}

/**
 * Extrae texto de una imagen usando Gemini Vision via OpenRouter
 */
async function extractTextFromImage(imageBase64, mimeType, pageNum) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY no configurada')
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      'X-Title': 'Cerebro Visas OCR'
    },
    body: JSON.stringify({
      model: 'google/gemini-flash-1.5',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`
              }
            },
            {
              type: 'text',
              text: `Extract ALL text from this document image. This is page ${pageNum} of an immigration document (likely an RFE, NOID, or Denial from USCIS).

Instructions:
- Extract every word, number, and piece of text visible
- Preserve the original structure and formatting as much as possible
- Include headers, footers, dates, case numbers, receipt numbers
- Include all paragraphs and bullet points
- If there are tables, represent them clearly
- Do NOT summarize - extract the COMPLETE text

Output the extracted text directly without any commentary.`
            }
          ]
        }
      ],
      max_tokens: 4000,
      temperature: 0.1
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Error en Gemini Vision:', error)
    throw new Error(`Gemini Vision error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

/**
 * Extrae texto completo de un PDF escaneado usando OCR
 */
export async function extractTextWithOCR(pdfBuffer, maxPages = 10) {
  console.log('🔍 Iniciando OCR para PDF escaneado...')
  
  try {
    // 1. Convertir PDF a imágenes
    const images = await pdfToImages(pdfBuffer, maxPages)
    
    if (images.length === 0) {
      return {
        success: false,
        text: '',
        error: 'No se pudieron extraer imágenes del PDF'
      }
    }
    
    // 2. Extraer texto de cada imagen
    const textParts = []
    
    for (const img of images) {
      console.log(`   📄 Procesando página ${img.page}/${images.length}...`)
      
      try {
        const pageText = await extractTextFromImage(img.base64, img.mimeType, img.page)
        if (pageText) {
          textParts.push(`--- Página ${img.page} ---\n${pageText}`)
        }
      } catch (error) {
        console.error(`   ⚠️ Error en página ${img.page}:`, error.message)
        textParts.push(`--- Página ${img.page} ---\n[Error al extraer texto]`)
      }
      
      // Pequeña pausa para no saturar la API
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    const fullText = textParts.join('\n\n')
    console.log(`✅ OCR completado: ${fullText.length} caracteres extraídos`)
    
    return {
      success: true,
      text: fullText,
      pages: images.length,
      method: 'ocr-gemini'
    }
    
  } catch (error) {
    console.error('❌ Error en OCR:', error)
    return {
      success: false,
      text: '',
      error: error.message
    }
  }
}
