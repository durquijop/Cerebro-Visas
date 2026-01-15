import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { document_id, case_id } = await request.json()

    if (!document_id || !case_id) {
      return NextResponse.json({ error: 'document_id y case_id son requeridos' }, { status: 400 })
    }

    // Obtener el documento
    const { data: doc, error: docError } = await supabaseAdmin
      .from('case_documents')
      .select('*')
      .eq('id', document_id)
      .single()

    if (docError) throw docError

    // Obtener el caso con el análisis de CV
    const { data: caseData, error: caseError } = await supabaseAdmin
      .from('visa_cases')
      .select('*')
      .eq('id', case_id)
      .single()

    if (caseError) throw caseError

    console.log(`📄 Analizando documento: ${doc.original_name} para caso ${caseData.title}`)

    // Analizar el documento
    const analysis = await analyzeDocument(doc, caseData)

    // Guardar el análisis en el documento
    const { error: updateError } = await supabaseAdmin
      .from('case_documents')
      .update({ 
        analysis_summary: JSON.stringify(analysis),
        analyzed_at: new Date().toISOString()
      })
      .eq('id', document_id)

    if (updateError) {
      console.error('Error guardando análisis:', updateError)
    }

    console.log(`✅ Análisis completado para ${doc.original_name}`)

    return NextResponse.json({
      success: true,
      analysis
    })

  } catch (error) {
    console.error('Error analyzing document:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function analyzeDocument(doc, caseData) {
  const apiKey = process.env.OPENROUTER_API_KEY
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY no configurada')
  }

  const docText = doc.text_content || ''
  const cvAnalysis = caseData.cv_analysis || {}
  const visaCategory = caseData.visa_category || 'EB2-NIW'
  const beneficiaryName = caseData.beneficiary_name || 'el beneficiario'

  const prompt = buildDocumentAnalysisPrompt(doc, docText, cvAnalysis, visaCategory, beneficiaryName)

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      'X-Title': 'Cerebro Visas - Document Analysis'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 3000
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Error en API de IA')
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content

  if (!content) {
    throw new Error('No se recibió respuesta de la IA')
  }

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    throw new Error('No se encontró JSON válido')
  } catch (parseError) {
    return {
      relevance_score: 50,
      summary: content.substring(0, 500),
      recommendation: 'REQUIERE REVISIÓN MANUAL'
    }
  }
}

function buildDocumentAnalysisPrompt(doc, docText, cvAnalysis, visaCategory, beneficiaryName) {
  const docTypeDescriptions = {
    'petition': 'Petición I-140',
    'rfe': 'Request for Evidence (RFE)',
    'rfe_response': 'Respuesta a RFE',
    'support_letter': 'Carta de Apoyo/Recomendación',
    'evidence': 'Documento de Evidencia',
    'publication': 'Publicación Académica',
    'citation': 'Citaciones',
    'award': 'Premio o Reconocimiento',
    'media': 'Cobertura de Medios',
    'contract': 'Contrato o Acuerdo',
    'financial': 'Documento Financiero',
    'cv': 'CV/Resume',
    'degree': 'Título Académico',
    'certification': 'Certificación',
    'other': 'Otro Documento'
  }

  const docTypeName = docTypeDescriptions[doc.doc_type] || doc.doc_type

  // Construir contexto del CV si existe
  let cvContext = ''
  if (cvAnalysis && cvAnalysis.aptitude_score) {
    cvContext = `
PERFIL DEL BENEFICIARIO (del análisis de CV):
- Puntaje de Aptitud: ${cvAnalysis.aptitude_score}%
- Recomendación: ${cvAnalysis.recommendation}
- Resumen: ${cvAnalysis.summary}
- Fortalezas: ${(cvAnalysis.key_qualifications || []).join(', ')}
- Áreas débiles: ${(cvAnalysis.missing_evidence || []).join(', ')}
`
  }

  return `Eres un experto analista de inmigración de EE.UU. especializado en visas ${visaCategory}.

TAREA: Analizar el siguiente documento y evaluar qué tan útil es para fortalecer el caso de visa de ${beneficiaryName}.

TIPO DE DOCUMENTO: ${docTypeName}
NOMBRE DEL ARCHIVO: ${doc.original_name}
VISA SOLICITADA: ${visaCategory}
${cvContext}

CONTENIDO DEL DOCUMENTO:
${docText.substring(0, 12000)}

INSTRUCCIONES:
Analiza el documento y proporciona un análisis en formato JSON:

{
  "relevance_score": <0-100, qué tan relevante es para el caso>,
  "quality_score": <0-100, calidad del documento como evidencia>,
  "recommendation": "<MUY ÚTIL | ÚTIL | PARCIALMENTE ÚTIL | POCO ÚTIL | NO RELEVANTE>",
  "summary": "<Resumen de 2-3 oraciones sobre el documento>",
  "key_points": ["<puntos clave que aporta el documento>"],
  "supports_prongs": {
    "prong1": {"supports": <true/false>, "explanation": "<cómo apoya/no apoya>"},
    "prong2": {"supports": <true/false>, "explanation": "<cómo apoya/no apoya>"},
    "prong3": {"supports": <true/false>, "explanation": "<cómo apoya/no apoya>"}
  },
  "strengths": ["<fortalezas del documento>"],
  "weaknesses": ["<debilidades o lo que falta>"],
  "suggestions": ["<sugerencias para mejorar o complementar>"],
  "complements_cv": "<Cómo complementa o fortalece el perfil del CV>",
  "overall_assessment": "<Evaluación general de cómo este documento ayuda al caso>"
}

CRITERIOS DE EVALUACIÓN para ${visaCategory}:
- Prong 1: ¿Demuestra mérito sustancial e importancia nacional?
- Prong 2: ¿Muestra que el beneficiario está bien posicionado?
- Prong 3: ¿Ayuda a demostrar que el balance favorece aprobar la visa?

Sé específico y objetivo en tu análisis.`
}
