import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { analyzeCaseByVisa } from '@/lib/case-miner'
import { getTaxonomyForVisa, getAnalysisPrompt } from '@/lib/taxonomy'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

async function callLLM(messages) {
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      'X-Title': 'Cerebro Visas'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4',
      messages,
      temperature: 0.2,
      max_tokens: 4000
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`LLM API error: ${error}`)
  }

  const data = await response.json()
  const content = data.choices[0].message.content
  
  // Limpiar markdown si el LLM lo agrega
  let cleanContent = content
  if (content.includes('```json')) {
    cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '')
  } else if (content.includes('```')) {
    cleanContent = content.replace(/```\n?/g, '')
  }
  
  return cleanContent.trim()
}

export async function POST(request, { params }) {
  try {
    const { id } = params

    // Obtener el caso con sus documentos
    const { data: caseData, error: caseError } = await supabaseAdmin
      .from('visa_cases')
      .select('*')
      .eq('id', id)
      .single()

    if (caseError) throw caseError

    const { data: documents, error: docsError } = await supabaseAdmin
      .from('case_documents')
      .select('*')
      .eq('case_id', id)

    if (docsError) throw docsError

    if (!documents || documents.length === 0) {
      return NextResponse.json(
        { error: 'No hay documentos para analizar' },
        { status: 400 }
      )
    }

    // Detectar tipo de visa
    const visaCategory = caseData.visa_category || 'EB2-NIW'
    const isEB1A = visaCategory.toUpperCase().includes('EB1')
    const visaType = isEB1A ? 'EB1A' : 'NIW'
    
    console.log(`🔬 Analizando caso ${caseData.title} como ${visaType}`)
    console.log(`📂 Total documentos: ${documents.length}`)

    // Separar documentos por prioridad
    const rfeNoidDocs = documents.filter(d => 
      ['RFE', 'NOID', 'Denial'].includes(d.doc_type)
    )
    const petitionDocs = documents.filter(d => 
      ['Petition Letter', 'Business Plan'].includes(d.doc_type)
    )
    const evidenceDocs = documents.filter(d => 
      ['Carta de Recomendación', 'CV/Resume', 'Evidencia'].includes(d.doc_type)
    )
    const otherDocs = documents.filter(d => 
      !['RFE', 'NOID', 'Denial', 'Petition Letter', 'Business Plan', 'Carta de Recomendación', 'CV/Resume', 'Evidencia'].includes(d.doc_type)
    )

    console.log(`📋 RFE/NOID: ${rfeNoidDocs.length}, Petition: ${petitionDocs.length}, Evidence: ${evidenceDocs.length}, Other: ${otherDocs.length}`)

    // Preparar contenido con límites diferentes según prioridad
    const prepareDoc = (doc, maxChars) => ({
      type: doc.doc_type,
      name: doc.original_name,
      content: doc.text_content?.substring(0, maxChars) || 'Sin contenido',
      wordCount: doc.word_count || 0
    })

    // RFE/NOID: máximo contenido (son los más importantes)
    const rfeContent = rfeNoidDocs.map(d => prepareDoc(d, 25000))
    
    // Petition/Business Plan: contenido alto
    const petitionContent = petitionDocs.map(d => prepareDoc(d, 15000))
    
    // Cartas de recomendación y CV: contenido medio
    const evidenceContent = evidenceDocs.map(d => prepareDoc(d, 8000))
    
    // Otros documentos: solo resumen
    const otherContent = otherDocs.map(d => prepareDoc(d, 3000))

    const docsContent = {
      rfe_noid_documents: rfeContent,
      petition_documents: petitionContent,
      evidence_documents: evidenceContent,
      other_documents: otherContent,
      summary: {
        total: documents.length,
        rfe_count: rfeNoidDocs.length,
        evidence_count: evidenceDocs.length
      }
    }

    // Determinar el tipo de análisis según el outcome
    const isApproved = caseData.outcome === 'approved'
    const isRFE = caseData.outcome === 'rfe' || caseData.outcome === 'noid'
    const isDenied = caseData.outcome === 'denied'

    // Obtener contexto de análisis según visa
    const analysisContext = getAnalysisPrompt(visaType)
    
    let analysisPrompt = ''

    if (isEB1A) {
      // Análisis EB-1A
      analysisPrompt = `${analysisContext.system}

${analysisContext.criteria_explanation}

${isRFE ? `
ESTE CASO RECIBIÓ UN RFE/NOID. Analiza:
1. ¿Qué criterios fueron cuestionados?
2. ¿Qué evidencia adicional se necesita para cada criterio?
3. ¿Se cuestiona la "aclamación sostenida" o estar en el "top del campo"?
` : isApproved ? `
ESTE CASO FUE APROBADO. Analiza:
1. ¿Qué criterios fueron aceptados?
2. ¿Qué estrategias funcionaron?
` : isDenied ? `
ESTE CASO FUE DENEGADO. Analiza:
1. ¿Qué criterios fallaron?
2. ¿Qué se puede mejorar si se presenta de nuevo?
` : `
ESTE CASO ESTÁ PENDIENTE. Analiza:
1. ¿Qué criterios están bien documentados?
2. ¿Qué criterios necesitan más evidencia?
3. ¿Hay riesgo de RFE? ¿En qué criterios?
`}

Responde SOLO con JSON:
{
  "visa_type": "EB1A",
  "summary": "Resumen ejecutivo del análisis (2-3 oraciones)",
  "criteria_assessment": {
    "C1_PREMIOS": {"status": "strong|adequate|weak|not_claimed", "notes": "..."},
    "C2_MEMBRESIAS": {"status": "strong|adequate|weak|not_claimed", "notes": "..."},
    "C3_MATERIAL_PUBLICADO": {"status": "strong|adequate|weak|not_claimed", "notes": "..."},
    "C4_JUEZ": {"status": "strong|adequate|weak|not_claimed", "notes": "..."},
    "C5_CONTRIBUCIONES": {"status": "strong|adequate|weak|not_claimed", "notes": "..."},
    "C6_ARTICULOS": {"status": "strong|adequate|weak|not_claimed", "notes": "..."},
    "C7_EXHIBICIONES": {"status": "strong|adequate|weak|not_claimed", "notes": "..."},
    "C8_ROL_PRINCIPAL": {"status": "strong|adequate|weak|not_claimed", "notes": "..."},
    "C9_SALARIO_ALTO": {"status": "strong|adequate|weak|not_claimed", "notes": "..."},
    "C10_EXITO_COMERCIAL": {"status": "strong|adequate|weak|not_claimed", "notes": "..."}
  },
  "criteria_count": {
    "strong": <número>,
    "adequate": <número>,
    "weak": <número>,
    "not_claimed": <número>
  },
  "meets_3_criteria": <true/false>,
  "sustained_acclaim": {
    "demonstrated": <true/false>,
    "concerns": "..."
  },
  "strengths": ["Lista de fortalezas"],
  "weaknesses": ["Lista de debilidades"],
  "recommendations": ["Recomendaciones específicas para EB-1A"],
  "overall_score": <0-100>
}`
    } else {
      // Análisis NIW
      analysisPrompt = `${analysisContext.system}

${isRFE ? `
ESTE CASO RECIBIÓ UN RFE/NOID. Analiza:
1. ¿Qué Prongs fueron cuestionados?
2. ¿Cuáles fueron las deficiencias específicas en cada Prong?
3. ¿Qué evidencia adicional se necesita?
` : isApproved ? `
ESTE CASO FUE APROBADO. Analiza:
1. ¿Qué hizo bien el caso en cada Prong?
2. ¿Qué estrategias funcionaron?
` : isDenied ? `
ESTE CASO FUE DENEGADO. Analiza:
1. ¿Qué Prong(s) fallaron?
2. ¿Qué se puede mejorar?
` : `
ESTE CASO ESTÁ PENDIENTE. Analiza:
1. ¿Qué tan fuerte está cada Prong?
2. ¿Dónde hay riesgo de RFE?
3. ¿Qué se puede reforzar?
`}

Responde SOLO con JSON:
{
  "visa_type": "NIW",
  "summary": "Resumen ejecutivo del análisis (2-3 oraciones)",
  "prong_analysis": {
    "P1": {
      "name": "Mérito Sustancial e Importancia Nacional",
      "score": <0-100>,
      "status": "strong|adequate|weak",
      "notes": "Análisis del Prong 1",
      "deficiencies": ["Lista de deficiencias si hay"],
      "recommendations": ["Recomendaciones específicas"]
    },
    "P2": {
      "name": "Bien Posicionado para Avanzar",
      "score": <0-100>,
      "status": "strong|adequate|weak",
      "notes": "Análisis del Prong 2",
      "deficiencies": ["Lista de deficiencias si hay"],
      "recommendations": ["Recomendaciones específicas"]
    },
    "P3": {
      "name": "Balance de Factores (Waiver)",
      "score": <0-100>,
      "status": "strong|adequate|weak",
      "notes": "Análisis del Prong 3",
      "deficiencies": ["Lista de deficiencias si hay"],
      "recommendations": ["Recomendaciones específicas"]
    }
  },
  "strengths": ["Lista de fortalezas del caso"],
  "weaknesses": ["Lista de debilidades"],
  "recommendations": ["Recomendaciones generales prioritarias"],
  "overall_score": <0-100>
}`
    }

    // Llamar al LLM
    const llmResponse = await callLLM([
      { role: 'system', content: analysisPrompt },
      { 
        role: 'user', 
        content: `CASO: ${caseData.title}\nCATEGORÍA: ${visaCategory}\nBENEFICIARIO: ${caseData.beneficiary_name || 'No especificado'}\nESTADO: ${caseData.outcome}\n\nDOCUMENTOS (${documents.length}):\n${JSON.stringify(docsContent, null, 2)}`
      }
    ])

    const analysis = JSON.parse(llmResponse)

    // Guardar el análisis en el caso
    await supabaseAdmin
      .from('visa_cases')
      .update({
        case_analysis: analysis,
        analyzed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    console.log(`✅ Análisis completado: Score ${analysis.overall_score}`)

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('Error analyzing case:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
