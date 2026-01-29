/**
 * OCR Module v8 - Extrae texto de PDFs usando OpenAI
 * Usa Files API para archivos grandes + GPT-4.1 para visión
 * Soporta PDFs escaneados hasta 20MB
 */

const MAX_SIZE_MB = 20  // Límite máximo
const CHUNK_SIZE_MB = 4 // Tamaño de chunk para base64 directo

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

  // Límite absoluto
  if (sizeMB > MAX_SIZE_MB) {
    console.log(`❌ PDF demasiado grande (${sizeMB.toFixed(1)}MB > ${MAX_SIZE_MB}MB)`)
    return {
      success: false,
      text: '',
      error: `El PDF es muy grande (${sizeMB.toFixed(1)}MB). El límite es ${MAX_SIZE_MB}MB.`,
      sizeLimitExceeded: true
    }
  }

  // Para archivos pequeños (<4MB), usar método directo base64
  if (sizeMB <= CHUNK_SIZE_MB) {
    console.log(`📄 PDF pequeño, usando extracción directa...`)
    return await extractWithBase64(pdfBuffer, OPENAI_API_KEY)
  }

  // Para archivos grandes, usar Files API
  console.log(`📦 PDF grande (${sizeMB.toFixed(1)}MB), usando Files API...`)
  return await extractWithFilesAPI(pdfBuffer, OPENAI_API_KEY)
}

/**
 * Extracción directa con base64 (para PDFs < 4MB)
 */
async function extractWithBase64(pdfBuffer, apiKey) {
  const pdfBase64 = pdfBuffer.toString('base64')
  
  console.log(`📤 Extracción directa con GPT-4.1... (timeout: 120s)`)
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120000)
  
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

INSTRUCCIONES CRÍTICAS:
1. Extrae CADA palabra de TODAS las páginas
2. Incluye fechas, números de caso (IOE, SRC, WAC, A-number)
3. Incluye TODOS los checkboxes marcados y su texto
4. Preserva la estructura (párrafos, listas, encabezados)
5. Marca cada página con "--- Página X ---"
6. NO omitas nada, NO resumas

Devuelve el texto completo extraído:`
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
      console.error(`❌ Error GPT-4.1:`, response.status, errorText.substring(0, 300))
      return { success: false, text: '', error: `API Error: ${response.status}` }
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''
    
    console.log(`✅ Extracción completada: ${text.length} caracteres`)
    
    return {
      success: text.length > 200,
      text: text,
      method: 'gpt-4.1-base64'
    }
    
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error.name === 'AbortError') {
      console.error(`❌ Timeout (120s)`)
      return { success: false, text: '', error: 'Timeout procesando el documento' }
    }
    
    console.error(`❌ Error:`, error.message)
    return { success: false, text: '', error: error.message }
  }
}

/**
 * Extracción usando Files API para PDFs grandes (>4MB)
 */
async function extractWithFilesAPI(pdfBuffer, apiKey) {
  console.log(`📤 Subiendo archivo a OpenAI Files API...`)
  
  try {
    // Paso 1: Subir el archivo a OpenAI
    const formData = new FormData()
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' })
    formData.append('file', blob, 'document.pdf')
    formData.append('purpose', 'assistants')
    
    const uploadResponse = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    })

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text()
      console.error(`❌ Error subiendo archivo:`, uploadResponse.status, error.substring(0, 200))
      
      // Fallback: intentar con base64 truncado
      console.log(`🔄 Fallback: extracción parcial con base64...`)
      const truncatedBuffer = pdfBuffer.slice(0, CHUNK_SIZE_MB * 1024 * 1024)
      const result = await extractWithBase64(truncatedBuffer, apiKey)
      result.partial = true
      return result
    }

    const fileData = await uploadResponse.json()
    const fileId = fileData.id
    console.log(`✅ Archivo subido: ${fileId}`)

    // Paso 2: Usar el archivo en una completación
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 180000) // 3 minutos
    
    console.log(`📤 Procesando con GPT-4.1... (timeout: 180s)`)
    
    const completionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
                  file_id: fileId
                }
              },
              {
                type: 'text',
                text: `Extrae TODO el texto de este documento PDF de USCIS (inmigración).

INSTRUCCIONES CRÍTICAS:
1. Extrae CADA palabra de TODAS las páginas (son varias páginas)
2. Incluye fechas, números de caso (IOE, SRC, WAC, A-number)
3. Incluye TODOS los checkboxes marcados y su texto
4. Preserva la estructura completa del documento
5. Marca cada página con "--- Página X ---"
6. Este es un documento legal importante - NO omitas NADA

Devuelve el texto completo extraído:`
              }
            ]
          }
        ],
        max_tokens: 32000,
        temperature: 0
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    // Paso 3: Eliminar el archivo de OpenAI (limpieza)
    try {
      await fetch(`https://api.openai.com/v1/files/${fileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      console.log(`🗑️ Archivo temporal eliminado`)
    } catch (e) {
      console.log(`⚠️ No se pudo eliminar archivo temporal: ${e.message}`)
    }

    if (!completionResponse.ok) {
      const error = await completionResponse.text()
      console.error(`❌ Error en completación:`, completionResponse.status, error.substring(0, 300))
      return { success: false, text: '', error: `API Error: ${completionResponse.status}` }
    }

    const data = await completionResponse.json()
    const text = data.choices?.[0]?.message?.content || ''
    
    console.log(`✅ Extracción con Files API completada: ${text.length} caracteres`)
    
    return {
      success: text.length > 200,
      text: text,
      method: 'gpt-4.1-files-api'
    }
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`❌ Timeout en Files API (180s)`)
      return { success: false, text: '', error: 'Timeout procesando documento grande' }
    }
    
    console.error(`❌ Error en Files API:`, error.message)
    
    // Fallback final: base64 truncado
    console.log(`🔄 Fallback final: extracción parcial...`)
    const truncatedBuffer = pdfBuffer.slice(0, CHUNK_SIZE_MB * 1024 * 1024)
    const result = await extractWithBase64(truncatedBuffer, apiKey)
    result.partial = true
    return result
  }
}
