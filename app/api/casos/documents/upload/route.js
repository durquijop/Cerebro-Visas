import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { extractText, normalizeText } from '@/lib/document-processor'
import { extractStructuredData, saveStructuredData } from '@/lib/case-miner'
import { generateDocumentEmbeddings } from '@/lib/embeddings'

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
    let structuredData = null
    
    // Para documentos RFE/NOID/Denial, usar el Case Miner
    const isRFEorNOID = ['rfe_document', 'noid_document', 'denial_notice'].includes(docType)
    
    // También considerar tipos alternativos
    const isRFEType = isRFEorNOID || ['RFE', 'NOID', 'Denial'].includes(docType)
    
    let embeddingsGenerated = 0
    
    if (isRFEType && extraction.success && cleanText.length > 100) {
      console.log('🔬 Iniciando extracción estructurada (Case Miner)...')
      try {
        const outcomeType = docType === 'rfe_document' || docType === 'RFE' ? 'RFE' : 
                           docType === 'noid_document' || docType === 'NOID' ? 'NOID' : 'Denial'
        
        const extractionResult = await extractStructuredData(cleanText, outcomeType)
        
        if (extractionResult.success) {
          structuredData = extractionResult.data
          
          // IMPORTANTE: Guardar structured_data directamente en case_documents
          // No usar document_issues/document_requests porque tienen FK restrictivo a 'documents'
          const { error: updateError } = await supabaseAdmin
            .from('case_documents')
            .update({ 
              structured_data: structuredData,
              analyzed_at: new Date().toISOString()
            })
            .eq('id', fileId)
          
          if (updateError) {
            console.error('Error actualizando structured_data:', updateError)
          } else {
            console.log(`✅ Case Miner completado y guardado en case_documents.structured_data`)
          }
          
          console.log(`✅ Issues: ${structuredData.issues?.length || 0}, Requests: ${structuredData.requests?.length || 0}`)
          
          documentAnalysis = {
            issues_count: structuredData.issues?.length || 0,
            requests_count: structuredData.requests?.length || 0,
            prongs_affected: structuredData.summary?.prongs_affected,
            executive_summary: structuredData.summary?.executive_summary,
            overall_severity: structuredData.summary?.overall_severity
          }
        }
      } catch (mineError) {
        console.error('Error en Case Miner:', mineError.message)
      }
      
      // GENERAR EMBEDDINGS para documentos RFE/NOID/Denial
      // Esto permite búsquedas RAG y estadísticas
      console.log('🧠 Generando embeddings para documento RFE/NOID...')
      try {
        const docForEmbedding = {
          id: fileId,
          text_content: cleanText,
          doc_type: docType,
          original_name: file.name,
          outcome_type: docType === 'rfe_document' || docType === 'RFE' ? 'RFE' : 
                       docType === 'noid_document' || docType === 'NOID' ? 'NOID' : 'Denial'
        }
        
        const embResult = await generateDocumentEmbeddings(supabaseAdmin, docForEmbedding, true)
        
        if (embResult.success) {
          embeddingsGenerated = embResult.chunks || 0
          console.log(`✅ Embeddings generados: ${embeddingsGenerated} chunks vectorizados`)
        } else {
          console.log(`⚠️ No se generaron embeddings: ${embResult.reason || embResult.error}`)
        }
      } catch (embError) {
        console.error('Error generando embeddings:', embError.message)
      }
      
    } else if (docType !== 'cv' && !skipAnalysis && extraction.success && cleanText.length > 100) {
      // Para otros documentos, usar análisis de relevancia
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
      analysis: documentAnalysis,
      structuredData: structuredData ? {
        issues_count: structuredData.issues?.length || 0,
        requests_count: structuredData.requests?.length || 0,
        prongs_affected: structuredData.summary?.prongs_affected,
        executive_summary: structuredData.summary?.executive_summary
      } : null
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
PERFIL DEL BENEFICIARIO (${beneficiaryName}):
- Puntaje de Aptitud para ${visaCategory}: ${cvAnalysis.aptitude_score}%
- Recomendación: ${cvAnalysis.recommendation}
- Fortalezas identificadas: ${(cvAnalysis.key_qualifications || []).join('; ')}
- Áreas que necesita reforzar: ${(cvAnalysis.missing_evidence || []).join('; ')}
- Resumen del perfil: ${cvAnalysis.summary || 'No disponible'}
`
  }

  return `Eres un experto abogado de inmigración de EE.UU. especializado en visas ${visaCategory}.

PREGUNTA PRINCIPAL: ¿Este documento APOYA al cliente ${beneficiaryName} en su proceso de visa ${visaCategory}?

${cvContext}

DOCUMENTO A EVALUAR:
- Tipo: ${docTypeName}
- Archivo: ${doc.original_name}

CONTENIDO DEL DOCUMENTO:
${docText.substring(0, 10000)}

DEBES DETERMINAR:
1. ¿Este documento APOYA o NO APOYA al cliente en su proceso de visa?
2. Si APOYA: ¿Por qué ayuda? ¿Qué fortalece del caso?
3. Si NO APOYA: ¿Por qué no sirve? ¿Qué problema tiene?

Responde ÚNICAMENTE en este formato JSON:
{
  "supports_client": <true/false - ¿APOYA al cliente en su proceso de visa?>,
  "support_level": "<APOYA FUERTEMENTE | APOYA | APOYA PARCIALMENTE | NO APOYA | PERJUDICA>",
  "main_reason": "<Razón principal de por qué APOYA o NO APOYA al cliente - ser muy claro y directo>",
  "relevance_score": <0-100>,
  "recommendation": "<INCLUIR | INCLUIR CON RESERVAS | REVISAR | NO INCLUIR>",
  "summary": "<Resumen de 2-3 oraciones>",
  "benefits_for_case": ["<beneficio 1>", "<beneficio 2>"],
  "risks_or_problems": ["<riesgo o problema 1>", "<riesgo o problema 2>"],
  "supports_prongs": {
    "prong1": {"supports": true/false, "explanation": "<cómo apoya o no el mérito e importancia nacional>"},
    "prong2": {"supports": true/false, "explanation": "<cómo apoya o no que está bien posicionado>"},
    "prong3": {"supports": true/false, "explanation": "<cómo apoya o no el balance de factores>"}
  },
  "relation_to_profile": {
    "strengthens": ["<qué del perfil refuerza>"],
    "covers_weaknesses": ["<qué debilidades del perfil cubre>"],
    "inconsistencies": ["<inconsistencias con el perfil, si hay>"]
  },
  "action_required": "<NINGUNA | OBTENER MÁS INFO | MODIFICAR DOCUMENTO | DESCARTAR>",
  "action_details": "<Qué hacer con este documento>",
  "final_verdict": "<✅ APOYA AL CLIENTE - Usar en el caso | ⚠️ APOYO PARCIAL - Usar con cuidado | ❌ NO APOYA - No usar>"
}`
}
