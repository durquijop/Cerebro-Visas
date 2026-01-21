import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Admin client para bypass RLS
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

/**
 * GET /api/drift-detector
 * Detecta cambios en la distribución de issues entre ventanas temporales
 */
export async function GET(request) {
  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    
    const shortWindow = parseInt(searchParams.get('short') || '60')
    const longWindow = parseInt(searchParams.get('long') || '180')
    const threshold = parseFloat(searchParams.get('threshold') || '15')

    // 1. Obtener issues de ventana corta (últimos N días)
    const shortWindowStart = new Date()
    shortWindowStart.setDate(shortWindowStart.getDate() - shortWindow)
    
    const { data: shortIssues, error: shortError } = await supabase
      .from('document_issues')
      .select(`
        taxonomy_code,
        severity,
        documents!inner(created_at, outcome_type)
      `)
      .gte('documents.created_at', shortWindowStart.toISOString())

    if (shortError) {
      console.error('Error fetching short window:', shortError)
    }

    // 2. Obtener issues de ventana larga (período anterior)
    const longWindowStart = new Date()
    longWindowStart.setDate(longWindowStart.getDate() - longWindow)
    const longWindowEnd = new Date()
    longWindowEnd.setDate(longWindowEnd.getDate() - shortWindow)

    const { data: longIssues, error: longError } = await supabase
      .from('document_issues')
      .select(`
        taxonomy_code,
        severity,
        documents!inner(created_at, outcome_type)
      `)
      .gte('documents.created_at', longWindowStart.toISOString())
      .lt('documents.created_at', longWindowEnd.toISOString())

    if (longError) {
      console.error('Error fetching long window:', longError)
    }

    // 3. Calcular distribuciones
    const shortCounts = {}
    const longCounts = {}
    let shortTotal = 0
    let longTotal = 0

    // Contar issues en ventana corta
    ;(shortIssues || []).forEach(issue => {
      if (issue.taxonomy_code) {
        shortCounts[issue.taxonomy_code] = (shortCounts[issue.taxonomy_code] || 0) + 1
        shortTotal++
      }
    })

    // Contar issues en ventana larga
    ;(longIssues || []).forEach(issue => {
      if (issue.taxonomy_code) {
        longCounts[issue.taxonomy_code] = (longCounts[issue.taxonomy_code] || 0) + 1
        longTotal++
      }
    })

    // 4. Calcular drift para cada taxonomy_code
    const allCodes = new Set([...Object.keys(shortCounts), ...Object.keys(longCounts)])
    const driftResults = []

    for (const code of allCodes) {
      const shortCount = shortCounts[code] || 0
      const longCount = longCounts[code] || 0
      
      const shortPct = shortTotal > 0 ? (shortCount / shortTotal) * 100 : 0
      const longPct = longTotal > 0 ? (longCount / longTotal) * 100 : 0
      
      const driftPct = longPct > 0 
        ? ((shortPct - longPct) / longPct) * 100 
        : (shortCount > 0 ? 100 : 0)

      // Determinar tipo de alerta
      let alertType = 'stable'
      let severity = 'low'
      
      if (Math.abs(shortPct - longPct) >= threshold) {
        if (shortPct > longPct) {
          alertType = 'increase'
          severity = driftPct > 50 ? 'critical' : driftPct > 25 ? 'high' : 'medium'
        } else {
          alertType = 'decrease'
          severity = 'medium'
        }
      } else if (longCount === 0 && shortCount >= 2) {
        alertType = 'new_pattern'
        severity = 'high'
      }

      if (alertType !== 'stable') {
        driftResults.push({
          taxonomy_code: code,
          short_window: {
            days: shortWindow,
            count: shortCount,
            percentage: Math.round(shortPct * 100) / 100
          },
          long_window: {
            days: longWindow,
            count: longCount,
            percentage: Math.round(longPct * 100) / 100
          },
          drift_percentage: Math.round(driftPct * 100) / 100,
          alert_type: alertType,
          severity: severity
        })
      }
    }

    // 5. Ordenar por severidad y drift
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    driftResults.sort((a, b) => {
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity]
      }
      return Math.abs(b.drift_percentage) - Math.abs(a.drift_percentage)
    })

    // 6. Obtener descripciones de taxonomía
    const { data: taxonomyData } = await supabase
      .from('taxonomy')
      .select('code, description, level1, level2, prong')
    
    const taxonomyMap = {}
    ;(taxonomyData || []).forEach(t => {
      taxonomyMap[t.code] = t
    })

    // Enriquecer resultados con descripciones
    const enrichedResults = driftResults.map(r => ({
      ...r,
      taxonomy: taxonomyMap[r.taxonomy_code] || { 
        description: r.taxonomy_code,
        level1: 'Desconocido',
        level2: 'Desconocido'
      }
    }))

    // 7. Generar resumen
    const summary = {
      period_analyzed: {
        short_window: `Últimos ${shortWindow} días`,
        long_window: `${shortWindow}-${longWindow} días atrás`
      },
      total_issues: {
        short_window: shortTotal,
        long_window: longTotal
      },
      alerts: {
        total: driftResults.length,
        critical: driftResults.filter(r => r.severity === 'critical').length,
        high: driftResults.filter(r => r.severity === 'high').length,
        medium: driftResults.filter(r => r.severity === 'medium').length,
        increases: driftResults.filter(r => r.alert_type === 'increase').length,
        decreases: driftResults.filter(r => r.alert_type === 'decrease').length,
        new_patterns: driftResults.filter(r => r.alert_type === 'new_pattern').length
      }
    }

    return NextResponse.json({
      success: true,
      summary,
      alerts: enrichedResults,
      parameters: {
        short_window_days: shortWindow,
        long_window_days: longWindow,
        threshold_percentage: threshold
      }
    })

  } catch (error) {
    console.error('Drift detector error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/drift-detector
 * Guarda una alerta de drift y opcionalmente la marca como reconocida
 */
export async function POST(request) {
  try {
    const supabase = getSupabaseAdmin()
    const body = await request.json()
    const { action, alert_id, alerts_to_save } = body

    if (action === 'acknowledge' && alert_id) {
      // Marcar alerta como reconocida
      const { error } = await supabase
        .from('drift_alerts')
        .update({
          acknowledged: true,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', alert_id)

      if (error) throw error
      return NextResponse.json({ success: true, message: 'Alerta reconocida' })
    }

    if (action === 'save_snapshot' && alerts_to_save) {
      // Guardar snapshot de alertas
      const alertsToInsert = alerts_to_save.map(alert => ({
        taxonomy_code: alert.taxonomy_code,
        alert_type: alert.alert_type,
        short_window_days: alert.short_window.days,
        long_window_days: alert.long_window.days,
        short_window_count: alert.short_window.count,
        long_window_count: alert.long_window.count,
        short_window_pct: alert.short_window.percentage,
        long_window_pct: alert.long_window.percentage,
        change_pct: alert.drift_percentage,
        severity: alert.severity,
        description: `${alert.taxonomy?.description || alert.taxonomy_code}: ${alert.alert_type === 'increase' ? 'Aumento' : alert.alert_type === 'decrease' ? 'Disminución' : 'Nuevo patrón'} del ${Math.abs(alert.drift_percentage).toFixed(1)}%`
      }))

      const { error } = await supabase
        .from('drift_alerts')
        .insert(alertsToInsert)

      if (error) throw error
      return NextResponse.json({ 
        success: true, 
        message: `${alertsToInsert.length} alertas guardadas` 
      })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  } catch (error) {
    console.error('Drift detector POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
