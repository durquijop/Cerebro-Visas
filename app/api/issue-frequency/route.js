import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

/**
 * GET /api/issue-frequency
 * Obtiene la frecuencia de issues por período (semana/mes)
 */
export async function GET(request) {
  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    
    const period = searchParams.get('period') || 'month' // week, month
    const limit = parseInt(searchParams.get('limit') || '6')
    const taxonomyFilter = searchParams.get('taxonomy') || null
    const prongFilter = searchParams.get('prong') || null

    // Calcular fecha de inicio
    const startDate = new Date()
    if (period === 'week') {
      startDate.setDate(startDate.getDate() - (limit * 7))
    } else {
      startDate.setMonth(startDate.getMonth() - limit)
    }

    // Obtener todos los issues con sus documentos
    let query = supabase
      .from('document_issues')
      .select(`
        id,
        taxonomy_code,
        severity,
        prong_affected,
        created_at,
        documents!inner(created_at, outcome_type, visa_category)
      `)
      .gte('documents.created_at', startDate.toISOString())

    const { data: issues, error } = await query

    if (error) {
      console.error('Error fetching issues:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Obtener taxonomía para descripciones
    const { data: taxonomy } = await supabase
      .from('taxonomy')
      .select('code, description, level1, level2, prong')

    const taxonomyMap = {}
    ;(taxonomy || []).forEach(t => {
      taxonomyMap[t.code] = t
    })

    // Agrupar por período y taxonomy_code
    const periodData = {}
    const totals = {}

    ;(issues || []).forEach(issue => {
      const docDate = new Date(issue.documents.created_at)
      let periodKey
      
      if (period === 'week') {
        // Obtener inicio de semana (lunes)
        const day = docDate.getDay()
        const diff = docDate.getDate() - day + (day === 0 ? -6 : 1)
        const weekStart = new Date(docDate.setDate(diff))
        periodKey = weekStart.toISOString().split('T')[0]
      } else {
        // Mes
        periodKey = `${docDate.getFullYear()}-${String(docDate.getMonth() + 1).padStart(2, '0')}`
      }

      // Aplicar filtros
      if (prongFilter && issue.prong_affected !== prongFilter) return
      if (taxonomyFilter && issue.taxonomy_code !== taxonomyFilter) return

      if (!periodData[periodKey]) {
        periodData[periodKey] = {}
        totals[periodKey] = 0
      }

      const code = issue.taxonomy_code || 'UNKNOWN'
      if (!periodData[periodKey][code]) {
        periodData[periodKey][code] = {
          count: 0,
          severities: { critical: 0, high: 0, medium: 0, low: 0 }
        }
      }
      
      periodData[periodKey][code].count++
      periodData[periodKey][code].severities[issue.severity || 'medium']++
      totals[periodKey]++
    })

    // Convertir a formato de series temporales
    const periods = Object.keys(periodData).sort()
    const allCodes = new Set()
    periods.forEach(p => {
      Object.keys(periodData[p]).forEach(code => allCodes.add(code))
    })

    // Crear series por taxonomy_code
    const series = []
    for (const code of allCodes) {
      const taxonomyInfo = taxonomyMap[code] || { description: code, level1: 'Otro', prong: 'N/A' }
      const dataPoints = periods.map(p => ({
        period: p,
        count: periodData[p][code]?.count || 0,
        percentage: totals[p] > 0 
          ? Math.round((periodData[p][code]?.count || 0) / totals[p] * 10000) / 100 
          : 0,
        severities: periodData[p][code]?.severities || { critical: 0, high: 0, medium: 0, low: 0 }
      }))

      const totalCount = dataPoints.reduce((sum, d) => sum + d.count, 0)
      
      series.push({
        taxonomy_code: code,
        taxonomy: taxonomyInfo,
        total_count: totalCount,
        data: dataPoints,
        trend: calculateTrend(dataPoints)
      })
    }

    // Ordenar por total y tomar top N
    series.sort((a, b) => b.total_count - a.total_count)
    const topSeries = series.slice(0, 15)

    // Calcular totales por período
    const periodTotals = periods.map(p => ({
      period: p,
      total: totals[p] || 0
    }))

    // Top issues global
    const topIssues = series.slice(0, 10).map(s => ({
      code: s.taxonomy_code,
      description: s.taxonomy?.description || s.taxonomy_code,
      prong: s.taxonomy?.prong,
      count: s.total_count,
      trend: s.trend
    }))

    return NextResponse.json({
      success: true,
      period_type: period,
      periods: periods,
      period_totals: periodTotals,
      series: topSeries,
      top_issues: topIssues,
      summary: {
        total_issues: issues?.length || 0,
        unique_taxonomy_codes: allCodes.size,
        periods_analyzed: periods.length
      }
    })

  } catch (error) {
    console.error('Issue frequency error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Calcula tendencia simple (subiendo, bajando, estable)
 */
function calculateTrend(dataPoints) {
  if (dataPoints.length < 2) return 'stable'
  
  const recent = dataPoints.slice(-2)
  const earlier = dataPoints.slice(0, Math.ceil(dataPoints.length / 2))
  
  const recentAvg = recent.reduce((s, d) => s + d.count, 0) / recent.length
  const earlierAvg = earlier.reduce((s, d) => s + d.count, 0) / earlier.length
  
  const change = earlierAvg > 0 ? ((recentAvg - earlierAvg) / earlierAvg) * 100 : 0
  
  if (change > 20) return 'increasing'
  if (change < -20) return 'decreasing'
  return 'stable'
}
