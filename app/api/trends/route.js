import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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
    
    // Calcular fecha de inicio según el período (si no hay fechas personalizadas)
    const now = new Date()
    let startDate = new Date()
    let endDate = now

    if (dateFrom && dateTo) {
      // Usar fechas personalizadas
      startDate = new Date(dateFrom)
      endDate = new Date(dateTo)
    } else {
      // Usar período predefinido
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
        case 'all':
          startDate = new Date('2020-01-01')
          break
        default:
          startDate.setMonth(now.getMonth() - 6)
      }
    }

    // 1. Obtener issues de document_issues con filtros
    let issuesQuery = supabase
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
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })

    const { data: dbIssues, error: issuesError } = await issuesQuery

    if (issuesError && issuesError.code !== '42P01') {
      console.error('Error fetching issues:', issuesError)
    }

    // 2. También obtener issues desde case_documents.structured_data
    let caseDocsQuery = supabase
      .from('case_documents')
      .select('id, original_name, doc_type, structured_data, created_at')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .not('structured_data', 'is', null)

    const { data: caseDocs } = await caseDocsQuery

    // Combinar issues de ambas fuentes
    let allIssues = []

    // Issues de document_issues
    if (dbIssues) {
      dbIssues.forEach(issue => {
        // Aplicar filtros basados en el documento relacionado
        const doc = issue.documents
        if (visaCategory && doc?.visa_category !== visaCategory) return
        if (serviceCenter && doc?.service_center !== serviceCenter) return
        if (outcomeType && doc?.outcome_type !== outcomeType) return

        allIssues.push({
          ...issue,
          source: 'document_issues',
          document_name: doc?.name,
          visa_category: doc?.visa_category,
          service_center: doc?.service_center,
          outcome_type: doc?.outcome_type
        })
      })
    }

    // Issues de case_documents.structured_data
    if (caseDocs) {
      caseDocs.forEach(doc => {
        const sd = typeof doc.structured_data === 'string' 
          ? JSON.parse(doc.structured_data) 
          : doc.structured_data

        // Aplicar filtros
        const docOutcome = sd.document_info?.outcome_type || doc.doc_type
        const docVisa = sd.document_info?.visa_category
        const docCenter = sd.document_info?.service_center

        if (outcomeType && docOutcome !== outcomeType) return
        if (visaCategory && docVisa !== visaCategory) return
        if (serviceCenter && docCenter !== serviceCenter) return

        if (sd.issues && Array.isArray(sd.issues)) {
          sd.issues.forEach(issue => {
            allIssues.push({
              ...issue,
              created_at: doc.created_at,
              source: 'case_documents',
              document_name: doc.original_name,
              visa_category: docVisa,
              service_center: docCenter,
              outcome_type: docOutcome
            })
          })
        }
      })
    }

    // 3. Obtener documentos para estadísticas
    let docsQuery = supabase
      .from('documents')
      .select('id, outcome_type, visa_category, service_center, document_date, created_at')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .in('outcome_type', ['RFE', 'NOID', 'Denial'])

    if (visaCategory) docsQuery = docsQuery.eq('visa_category', visaCategory)
    if (serviceCenter) docsQuery = docsQuery.eq('service_center', serviceCenter)
    if (outcomeType) docsQuery = docsQuery.eq('outcome_type', outcomeType)

    const { data: documents } = await docsQuery
    const documentsList = documents || []

    // También contar case_documents
    let caseDocsCountQuery = supabase
      .from('case_documents')
      .select('id, doc_type, created_at')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    const { data: caseDocsCount } = await caseDocsCountQuery
    const totalDocs = documentsList.length + (caseDocsCount?.length || 0)

    // 4. Calcular top issues por frecuencia
    const issueCount = {}
    allIssues.forEach(issue => {
      const code = issue.taxonomy_code || 'UNKNOWN'
      if (!issueCount[code]) {
        issueCount[code] = {
          code,
          count: 0,
          severities: { critical: 0, high: 0, medium: 0, low: 0 },
          prongs: {},
          outcomes: {},
          centers: {}
        }
      }
      issueCount[code].count++
      if (issue.severity) {
        issueCount[code].severities[issue.severity] = (issueCount[code].severities[issue.severity] || 0) + 1
      }
      if (issue.prong_affected) {
        issueCount[code].prongs[issue.prong_affected] = (issueCount[code].prongs[issue.prong_affected] || 0) + 1
      }
      if (issue.outcome_type) {
        issueCount[code].outcomes[issue.outcome_type] = (issueCount[code].outcomes[issue.outcome_type] || 0) + 1
      }
      if (issue.service_center) {
        issueCount[code].centers[issue.service_center] = (issueCount[code].centers[issue.service_center] || 0) + 1
      }
    })

    const topIssues = Object.values(issueCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .map(item => ({
        ...item,
        percentage: allIssues.length > 0 ? Math.round((item.count / allIssues.length) * 100) : 0
      }))

    // 5. Agrupar issues por mes
    const issuesByMonth = {}
    allIssues.forEach(issue => {
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

    // 6. Distribución por prong
    const prongCount = { P1: 0, P2: 0, P3: 0, EVIDENCE: 0, COHERENCE: 0, PROCEDURAL: 0 }
    allIssues.forEach(issue => {
      if (issue.prong_affected && prongCount.hasOwnProperty(issue.prong_affected)) {
        prongCount[issue.prong_affected]++
      }
    })

    const prongDistribution = Object.entries(prongCount)
      .map(([prong, count]) => ({
        prong,
        count,
        percentage: allIssues.length > 0 ? Math.round((count / allIssues.length) * 100) : 0,
        label: getProngLabel(prong)
      }))
      .filter(p => p.count > 0)
      .sort((a, b) => b.count - a.count)

    // 7. Distribución por severidad
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
        label: getSeverityLabel(severity)
      }))
      .filter(s => s.count > 0)

    // 8. Documentos por tipo
    const docsByType = { RFE: 0, NOID: 0, Denial: 0 }
    documentsList.forEach(doc => {
      if (doc.outcome_type && docsByType.hasOwnProperty(doc.outcome_type)) {
        docsByType[doc.outcome_type]++
      }
    })

    // 9. Issues por service center
    const serviceCenter_dist = {}
    allIssues.forEach(issue => {
      const center = issue.service_center || 'No especificado'
      if (!serviceCenter_dist[center]) {
        serviceCenter_dist[center] = 0
      }
      serviceCenter_dist[center]++
    })

    const serviceCenterDistribution = Object.entries(serviceCenter_dist)
      .map(([center, count]) => ({ center, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // 10. Obtener opciones únicas para filtros
    const { data: allDocs } = await supabase
      .from('documents')
      .select('visa_category, service_center, outcome_type')
      .not('visa_category', 'is', null)

    const filterOptions = {
      visaCategories: [...new Set((allDocs || []).map(d => d.visa_category).filter(Boolean))],
      serviceCenters: [...new Set((allDocs || []).map(d => d.service_center).filter(Boolean))],
      outcomeTypes: ['RFE', 'NOID', 'Denial']
    }

    return NextResponse.json({
      topIssues,
      issuesByMonth: issuesByMonthArray,
      prongDistribution,
      severityDistribution,
      documentsByType: docsByType,
      serviceCenterDistribution,
      totalIssues: allIssues.length,
      totalDocuments: totalDocs,
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
