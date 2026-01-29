/**
 * OCR Module v7 - Extrae texto de PDFs usando OpenAI GPT-4.1
 * Usa la API directa de OpenAI con soporte de visión
 * Maneja archivos grandes con timeout y límites
 */

/**
 * Extrae texto de un PDF usando IA via OpenAI
 */
export async function extractTextWithOCR(pdfBuffer) {
  console.log('🔍 Iniciando extracción de PDF con OpenAI...')
  const sizeMB = pdfBuffer.length / 1024 / 1024
  console.log(`   Tamaño del PDF: ${sizeMB.toFixed(2)} MB`)
  
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  
  if (!OPENAI_API_KEY) {
    return {
      success: false,
      text: '',
      error: 'OPENAI_API_KEY no configurada'
    }
  }

  // Límite estricto de 5MB para OCR (base64 aumenta ~33% el tamaño)
  const MAX_SIZE_MB = 5
  if (sizeMB > MAX_SIZE_MB) {
    console.log(`❌ PDF demasiado grande para OCR (${sizeMB.toFixed(1)}MB > ${MAX_SIZE_MB}MB)`)
    return {
      success: false,
      text: '',
      error: `El PDF escaneado es muy grande (${sizeMB.toFixed(1)}MB). El límite para OCR es ${MAX_SIZE_MB}MB. Por favor, reduce el tamaño del PDF o divide el documento en partes más pequeñas.`,
      sizeLimitExceeded: true
    }
  }

  return await processWithTimeout(pdfBuffer, OPENAI_API_KEY, false)
}

/**
 * Procesa el PDF con timeout
 */
async function processWithTimeout(pdfBuffer, apiKey, isPartial) {
  const pdfBase64 = pdfBuffer.toString('base64')
  
  console.log(`📤 Intentando extracción con GPT-4.1... (timeout: 90s)`)
  
  // Crear AbortController para timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 90000) // 90 segundos
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
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
1. Extrae CADA palabra de TODAS las páginas visibles
2. Incluye fechas, números de caso (IOE..., A-number, SRC...)
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
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Error con GPT-4.1:`, response.status, errorText.substring(0, 200))
      
      // Intentar con gpt-4.1-mini como fallback
      return await extractWithMini(pdfBase64, apiKey, isPartial)
    }

    const data = await response.json()
    const extractedText = data.choices?.[0]?.message?.content || ''
    
    console.log(`✅ Extracción con GPT-4.1 completada: ${extractedText.length} caracteres`)
    
    if (extractedText.length > 500) {
      return {
        success: true,
        text: extractedText,
        method: 'gpt-4.1',
        partial: isPartial
      }
    }
    
    console.log(`⚠️ GPT-4.1 extrajo poco texto, intentando con gpt-4.1-mini...`)
    return await extractWithMini(pdfBase64, apiKey, isPartial)
    
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error.name === 'AbortError') {
      console.error(`❌ Timeout en extracción OCR (90s)`)
      return {
        success: false,
        text: '',
        error: 'Timeout: El documento es muy grande o complejo para procesar. Intenta con un PDF más pequeño o con mejor calidad de escaneo.'
      }
    }
    
    console.error(`❌ Error con GPT-4.1:`, error.message)
    return await extractWithMini(pdfBase64, apiKey, isPartial)
  }
}

/**
 * Fallback usando GPT-4.1-mini con timeout
 */
async function extractWithMini(pdfBase64, apiKey, isPartial = false) {
  console.log(`📤 Intentando extracción con GPT-4.1-mini... (timeout: 60s)`)
  
  // Crear AbortController para timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 segundos
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
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
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Error con GPT-4.1-mini:`, response.status, errorText.substring(0, 200))
      return {
        success: false,
        text: '',
        error: `Error de API: ${response.status}`
      }
    }

    const data = await response.json()
    const extractedText = data.choices?.[0]?.message?.content || ''
    
    console.log(`✅ Extracción con GPT-4.1-mini completada: ${extractedText.length} caracteres`)
    
    return {
      success: extractedText.length > 100,
      text: extractedText,
      method: 'gpt-4.1-mini',
      partial: isPartial
    }
    
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error.name === 'AbortError') {
      console.error(`❌ Timeout en GPT-4.1-mini (60s)`)
      return {
        success: false,
        text: '',
        error: 'Timeout: El documento es muy grande para OCR. Intenta con un PDF más pequeño.'
      }
    }
    
    console.error(`❌ Error con GPT-4.1-mini:`, error.message)
    return {
      success: false,
      text: '',
      error: error.message
    }
  }
}
