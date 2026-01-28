/**
 * OCR Module v6 - Extrae texto de PDFs usando OpenAI GPT-4o
 * Usa la API directa de OpenAI con soporte de visión
 */

/**
 * Extrae texto de un PDF usando IA via OpenAI
 */
export async function extractTextWithOCR(pdfBuffer) {
  console.log('🔍 Iniciando extracción de PDF con OpenAI...')
  console.log(`   Tamaño del PDF: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`)
  
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  
  if (!OPENAI_API_KEY) {
    return {
      success: false,
      text: '',
      error: 'OPENAI_API_KEY no configurada'
    }
  }

  // Si el PDF es muy grande (>10MB), puede fallar
  if (pdfBuffer.length > 10 * 1024 * 1024) {
    console.log('⚠️ PDF muy grande para OCR, intentando extracción parcial...')
  }

  const pdfBase64 = pdfBuffer.toString('base64')
  
  console.log(`📤 Intentando extracción con GPT-4o...`)
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
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
                text: `Extrae TODO el texto de este documento PDF de USCIS (inmigración).

INSTRUCCIONES:
1. Extrae CADA palabra de TODAS las páginas
2. Incluye fechas, números de caso (IOE..., A-number)
3. Preserva la estructura (párrafos, listas, títulos)
4. Marca los saltos de página con "--- Página X ---"
5. NO resumas - extrae el texto COMPLETO

Solo devuelve el texto extraído:`
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
      console.error(`❌ Error con GPT-4o:`, response.status, errorText)
      
      // Intentar con gpt-4o-mini como fallback
      return await extractWithMini(pdfBase64, OPENAI_API_KEY)
    }

    const data = await response.json()
    const extractedText = data.choices?.[0]?.message?.content || ''
    
    console.log(`✅ Extracción con GPT-4o completada: ${extractedText.length} caracteres`)
    
    if (extractedText.length > 500) {
      return {
        success: true,
        text: extractedText,
        method: 'gpt-4o'
      }
    }
    
    console.log(`⚠️ GPT-4o extrajo poco texto, intentando con gpt-4o-mini...`)
    return await extractWithMini(pdfBase64, OPENAI_API_KEY)
    
  } catch (error) {
    console.error(`❌ Error con GPT-4o:`, error.message)
    return await extractWithMini(pdfBase64, OPENAI_API_KEY)
  }
}

/**
 * Fallback usando GPT-4o-mini
 */
async function extractWithMini(pdfBase64, apiKey) {
  console.log(`📤 Intentando extracción con GPT-4o-mini...`)
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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
                text: `Extrae TODO el texto de este documento PDF. Incluye todo: fechas, números, nombres. NO resumas, extrae el texto completo.`
              }
            ]
          }
        ],
        max_tokens: 8000,
        temperature: 0
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Error con GPT-4o-mini:`, response.status, errorText)
      return {
        success: false,
        text: '',
        error: `Error de API: ${errorText}`
      }
    }

    const data = await response.json()
    const extractedText = data.choices?.[0]?.message?.content || ''
    
    console.log(`✅ Extracción con GPT-4o-mini completada: ${extractedText.length} caracteres`)
    
    return {
      success: extractedText.length > 100,
      text: extractedText,
      method: 'gpt-4o-mini'
    }
    
  } catch (error) {
    console.error(`❌ Error con GPT-4o-mini:`, error.message)
    return {
      success: false,
      text: '',
      error: error.message
    }
  }
}
