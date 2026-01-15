/**
 * OCR Module v2 - Extrae texto de PDFs escaneados usando Gemini Vision
 * Envía el PDF directamente a la API sin convertir a imágenes
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

/**
 * Extrae texto de un PDF escaneado usando Gemini Vision
 * Procesa el documento en chunks para manejar archivos grandes
 */
export async function extractTextWithOCR(pdfBuffer) {
  console.log('🔍 Iniciando OCR para PDF escaneado...')
  console.log(`   Tamaño del PDF: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`)
  
  if (!OPENROUTER_API_KEY) {
    return {
      success: false,
      text: '',
      error: 'OPENROUTER_API_KEY no configurada'
    }
  }

  try {
    // Convertir PDF a base64
    const pdfBase64 = pdfBuffer.toString('base64')
    
    // Si el PDF es muy grande, puede exceder límites de la API
    const maxSizeMB = 10
    if (pdfBuffer.length > maxSizeMB * 1024 * 1024) {
      console.log(`⚠️ PDF muy grande (${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB). Procesando con límites...`)
    }

    console.log('📤 Enviando PDF a Gemini Vision para OCR...')
    
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
                type: 'file',
                file: {
                  filename: 'document.pdf',
                  file_data: `data:application/pdf;base64,${pdfBase64}`
                }
              },
              {
                type: 'text',
                text: `You are an expert OCR system. Extract ALL text from this PDF document.

This is an immigration document (likely an RFE, NOID, or Denial from USCIS).

INSTRUCTIONS:
1. Extract EVERY word, number, and piece of text visible in ALL pages
2. Preserve the original structure and formatting
3. Include headers, footers, dates, case numbers, receipt numbers
4. Include all paragraphs, bullet points, and lists
5. If there are tables, represent them clearly
6. Separate each page with "--- Page X ---"
7. Do NOT summarize - extract the COMPLETE text

OUTPUT: Only the extracted text, no commentary or explanations.`
              }
            ]
          }
        ],
        max_tokens: 16000,
        temperature: 0.1
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Error en Gemini Vision:', response.status, errorText)
      
      // Intentar con método alternativo si falla
      return await extractTextWithOCRAlternative(pdfBuffer)
    }

    const data = await response.json()
    const extractedText = data.choices?.[0]?.message?.content || ''
    
    console.log(`✅ OCR completado: ${extractedText.length} caracteres extraídos`)
    
    if (extractedText.length < 100) {
      console.log('⚠️ Poco texto extraído, intentando método alternativo...')
      return await extractTextWithOCRAlternative(pdfBuffer)
    }
    
    return {
      success: true,
      text: extractedText,
      method: 'ocr-gemini-pdf'
    }
    
  } catch (error) {
    console.error('❌ Error en OCR:', error)
    return await extractTextWithOCRAlternative(pdfBuffer)
  }
}

/**
 * Método alternativo: usar Claude para OCR
 */
async function extractTextWithOCRAlternative(pdfBuffer) {
  console.log('🔄 Intentando OCR con método alternativo (Claude)...')
  
  try {
    const pdfBase64 = pdfBuffer.toString('base64')
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        'X-Title': 'Cerebro Visas OCR Alt'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64
                }
              },
              {
                type: 'text',
                text: `Extract ALL text from this PDF document. This is an immigration document (RFE, NOID, or Denial from USCIS).

Instructions:
- Extract every word visible in ALL pages
- Preserve structure (headers, paragraphs, lists)
- Include dates, case numbers, receipt numbers
- Separate pages with "--- Page X ---"
- Output ONLY the extracted text, no commentary

Begin extraction:`
              }
            ]
          }
        ],
        max_tokens: 16000,
        temperature: 0.1
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Error en Claude OCR:', response.status, errorText)
      return {
        success: false,
        text: '',
        error: `OCR falló: ${response.status}`
      }
    }

    const data = await response.json()
    const extractedText = data.choices?.[0]?.message?.content || ''
    
    console.log(`✅ OCR alternativo completado: ${extractedText.length} caracteres`)
    
    return {
      success: extractedText.length > 50,
      text: extractedText,
      method: 'ocr-claude'
    }
    
  } catch (error) {
    console.error('❌ Error en OCR alternativo:', error)
    return {
      success: false,
      text: '',
      error: error.message
    }
  }
}
