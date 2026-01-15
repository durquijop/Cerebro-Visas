import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { extractText, normalizeText } from '@/lib/document-processor'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const caseId = formData.get('case_id')
    const docType = formData.get('doc_type') || 'other'
    const skipAnalysis = formData.get('skip_analysis') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }

    if (!caseId) {
      return NextResponse.json({ error: 'case_id es requerido' }, { status: 400 })
    }

    console.log(`📤 Subiendo archivo: ${file.name} para caso ${caseId}`)

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const fileId = uuidv4()
    const fileExt = file.name.split('.').pop().toLowerCase()
    const storagePath = `casos/${caseId}/${fileId}.${fileExt}`

    // Subir a storage
    const { error: storageError } = await supabaseAdmin.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: '3600'
      })

    if (storageError) {
      console.error('Storage error:', storageError)
    }

    // Extraer texto
    console.log('🔍 Extrayendo texto del documento...')
    const extraction = await extractText(buffer, file.name)
    
    const cleanText = normalizeText(extraction.text || '')
    const wordCount = cleanText.split(/\s+/).filter(w => w.length > 0).length

    console.log(`📊 Extracción: success=${extraction.success}, palabras=${wordCount}`)

    // Guardar en BD
    const { data: document, error: dbError } = await supabaseAdmin
      .from('case_documents')
      .insert({
        id: fileId,
        case_id: caseId,
        original_name: file.name,
        doc_type: docType,
        file_type: fileExt,
        storage_path: storagePath,
        text_content: cleanText.substring(0, 100000),
        word_count: wordCount
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      throw dbError
    }

    console.log(`✅ Documento guardado: ${fileId}`)

    // Analizar automáticamente si no es CV y no se saltó el análisis
    let documentAnalysis = null
    if (docType !== 'cv' && !skipAnalysis && extraction.success && cleanText.length > 100) {
      console.log('🧠 Iniciando análisis automático del documento...')
      try {
        documentAnalysis = await analyzeDocumentForCase(document, caseId, cleanText)
        
        // Actualizar documento con el análisis
        await supabaseAdmin
          .from('case_documents')
          .update({ 
            analysis_summary: JSON.stringify(documentAnalysis),
            analyzed_at: new Date().toISOString()
          })
          .eq('id', fileId)
        
        console.log(`✅ Análisis completado: ${documentAnalysis.relevance_score}% relevancia`)
      } catch (analysisError) {
        console.error('Error en análisis:', analysisError.message)
        // No fallar el upload si falla el análisis
      }
    }

    return NextResponse.json({ 
      success: true, 
      document: {
        ...document,
        analysis_summary: documentAnalysis ? JSON.stringify(documentAnalysis) : null
      },
      extraction: {
        success: extraction.success,
        wordCount,
        charCount: cleanText.length,
        pageCount: extraction.numPages,
        method: extraction.method
      },
      analysis: documentAnalysis
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ 
      error: error.message,
      details: 'Error al procesar el documento'
    }, { status: 500 })
  }
}

async function analyzeDocumentForCase(doc, caseId, docText) {
  // Obtener datos del caso
  const { data: caseData, error: caseError } = await supabaseAdmin
    .from('visa_cases')
    .select('*')
    .eq('id', caseId)
    .single()

  if (caseError) throw caseError

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY no configurada')

  const cvAnalysis = caseData.cv_analysis || {}
  const visaCategory = caseData.visa_category || 'EB2-NIW'
  const beneficiaryName = caseData.beneficiary_name || 'el beneficiario'

  const prompt = buildAnalysisPrompt(doc, docText, cvAnalysis, visaCategory, beneficiaryName)

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      'X-Title': 'Cerebro Visas - Doc Analysis'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2500
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Error en API')
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('Error parsing JSON:', e)
  }

  return {
    relevance_score: 50,
    quality_score: 50,
    recommendation: 'REQUIERE REVISIÓN',
    summary: content?.substring(0, 300) || 'Análisis no disponible'
  }
}

function buildAnalysisPrompt(doc, docText, cvAnalysis, visaCategory, beneficiaryName) {
  const docTypes = {
    'petition': 'Petición I-140',
    'rfe': 'Request for Evidence (RFE)',
    'rfe_response': 'Respuesta a RFE',
    'support_letter': 'Carta de Apoyo',
    'recommendation_letter': 'Carta de Recomendación',
    'evidence': 'Evidencia',
    'publication': 'Publicación',
    'citation': 'Citaciones',
    'award': 'Premio/Reconocimiento',
    'media': 'Cobertura de Medios',
    'contract': 'Contrato',
    'financial': 'Documento Financiero',
    'degree': 'Título Académico',
    'certification': 'Certificación',
    'other': 'Documento'
  }

  const docTypeName = docTypes[doc.doc_type] || doc.doc_type

  let cvContext = ''
  if (cvAnalysis?.aptitude_score) {
    cvContext = `
PERFIL DEL BENEFICIARIO (CV analizado):
- Aptitud: ${cvAnalysis.aptitude_score}%
- Fortalezas: ${(cvAnalysis.key_qualifications || []).slice(0, 3).join('; ')}
- Necesita reforzar: ${(cvAnalysis.missing_evidence || []).slice(0, 3).join('; ')}
`
  }

  return `Eres un experto en inmigración de EE.UU. para visas ${visaCategory}.

ANALIZA este documento y evalúa su utilidad para el caso de ${beneficiaryName}.

DOCUMENTO: ${docTypeName}
ARCHIVO: ${doc.original_name}
VISA: ${visaCategory}
${cvContext}

CONTENIDO:
${docText.substring(0, 10000)}

Responde SOLO en JSON:
{
  "relevance_score": <0-100>,
  "quality_score": <0-100>,
  "recommendation": "<MUY ÚTIL|ÚTIL|PARCIALMENTE ÚTIL|POCO ÚTIL>",
  "summary": "<2-3 oraciones>",
  "key_points": ["punto1", "punto2", "punto3"],
  "supports_prongs": {
    "prong1": {"supports": true/false, "how": "<breve>"},
    "prong2": {"supports": true/false, "how": "<breve>"},
    "prong3": {"supports": true/false, "how": "<breve>"}
  },
  "strengths": ["fortaleza1", "fortaleza2"],
  "weaknesses": ["debilidad1"],
  "complements_cv": "<cómo complementa el CV>",
  "suggestions": ["sugerencia1"]
}`
}
