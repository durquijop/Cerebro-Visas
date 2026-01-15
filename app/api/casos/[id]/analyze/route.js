import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
      model: 'openai/gpt-4o-mini',
      messages,
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`LLM API error: ${error}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
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

    // Preparar el contenido de los documentos
    const docsContent = documents.map(doc => ({
      type: doc.doc_type,
      name: doc.original_name,
      content: doc.text_content?.substring(0, 5000) || 'Sin contenido'
    }))

    // Determinar el tipo de análisis según el outcome
    const isApproved = caseData.outcome === 'approved'
    const isRFE = caseData.outcome === 'rfe' || caseData.outcome === 'noid'
    const isDenied = caseData.outcome === 'denied'

    let analysisPrompt = ''

    if (isApproved) {
      analysisPrompt = `Eres un experto en visas EB-2 NIW. Este caso fue APROBADO.

Analiza los documentos y extrae:
1. Las FORTALEZAS del caso: ¿Qué se hizo bien? ¿Qué estrategias funcionaron?
2. MEJORES PRÁCTICAS: ¿Qué pueden aprender otros casos de éste?
3. RECOMENDACIONES: Consejos para replicar este éxito.

Responde SOLO con JSON:
{
  "summary": "Resumen ejecutivo del análisis (2-3 oraciones)",
  "strengths": ["Lista de fortalezas y lo que se hizo bien"],
  "best_practices": ["Mejores prácticas identificadas"],
  "recommendations": ["Recomendaciones para futuros casos"]
}`
    } else if (isRFE) {
      analysisPrompt = `Eres un experto en visas EB-2 NIW. Este caso recibió un RFE/NOID.

Analiza los documentos y el RFE para identificar:
1. DEBILIDADES: ¿Qué problemas tenían los documentos originales?
2. CAUSAS del RFE: ¿Por qué USCIS pidió más evidencia?
3. RECOMENDACIONES: ¿Cómo se debería responder? ¿Qué mejorar?

Busca específicamente:
- Prong 1: ¿Se demostró importancia nacional?
- Prong 2: ¿Se demostró que el beneficiario está bien posicionado?
- Prong 3: ¿Se justificó el waiver del labor certification?

Responde SOLO con JSON:
{
  "summary": "Resumen del análisis del RFE (2-3 oraciones)",
  "weaknesses": ["Lista de debilidades identificadas en los documentos"],
  "rfe_causes": ["Causas probables del RFE según el análisis"],
  "prong_analysis": {
    "p1": "Análisis de Prong 1",
    "p2": "Análisis de Prong 2",
    "p3": "Análisis de Prong 3"
  },
  "recommendations": ["Recomendaciones específicas para responder al RFE"]
}`
    } else if (isDenied) {
      analysisPrompt = `Eres un experto en visas EB-2 NIW. Este caso fue DENEGADO.

Analiza los documentos para identificar:
1. ERRORES CRÍTICOS: ¿Qué falló en el caso?
2. DEBILIDADES: Problemas en los documentos y argumentación
3. LECCIONES: ¿Qué se puede aprender de este caso?

Responde SOLO con JSON:
{
  "summary": "Resumen del análisis de la denegación (2-3 oraciones)",
  "critical_errors": ["Errores críticos que llevaron a la denegación"],
  "weaknesses": ["Debilidades en los documentos"],
  "lessons_learned": ["Lecciones aprendidas"],
  "recommendations": ["Recomendaciones si se presenta una moción o nuevo caso"]
}`
    } else {
      analysisPrompt = `Eres un experto en visas EB-2 NIW. Este caso está PENDIENTE.

Analiza los documentos para identificar:
1. FORTALEZAS: ¿Qué está bien en el caso actual?
2. POSIBLES DEBILIDADES: ¿Qué podría causar un RFE?
3. RECOMENDACIONES: ¿Qué se puede mejorar antes de presentar?

Responde SOLO con JSON:
{
  "summary": "Resumen del estado actual del caso (2-3 oraciones)",
  "strengths": ["Fortalezas actuales del caso"],
  "weaknesses": ["Posibles debilidades o riesgos de RFE"],
  "recommendations": ["Recomendaciones para fortalecer el caso"]
}`
    }

    // Llamar al LLM
    const llmResponse = await callLLM([
      { role: 'system', content: analysisPrompt },
      { 
        role: 'user', 
        content: `CASO: ${caseData.title}\nCATEGORÍA: ${caseData.visa_category}\nESTADO: ${caseData.outcome}\n\nDOCUMENTOS:\n${JSON.stringify(docsContent, null, 2)}`
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

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('Error analyzing case:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
