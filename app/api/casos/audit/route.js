import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Auditor de Expediente API
 * Analiza un caso completo y genera un reporte de fortalezas/debilidades
 */
export async function POST(request) {
  try {
    const { caseId } = await request.json()

    if (!caseId) {
      return NextResponse.json({ error: 'Se requiere caseId' }, { status: 400 })
    }

    console.log(`🔍 Iniciando auditoría del caso ${caseId}...`)

    // 1. Obtener el caso
    const { data: caseData, error: caseError } = await supabase
      .from('visa_cases')
      .select('*')
      .eq('id', caseId)
      .single()

    if (caseError || !caseData) {
      return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
    }

    // 2. Obtener documentos del caso
    const { data: caseDocuments } = await supabase
      .from('case_documents')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })

    // 3. Obtener documentos de la tabla documents vinculados al caso
    const { data: documents } = await supabase
      .from('documents')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })

    const allDocuments = [...(caseDocuments || []), ...(documents || [])]

    if (allDocuments.length === 0) {
      return NextResponse.json({ 
        error: 'El caso no tiene documentos para auditar' 
      }, { status: 400 })
    }

    // 4. Extraer todos los issues y requests de los documentos
    let allIssues = []
    let allRequests = []
    let cvAnalysis = null
    let rfeDocuments = []
    let supportingDocuments = []

    allDocuments.forEach(doc => {
      const docType = doc.doc_type || doc.outcome_type || ''
      const docName = doc.original_name || doc.name || 'Documento'

      // Clasificar documentos
      if (docType.toLowerCase().includes('cv') || docType.toLowerCase().includes('curriculum')) {
        cvAnalysis = doc.structured_data || doc.cv_analysis
      } else if (['rfe_document', 'noid_document', 'denial_notice', 'RFE', 'NOID', 'Denial'].includes(docType)) {
        rfeDocuments.push(doc)
      } else {
        supportingDocuments.push(doc)
      }

      // Extraer issues de structured_data
      if (doc.structured_data) {
        const sd = typeof doc.structured_data === 'string' 
          ? JSON.parse(doc.structured_data) 
          : doc.structured_data

        if (sd.issues && Array.isArray(sd.issues)) {
          sd.issues.forEach(issue => {
            allIssues.push({
              ...issue,
              document_name: docName,
              document_type: docType
            })
          })
        }

        if (sd.requests && Array.isArray(sd.requests)) {
          sd.requests.forEach(req => {
            allRequests.push({
              ...req,
              document_name: docName,
              document_type: docType
            })
          })
        }
      }
    })

    // También obtener CV analysis del caso si existe
    if (caseData.cv_analysis) {
      cvAnalysis = typeof caseData.cv_analysis === 'string' 
        ? JSON.parse(caseData.cv_analysis) 
        : caseData.cv_analysis
    }

    // 5. Analizar por Prong
    const prongAnalysis = analyzeProngs(allIssues, allRequests, cvAnalysis)

    // 6. Generar checklist de evidencia
    const evidenceChecklist = generateEvidenceChecklist(allDocuments, allIssues, allRequests)

    // 7. Calcular score general del caso
    const overallScore = calculateCaseScore(prongAnalysis, evidenceChecklist)

    // 8. Generar recomendaciones
    const recommendations = generateRecommendations(prongAnalysis, evidenceChecklist, allIssues)

    // 9. Construir reporte
    const auditReport = {
      caseId,
      caseName: caseData.title || caseData.beneficiary_name || 'Caso sin nombre',
      beneficiary: caseData.beneficiary_name,
      visaType: caseData.visa_type || 'EB2-NIW',
      auditDate: new Date().toISOString(),
      
      summary: {
        overallScore,
        totalDocuments: allDocuments.length,
        totalIssues: allIssues.length,
        totalRequests: allRequests.length,
        rfeCount: rfeDocuments.length,
        supportingDocsCount: supportingDocuments.length,
        hasCv: !!cvAnalysis
      },

      prongAnalysis,
      evidenceChecklist,
      recommendations,

      documentBreakdown: {
        rfeDocuments: rfeDocuments.map(d => ({
          name: d.original_name || d.name,
          type: d.doc_type || d.outcome_type,
          issuesCount: countIssuesForDoc(allIssues, d.original_name || d.name)
        })),
        supportingDocuments: supportingDocuments.map(d => ({
          name: d.original_name || d.name,
          type: d.doc_type
        })),
        cvPresent: !!cvAnalysis
      },

      issuesByPrior: groupIssuesByPriority(allIssues),
      
      rawData: {
        issues: allIssues,
        requests: allRequests
      }
    }

    console.log(`✅ Auditoría completada: Score ${overallScore}/100`)

    return NextResponse.json(auditReport)

  } catch (error) {
    console.error('Error in audit:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function analyzeProngs(issues, requests, cvAnalysis) {
  const prongs = {
    P1: {
      name: 'Prong 1 - Mérito Sustancial e Importancia Nacional',
      description: 'El endeavor propuesto tiene mérito sustancial y es de importancia nacional',
      score: 100,
      strengths: [],
      weaknesses: [],
      issueCount: 0,
      requestCount: 0
    },
    P2: {
      name: 'Prong 2 - Bien Posicionado para Avanzar',
      description: 'El beneficiario está bien posicionado para avanzar el endeavor propuesto',
      score: 100,
      strengths: [],
      weaknesses: [],
      issueCount: 0,
      requestCount: 0
    },
    P3: {
      name: 'Prong 3 - Balance de Factores',
      description: 'En balance, sería beneficioso dispensar los requisitos de oferta laboral y certificación',
      score: 100,
      strengths: [],
      weaknesses: [],
      issueCount: 0,
      requestCount: 0
    }
  }

  // Analizar issues por prong
  issues.forEach(issue => {
    const prong = issue.prong_affected
    if (prong && prongs[prong]) {
      prongs[prong].issueCount++
      
      // Reducir score según severidad
      const severityImpact = {
        critical: 25,
        high: 15,
        medium: 8,
        low: 3
      }
      prongs[prong].score -= severityImpact[issue.severity] || 5

      // Agregar debilidad
      prongs[prong].weaknesses.push({
        code: issue.taxonomy_code,
        severity: issue.severity,
        quote: issue.extracted_quote?.substring(0, 150),
        document: issue.document_name
      })
    }
  })

  // Analizar requests por prong
  requests.forEach(req => {
    const prong = req.prong_mapping
    if (prong && prongs[prong]) {
      prongs[prong].requestCount++
      prongs[prong].score -= 5

      prongs[prong].weaknesses.push({
        type: 'request',
        text: req.request_text?.substring(0, 150),
        priority: req.priority
      })
    }
  })

  // Agregar fortalezas basadas en CV si existe
  if (cvAnalysis) {
    if (cvAnalysis.education?.length > 0) {
      prongs.P2.strengths.push({
        type: 'education',
        description: `Formación académica documentada: ${cvAnalysis.education.length} títulos`
      })
    }
    if (cvAnalysis.publications?.length > 0) {
      prongs.P1.strengths.push({
        type: 'publications',
        description: `${cvAnalysis.publications.length} publicaciones documentadas`
      })
      prongs.P2.strengths.push({
        type: 'publications',
        description: `Track record de investigación con ${cvAnalysis.publications.length} publicaciones`
      })
    }
    if (cvAnalysis.experience?.length > 0) {
      prongs.P2.strengths.push({
        type: 'experience',
        description: `${cvAnalysis.experience.length} posiciones profesionales relevantes`
      })
    }
    if (cvAnalysis.awards?.length > 0) {
      prongs.P2.strengths.push({
        type: 'awards',
        description: `${cvAnalysis.awards.length} premios/reconocimientos`
      })
    }
  }

  // Agregar fortalezas default si no hay issues
  Object.keys(prongs).forEach(key => {
    if (prongs[key].issueCount === 0 && prongs[key].strengths.length === 0) {
      prongs[key].strengths.push({
        type: 'no_issues',
        description: 'Sin objeciones documentadas de USCIS para este prong'
      })
    }
    // Asegurar score mínimo
    prongs[key].score = Math.max(0, Math.min(100, prongs[key].score))
  })

  return prongs
}

function generateEvidenceChecklist(documents, issues, requests) {
  const checklist = {
    essential: [
      { 
        item: 'CV/Resume del beneficiario', 
        status: documents.some(d => (d.doc_type || '').toLowerCase().includes('cv') || (d.doc_type || '').toLowerCase().includes('curriculum')) ? 'present' : 'missing',
        importance: 'critical'
      },
      { 
        item: 'Cartas de recomendación', 
        status: documents.some(d => (d.doc_type || '').toLowerCase().includes('carta') || (d.doc_type || '').toLowerCase().includes('letter')) ? 'present' : 'unknown',
        importance: 'critical'
      },
      { 
        item: 'Plan de negocios / Propuesta del endeavor', 
        status: documents.some(d => (d.doc_type || '').toLowerCase().includes('plan') || (d.doc_type || '').toLowerCase().includes('propuesta')) ? 'present' : 'unknown',
        importance: 'high'
      },
      { 
        item: 'Evidencia de publicaciones/investigación', 
        status: documents.some(d => (d.doc_type || '').toLowerCase().includes('publicacion') || (d.doc_type || '').toLowerCase().includes('paper')) ? 'present' : 'unknown',
        importance: 'high'
      },
      { 
        item: 'Títulos académicos', 
        status: documents.some(d => (d.doc_type || '').toLowerCase().includes('titulo') || (d.doc_type || '').toLowerCase().includes('degree')) ? 'present' : 'unknown',
        importance: 'high'
      }
    ],
    requestedByUSCIS: requests.map(req => ({
      item: req.request_text?.substring(0, 100),
      status: 'pending',
      importance: req.priority === 'required' ? 'critical' : 'high',
      prong: req.prong_mapping
    })),
    recommended: []
  }

  // Agregar recomendaciones basadas en issues
  const issueTypes = new Set(issues.map(i => i.taxonomy_code))
  
  if (issueTypes.has('NIW.EV.CARTAS.SIN_VERIFICABLES') || issueTypes.has('NIW.EV.CARTAS.GENERICAS')) {
    checklist.recommended.push({
      item: 'Cartas de recomendación con datos verificables y específicos',
      reason: 'USCIS ha objetado la calidad de las cartas actuales'
    })
  }
  
  if (issueTypes.has('NIW.EV.BP.NUMEROS_SIN_METODOLOGIA') || issueTypes.has('NIW.EV.BP.SUPUESTOS_NO_SOPORTADOS')) {
    checklist.recommended.push({
      item: 'Metodología detallada para proyecciones numéricas',
      reason: 'Las proyecciones presentadas carecen de sustento metodológico'
    })
  }

  if (issueTypes.has('NIW.P1.MERITO.SIN_IMPORTANCIA_NACIONAL')) {
    checklist.recommended.push({
      item: 'Evidencia del impacto a nivel nacional del endeavor',
      reason: 'Necesita demostrar alcance más allá de lo local/regional'
    })
  }

  if (issueTypes.has('NIW.P2.POSICION.SIN_RECURSOS')) {
    checklist.recommended.push({
      item: 'Prueba de acceso a financiamiento o recursos',
      reason: 'USCIS cuestiona la capacidad de ejecutar el plan'
    })
  }

  return checklist
}

function calculateCaseScore(prongAnalysis, evidenceChecklist) {
  // Promedio ponderado de scores por prong
  const prongWeight = 0.7
  const evidenceWeight = 0.3

  const avgProngScore = (
    prongAnalysis.P1.score + 
    prongAnalysis.P2.score + 
    prongAnalysis.P3.score
  ) / 3

  // Score de evidencia
  const essentialPresent = evidenceChecklist.essential.filter(e => e.status === 'present').length
  const essentialTotal = evidenceChecklist.essential.length
  const evidenceScore = essentialTotal > 0 ? (essentialPresent / essentialTotal) * 100 : 50

  const finalScore = Math.round(
    (avgProngScore * prongWeight) + (evidenceScore * evidenceWeight)
  )

  return Math.max(0, Math.min(100, finalScore))
}

function generateRecommendations(prongAnalysis, evidenceChecklist, issues) {
  const recommendations = []

  // Recomendaciones por prong con score bajo
  Object.entries(prongAnalysis).forEach(([key, prong]) => {
    if (prong.score < 70) {
      recommendations.push({
        priority: prong.score < 50 ? 'critical' : 'high',
        prong: key,
        title: `Fortalecer ${prong.name}`,
        description: `Score actual: ${prong.score}/100. ${prong.weaknesses.length} debilidades identificadas.`,
        actions: prong.weaknesses.slice(0, 3).map(w => 
          w.type === 'request' 
            ? `Responder solicitud: ${w.text}`
            : `Abordar issue ${w.code}: ${w.severity}`
        )
      })
    }
  })

  // Recomendaciones por evidencia faltante
  evidenceChecklist.essential
    .filter(e => e.status === 'missing' && e.importance === 'critical')
    .forEach(e => {
      recommendations.push({
        priority: 'critical',
        prong: 'EVIDENCE',
        title: `Agregar: ${e.item}`,
        description: 'Documento esencial no encontrado en el expediente',
        actions: [`Obtener y adjuntar ${e.item}`]
      })
    })

  // Recomendaciones de la checklist
  evidenceChecklist.recommended.forEach(r => {
    recommendations.push({
      priority: 'medium',
      prong: 'EVIDENCE',
      title: r.item,
      description: r.reason,
      actions: [`Preparar: ${r.item}`]
    })
  })

  // Ordenar por prioridad
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  return recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
}

function countIssuesForDoc(issues, docName) {
  return issues.filter(i => i.document_name === docName).length
}

function groupIssuesByPriority(issues) {
  return {
    critical: issues.filter(i => i.severity === 'critical'),
    high: issues.filter(i => i.severity === 'high'),
    medium: issues.filter(i => i.severity === 'medium'),
    low: issues.filter(i => i.severity === 'low')
  }
}
