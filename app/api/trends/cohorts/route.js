import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Cohort Analyzer API
 * Analiza tendencias de issues por diferentes cohortes:
 * - Por período de tiempo (mes, trimestre, año)
 * - Por industria/campo del beneficiario
 * - Por categoría de visa
 * - Por outcome type (RFE/NOID/Denial)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const groupBy = searchParams.get('groupBy') || 'month' // month, quarter, year, industry
    const compareWith = searchParams.get('compareWith') || '' // Para comparar dos cohortes
    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const visaCategory = searchParams.get('visa_category') || ''

    console.log(`📊 Cohort Analyzer: groupBy=${groupBy}, year=${year}`)

    // 1. Obtener todos los issues con metadata
    const allIssues = await getAllIssuesWithMetadata()

    // 2. Agrupar según el criterio seleccionado
    let cohortData = {}
    
    switch (groupBy) {
      case 'month':
        cohortData = groupByMonth(allIssues, year)
        break
      case 'quarter':
        cohortData = groupByQuarter(allIssues, year)
        break
      case 'year':
        cohortData = groupByYear(allIssues)
        break
      case 'industry':
        cohortData = groupByIndustry(allIssues)
        break
      default:
        cohortData = groupByMonth(allIssues, year)
    }

    // 3. Calcular estadísticas por cohorte
    const cohortsWithStats = calculateCohortStats(cohortData)

    // 4. Calcular comparaciones entre cohortes
    const comparisons = calculateComparisons(cohortsWithStats)

    // 5. Obtener top issues por cohorte
    const topIssuesByCohort = getTopIssuesByCohort(cohortData)

    // 6. Distribución por prong por cohorte
    const prongDistribution = getProngDistributionByCohort(cohortData)

    // 7. Obtener años disponibles para filtro
    const availableYears = getAvailableYears(allIssues)

    // 8. Obtener industrias disponibles
    const availableIndustries = getAvailableIndustries(allIssues)

    return NextResponse.json({
      success: true,
      groupBy,
      year,
      totalIssues: allIssues.length,
      cohorts: cohortsWithStats,
      comparisons,
      topIssuesByCohort,
      prongDistribution,
      filters: {
        availableYears,
        availableIndustries,
        groupByOptions: [
          { value: 'month', label: 'Por Mes' },
          { value: 'quarter', label: 'Por Trimestre' },
          { value: 'year', label: 'Por Año' },
          { value: 'industry', label: 'Por Industria' }
        ]
      },
      summary: generateCohortSummary(cohortsWithStats, comparisons)
    })

  } catch (error) {
    console.error('Error in cohort analysis:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function getAllIssuesWithMetadata() {
  let allIssues = []

  // Obtener de document_issues
  const { data: dbIssues } = await supabase
    .from('document_issues')
    .select(`
      id,
      taxonomy_code,
      severity,
      prong_affected,
      created_at,
      documents:document_id (
        id, name, outcome_type, visa_category, document_date, 
        service_center, beneficiary_name, industry
      )
    `)
    .order('created_at', { ascending: false })

  if (dbIssues) {
    dbIssues.forEach(issue => {
      allIssues.push({
        ...issue,
        source: 'document_issues',
        document_name: issue.documents?.name,
        outcome_type: issue.documents?.outcome_type,
        visa_category: issue.documents?.visa_category,
        industry: issue.documents?.industry || extractIndustryFromName(issue.documents?.beneficiary_name),
        document_date: issue.documents?.document_date || issue.created_at
      })
    })
  }

  // Obtener de case_documents.structured_data
  const { data: caseDocs } = await supabase
    .from('case_documents')
    .select(`
      id, original_name, doc_type, structured_data, created_at,
      visa_cases:case_id (
        beneficiary_name, visa_category, industry
      )
    `)
    .not('structured_data', 'is', null)

  if (caseDocs) {
    caseDocs.forEach(doc => {
      const sd = typeof doc.structured_data === 'string' 
        ? JSON.parse(doc.structured_data) 
        : doc.structured_data

      if (sd.issues && Array.isArray(sd.issues)) {
        sd.issues.forEach(issue => {
          allIssues.push({
            ...issue,
            source: 'case_documents',
            created_at: doc.created_at,
            document_name: doc.original_name,
            outcome_type: sd.document_info?.outcome_type || doc.doc_type,
            visa_category: sd.document_info?.visa_category || doc.visa_cases?.visa_category,
            industry: doc.visa_cases?.industry || extractIndustryFromName(doc.visa_cases?.beneficiary_name),
            document_date: sd.document_info?.document_date || doc.created_at
          })
        })
      }
    })
  }

  return allIssues
}

function extractIndustryFromName(name) {
  // Placeholder - en producción esto vendría de la BD
  if (!name) return 'No especificada'
  return 'General'
}

function groupByMonth(issues, year) {
  const months = {}
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  // Inicializar todos los meses
  for (let i = 0; i < 12; i++) {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`
    months[key] = {
      key,
      label: `${monthNames[i]} ${year}`,
      shortLabel: monthNames[i].substring(0, 3),
      period: 'month',
      year: parseInt(year),
      month: i + 1,
      issues: []
    }
  }

  // Agrupar issues
  issues.forEach(issue => {
    const date = new Date(issue.document_date || issue.created_at)
    if (date.getFullYear().toString() === year) {
      const key = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (months[key]) {
        months[key].issues.push(issue)
      }
    }
  })

  return months
}

function groupByQuarter(issues, year) {
  const quarters = {
    [`${year}-Q1`]: { 
      key: `${year}-Q1`, 
      label: `Q1 ${year} (Ene-Mar)`, 
      shortLabel: 'Q1',
      period: 'quarter',
      year: parseInt(year),
      quarter: 1,
      months: [1, 2, 3],
      issues: [] 
    },
    [`${year}-Q2`]: { 
      key: `${year}-Q2`, 
      label: `Q2 ${year} (Abr-Jun)`, 
      shortLabel: 'Q2',
      period: 'quarter',
      year: parseInt(year),
      quarter: 2,
      months: [4, 5, 6],
      issues: [] 
    },
    [`${year}-Q3`]: { 
      key: `${year}-Q3`, 
      label: `Q3 ${year} (Jul-Sep)`, 
      shortLabel: 'Q3',
      period: 'quarter',
      year: parseInt(year),
      quarter: 3,
      months: [7, 8, 9],
      issues: [] 
    },
    [`${year}-Q4`]: { 
      key: `${year}-Q4`, 
      label: `Q4 ${year} (Oct-Dic)`, 
      shortLabel: 'Q4',
      period: 'quarter',
      year: parseInt(year),
      quarter: 4,
      months: [10, 11, 12],
      issues: [] 
    }
  }

  issues.forEach(issue => {
    const date = new Date(issue.document_date || issue.created_at)
    if (date.getFullYear().toString() === year) {
      const month = date.getMonth() + 1
      const quarter = Math.ceil(month / 3)
      const key = `${year}-Q${quarter}`
      if (quarters[key]) {
        quarters[key].issues.push(issue)
      }
    }
  })

  return quarters
}

function groupByYear(issues) {
  const years = {}

  issues.forEach(issue => {
    const date = new Date(issue.document_date || issue.created_at)
    const year = date.getFullYear().toString()
    
    if (!years[year]) {
      years[year] = {
        key: year,
        label: year,
        shortLabel: year,
        period: 'year',
        year: parseInt(year),
        issues: []
      }
    }
    years[year].issues.push(issue)
  })

  return years
}

function groupByIndustry(issues) {
  const industries = {}

  issues.forEach(issue => {
    const industry = issue.industry || 'No especificada'
    
    if (!industries[industry]) {
      industries[industry] = {
        key: industry,
        label: industry,
        shortLabel: industry.substring(0, 15),
        period: 'industry',
        issues: []
      }
    }
    industries[industry].issues.push(issue)
  })

  return industries
}

function calculateCohortStats(cohortData) {
  const result = []

  Object.values(cohortData).forEach(cohort => {
    const issues = cohort.issues
    const total = issues.length

    // Contar por severidad
    const bySeverity = {
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length
    }

    // Contar por prong
    const byProng = {
      P1: issues.filter(i => i.prong_affected === 'P1').length,
      P2: issues.filter(i => i.prong_affected === 'P2').length,
      P3: issues.filter(i => i.prong_affected === 'P3').length,
      EVIDENCE: issues.filter(i => i.prong_affected === 'EVIDENCE').length,
      COHERENCE: issues.filter(i => i.prong_affected === 'COHERENCE').length,
      PROCEDURAL: issues.filter(i => i.prong_affected === 'PROCEDURAL').length
    }

    // Top 5 códigos
    const codeCount = {}
    issues.forEach(i => {
      const code = i.taxonomy_code || 'UNKNOWN'
      codeCount[code] = (codeCount[code] || 0) + 1
    })
    const topCodes = Object.entries(codeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => ({ code, count, percentage: total > 0 ? Math.round((count/total)*100) : 0 }))

    // Calcular "severity score" (ponderado)
    const severityScore = total > 0 
      ? Math.round(((bySeverity.critical * 4 + bySeverity.high * 3 + bySeverity.medium * 2 + bySeverity.low * 1) / total) * 25)
      : 0

    result.push({
      ...cohort,
      stats: {
        total,
        bySeverity,
        byProng,
        topCodes,
        severityScore, // 0-100, donde 100 es más severo
        avgIssuesPerDoc: total // Simplificado por ahora
      }
    })
  })

  // Ordenar por key
  return result.sort((a, b) => a.key.localeCompare(b.key))
}

function calculateComparisons(cohorts) {
  if (cohorts.length < 2) return null

  const comparisons = []
  
  for (let i = 1; i < cohorts.length; i++) {
    const prev = cohorts[i - 1]
    const curr = cohorts[i]
    
    const totalChange = prev.stats.total > 0 
      ? Math.round(((curr.stats.total - prev.stats.total) / prev.stats.total) * 100)
      : (curr.stats.total > 0 ? 100 : 0)

    const severityChange = curr.stats.severityScore - prev.stats.severityScore

    // Cambios por prong
    const prongChanges = {}
    Object.keys(curr.stats.byProng).forEach(prong => {
      const prevCount = prev.stats.byProng[prong] || 0
      const currCount = curr.stats.byProng[prong] || 0
      const change = prevCount > 0 
        ? Math.round(((currCount - prevCount) / prevCount) * 100)
        : (currCount > 0 ? 100 : 0)
      prongChanges[prong] = {
        previous: prevCount,
        current: currCount,
        change,
        direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
      }
    })

    comparisons.push({
      from: prev.key,
      to: curr.key,
      fromLabel: prev.shortLabel,
      toLabel: curr.shortLabel,
      totalChange,
      totalDirection: totalChange > 0 ? 'up' : totalChange < 0 ? 'down' : 'stable',
      severityChange,
      severityDirection: severityChange > 0 ? 'up' : severityChange < 0 ? 'down' : 'stable',
      prongChanges
    })
  }

  return comparisons
}

function getTopIssuesByCohort(cohortData) {
  const result = {}

  Object.entries(cohortData).forEach(([key, cohort]) => {
    const codeCount = {}
    cohort.issues.forEach(issue => {
      const code = issue.taxonomy_code || 'UNKNOWN'
      codeCount[code] = (codeCount[code] || 0) + 1
    })

    result[key] = Object.entries(codeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => ({ code, count }))
  })

  return result
}

function getProngDistributionByCohort(cohortData) {
  const result = {}

  Object.entries(cohortData).forEach(([key, cohort]) => {
    const total = cohort.issues.length
    const prongs = { P1: 0, P2: 0, P3: 0, EVIDENCE: 0, COHERENCE: 0, PROCEDURAL: 0 }
    
    cohort.issues.forEach(issue => {
      if (issue.prong_affected && prongs.hasOwnProperty(issue.prong_affected)) {
        prongs[issue.prong_affected]++
      }
    })

    result[key] = Object.entries(prongs).map(([prong, count]) => ({
      prong,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    }))
  })

  return result
}

function getAvailableYears(issues) {
  const years = new Set()
  issues.forEach(issue => {
    const date = new Date(issue.document_date || issue.created_at)
    years.add(date.getFullYear())
  })
  return Array.from(years).sort((a, b) => b - a)
}

function getAvailableIndustries(issues) {
  const industries = new Set()
  issues.forEach(issue => {
    if (issue.industry) {
      industries.add(issue.industry)
    }
  })
  return Array.from(industries).sort()
}

function generateCohortSummary(cohorts, comparisons) {
  if (cohorts.length === 0) {
    return { message: 'No hay datos suficientes para el análisis' }
  }

  const totalIssues = cohorts.reduce((sum, c) => sum + c.stats.total, 0)
  const avgPerCohort = Math.round(totalIssues / cohorts.length)
  
  // Encontrar cohort con más issues
  const maxCohort = cohorts.reduce((max, c) => c.stats.total > max.stats.total ? c : max, cohorts[0])
  
  // Encontrar cohort con mayor severidad
  const maxSeverity = cohorts.reduce((max, c) => c.stats.severityScore > max.stats.severityScore ? c : max, cohorts[0])

  // Tendencia general
  let trend = 'stable'
  if (comparisons && comparisons.length > 0) {
    const lastComparison = comparisons[comparisons.length - 1]
    if (lastComparison.totalChange > 20) trend = 'increasing'
    else if (lastComparison.totalChange < -20) trend = 'decreasing'
  }

  return {
    totalIssues,
    avgPerCohort,
    cohortsAnalyzed: cohorts.length,
    peakCohort: { label: maxCohort.label, count: maxCohort.stats.total },
    highestSeverity: { label: maxSeverity.label, score: maxSeverity.stats.severityScore },
    trend,
    trendLabel: trend === 'increasing' ? 'En aumento' : trend === 'decreasing' ? 'En descenso' : 'Estable'
  }
}
