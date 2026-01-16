/**
 * CASE MINER - Extracción Estructurada con LLM
 * Convierte documentos RFE/NOID/Denial en data estructurada
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

/**
 * Taxonomía de issues para mapeo
 */
const TAXONOMY_CODES = {
  // Prong 1
  'NIW.P1.MERITO.IMPACTO_NO_CUANTIFICADO': 'Impacto económico no cuantificado',
  'NIW.P1.MERITO.ALCANCE_LOCAL': 'Alcance geográfico limitado/local',
  'NIW.P1.MERITO.PROBLEMA_COMUN': 'Problema descrito como común',
  'NIW.P1.MERITO.SIN_IMPORTANCIA_NACIONAL': 'Importancia nacional no demostrada',
  'NIW.P1.MERITO.BENEFICIO_LIMITADO': 'Beneficio limitado a clientes',
  // Prong 2
  'NIW.P2.POSICION.EDUCACION_INSUFICIENTE': 'Educación insuficiente',
  'NIW.P2.POSICION.EXPERIENCIA_NO_RELACIONADA': 'Experiencia no relacionada',
  'NIW.P2.POSICION.SIN_TRACK_RECORD': 'Sin track record de éxito',
  'NIW.P2.POSICION.PLAN_VAGO': 'Plan futuro vago o incompleto',
  'NIW.P2.POSICION.SIN_PROGRESO': 'Sin progreso demostrado',
  'NIW.P2.POSICION.SIN_RECURSOS': 'Recursos no demostrados',
  'NIW.P2.POSICION.SIN_INTERES_TERCEROS': 'Sin interés de terceros',
  // Prong 3
  'NIW.P3.BALANCE.PERM_NO_JUSTIFICADO': 'Waiver PERM no justificado',
  'NIW.P3.BALANCE.TRABAJADORES_US': 'Perjuicio a trabajadores US no descartado',
  'NIW.P3.BALANCE.ESCASEZ_NO_DEMOSTRADA': 'Escasez de talento no demostrada',
  'NIW.P3.BALANCE.URGENCIA_NO_DEMOSTRADA': 'Urgencia no demostrada',
  // Evidencia - Cartas
  'NIW.EV.CARTAS.GENERICAS': 'Cartas genéricas',
  'NIW.EV.CARTAS.SIN_VERIFICABLES': 'Cartas sin ejemplos verificables',
  'NIW.EV.CARTAS.AUTORES_NO_CALIFICADOS': 'Autores de cartas no calificados',
  'NIW.EV.CARTAS.RELACION_PERSONAL': 'Cartas de relación personal',
  // Evidencia - Publicaciones
  'NIW.EV.PUBS.IRRELEVANTES': 'Publicaciones irrelevantes al endeavor',
  'NIW.EV.PUBS.POCAS_CITAS': 'Publicaciones con pocas citaciones',
  'NIW.EV.PUBS.SIN_INFLUENCIA': 'Sin influencia demostrada en el campo',
  // Evidencia - Business Plan
  'NIW.EV.BP.NUMEROS_SIN_METODOLOGIA': 'Proyecciones sin metodología',
  'NIW.EV.BP.SUPUESTOS_NO_SOPORTADOS': 'Supuestos no soportados',
  'NIW.EV.BP.MERCADO_NO_VALIDADO': 'Mercado no validado',
  // Evidencia - Econométrico
  'NIW.EV.ECON.METODOLOGIA_DEBIL': 'Metodología econométrica débil',
  'NIW.EV.ECON.SUPUESTOS_IRREALES': 'Supuestos irreales',
  // Evidencia - Patentes
  'NIW.EV.PAT.SIN_USO': 'Patentes sin uso comercial',
  'NIW.EV.PAT.SIN_LICENCIAS': 'Patentes sin licencias',
  // Coherencia
  'NIW.COH.CONTRADICCIONES': 'Contradicciones internas',
  'NIW.COH.CRONOLOGIA_CONFUSA': 'Cronología confusa',
  'NIW.COH.CLAIMS_VS_EXHIBITS': 'Claims grandes, exhibits pequeños',
  // Procedural
  'NIW.PROC.GRADO_NO_EQUIVALENTE': 'Grado no equivalente a USA',
  'NIW.PROC.TRANSCRIPTS_FALTANTES': 'Transcripts faltantes',
  'NIW.PROC.TRADUCCION_FALTANTE': 'Traducción faltante'
}

/**
 * Extrae datos estructurados de un documento RFE/NOID/Denial
 */
export async function extractStructuredData(documentText, docType = 'RFE') {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY no configurada')
  }

  if (!documentText || documentText.length < 100) {
    throw new Error('Texto del documento muy corto para análisis')
  }

  console.log('🔬 Iniciando extracción estructurada...')
  console.log(`   Tipo: ${docType}, Longitud: ${documentText.length} caracteres`)

  const taxonomyList = Object.entries(TAXONOMY_CODES)
    .map(([code, desc]) => `${code}: ${desc}`)
    .join('\n')

  const prompt = `Eres un experto analizador de documentos de inmigración de USCIS. Analiza este documento ${docType} y extrae información estructurada.

IMPORTANTE: TODAS las respuestas deben estar en ESPAÑOL.

DOCUMENTO A ANALIZAR:
${documentText.substring(0, 30000)}

TAXONOMÍA DE ISSUES (usa SOLO estos códigos):
${taxonomyList}

EXTRAE la siguiente información en formato JSON ESTRICTO (TODO EN ESPAÑOL):

{
  "document_info": {
    "outcome_type": "<RFE | NOID | Denial | Approval>",
    "visa_category": "<EB2-NIW | EB1A | EB1B | EB2 | EB3 | otro>",
    "document_date": "<YYYY-MM-DD o null>",
    "response_deadline": "<YYYY-MM-DD o null>",
    "service_center": "<Texas Service Center | Nebraska Service Center | otro | null>",
    "field_office": "<si aplica o null>",
    "officer_id": "<código del oficial si aparece o null>",
    "receipt_number": "<IOE... o SRC... o LIN... o null>",
    "a_number": "<A###-###-### o null>",
    "beneficiary_name": "<nombre completo o null>",
    "endeavor_field": "<campo del endeavor propuesto EN ESPAÑOL>"
  },
  "issues": [
    {
      "taxonomy_code": "<código de la taxonomía>",
      "severity": "<critical | high | medium | low>",
      "prong_affected": "<P1 | P2 | P3 | EVIDENCE | COHERENCE | PROCEDURAL>",
      "extracted_quote": "<cita textual del documento>",
      "page_ref": "<página si se puede determinar o null>",
      "officer_reasoning": "<resumen del razonamiento del oficial EN ESPAÑOL>"
    }
  ],
  "requests": [
    {
      "request_text": "<qué evidencia específica pide USCIS EN ESPAÑOL>",
      "evidence_type": "<tipo de evidencia: carta | documento | explicación | otro>",
      "prong_mapping": "<P1 | P2 | P3 | PROCEDURAL>",
      "priority": "<required | recommended>"
    }
  ],
  "summary": {
    "main_deficiencies": ["<deficiencia 1 EN ESPAÑOL>", "<deficiencia 2 EN ESPAÑOL>"],
    "strongest_concerns": ["<preocupación principal EN ESPAÑOL>"],
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
1. Usa SOLO códigos de taxonomía de la lista proporcionada
2. Extrae TODAS las deficiencias mencionadas, no solo las principales
3. Las citas deben ser textuales del documento
4. Si un campo no está en el documento, usa null
5. Severity: critical=puede causar denial, high=problema serio, medium=debilidad, low=sugerencia
6. Responde SOLO con el JSON, sin texto adicional`

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        'X-Title': 'Cerebro Visas - Case Miner'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
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
    console.log(`✅ Extracción completada: ${structuredData.issues?.length || 0} issues encontrados`)

    return {
      success: true,
      data: structuredData
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
 * Guarda los datos estructurados en la base de datos
 */
export async function saveStructuredData(supabase, documentId, structuredData) {
  try {
    const { document_info, issues, requests, summary } = structuredData

    // 1. Actualizar documento con info extraída
    const docUpdate = {
      outcome_type: document_info.outcome_type,
      visa_category: document_info.visa_category,
      document_date: document_info.document_date,
      response_deadline: document_info.response_deadline,
      service_center: document_info.service_center,
      field_office: document_info.field_office,
      officer_id: document_info.officer_id,
      receipt_number: document_info.receipt_number,
      a_number: document_info.a_number,
      beneficiary_name: document_info.beneficiary_name,
      structured_data: structuredData,
      extraction_status: 'completed',
      analyzed_at: new Date().toISOString()
    }

    await supabase
      .from('documents')
      .update(docUpdate)
      .eq('id', documentId)

    // 2. Guardar issues
    if (issues && issues.length > 0) {
      const issuesToInsert = issues.map(issue => ({
        document_id: documentId,
        taxonomy_code: issue.taxonomy_code,
        severity: issue.severity,
        extracted_quote: issue.extracted_quote,
        page_ref: issue.page_ref,
        prong_affected: issue.prong_affected,
        officer_reasoning: issue.officer_reasoning
      }))

      // Eliminar issues anteriores del documento
      await supabase
        .from('document_issues')
        .delete()
        .eq('document_id', documentId)

      // Insertar nuevos issues
      const { error: issuesError } = await supabase
        .from('document_issues')
        .insert(issuesToInsert)

      if (issuesError) {
        console.error('Error guardando issues:', issuesError)
      }
    }

    // 3. Guardar requests
    if (requests && requests.length > 0) {
      const requestsToInsert = requests.map(req => ({
        document_id: documentId,
        request_text: req.request_text,
        evidence_type: req.evidence_type,
        prong_mapping: req.prong_mapping,
        priority: req.priority
      }))

      // Eliminar requests anteriores
      await supabase
        .from('document_requests')
        .delete()
        .eq('document_id', documentId)

      // Insertar nuevos requests
      const { error: requestsError } = await supabase
        .from('document_requests')
        .insert(requestsToInsert)

      if (requestsError) {
        console.error('Error guardando requests:', requestsError)
      }
    }

    console.log(`✅ Datos estructurados guardados para documento ${documentId}`)
    return { success: true }

  } catch (error) {
    console.error('❌ Error guardando datos estructurados:', error)
    return { success: false, error: error.message }
  }
}
