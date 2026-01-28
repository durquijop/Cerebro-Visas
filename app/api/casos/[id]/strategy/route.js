import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

async function callLLM(messages, options = {}) {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: options.model || 'gpt-4.1',
      messages,
      temperature: options.temperature || 0.3,
      max_tokens: options.maxTokens || 8000
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${error}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

/**
 * POST /api/casos/[id]/strategy
 * Genera una estrategia de respuesta al RFE
 */
export async function POST(request, { params }) {
  try {
    const { id } = params

    // 1. Obtener el caso
    const { data: caseData, error: caseError } = await supabaseAdmin
      .from('visa_cases')
      .select('*')
      .eq('id', id)
      .single()

    if (caseError) throw new Error(`Error obteniendo caso: ${caseError.message}`)

    // 2. Obtener todos los documentos del caso
    const { data: documents, error: docsError } = await supabaseAdmin
      .from('case_documents')
      .select('*')
      .eq('case_id', id)

    if (docsError) throw new Error(`Error obteniendo documentos: ${docsError.message}`)

    // 3. Separar documentos por tipo
    const rfeDocuments = documents.filter(d => 
      ['RFE', 'NOID', 'Denial'].includes(d.doc_type)
    )
    
    if (rfeDocuments.length === 0) {
      return NextResponse.json(
        { error: 'No hay documentos RFE/NOID/Denial en este caso para generar estrategia' },
        { status: 400 }
      )
    }

    const evidenceDocuments = documents.filter(d => 
      !['RFE', 'NOID', 'Denial'].includes(d.doc_type)
    )

    // 4. Preparar contenido para el análisis
    const rfeContent = rfeDocuments.map(d => ({
      name: d.original_name,
      type: d.doc_type,
      content: d.text_content?.substring(0, 30000) || 'Sin contenido'
    }))

    const evidenceSummary = evidenceDocuments.map(d => ({
      name: d.original_name,
      type: d.doc_type,
      wordCount: d.word_count || 0,
      hasContent: (d.text_content?.length || 0) > 100
    }))

    // 5. Detectar tipo de visa
    const visaCategory = caseData.visa_category || 'EB2-NIW'
    const isEB1A = visaCategory.toUpperCase().includes('EB1')
    const visaType = isEB1A ? 'EB1A' : 'NIW'

    console.log(`📋 Generando estrategia para caso ${caseData.title}`)
    console.log(`   Visa: ${visaType}`)
    console.log(`   RFEs: ${rfeDocuments.length}`)
    console.log(`   Evidencia: ${evidenceDocuments.length} documentos`)

    // 6. Construir prompt de estrategia
    const strategyPrompt = generateStrategyPrompt(visaType, caseData, rfeContent, evidenceSummary)

    // 7. Llamar al LLM
    const llmResponse = await callLLM([
      { role: 'user', content: strategyPrompt }
    ], { maxTokens: 10000, temperature: 0.3 })

    // 8. Parsear respuesta
    let strategy
    try {
      // Limpiar markdown si existe
      let cleanResponse = llmResponse
      if (cleanResponse.includes('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      } else if (cleanResponse.includes('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/g, '')
      }
      strategy = JSON.parse(cleanResponse.trim())
    } catch (parseError) {
      console.error('Error parseando respuesta:', parseError)
      console.log('Respuesta raw:', llmResponse.substring(0, 500))
      throw new Error('Error procesando la estrategia generada')
    }

    // 9. Agregar metadata
    strategy.metadata = {
      case_id: id,
      case_name: caseData.title,
      beneficiary: caseData.beneficiary_name,
      visa_category: visaCategory,
      visa_type: visaType,
      generated_at: new Date().toISOString(),
      rfe_documents_analyzed: rfeDocuments.length,
      evidence_documents_available: evidenceDocuments.length
    }

    // 10. Guardar estrategia en el caso
    await supabaseAdmin
      .from('visa_cases')
      .update({
        rfe_strategy: strategy,
        strategy_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    console.log(`✅ Estrategia generada con ${strategy.deficiencies?.length || 0} puntos`)

    return NextResponse.json({ 
      success: true, 
      strategy 
    })

  } catch (error) {
    console.error('Error generando estrategia:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

/**
 * Genera el prompt para la estrategia según el tipo de visa
 */
function generateStrategyPrompt(visaType, caseData, rfeContent, evidenceSummary) {
  const legalFramework = visaType === 'EB1A' 
    ? `MARCO LEGAL EB-1A:
- 8 CFR 204.5(h)(3): 10 criterios, debe cumplir al menos 3
- Kazarian v. USCIS: Análisis de dos pasos (evidencia inicial + méritos finales)
- El beneficiario debe demostrar "aclamación nacional o internacional sostenida"
- Debe estar en el "pequeño porcentaje que ha llegado a la cima del campo"

CRITERIOS EB-1A:
C1: Premios/reconocimientos de excelencia
C2: Membresías en asociaciones que requieren logros sobresalientes
C3: Material publicado sobre el beneficiario
C4: Participación como juez del trabajo de otros
C5: Contribuciones originales de importancia mayor
C6: Autoría de artículos académicos
C7: Exhibición del trabajo en exposiciones artísticas
C8: Rol principal en organizaciones distinguidas
C9: Salario alto en relación con otros en el campo
C10: Éxito comercial en artes escénicas`
    : `MARCO LEGAL EB-2 NIW (Test Dhanasar):
- Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016)
- Tres prongs que TODOS deben satisfacerse:

PRONG 1 - Mérito Sustancial e Importancia Nacional:
- El endeavor propuesto debe tener mérito sustancial
- Debe tener importancia nacional (no necesariamente impacto en todo EE.UU.)
- Áreas: salud, tecnología, educación, economía, medio ambiente, etc.

PRONG 2 - Bien Posicionado para Avanzar:
- Educación, habilidades, conocimiento relevante
- Historial de éxito en esfuerzos relacionados
- Modelo o plan de progreso
- Interés de clientes, usuarios, inversores potenciales
- Cartas de apoyo de expertos

PRONG 3 - Balance de Factores (Waiver):
- Beneficio para EE.UU. de dispensar requisitos de oferta laboral/certificación
- Naturaleza del endeavor (urgencia, escasez de profesionales)
- Impacto adverso mínimo en trabajadores estadounidenses`

  return `Eres un estratega legal experto en inmigración de Estados Unidos, especializado en casos ${visaType}.

${legalFramework}

INFORMACIÓN DEL CASO:
- Nombre: ${caseData.title}
- Beneficiario: ${caseData.beneficiary_name || 'No especificado'}
- Categoría: ${caseData.visa_category}
- Estado actual: ${caseData.outcome}

DOCUMENTO(S) RFE/NOID RECIBIDO(S):
${rfeContent.map((doc, i) => `
=== DOCUMENTO ${i + 1}: ${doc.name} (${doc.type}) ===
${doc.content}
`).join('\n')}

EVIDENCIA DISPONIBLE EN EL EXPEDIENTE (${evidenceSummary.length} documentos):
${evidenceSummary.map(doc => `- ${doc.name} (${doc.type}) - ${doc.wordCount} palabras`).join('\n')}

GENERA UNA ESTRATEGIA COMPLETA DE RESPUESTA EN FORMATO JSON:

{
  "executive_summary": "Resumen ejecutivo de 3-4 oraciones sobre el RFE y la estrategia general recomendada",
  
  "rfe_overview": {
    "document_type": "RFE | NOID | Denial",
    "date_identified": "fecha si se puede extraer o null",
    "response_deadline": "fecha límite si se menciona o null",
    "overall_severity": "critical | high | medium",
    "main_concerns": ["lista de las 3-5 preocupaciones principales de USCIS"]
  },
  
  "deficiencies": [
    {
      "id": 1,
      "title": "Título descriptivo de la deficiencia",
      "prong_or_criteria": "${visaType === 'EB1A' ? 'C1_PREMIOS | C2_MEMBRESIAS | etc.' : 'P1 | P2 | P3'}",
      "uscis_concern": "Qué exactamente cuestiona USCIS (cita o paráfrasis)",
      "severity": "critical | high | medium | low",
      "existing_evidence": [
        "Documento existente que ayuda a responder este punto"
      ],
      "evidence_gaps": [
        "Evidencia que falta y se debe conseguir"
      ],
      "recommended_response": {
        "main_argument": "Argumento principal a presentar",
        "supporting_points": ["Punto de apoyo 1", "Punto de apoyo 2"],
        "legal_citations": ["Caso precedente o regulación aplicable"],
        "evidence_to_submit": [
          {
            "type": "Tipo de evidencia (carta, documento, etc.)",
            "description": "Descripción específica",
            "from_whom": "De quién obtenerla",
            "priority": "essential | recommended | optional"
          }
        ]
      }
    }
  ],
  
  "response_structure": {
    "recommended_order": [
      {
        "section": 1,
        "title": "Título de la sección",
        "content_summary": "Qué incluir en esta sección",
        "estimated_pages": "1-2 páginas"
      }
    ],
    "tone_guidance": "Guía sobre el tono a usar en la respuesta",
    "key_themes": ["Tema recurrente 1", "Tema recurrente 2"]
  },
  
  "evidence_checklist": {
    "essential": [
      {
        "item": "Descripción del documento/evidencia",
        "purpose": "Para qué sirve",
        "addresses_deficiency": [1, 2]
      }
    ],
    "recommended": [
      {
        "item": "Descripción",
        "purpose": "Para qué sirve",
        "addresses_deficiency": [1]
      }
    ],
    "optional_strengthening": [
      {
        "item": "Descripción",
        "purpose": "Por qué ayudaría"
      }
    ]
  },
  
  "legal_arguments": [
    {
      "argument_title": "Título del argumento",
      "legal_basis": "Base legal (caso, regulación)",
      "application": "Cómo aplica a este caso",
      "addresses_deficiency": [1, 2]
    }
  ],
  
  "risk_assessment": {
    "approval_probability_if_addressed": "high | medium | low",
    "critical_success_factors": ["Factor 1", "Factor 2"],
    "potential_weaknesses": ["Debilidad que podría persistir"],
    "contingency_recommendations": "Qué hacer si se recibe otro RFE o denegación"
  },
  
  "timeline_recommendations": {
    "preparation_time_needed": "X semanas",
    "key_milestones": [
      {
        "week": 1,
        "tasks": ["Tarea 1", "Tarea 2"]
      }
    ]
  }
}

INSTRUCCIONES:
1. Analiza CADA deficiencia mencionada en el RFE
2. Cruza con la evidencia existente para identificar qué ya tenemos
3. Identifica gaps específicos de evidencia
4. Proporciona argumentos legales con citas de precedentes
5. Sé específico y accionable en las recomendaciones
6. TODO debe estar en ESPAÑOL
7. Responde SOLO con el JSON, sin texto adicional`
}
