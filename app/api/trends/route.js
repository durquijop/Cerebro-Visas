import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { generateTrendsAnalysis } from '@/lib/trends-analysis'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parámetros de filtro
    const period = searchParams.get('period') || '6months'
    const visaCategory = searchParams.get('visa_category') || ''
    const serviceCenter = searchParams.get('service_center') || ''
    const outcomeType = searchParams.get('outcome_type') || ''
    const dateFrom = searchParams.get('date_from') || ''
    const dateTo = searchParams.get('date_to') || ''
    
    // Calcular rango de fechas
    const now = new Date()
    let startDate = new Date()
    let endDate = now

    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom)
      endDate = new Date(dateTo)
    } else {
      switch (period) {
        case '3months': startDate.setMonth(now.getMonth() - 3); break
        case '6months': startDate.setMonth(now.getMonth() - 6); break
        case '1year': startDate.setFullYear(now.getFullYear() - 1); break
        case 'all': startDate = new Date('2020-01-01'); break
        default: startDate.setMonth(now.getMonth() - 6)
      }
    }

    // 1. Obtener documentos con structured_data
    let query = supabase
      .from('documents')
      .select('id, name, doc_type, visa_category, service_center, outcome_type, document_date, structured_data, created_at')
      .not('structured_data', 'is', null)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })

    if (visaCategory) query = query.eq('visa_category', visaCategory)
    if (serviceCenter) query = query.eq('service_center', serviceCenter)
    if (outcomeType) query = query.eq('outcome_type', outcomeType)

    const { data: documents, error: docsError } = await query

    if (docsError) {
      console.error('Error fetching documents:', docsError)
      return NextResponse.json({ error: docsError.message }, { status: 500 })
    }

    // 2. Extraer todos los issues de structured_data
    const allIssues = []
    const allRequests = []
    
    for (const doc of documents || []) {
      const sd = typeof doc.structured_data === 'string' 
        ? JSON.parse(doc.structured_data) 
        : doc.structured_data
      
      // Extraer info del documento
      const docInfo = sd?.document_info || {}
      const docVisa = docInfo.visa_category || doc.visa_category
      const docCenter = docInfo.service_center || doc.service_center
      const docOutcome = docInfo.outcome_type || doc.outcome_type || doc.doc_type
      
      // Procesar issues
      if (sd?.issues && Array.isArray(sd.issues)) {
        for (const issue of sd.issues) {
          allIssues.push({
            ...issue,
            document_id: doc.id,
            document_name: doc.name,
            visa_category: docVisa,
            service_center: docCenter,
            outcome_type: docOutcome,
            created_at: doc.created_at
          })
        }
      }
      
      // Procesar requests
      if (sd?.requests && Array.isArray(sd.requests)) {
        for (const req of sd.requests) {
          allRequests.push({
            ...req,
            document_id: doc.id,
            document_name: doc.name,
            visa_category: docVisa,
            created_at: doc.created_at
          })
        }
      }
    }

    // 3. Calcular estadísticas de issues
    const issuesByCode = {}
    allIssues.forEach(issue => {
      const code = issue.taxonomy_code || 'UNKNOWN'
      if (!issuesByCode[code]) {
        issuesByCode[code] = {
          code,
          description: getIssueDescription(code),
          count: 0,
          severities: { critical: 0, high: 0, medium: 0, low: 0 },
          prongs: {},
          outcomes: {},
          centers: {}
        }
      }
      issuesByCode[code].count++
      
      if (issue.severity) {
        issuesByCode[code].severities[issue.severity] = (issuesByCode[code].severities[issue.severity] || 0) + 1
      }
      if (issue.prong_affected) {
        issuesByCode[code].prongs[issue.prong_affected] = (issuesByCode[code].prongs[issue.prong_affected] || 0) + 1
      }
      if (issue.outcome_type) {
        issuesByCode[code].outcomes[issue.outcome_type] = (issuesByCode[code].outcomes[issue.outcome_type] || 0) + 1
      }
      if (issue.service_center) {
        issuesByCode[code].centers[issue.service_center] = (issuesByCode[code].centers[issue.service_center] || 0) + 1
      }
    })

    const topIssues = Object.values(issuesByCode)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .map(item => ({
        ...item,
        percentage: allIssues.length > 0 ? Math.round((item.count / allIssues.length) * 100) : 0
      }))

    // 4. Issues por mes (para gráfico de tendencia)
    const issuesByMonth = {}
    allIssues.forEach(issue => {
      const date = new Date(issue.created_at)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!issuesByMonth[monthKey]) {
        issuesByMonth[monthKey] = { month: monthKey, total: 0, critical: 0, high: 0, medium: 0, low: 0 }
      }
      issuesByMonth[monthKey].total++
      if (issue.severity) {
        issuesByMonth[monthKey][issue.severity]++
      }
    })

    const issuesByMonthArray = Object.values(issuesByMonth)
      .sort((a, b) => a.month.localeCompare(b.month))

    // 5. Distribución por prong/criterio
    const prongCount = {}
    allIssues.forEach(issue => {
      const prong = issue.prong_affected || issue.criteria_affected || 'N/A'
      prongCount[prong] = (prongCount[prong] || 0) + 1
    })

    const prongDistribution = Object.entries(prongCount)
      .map(([prong, count]) => ({
        prong,
        count,
        percentage: allIssues.length > 0 ? Math.round((count / allIssues.length) * 100) : 0,
        label: getProngLabel(prong)
      }))
      .sort((a, b) => b.count - a.count)

    // 6. Distribución por severidad
    const severityCount = { critical: 0, high: 0, medium: 0, low: 0 }
    allIssues.forEach(issue => {
      if (issue.severity && severityCount.hasOwnProperty(issue.severity)) {
        severityCount[issue.severity]++
      }
    })

    const severityDistribution = Object.entries(severityCount)
      .map(([severity, count]) => ({
        severity,
        count,
        percentage: allIssues.length > 0 ? Math.round((count / allIssues.length) * 100) : 0,
        label: getSeverityLabel(severity),
        color: getSeverityColor(severity)
      }))
      .filter(s => s.count > 0)

    // 7. Documentos por tipo
    const docsByType = { RFE: 0, NOID: 0, Denial: 0, Approval: 0 }
    documents?.forEach(doc => {
      const sd = typeof doc.structured_data === 'string' 
        ? JSON.parse(doc.structured_data) 
        : doc.structured_data
      const type = sd?.document_info?.outcome_type || doc.outcome_type || doc.doc_type
      if (docsByType.hasOwnProperty(type)) {
        docsByType[type]++
      }
    })

    // 8. Issues por service center
    const centerCount = {}
    allIssues.forEach(issue => {
      const center = issue.service_center || 'No especificado'
      centerCount[center] = (centerCount[center] || 0) + 1
    })

    const serviceCenterDistribution = Object.entries(centerCount)
      .map(([center, count]) => ({ center, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // 9. Top requests (evidencia solicitada)
    const requestsByType = {}
    allRequests.forEach(req => {
      const type = req.evidence_type || 'Otro'
      if (!requestsByType[type]) {
        requestsByType[type] = { type, count: 0, examples: [] }
      }
      requestsByType[type].count++
      if (requestsByType[type].examples.length < 3) {
        requestsByType[type].examples.push(req.request_text?.substring(0, 100))
      }
    })

    const topRequests = Object.values(requestsByType)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // 10. Opciones para filtros
    const { data: allDocs } = await supabase
      .from('documents')
      .select('visa_category, service_center, outcome_type')
      .not('visa_category', 'is', null)

    const filterOptions = {
      visaCategories: [...new Set((allDocs || []).map(d => d.visa_category).filter(Boolean))].sort(),
      serviceCenters: [...new Set((allDocs || []).map(d => d.service_center).filter(Boolean))].sort(),
      outcomeTypes: ['RFE', 'NOID', 'Denial', 'Approval']
    }

    // 11. Insights generados
    const insights = generateInsights(allIssues, topIssues, severityDistribution, prongDistribution)

    return NextResponse.json({
      // Estadísticas principales
      totalIssues: allIssues.length,
      totalRequests: allRequests.length,
      totalDocuments: documents?.length || 0,
      
      // Datos para gráficos
      topIssues,
      issuesByMonth: issuesByMonthArray,
      prongDistribution,
      severityDistribution,
      documentsByType: docsByType,
      serviceCenterDistribution,
      topRequests,
      
      // Insights
      insights,
      
      // Filtros
      period,
      filterOptions,
      activeFilters: {
        visaCategory: visaCategory || null,
        serviceCenter: serviceCenter || null,
        outcomeType: outcomeType || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null
      },
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    })

  } catch (error) {
    console.error('Error in trends API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Funciones auxiliares
function getProngLabel(prong) {
  const labels = {
    'P1': 'Prong 1 - Mérito e Importancia',
    'P2': 'Prong 2 - Bien Posicionado',
    'P3': 'Prong 3 - Balance de Factores',
    'C1_PREMIOS': 'Premios',
    'C2_MEMBRESIAS': 'Membresías',
    'C3_MATERIAL_PUBLICADO': 'Material Publicado',
    'C4_JUEZ': 'Juez',
    'C5_CONTRIBUCIONES': 'Contribuciones Originales',
    'C6_ARTICULOS': 'Artículos Académicos',
    'C7_EXHIBICIONES': 'Exhibiciones',
    'C8_ROL_PRINCIPAL': 'Rol Principal',
    'C9_SALARIO_ALTO': 'Salario Alto',
    'C10_EXITO_COMERCIAL': 'Éxito Comercial',
    'EVIDENCE': 'Evidencia',
    'COHERENCE': 'Coherencia',
    'PROCEDURAL': 'Procedural',
    'FINAL': 'Análisis Final'
  }
  return labels[prong] || prong
}

function getSeverityLabel(severity) {
  const labels = {
    critical: 'Crítico',
    high: 'Alto',
    medium: 'Medio',
    low: 'Bajo'
  }
  return labels[severity] || severity
}

function getSeverityColor(severity) {
  const colors = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e'
  }
  return colors[severity] || '#6b7280'
}

function getIssueDescription(code) {
  // Mapeo básico de códigos a descripciones
  const descriptions = {
    'NIW-P1-01': 'Mérito sustancial no establecido',
    'NIW-P1-02': 'Importancia nacional no demostrada',
    'NIW-P2-01': 'Falta de evidencia de posición favorable',
    'NIW-P2-02': 'Historial insuficiente de éxito',
    'NIW-P3-01': 'Balance de factores no favorable',
    'EB1A-C5-01': 'Contribuciones no suficientemente originales',
    'EB1A-FINAL-01': 'No demuestra aclamación sostenida'
  }
  return descriptions[code] || code
}

function generateInsights(allIssues, topIssues, severityDist, prongDist) {
  const insights = []
  
  if (allIssues.length === 0) {
    return [{ type: 'info', text: 'Sube documentos RFE/NOID para generar análisis de tendencias.' }]
  }
  
  // Insight sobre issue más común
  if (topIssues.length > 0) {
    const top = topIssues[0]
    insights.push({
      type: 'warning',
      title: 'Issue Más Frecuente',
      text: `"${top.code}" aparece en ${top.percentage}% de los casos (${top.count} veces).`,
      action: 'Revisar documentación relacionada'
    })
  }
  
  // Insight sobre severidad
  const criticalCount = severityDist.find(s => s.severity === 'critical')?.count || 0
  const highCount = severityDist.find(s => s.severity === 'high')?.count || 0
  if (criticalCount + highCount > allIssues.length * 0.5) {
    insights.push({
      type: 'critical',
      title: 'Alta Concentración de Issues Críticos',
      text: `${Math.round((criticalCount + highCount) / allIssues.length * 100)}% de los issues son críticos o altos.`,
      action: 'Requiere atención inmediata en la preparación de casos'
    })
  }
  
  // Insight sobre prongs más afectados
  if (prongDist.length > 0) {
    const topProng = prongDist[0]
    insights.push({
      type: 'info',
      title: 'Área Más Cuestionada',
      text: `${topProng.label} es el área más frecuentemente cuestionada (${topProng.percentage}%).`,
      action: 'Fortalecer evidencia en esta área'
    })
  }
  
  return insights
}
