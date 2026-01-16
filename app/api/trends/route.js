import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '6months' // 3months, 6months, 1year
    
    // Calcular fecha de inicio según el período
    const now = new Date()
    let startDate = new Date()
    switch (period) {
      case '3months':
        startDate.setMonth(now.getMonth() - 3)
        break
      case '6months':
        startDate.setMonth(now.getMonth() - 6)
        break
      case '1year':
        startDate.setFullYear(now.getFullYear() - 1)
        break
      default:
        startDate.setMonth(now.getMonth() - 6)
    }

    // 1. Obtener todos los issues en el período
    const { data: issues, error: issuesError } = await supabase
      .from('document_issues')
      .select(`
        id,
        taxonomy_code,
        severity,
        prong_affected,
        created_at,
        documents:document_id (
          id,
          name,
          outcome_type,
          visa_category,
          document_date,
          service_center
        )
      `)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (issuesError) {
      console.error('Error fetching issues:', issuesError)
      // Si la tabla no existe, devolver datos vacíos
      if (issuesError.code === '42P01') {
        return NextResponse.json({
          topIssues: [],
          issuesByMonth: [],
          prongDistribution: [],
          severityDistribution: [],
          totalIssues: 0,
          totalDocuments: 0,
          period
        })
      }
    }

    const issuesList = issues || []

    // 2. Obtener documentos en el período
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id, outcome_type, visa_category, document_date, created_at')
      .gte('created_at', startDate.toISOString())
      .in('outcome_type', ['RFE', 'NOID', 'Denial'])

    const documentsList = documents || []

    // 3. Calcular top issues por frecuencia
    const issueCount = {}
    issuesList.forEach(issue => {
      const code = issue.taxonomy_code || 'UNKNOWN'
      if (!issueCount[code]) {
        issueCount[code] = {
          code,
          count: 0,
          severities: { critical: 0, high: 0, medium: 0, low: 0 },
          prongs: {}
        }
      }
      issueCount[code].count++
      if (issue.severity) {
        issueCount[code].severities[issue.severity] = (issueCount[code].severities[issue.severity] || 0) + 1
      }
      if (issue.prong_affected) {
        issueCount[code].prongs[issue.prong_affected] = (issueCount[code].prongs[issue.prong_affected] || 0) + 1
      }
    })

    const topIssues = Object.values(issueCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .map(item => ({
        ...item,
        percentage: issuesList.length > 0 ? Math.round((item.count / issuesList.length) * 100) : 0
      }))

    // 4. Agrupar issues por mes
    const issuesByMonth = {}
    issuesList.forEach(issue => {
      const date = new Date(issue.created_at)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!issuesByMonth[monthKey]) {
        issuesByMonth[monthKey] = {
          month: monthKey,
          total: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0
        }
      }
      issuesByMonth[monthKey].total++
      if (issue.severity) {
        issuesByMonth[monthKey][issue.severity]++
      }
    })

    const issuesByMonthArray = Object.values(issuesByMonth)
      .sort((a, b) => a.month.localeCompare(b.month))

    // 5. Distribución por prong
    const prongCount = { P1: 0, P2: 0, P3: 0, EVIDENCE: 0, COHERENCE: 0, PROCEDURAL: 0 }
    issuesList.forEach(issue => {
      if (issue.prong_affected && prongCount.hasOwnProperty(issue.prong_affected)) {
        prongCount[issue.prong_affected]++
      }
    })

    const prongDistribution = Object.entries(prongCount)
      .map(([prong, count]) => ({
        prong,
        count,
        percentage: issuesList.length > 0 ? Math.round((count / issuesList.length) * 100) : 0,
        label: getProngLabel(prong)
      }))
      .filter(p => p.count > 0)
      .sort((a, b) => b.count - a.count)

    // 6. Distribución por severidad
    const severityCount = { critical: 0, high: 0, medium: 0, low: 0 }
    issuesList.forEach(issue => {
      if (issue.severity && severityCount.hasOwnProperty(issue.severity)) {
        severityCount[issue.severity]++
      }
    })

    const severityDistribution = Object.entries(severityCount)
      .map(([severity, count]) => ({
        severity,
        count,
        percentage: issuesList.length > 0 ? Math.round((count / issuesList.length) * 100) : 0,
        label: getSeverityLabel(severity)
      }))
      .filter(s => s.count > 0)

    // 7. Documentos por tipo
    const docsByType = { RFE: 0, NOID: 0, Denial: 0 }
    documentsList.forEach(doc => {
      if (doc.outcome_type && docsByType.hasOwnProperty(doc.outcome_type)) {
        docsByType[doc.outcome_type]++
      }
    })

    // 8. Issues por service center
    const serviceCenter = {}
    issuesList.forEach(issue => {
      const center = issue.documents?.service_center || 'No especificado'
      if (!serviceCenter[center]) {
        serviceCenter[center] = 0
      }
      serviceCenter[center]++
    })

    const serviceCenterDistribution = Object.entries(serviceCenter)
      .map(([center, count]) => ({ center, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return NextResponse.json({
      topIssues,
      issuesByMonth: issuesByMonthArray,
      prongDistribution,
      severityDistribution,
      documentsByType: docsByType,
      serviceCenterDistribution,
      totalIssues: issuesList.length,
      totalDocuments: documentsList.length,
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString()
      }
    })

  } catch (error) {
    console.error('Error in trends API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function getProngLabel(prong) {
  const labels = {
    P1: 'Prong 1 - Mérito/Importancia',
    P2: 'Prong 2 - Bien Posicionado',
    P3: 'Prong 3 - Balance',
    EVIDENCE: 'Evidencia',
    COHERENCE: 'Coherencia',
    PROCEDURAL: 'Procedural'
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
