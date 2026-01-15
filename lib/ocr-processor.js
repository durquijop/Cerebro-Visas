/**
 * OCR Module v4 - Extrae texto de PDFs usando Gemini 2.0 Flash
 * Usa el formato correcto para OpenRouter
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

/**
 * Extrae texto de un PDF usando Gemini 2.0 Flash via OpenRouter
 */
export async function extractTextWithOCR(pdfBuffer) {
  console.log('🔍 Iniciando extracción de PDF con IA...')
  console.log(`   Tamaño del PDF: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`)
  
  if (!OPENROUTER_API_KEY) {
    return {
      success: false,
      text: '',
      error: 'OPENROUTER_API_KEY no configurada'
    }
  }

  try {
    const pdfBase64 = pdfBuffer.toString('base64')
    
    console.log('📤 Enviando PDF a Gemini 2.0 Flash...')
    
    // Usar Gemini 2.0 Flash que soporta archivos
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        'X-Title': 'Cerebro Visas PDF'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
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
                text: `You are a document text extractor. Extract ALL text from this PDF document.

This is a USCIS immigration document (RFE/NOID/Denial).

INSTRUCTIONS:
1. Extract EVERY word from ALL pages
2. Include dates, case numbers (IOE..., A...-...-...)
3. Preserve structure (paragraphs, lists, headers)
4. Mark page breaks with "--- Page X ---"
5. DO NOT summarize - extract COMPLETE text

Output ONLY the extracted text:`
              }
            ]
          }
        ],
        max_tokens: 32000,
        temperature: 0
      })
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('❌ Error Gemini 2.0:', response.status, errorData)
      
      // Intentar con modelo alternativo
      return await extractWithAlternativeModel(pdfBase64)
    }

    const data = await response.json()
    const extractedText = data.choices?.[0]?.message?.content || ''
    
    console.log(`✅ Extracción Gemini completada: ${extractedText.length} caracteres`)
    
    if (extractedText.length > 500) {
      return {
        success: true,
        text: extractedText,
        method: 'gemini-2.0-flash'
      }
    }
    
    // Si extrajo poco, intentar alternativa
    return await extractWithAlternativeModel(pdfBase64)
    
  } catch (error) {
    console.error('❌ Error en extracción:', error)
    return {
      success: false,
      text: '',
      error: error.message
    }
  }
}

/**
 * Modelo alternativo: Claude 3.5 Sonnet con imagen del PDF
 */
async function extractWithAlternativeModel(pdfBase64) {
  console.log('🔄 Intentando con modelo alternativo...')
  
  try {
    // Intentar con GPT-4o que maneja PDFs mejor
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        'X-Title': 'Cerebro Visas PDF Alt'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
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
                text: `Extract ALL text from this PDF. This is a USCIS immigration document. 
Extract every word, date, case number. Do not summarize. Output complete text only.`
              }
            ]
          }
        ],
        max_tokens: 16000,
        temperature: 0
      })
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('❌ Error alternativo:', err)
      return { success: false, text: '', error: 'Extraction failed' }
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''
    
    console.log(`✅ Extracción alternativa: ${text.length} caracteres`)
    
    return {
      success: text.length > 200,
      text: text,
      method: 'gpt-4o'
    }
  } catch (error) {
    console.error('❌ Error alternativo:', error)
    return { success: false, text: '', error: error.message }
  }
}
