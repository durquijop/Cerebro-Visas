/**
 * OCR Module v5 - Extrae texto de PDFs usando modelos de IA
 * Usa OpenRouter con múltiples modelos como fallback
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

/**
 * Extrae texto de un PDF usando IA via OpenRouter
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

  // Si el PDF es muy grande (>10MB), puede fallar
  if (pdfBuffer.length > 10 * 1024 * 1024) {
    console.log('⚠️ PDF muy grande para OCR, intentando extracción parcial...')
  }

  const pdfBase64 = pdfBuffer.toString('base64')
  
  // Lista de modelos a intentar en orden
  const models = [
    'google/gemini-2.0-flash-001',
    'anthropic/claude-sonnet-4',
    'openai/gpt-4o'
  ]

  for (const model of models) {
    console.log(`📤 Intentando extracción con ${model}...`)
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
          'X-Title': 'Cerebro Visas OCR'
        },
        body: JSON.stringify({
          model: model,
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
          max_tokens: 32000,
          temperature: 0
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ Error con ${model}:`, response.status, errorText)
        continue // Intentar siguiente modelo
      }

      const data = await response.json()
      const extractedText = data.choices?.[0]?.message?.content || ''
      
      console.log(`✅ Extracción con ${model} completada: ${extractedText.length} caracteres`)
      
      if (extractedText.length > 500) {
        return {
          success: true,
          text: extractedText,
          method: model
        }
      }
      
      console.log(`⚠️ ${model} extrajo poco texto, intentando siguiente modelo...`)
      
    } catch (error) {
      console.error(`❌ Error con ${model}:`, error.message)
      continue
    }
  }

  // Si ningún modelo funcionó
  console.error('❌ Ningún modelo pudo extraer el texto')
  return {
    success: false,
    text: '',
    error: 'No se pudo extraer texto con ningún modelo de IA'
  }
}
