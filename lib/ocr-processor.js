/**
 * OCR Module v3 - Extrae texto de PDFs usando Claude Sonnet
 * Claude soporta PDFs nativamente via base64
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

/**
 * Extrae texto de un PDF usando Claude (soporta PDFs nativamente)
 */
export async function extractTextWithOCR(pdfBuffer) {
  console.log('🔍 Iniciando extracción con Claude...')
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
    
    // Limitar tamaño para evitar errores
    const maxSizeMB = 20
    if (pdfBuffer.length > maxSizeMB * 1024 * 1024) {
      console.log(`⚠️ PDF excede ${maxSizeMB}MB, puede fallar`)
    }

    console.log('📤 Enviando PDF a Claude para extracción...')
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        'X-Title': 'Cerebro Visas PDF Extract'
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
                text: `Extract ALL text from this PDF document completely. This is a USCIS immigration document (RFE, NOID, or Denial).

CRITICAL INSTRUCTIONS:
1. Extract EVERY single word from ALL pages
2. Include all dates, case numbers, receipt numbers (like IOE..., A...-...-...)
3. Preserve paragraph structure
4. Include headers, footers, addresses
5. Include all bullet points and lists exactly as shown
6. Separate pages with "--- Page X ---"

DO NOT summarize. DO NOT skip any content. Extract the COMPLETE text verbatim.

Begin extraction now:`
              }
            ]
          }
        ],
        max_tokens: 16000,
        temperature: 0
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Error en Claude:', response.status, errorText)
      return {
        success: false,
        text: '',
        error: `API error: ${response.status}`
      }
    }

    const data = await response.json()
    const extractedText = data.choices?.[0]?.message?.content || ''
    
    console.log(`✅ Extracción completada: ${extractedText.length} caracteres`)
    
    return {
      success: extractedText.length > 100,
      text: extractedText,
      method: 'claude-pdf'
    }
    
  } catch (error) {
    console.error('❌ Error en extracción:', error)
    return {
      success: false,
      text: '',
      error: error.message
    }
  }
}
