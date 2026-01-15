// ===========================================
// CLIENTE LLM - OpenRouter
// Procesa documentos y extrae información estructurada
// ===========================================

import { TAXONOMY_CODES_FOR_PROMPT } from './taxonomy'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

/**
 * Envía una solicitud al LLM via OpenRouter
 */
export async function callLLM(messages, options = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY no está configurada')
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      'X-Title': 'Cerebro Visas'
    },
    body: JSON.stringify({
      model: options.model || 'openai/gpt-4o-mini',
      messages,
      temperature: options.temperature || 0.1,
      max_tokens: options.maxTokens || 4000,
      response_format: options.jsonMode ? { type: 'json_object' } : undefined
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter API error: ${error}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

/**
 * Extrae información estructurada de un documento RFE/NOID/Denial
 */
export async function extractDocumentInfo(text, docType = 'RFE') {
  const systemPrompt = `Eres un experto analizador de documentos de inmigración de USCIS, especializado en casos EB-2 NIW (National Interest Waiver).

Tu tarea es analizar el texto de un documento ${docType} y extraer información estructurada.

DEBES responder ÚNICAMENTE con un JSON válido con la siguiente estructura:
{
  "document_type": "RFE" | "NOID" | "Denial" | "Other",
  "visa_category": "EB-2 NIW" | "EB-1A" | "Other",
  "receipt_number": "string o null",
  "beneficiary_name": "string o null",
  "date_issued": "YYYY-MM-DD o null",
  "response_deadline": "YYYY-MM-DD o null",
  "service_center": "string o null",
  "officer_name": "string o null",
  "issues": [
    {
      "taxonomy_code": "código de taxonomía",
      "description": "descripción breve del problema identificado",
      "severity": "critical" | "high" | "medium" | "low",
      "quote": "cita textual relevante del documento",
      "page_reference": "número de página si está disponible"
    }
  ],
  "evidence_requested": [
    {
      "item": "descripción del item de evidencia solicitado",
      "prong_mapping": "P1" | "P2" | "P3",
      "priority": "required" | "recommended"
    }
  ],
  "key_quotes": [
    {
      "quote": "cita textual importante",
      "context": "por qué es importante"
    }
  ],
  "summary": "resumen ejecutivo de 2-3 oraciones"
}

CÓDIGOS DE TAXONOMÍA VÁLIDOS:
${TAXONOMY_CODES_FOR_PROMPT}

IMPORTANTE:
- Solo usa códigos de taxonomía de la lista proporcionada
- Extrae citas textuales exactas del documento
- Si no puedes determinar un campo, usa null
- La severidad debe basarse en el impacto: critical (puede causar denial), high (problema serio), medium (debilidad), low (observación menor)`

  const userPrompt = `Analiza el siguiente documento ${docType} y extrae la información estructurada:

---DOCUMENTO---
${text}
---FIN DOCUMENTO---

Responde SOLO con el JSON estructurado.`

  try {
    const response = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { jsonMode: true, temperature: 0.1 })

    // Parsear la respuesta JSON
    const parsed = JSON.parse(response)
    return {
      success: true,
      data: parsed
    }
  } catch (error) {
    console.error('Error extracting document info:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Analiza un expediente completo y genera recomendaciones
 */
export async function auditExpediente(claims, evidence, previousRFEs = []) {
  const systemPrompt = `Eres un auditor experto de expedientes de inmigración EB-2 NIW.

Tu tarea es revisar los claims (afirmaciones) del expediente, la evidencia proporcionada, y RFEs previos similares para identificar:

1. P1 (Críticos): Faltantes que probablemente causarán un RFE o denial
2. P2 (Importantes): Debilidades que podrían ser cuestionadas
3. P3 (Mejoras): Recomendaciones para fortalecer el caso

Responde con un JSON estructurado con recomendaciones priorizadas.`

  const userPrompt = `CLAIMS DEL EXPEDIENTE:
${JSON.stringify(claims, null, 2)}

EVIDENCIA PROPORCIONADA:
${JSON.stringify(evidence, null, 2)}

PATRONES DE RFES PREVIOS SIMILARES:
${JSON.stringify(previousRFEs, null, 2)}

Genera un análisis de auditoría con recomendaciones priorizadas.`

  try {
    const response = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { jsonMode: true, temperature: 0.2 })

    return {
      success: true,
      data: JSON.parse(response)
    }
  } catch (error) {
    console.error('Error auditing expediente:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
