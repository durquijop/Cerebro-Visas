/**
 * CASE MINER - Extracción Estructurada con LLM
 * Convierte documentos RFE/NOID/Denial en data estructurada
 * Soporta: EB2-NIW y EB1A
 */

import { getTaxonomyForVisa, getTaxonomyPrompt, getAnalysisPrompt, getAllTaxonomyCodes } from './taxonomy'

// Priorizar OpenRouter, fallback a OpenAI directo
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

function getLLMConfig() {
  if (OPENROUTER_API_KEY) {
    return {
      apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: OPENROUTER_API_KEY,
      model: 'openai/gpt-4.1',
      headers: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'https://cerebro-visas.com',
        'X-Title': 'Cerebro Visas Case Miner'
      }
    }
  }
  if (OPENAI_API_KEY) {
    return {
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: OPENAI_API_KEY,
      model: 'gpt-4.1',
      headers: {}
    }
  }
  throw new Error('No hay API key configurada (OPENROUTER_API_KEY o OPENAI_API_KEY)')
}

/**
 * Detecta el tipo de visa del documento
 */
function detectVisaType(documentText, providedType = null) {
  if (providedType) {
    const upper = providedType.toUpperCase()
    if (upper.includes('EB1A') || upper.includes('EB-1A') || upper.includes('EB1')) {
      return 'EB1A'
    }
    if (upper.includes('NIW') || upper.includes('EB2') || upper.includes('EB-2')) {
      return 'NIW'
    }
  }
  
  // Detectar del texto
  const textUpper = documentText.toUpperCase()
  
  // Patrones EB1A
  const eb1aPatterns = [
    'EB-1A', 'EB1A', 'EXTRAORDINARY ABILITY', 'HABILIDAD EXTRAORDINARIA',
    '203(B)(1)(A)', 'ALIEN OF EXTRAORDINARY', '10 CRITERIA', 'TEN CRITERIA',
    'SUSTAINED NATIONAL', 'SUSTAINED INTERNATIONAL'
  ]
  
  // Patrones NIW
  const niwPatterns = [
    'NATIONAL INTEREST WAIVER', 'NIW', 'EB-2', 'EB2',
    'DHANASAR', 'THREE PRONGS', 'PRONG 1', 'PRONG 2', 'PRONG 3',
    '203(B)(2)', 'ADVANCED DEGREE', 'EXCEPTIONAL ABILITY'
  ]
  
  let eb1aScore = 0
  let niwScore = 0
  
  eb1aPatterns.forEach(p => {
    if (textUpper.includes(p)) eb1aScore++
  })
  
  niwPatterns.forEach(p => {
    if (textUpper.includes(p)) niwScore++
  })
  
  return eb1aScore > niwScore ? 'EB1A' : 'NIW'
}

/**
 * Genera el prompt de extracción según el tipo de visa
 */
function generateExtractionPrompt(visaType, documentText, docType) {
  const taxonomyCodes = getTaxonomyPrompt(visaType)
  const analysisContext = getAnalysisPrompt(visaType)
  
  if (visaType === 'EB1A') {
    return `${analysisContext.system}

Estás analizando un documento ${docType} para una petición EB-1A.

DOCUMENTO A ANALIZAR:
${documentText.substring(0, 30000)}

TAXONOMÍA DE ISSUES EB-1A (usa SOLO estos códigos):
${taxonomyCodes}

EXTRAE la información en formato JSON ESTRICTO (TODO EN ESPAÑOL):

{
  "document_info": {
    "outcome_type": "<RFE | NOID | Denial | Approval>",
    "visa_category": "EB1A",
    "document_date": "<YYYY-MM-DD o null>",
    "response_deadline": "<YYYY-MM-DD o null>",
    "service_center": "<Texas Service Center | Nebraska Service Center | otro | null>",
    "receipt_number": "<IOE... o SRC... o LIN... o null>",
    "beneficiary_name": "<nombre completo o null>",
    "field_of_expertise": "<campo de expertise del beneficiario>"
  },
  "criteria_evaluation": {
    "C1_PREMIOS": {"claimed": <true/false>, "accepted": <true/false>, "issues": ["códigos de issues"]},
    "C2_MEMBRESIAS": {"claimed": <true/false>, "accepted": <true/false>, "issues": ["códigos de issues"]},
    "C3_MATERIAL_PUBLICADO": {"claimed": <true/false>, "accepted": <true/false>, "issues": ["códigos de issues"]},
    "C4_JUEZ": {"claimed": <true/false>, "accepted": <true/false>, "issues": ["códigos de issues"]},
    "C5_CONTRIBUCIONES": {"claimed": <true/false>, "accepted": <true/false>, "issues": ["códigos de issues"]},
    "C6_ARTICULOS": {"claimed": <true/false>, "accepted": <true/false>, "issues": ["códigos de issues"]},
    "C7_EXHIBICIONES": {"claimed": <true/false>, "accepted": <true/false>, "issues": ["códigos de issues"]},
    "C8_ROL_PRINCIPAL": {"claimed": <true/false>, "accepted": <true/false>, "issues": ["códigos de issues"]},
    "C9_SALARIO_ALTO": {"claimed": <true/false>, "accepted": <true/false>, "issues": ["códigos de issues"]},
    "C10_EXITO_COMERCIAL": {"claimed": <true/false>, "accepted": <true/false>, "issues": ["códigos de issues"]}
  },
  "criteria_summary": {
    "total_claimed": <número de criterios alegados>,
    "total_accepted": <número de criterios aceptados por USCIS>,
    "meets_minimum": <true si >= 3 criterios aceptados, false si no>
  },
  "issues": [
    {
      "taxonomy_code": "<código de la taxonomía EB1A>",
      "criteria_affected": "<C1_PREMIOS | C2_MEMBRESIAS | ... | FINAL>",
      "severity": "<critical | high | medium | low>",
      "extracted_quote": "<cita textual del documento>",
      "page_ref": "<página si se puede determinar o null>",
      "officer_reasoning": "<resumen del razonamiento del oficial EN ESPAÑOL>"
    }
  ],
  "requests": [
    {
      "request_text": "<qué evidencia específica pide USCIS EN ESPAÑOL>",
      "evidence_type": "<tipo de evidencia>",
      "criteria_mapping": "<C1_PREMIOS | C2_MEMBRESIAS | ... | FINAL>",
      "priority": "<required | recommended>"
    }
  ],
  "summary": {
    "main_deficiencies": ["<deficiencia 1>", "<deficiencia 2>"],
    "strongest_concerns": ["<preocupación principal>"],
    "criteria_at_risk": ["<criterios que podrían no ser aceptados>"],
    "overall_severity": "<critical | high | medium | low>",
    "executive_summary": "<resumen ejecutivo de 2-3 oraciones EN ESPAÑOL>",
    "final_merits_concern": <true si hay preocupación sobre aclamación sostenida/top del campo>
  }
}

REGLAS:
1. Usa SOLO códigos de taxonomía EB1A de la lista
2. Evalúa CADA criterio - marca claimed=true si el beneficiario lo alegó
3. Marca accepted=true solo si USCIS lo aceptó explícitamente
4. Las citas deben ser textuales del documento
5. Severity: critical=puede causar denial, high=problema serio
6. Responde SOLO con el JSON, sin texto adicional`

  } else {
    // NIW (default)
    return `${analysisContext.system}

Estás analizando un documento ${docType} para una petición EB-2 NIW.

DOCUMENTO A ANALIZAR:
${documentText.substring(0, 30000)}

TAXONOMÍA DE ISSUES NIW (usa SOLO estos códigos):
${taxonomyCodes}

EXTRAE la información en formato JSON ESTRICTO (TODO EN ESPAÑOL):

{
  "document_info": {
    "outcome_type": "<RFE | NOID | Denial | Approval>",
    "visa_category": "EB2-NIW",
    "document_date": "<YYYY-MM-DD o null>",
    "response_deadline": "<YYYY-MM-DD o null>",
    "service_center": "<Texas Service Center | Nebraska Service Center | otro | null>",
    "receipt_number": "<IOE... o SRC... o LIN... o null>",
    "beneficiary_name": "<nombre completo o null>",
    "endeavor_field": "<campo del endeavor propuesto EN ESPAÑOL>"
  },
  "prong_evaluation": {
    "P1": {
      "status": "<satisfied | deficient | not_addressed>",
      "issues": ["<códigos de issues P1>"],
      "officer_notes": "<resumen de lo que dijo el oficial sobre Prong 1>"
    },
    "P2": {
      "status": "<satisfied | deficient | not_addressed>",
      "issues": ["<códigos de issues P2>"],
      "officer_notes": "<resumen de lo que dijo el oficial sobre Prong 2>"
    },
    "P3": {
      "status": "<satisfied | deficient | not_addressed>",
      "issues": ["<códigos de issues P3>"],
      "officer_notes": "<resumen de lo que dijo el oficial sobre Prong 3>"
    }
  },
  "issues": [
    {
      "taxonomy_code": "<código de la taxonomía NIW>",
      "severity": "<critical | high | medium | low>",
      "prong_affected": "<P1 | P2 | P3>",
      "extracted_quote": "<cita textual del documento>",
      "page_ref": "<página si se puede determinar o null>",
      "officer_reasoning": "<resumen del razonamiento del oficial EN ESPAÑOL>"
    }
  ],
  "requests": [
    {
      "request_text": "<qué evidencia específica pide USCIS EN ESPAÑOL>",
      "evidence_type": "<tipo de evidencia: carta | documento | explicación | otro>",
      "prong_mapping": "<P1 | P2 | P3>",
      "priority": "<required | recommended>"
    }
  ],
  "summary": {
    "main_deficiencies": ["<deficiencia 1>", "<deficiencia 2>"],
    "strongest_concerns": ["<preocupación principal>"],
    "prongs_affected": {
      "P1": <true/false>,
      "P2": <true/false>,
      "P3": <true/false>
    },
    "overall_severity": "<critical | high | medium | low>",
    "executive_summary": "<resumen ejecutivo de 2-3 oraciones EN ESPAÑOL>"
  }
}

REGLAS:
1. Usa SOLO códigos de taxonomía NIW de la lista proporcionada
2. Evalúa CADA prong según el test Dhanasar
3. Extrae TODAS las deficiencias mencionadas
4. Las citas deben ser textuales del documento
5. Severity: critical=puede causar denial, high=problema serio
6. Responde SOLO con el JSON, sin texto adicional`
  }
}

/**
 * Extrae datos estructurados de un documento RFE/NOID/Denial
 * @param {string} documentText - Texto del documento
 * @param {string} docType - Tipo de documento (RFE, NOID, Denial)
 * @param {string} visaCategory - Categoría de visa (EB2-NIW, EB1A, etc.)
 */
export async function extractStructuredData(documentText, docType = 'RFE', visaCategory = null) {
  const llmConfig = getLLMConfig()

  if (!documentText || documentText.length < 100) {
    throw new Error('Texto del documento muy corto para análisis')
  }

  // Detectar tipo de visa
  const visaType = detectVisaType(documentText, visaCategory)
  
  console.log('🔬 Iniciando extracción estructurada...')
  console.log(`   Tipo documento: ${docType}`)
  console.log(`   Visa detectada: ${visaType}`)
  console.log(`   Longitud: ${documentText.length} caracteres`)

  const prompt = generateExtractionPrompt(visaType, documentText, docType)

  try {
    console.log(`   📡 Usando ${OPENROUTER_API_KEY ? 'OpenRouter' : 'OpenAI'} para extracción...`)
    
    const response = await fetch(llmConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${llmConfig.apiKey}`,
        'Content-Type': 'application/json',
        ...llmConfig.headers
      },
      body: JSON.stringify({
        model: llmConfig.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 8000,
        temperature: 0.1
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ Error en LLM:', error)
      throw new Error(`Error en extracción: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    // Parsear JSON de la respuesta
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('❌ No se encontró JSON en la respuesta')
      throw new Error('Respuesta del LLM no contiene JSON válido')
    }

    const structuredData = JSON.parse(jsonMatch[0])
    
    // Agregar metadata
    structuredData.visa_type_detected = visaType
    structuredData.extraction_timestamp = new Date().toISOString()
    
    console.log(`✅ Extracción completada para ${visaType}`)
    console.log(`   Issues: ${structuredData.issues?.length || 0}`)
    console.log(`   Requests: ${structuredData.requests?.length || 0}`)

    return {
      success: true,
      data: structuredData,
      visaType
    }

  } catch (error) {
    console.error('❌ Error en extracción estructurada:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Analiza un caso completo considerando el tipo de visa
 */
export async function analyzeCaseByVisa(caseData, documents) {
  const visaType = detectVisaType('', caseData.visa_category)
  const analysisContext = getAnalysisPrompt(visaType)
  
  // Preparar resumen de documentos
  const docsContent = documents.map(doc => ({
    type: doc.doc_type,
    name: doc.original_name,
    content: doc.text_content?.substring(0, 3000) || 'Sin contenido',
    structuredData: doc.structured_data || null
  }))

  // Determinar estado del caso
  const isRFE = caseData.outcome === 'rfe' || caseData.outcome === 'noid'
  const isDenied = caseData.outcome === 'denied'
  const isApproved = caseData.outcome === 'approved'

  let focusPrompt = ''
  if (isRFE) {
    focusPrompt = `
ESTE CASO RECIBIÓ UN RFE/NOID. Enfócate en:
1. ¿Por qué USCIS envió el RFE? ¿Qué deficiencias identificó?
2. ¿Qué documentos existentes responden a cada deficiencia?
3. ¿Qué evidencia adicional se necesita?
4. Recomendaciones específicas para la respuesta.`
  } else if (isDenied) {
    focusPrompt = `
ESTE CASO FUE DENEGADO. Enfócate en:
1. ¿Cuáles fueron los errores críticos?
2. ¿Qué se puede aprender para futuros casos?
3. ¿Hay posibilidad de moción o nuevo filing?`
  } else if (isApproved) {
    focusPrompt = `
ESTE CASO FUE APROBADO. Enfócate en:
1. ¿Qué estrategias funcionaron bien?
2. ¿Qué mejores prácticas se pueden replicar?`
  } else {
    focusPrompt = `
ESTE CASO ESTÁ PENDIENTE. Enfócate en:
1. ¿Qué fortalezas tiene el caso actual?
2. ¿Qué debilidades podrían causar un RFE?
3. ¿Qué se puede mejorar antes de que USCIS responda?`
  }

  const prompt = `${analysisContext.system}

${focusPrompt}

INFORMACIÓN DEL CASO:
- Nombre: ${caseData.title || caseData.beneficiary_name}
- Categoría: ${caseData.visa_category}
- Estado: ${caseData.outcome}
- Beneficiario: ${caseData.beneficiary_name}

DOCUMENTOS EN EL EXPEDIENTE:
${JSON.stringify(docsContent, null, 2)}

Responde en JSON con este formato:
{
  "visa_analysis_type": "${visaType}",
  "case_strength_score": <0-100>,
  ${visaType === 'EB1A' ? `
  "criteria_assessment": {
    "C1_PREMIOS": {"strength": "strong|moderate|weak|missing", "notes": "..."},
    "C2_MEMBRESIAS": {"strength": "strong|moderate|weak|missing", "notes": "..."},
    "C3_MATERIAL_PUBLICADO": {"strength": "strong|moderate|weak|missing", "notes": "..."},
    "C4_JUEZ": {"strength": "strong|moderate|weak|missing", "notes": "..."},
    "C5_CONTRIBUCIONES": {"strength": "strong|moderate|weak|missing", "notes": "..."},
    "C6_ARTICULOS": {"strength": "strong|moderate|weak|missing", "notes": "..."},
    "C7_EXHIBICIONES": {"strength": "strong|moderate|weak|missing", "notes": "..."},
    "C8_ROL_PRINCIPAL": {"strength": "strong|moderate|weak|missing", "notes": "..."},
    "C9_SALARIO_ALTO": {"strength": "strong|moderate|weak|missing", "notes": "..."},
    "C10_EXITO_COMERCIAL": {"strength": "strong|moderate|weak|missing", "notes": "..."}
  },
  "criteria_count": {"strong": <n>, "moderate": <n>, "weak": <n>},
  "sustained_acclaim_assessment": "...",` : `
  "prong_assessment": {
    "P1": {"strength": "strong|moderate|weak", "score": <0-100>, "notes": "..."},
    "P2": {"strength": "strong|moderate|weak", "score": <0-100>, "notes": "..."},
    "P3": {"strength": "strong|moderate|weak", "score": <0-100>, "notes": "..."}
  },`}
  "summary": "Resumen ejecutivo de 2-3 oraciones",
  "strengths": ["fortaleza 1", "fortaleza 2"],
  "weaknesses": ["debilidad 1", "debilidad 2"],
  "recommendations": [
    {"priority": "critical|high|medium", "action": "...", "evidence_needed": "..."}
  ],
  "rfe_risk_assessment": "low|medium|high|already_received"
}`

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY
    
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        temperature: 0.2
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON in response')
    }

    return {
      success: true,
      analysis: JSON.parse(jsonMatch[0]),
      visaType
    }

  } catch (error) {
    console.error('Error en análisis de caso:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Guarda los datos estructurados en la base de datos
 */
export async function saveStructuredData(supabase, documentId, structuredData) {
  try {
    const { document_info, issues, requests, summary } = structuredData

    // Actualizar documento con metadata
    if (document_info) {
      await supabase
        .from('documents')
        .update({
          document_date: document_info.document_date,
          outcome_type: document_info.outcome_type,
          visa_category: document_info.visa_category,
          service_center: document_info.service_center,
          receipt_number: document_info.receipt_number,
          beneficiary_name: document_info.beneficiary_name,
          response_deadline: document_info.response_deadline,
          structured_data: structuredData,
          extraction_status: 'completed',
          analyzed_at: new Date().toISOString()
        })
        .eq('id', documentId)
    }

    // Guardar issues en document_issues
    if (issues && issues.length > 0) {
      const issueRecords = issues.map(issue => ({
        document_id: documentId,
        taxonomy_code: issue.taxonomy_code,
        severity: issue.severity,
        extracted_quote: issue.extracted_quote,
        page_ref: issue.page_ref,
        prong_affected: issue.prong_affected || issue.criteria_affected,
        officer_reasoning: issue.officer_reasoning
      }))

      await supabase.from('document_issues').insert(issueRecords)
    }

    // Guardar requests en document_requests
    if (requests && requests.length > 0) {
      const requestRecords = requests.map(req => ({
        document_id: documentId,
        request_text: req.request_text,
        evidence_type: req.evidence_type,
        prong_mapping: req.prong_mapping || req.criteria_mapping,
        priority: req.priority
      }))

      await supabase.from('document_requests').insert(requestRecords)
    }

    return { success: true }
  } catch (error) {
    console.error('Error guardando datos estructurados:', error)
    return { success: false, error: error.message }
  }
}
