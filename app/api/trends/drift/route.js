import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Drift Detector API
 * Compara la distribución de issues entre dos períodos para detectar cambios en criterios de USCIS
 * 
 * Parámetros:
 * - recentDays: días del período reciente (default: 60)
 * - baselineDays: días del período de referencia (default: 180)
 * - threshold: % mínimo de cambio para considerar significativo (default: 20)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const recentDays = parseInt(searchParams.get('recentDays') || '60')
    const baselineDays = parseInt(searchParams.get('baselineDays') || '180')
    const threshold = parseInt(searchParams.get('threshold') || '20')

    const now = new Date()
    
    // Período reciente: últimos N días
    const recentStart = new Date(now)
    recentStart.setDate(recentStart.getDate() - recentDays)
    
    // Período de referencia: desde hace (baselineDays) hasta hace (recentDays)
    const baselineStart = new Date(now)
    baselineStart.setDate(baselineStart.getDate() - baselineDays)
    const baselineEnd = new Date(recentStart)

    console.log(`📊 Drift Detector: Comparando ${recentDays} días recientes vs ${baselineDays - recentDays} días anteriores`)

    // Obtener issues del período reciente
    const recentIssues = await getIssuesForPeriod(recentStart, now)
    
    // Obtener issues del período de referencia
    const baselineIssues = await getIssuesForPeriod(baselineStart, baselineEnd)

    // Calcular distribución por taxonomy_code para ambos períodos
    const recentDistribution = calculateDistribution(recentIssues)
    const baselineDistribution = calculateDistribution(baselineIssues)

    // Detectar drifts (cambios significativos)
    const drifts = detectDrifts(recentDistribution, baselineDistribution, threshold)

    // Calcular distribución por prong
    const recentProngDist = calculateProngDistribution(recentIssues)
    const baselineProngDist = calculateProngDistribution(baselineIssues)
    const prongDrifts = detectProngDrifts(recentProngDist, baselineProngDist, threshold)

    // Calcular distribución por severity
    const recentSeverityDist = calculateSeverityDistribution(recentIssues)
    const baselineSeverityDist = calculateSeverityDistribution(baselineIssues)
    const severityDrifts = detectSeverityDrifts(recentSeverityDist, baselineSeverityDist, threshold)

    // Identificar nuevos issues que no existían en el período base
    const newIssues = findNewIssues(recentDistribution, baselineDistribution)

    // Identificar issues que desaparecieron
    const disappearedIssues = findDisappearedIssues(recentDistribution, baselineDistribution)

    // Calcular score de drift general (0-100)
    const overallDriftScore = calculateOverallDriftScore(drifts, prongDrifts, newIssues)

    // Generar alertas
    const alerts = generateAlerts(drifts, prongDrifts, severityDrifts, newIssues, threshold)

    return NextResponse.json({
      success: true,
      periods: {
        recent: {
          label: `Últimos ${recentDays} días`,
          start: recentStart.toISOString(),
          end: now.toISOString(),
          totalIssues: recentIssues.length,
          uniqueCodes: Object.keys(recentDistribution).length
        },
        baseline: {
          label: `${baselineDays - recentDays} días anteriores`,
          start: baselineStart.toISOString(),
          end: baselineEnd.toISOString(),
          totalIssues: baselineIssues.length,
          uniqueCodes: Object.keys(baselineDistribution).length
        }
      },
      overallDriftScore,
      drifts: drifts.slice(0, 15), // Top 15 drifts más significativos
      prongDrifts,
      severityDrifts,
      newIssues: newIssues.slice(0, 10),
      disappearedIssues: disappearedIssues.slice(0, 10),
      alerts,
      threshold,
      summary: generateSummary(drifts, prongDrifts, newIssues, overallDriftScore)
    })

  } catch (error) {
    console.error('Error in drift detection:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function getIssuesForPeriod(startDate, endDate) {
  // Obtener de document_issues
  const { data: dbIssues, error: dbError } = await supabase
    .from('document_issues')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lt('created_at', endDate.toISOString())

  // También obtener de structured_data en case_documents
  const { data: caseDocs, error: caseError } = await supabase
    .from('case_documents')
    .select('id, structured_data, created_at')
    .gte('created_at', startDate.toISOString())
    .lt('created_at', endDate.toISOString())
    .not('structured_data', 'is', null)

  let allIssues = dbIssues || []

  // Extraer issues de structured_data
  if (caseDocs && caseDocs.length > 0) {
    caseDocs.forEach(doc => {
      if (doc.structured_data) {
        const sd = typeof doc.structured_data === 'string' 
          ? JSON.parse(doc.structured_data) 
          : doc.structured_data
        
        if (sd.issues && Array.isArray(sd.issues)) {
          sd.issues.forEach(issue => {
            allIssues.push({
              ...issue,
              document_id: doc.id,
              created_at: doc.created_at,
              source: 'case_documents'
            })
          })
        }
      }
    })
  }

  return allIssues
}

function calculateDistribution(issues) {
  const distribution = {}
  const total = issues.length
  
  issues.forEach(issue => {
    const code = issue.taxonomy_code || 'UNKNOWN'
    if (!distribution[code]) {
      distribution[code] = {
        code,
        count: 0,
        percentage: 0,
        severities: { critical: 0, high: 0, medium: 0, low: 0 },
        prongs: {}
      }
    }
    distribution[code].count++
    
    if (issue.severity) {
      distribution[code].severities[issue.severity] = 
        (distribution[code].severities[issue.severity] || 0) + 1
    }
    
    if (issue.prong_affected) {
      distribution[code].prongs[issue.prong_affected] = 
        (distribution[code].prongs[issue.prong_affected] || 0) + 1
    }
  })

  // Calcular porcentajes
  Object.values(distribution).forEach(item => {
    item.percentage = total > 0 ? (item.count / total) * 100 : 0
  })

  return distribution
}

function calculateProngDistribution(issues) {
  const distribution = { P1: 0, P2: 0, P3: 0, EVIDENCE: 0, COHERENCE: 0, PROCEDURAL: 0 }
  const total = issues.length

  issues.forEach(issue => {
    if (issue.prong_affected && distribution.hasOwnProperty(issue.prong_affected)) {
      distribution[issue.prong_affected]++
    }
  })

  const result = {}
  Object.entries(distribution).forEach(([prong, count]) => {
    result[prong] = {
      count,
      percentage: total > 0 ? (count / total) * 100 : 0
    }
  })

  return result
}

function calculateSeverityDistribution(issues) {
  const distribution = { critical: 0, high: 0, medium: 0, low: 0 }
  const total = issues.length

  issues.forEach(issue => {
    if (issue.severity && distribution.hasOwnProperty(issue.severity)) {
      distribution[issue.severity]++
    }
  })

  const result = {}
  Object.entries(distribution).forEach(([severity, count]) => {
    result[severity] = {
      count,
      percentage: total > 0 ? (count / total) * 100 : 0
    }
  })

  return result
}

function detectDrifts(recentDist, baselineDist, threshold) {
  const drifts = []
  const allCodes = new Set([...Object.keys(recentDist), ...Object.keys(baselineDist)])

  allCodes.forEach(code => {
    const recent = recentDist[code]?.percentage || 0
    const baseline = baselineDist[code]?.percentage || 0
    
    // Calcular cambio absoluto y relativo
    const absoluteChange = recent - baseline
    const relativeChange = baseline > 0 ? ((recent - baseline) / baseline) * 100 : (recent > 0 ? 100 : 0)

    // Solo incluir si el cambio es significativo
    if (Math.abs(absoluteChange) >= 2 || Math.abs(relativeChange) >= threshold) {
      drifts.push({
        code,
        recentPercentage: Math.round(recent * 10) / 10,
        baselinePercentage: Math.round(baseline * 10) / 10,
        recentCount: recentDist[code]?.count || 0,
        baselineCount: baselineDist[code]?.count || 0,
        absoluteChange: Math.round(absoluteChange * 10) / 10,
        relativeChange: Math.round(relativeChange),
        direction: absoluteChange > 0 ? 'up' : absoluteChange < 0 ? 'down' : 'stable',
        isSignificant: Math.abs(relativeChange) >= threshold,
        severity: recentDist[code]?.severities || baselineDist[code]?.severities || {}
      })
    }
  })

  // Ordenar por magnitud del cambio
  return drifts.sort((a, b) => Math.abs(b.relativeChange) - Math.abs(a.relativeChange))
}

function detectProngDrifts(recentDist, baselineDist, threshold) {
  const drifts = []
  const prongs = ['P1', 'P2', 'P3', 'EVIDENCE', 'COHERENCE', 'PROCEDURAL']
  const labels = {
    P1: 'Prong 1 - Mérito Nacional',
    P2: 'Prong 2 - Bien Posicionado',
    P3: 'Prong 3 - Balance',
    EVIDENCE: 'Evidencia',
    COHERENCE: 'Coherencia',
    PROCEDURAL: 'Procedural'
  }

  prongs.forEach(prong => {
    const recent = recentDist[prong]?.percentage || 0
    const baseline = baselineDist[prong]?.percentage || 0
    const absoluteChange = recent - baseline
    const relativeChange = baseline > 0 ? ((recent - baseline) / baseline) * 100 : (recent > 0 ? 100 : 0)

    drifts.push({
      prong,
      label: labels[prong],
      recentPercentage: Math.round(recent * 10) / 10,
      baselinePercentage: Math.round(baseline * 10) / 10,
      recentCount: recentDist[prong]?.count || 0,
      baselineCount: baselineDist[prong]?.count || 0,
      absoluteChange: Math.round(absoluteChange * 10) / 10,
      relativeChange: Math.round(relativeChange),
      direction: absoluteChange > 0 ? 'up' : absoluteChange < 0 ? 'down' : 'stable',
      isSignificant: Math.abs(relativeChange) >= threshold
    })
  })

  return drifts.sort((a, b) => Math.abs(b.relativeChange) - Math.abs(a.relativeChange))
}

function detectSeverityDrifts(recentDist, baselineDist, threshold) {
  const drifts = []
  const severities = ['critical', 'high', 'medium', 'low']
  const labels = { critical: 'Crítico', high: 'Alto', medium: 'Medio', low: 'Bajo' }

  severities.forEach(severity => {
    const recent = recentDist[severity]?.percentage || 0
    const baseline = baselineDist[severity]?.percentage || 0
    const absoluteChange = recent - baseline
    const relativeChange = baseline > 0 ? ((recent - baseline) / baseline) * 100 : (recent > 0 ? 100 : 0)

    drifts.push({
      severity,
      label: labels[severity],
      recentPercentage: Math.round(recent * 10) / 10,
      baselinePercentage: Math.round(baseline * 10) / 10,
      recentCount: recentDist[severity]?.count || 0,
      baselineCount: baselineDist[severity]?.count || 0,
      absoluteChange: Math.round(absoluteChange * 10) / 10,
      relativeChange: Math.round(relativeChange),
      direction: absoluteChange > 0 ? 'up' : absoluteChange < 0 ? 'down' : 'stable',
      isSignificant: Math.abs(relativeChange) >= threshold
    })
  })

  return drifts
}

function findNewIssues(recentDist, baselineDist) {
  const newIssues = []
  
  Object.entries(recentDist).forEach(([code, data]) => {
    if (!baselineDist[code] || baselineDist[code].count === 0) {
      newIssues.push({
        code,
        count: data.count,
        percentage: Math.round(data.percentage * 10) / 10,
        severity: data.severities,
        prongs: data.prongs,
        isNew: true
      })
    }
  })

  return newIssues.sort((a, b) => b.count - a.count)
}

function findDisappearedIssues(recentDist, baselineDist) {
  const disappeared = []
  
  Object.entries(baselineDist).forEach(([code, data]) => {
    if (!recentDist[code] || recentDist[code].count === 0) {
      disappeared.push({
        code,
        previousCount: data.count,
        previousPercentage: Math.round(data.percentage * 10) / 10,
        disappeared: true
      })
    }
  })

  return disappeared.sort((a, b) => b.previousCount - a.previousCount)
}

function calculateOverallDriftScore(drifts, prongDrifts, newIssues) {
  // Score basado en:
  // - Número de issues con cambio significativo
  // - Magnitud de los cambios
  // - Nuevos issues detectados
  
  const significantDrifts = drifts.filter(d => d.isSignificant).length
  const significantProngDrifts = prongDrifts.filter(d => d.isSignificant).length
  const avgRelativeChange = drifts.length > 0 
    ? drifts.reduce((sum, d) => sum + Math.abs(d.relativeChange), 0) / drifts.length
    : 0

  let score = 0
  
  // Contribución de drifts significativos (hasta 40 puntos)
  score += Math.min(significantDrifts * 5, 40)
  
  // Contribución de cambios en prongs (hasta 30 puntos)
  score += Math.min(significantProngDrifts * 10, 30)
  
  // Contribución de nuevos issues (hasta 20 puntos)
  score += Math.min(newIssues.length * 5, 20)
  
  // Contribución del promedio de cambio relativo (hasta 10 puntos)
  score += Math.min(avgRelativeChange / 10, 10)

  return Math.min(Math.round(score), 100)
}

function generateAlerts(drifts, prongDrifts, severityDrifts, newIssues, threshold) {
  const alerts = []

  // Alertas por issues que aumentaron significativamente
  drifts
    .filter(d => d.direction === 'up' && d.isSignificant && d.relativeChange >= threshold)
    .slice(0, 5)
    .forEach(d => {
      alerts.push({
        type: 'increase',
        severity: d.relativeChange >= 50 ? 'high' : 'medium',
        code: d.code,
        message: `"${d.code}" aumentó ${d.relativeChange}% (de ${d.baselinePercentage}% a ${d.recentPercentage}%)`,
        recommendation: 'USCIS puede estar poniendo más énfasis en este issue. Reforzar evidencia relacionada.'
      })
    })

  // Alertas por cambios en prongs
  prongDrifts
    .filter(d => d.isSignificant && d.direction === 'up')
    .forEach(d => {
      alerts.push({
        type: 'prong_shift',
        severity: d.relativeChange >= 30 ? 'high' : 'medium',
        prong: d.prong,
        message: `${d.label} bajo más escrutinio: +${d.absoluteChange}% puntos`,
        recommendation: `Fortalecer argumentación del ${d.prong} en peticiones futuras.`
      })
    })

  // Alertas por aumento en severidad
  const criticalDrift = severityDrifts.find(d => d.severity === 'critical')
  if (criticalDrift && criticalDrift.direction === 'up' && criticalDrift.absoluteChange >= 5) {
    alerts.push({
      type: 'severity_increase',
      severity: 'high',
      message: `Issues críticos aumentaron de ${criticalDrift.baselinePercentage}% a ${criticalDrift.recentPercentage}%`,
      recommendation: 'USCIS puede estar siendo más estricto. Revisar cuidadosamente las peticiones.'
    })
  }

  // Alertas por nuevos issues
  if (newIssues.length >= 3) {
    alerts.push({
      type: 'new_patterns',
      severity: 'medium',
      message: `${newIssues.length} nuevos tipos de issues detectados que no aparecían anteriormente`,
      recommendation: 'Posibles nuevos criterios o énfasis de USCIS. Investigar estos patrones.'
    })
  }

  return alerts.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })
}

function generateSummary(drifts, prongDrifts, newIssues, overallScore) {
  const significantIncreases = drifts.filter(d => d.direction === 'up' && d.isSignificant).length
  const significantDecreases = drifts.filter(d => d.direction === 'down' && d.isSignificant).length
  const prongShifts = prongDrifts.filter(d => d.isSignificant).length

  let status = 'stable'
  let statusLabel = 'Estable'
  let statusDescription = 'No se detectan cambios significativos en los criterios de USCIS.'

  if (overallScore >= 70) {
    status = 'high_drift'
    statusLabel = 'Cambios Importantes'
    statusDescription = 'Se detectan cambios significativos en los patrones de RFE/NOID. Revisar estrategia de peticiones.'
  } else if (overallScore >= 40) {
    status = 'moderate_drift'
    statusLabel = 'Cambios Moderados'
    statusDescription = 'Algunos cambios detectados en los criterios. Monitorear tendencias.'
  } else if (overallScore >= 20) {
    status = 'low_drift'
    statusLabel = 'Cambios Menores'
    statusDescription = 'Pequeñas variaciones en los patrones. Situación relativamente estable.'
  }

  return {
    status,
    statusLabel,
    statusDescription,
    stats: {
      significantIncreases,
      significantDecreases,
      prongShifts,
      newIssues: newIssues.length
    }
  }
}
