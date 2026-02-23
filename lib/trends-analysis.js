/**
 * Trends Analysis Engine - Generador de Conclusiones Inteligentes
 * Analiza patrones de issues y genera insights accionables
 */

import { TAXONOMY } from '@/lib/taxonomy'

/**
 * Genera análisis completo de tendencias
 */
export function generateTrendsAnalysis(issues, documents, topIssues, prongDistribution, severityDistribution) {
  if (!issues || issues.length === 0) {
    return {
      hasData: false,
      summary: 'No hay datos suficientes para generar análisis. Sube documentos RFE/NOID para comenzar.',
      insights: [],
      recommendations: [],
      criticalAlerts: []
    }
  }

  const analysis = {
    hasData: true,
    summary: '',
    keyFindings: [],
    insights: [],
    recommendations: [],
    criticalAlerts: [],
    patterns: [],
    actionPlan: []
  }

  // 1. Generar resumen ejecutivo
  analysis.summary = generateExecutiveSummary(issues, documents, topIssues, prongDistribution)

  // 2. Identificar hallazgos clave
  analysis.keyFindings = identifyKeyFindings(topIssues, prongDistribution, severityDistribution)

  // 3. Generar insights profundos
  analysis.insights = generateDeepInsights(issues, topIssues, prongDistribution)

  // 4. Crear recomendaciones priorizadas
  analysis.recommendations = generateRecommendations(topIssues, prongDistribution)

  // 5. Identificar alertas críticas
  analysis.criticalAlerts = identifyCriticalAlerts(issues, severityDistribution, topIssues)

  // 6. Detectar patrones
  analysis.patterns = detectPatterns(issues, documents)

  // 7. Plan de acción
  analysis.actionPlan = generateActionPlan(analysis.recommendations, analysis.criticalAlerts)

  return analysis
}

/**
 * Genera resumen ejecutivo
 */
function generateExecutiveSummary(issues, documents, topIssues, prongDistribution) {
  const totalIssues = issues.length
  const totalDocs = documents.length
  const avgIssuesPerDoc = totalDocs > 0 ? (totalIssues / totalDocs).toFixed(1) : 0
  
  // Identificar prong más problemático
  const worstProng = prongDistribution?.length > 0 
    ? prongDistribution.reduce((a, b) => a.count > b.count ? a : b)
    : null
  
  // Identificar issue más común
  const topIssue = topIssues?.[0]
  
  let summary = `Análisis de ${totalDocs} documentos con ${totalIssues} issues identificados (promedio ${avgIssuesPerDoc} por documento). `
  
  if (worstProng) {
    const prongLabels = {
      P1: 'Prong 1 (Mérito e Importancia Nacional)',
      P2: 'Prong 2 (Bien Posicionado)',
      P3: 'Prong 3 (Balance de Factores)'
    }
    summary += `El área más cuestionada es ${prongLabels[worstProng.prong] || worstProng.prong} con ${worstProng.percentage}% de los issues. `
  }
  
  if (topIssue) {
    const issueInfo = getIssueInfo(topIssue.code)
    summary += `El issue más frecuente es "${issueInfo.label}" (${topIssue.percentage}% de casos).`
  }
  
  return summary
}

/**
 * Identifica hallazgos clave
 */
function identifyKeyFindings(topIssues, prongDistribution, severityDistribution) {
  const findings = []
  
  // Hallazgo sobre concentración de issues
  if (topIssues?.length >= 3) {
    const top3Percentage = topIssues.slice(0, 3).reduce((sum, i) => sum + i.percentage, 0)
    if (top3Percentage >= 50) {
      findings.push({
        type: 'concentration',
        icon: 'target',
        title: 'Alta Concentración de Issues',
        description: `Los 3 issues más comunes representan el ${top3Percentage}% de todos los problemas. Enfocarse en estos generará el mayor impacto.`,
        issues: topIssues.slice(0, 3).map(i => i.code)
      })
    }
  }
  
  // Hallazgo sobre severidad
  const criticalCount = severityDistribution?.find(s => s.severity === 'critical')?.count || 0
  const highCount = severityDistribution?.find(s => s.severity === 'high')?.count || 0
  const totalSeverity = severityDistribution?.reduce((sum, s) => sum + s.count, 0) || 1
  const criticalHighPercentage = Math.round(((criticalCount + highCount) / totalSeverity) * 100)
  
  if (criticalHighPercentage >= 60) {
    findings.push({
      type: 'severity',
      icon: 'alert-triangle',
      title: 'Mayoría de Issues son Críticos o Altos',
      description: `El ${criticalHighPercentage}% de los issues son de severidad crítica o alta. Esto indica que USCIS está siendo muy estricto en sus evaluaciones.`,
      severity: 'high'
    })
  }
  
  // Hallazgo sobre prongs
  if (prongDistribution?.length > 0) {
    const p3 = prongDistribution.find(p => p.prong === 'P3')
    if (p3 && p3.percentage >= 30) {
      findings.push({
        type: 'prong',
        icon: 'scale',
        title: 'Prong 3 Altamente Cuestionado',
        description: `El ${p3.percentage}% de issues están en Prong 3 (Balance). USCIS está cuestionando por qué el waiver beneficia a EE.UU. más que el proceso laboral tradicional.`,
        prong: 'P3'
      })
    }
    
    const p1 = prongDistribution.find(p => p.prong === 'P1')
    if (p1 && p1.percentage >= 25) {
      findings.push({
        type: 'prong',
        icon: 'flag',
        title: 'Deficiencias en Mérito Nacional',
        description: `${p1.percentage}% de issues cuestionan la importancia nacional del trabajo. Se necesita evidencia más sólida del impacto a nivel país.`,
        prong: 'P1'
      })
    }
  }
  
  return findings
}

/**
 * Genera insights profundos sobre por qué ocurren los issues
 */
function generateDeepInsights(issues, topIssues, prongDistribution) {
  const insights = []
  
  // Analizar cada top issue y explicar por qué ocurre
  topIssues?.slice(0, 5).forEach(issue => {
    const info = getIssueInfo(issue.code)
    
    insights.push({
      code: issue.code,
      label: info.label,
      count: issue.count,
      percentage: issue.percentage,
      whyItHappens: info.whyItHappens,
      whatUSCISWants: info.whatUSCISWants,
      howToFix: info.remediation,
      evidenceNeeded: info.evidenceNeeded,
      severity: info.severity,
      prong: info.prong
    })
  })
  
  return insights
}

/**
 * Genera recomendaciones priorizadas
 */
function generateRecommendations(topIssues, prongDistribution) {
  const recommendations = []
  
  // Recomendaciones basadas en top issues
  topIssues?.slice(0, 5).forEach((issue, idx) => {
    const info = getIssueInfo(issue.code)
    
    recommendations.push({
      priority: idx < 2 ? 'critical' : idx < 4 ? 'high' : 'medium',
      title: info.remediation?.split('.')[0] || `Mejorar ${info.label}`,
      description: info.remediation,
      relatedIssue: issue.code,
      impact: `Podría resolver ${issue.percentage}% de los issues`,
      actions: info.actions || [],
      evidenceTypes: info.evidenceTypes || []
    })
  })
  
  // Recomendaciones basadas en prongs
  const weakProng = prongDistribution?.reduce((a, b) => a.count > b.count ? a : b, { count: 0 })
  if (weakProng && weakProng.count > 0) {
    const prongRecs = getProngRecommendations(weakProng.prong)
    recommendations.push(...prongRecs.map(r => ({ ...r, priority: 'high' })))
  }
  
  return recommendations
}

/**
 * Identifica alertas críticas
 */
function identifyCriticalAlerts(issues, severityDistribution, topIssues) {
  const alerts = []
  
  // Alerta si hay muchos issues críticos
  const criticalCount = severityDistribution?.find(s => s.severity === 'critical')?.count || 0
  if (criticalCount > 5) {
    alerts.push({
      type: 'critical',
      icon: 'alert-octagon',
      title: '⚠️ Alto Volumen de Issues Críticos',
      message: `Se detectaron ${criticalCount} issues de severidad crítica que pueden causar denegaciones directas.`,
      action: 'Revisar urgentemente la preparación de evidencia para estos casos.'
    })
  }
  
  // Alerta si un issue específico es muy dominante
  if (topIssues?.[0]?.percentage >= 25) {
    const info = getIssueInfo(topIssues[0].code)
    alerts.push({
      type: 'pattern',
      icon: 'trending-up',
      title: `🎯 Issue Dominante: ${info.label}`,
      message: `Este issue representa ${topIssues[0].percentage}% de todos los problemas. Hay un patrón sistémico.`,
      action: info.remediation
    })
  }
  
  // Alerta sobre P3 (común en NIW)
  const p3Issues = issues?.filter(i => i.prong_affected === 'P3' || i.code?.includes('P3')).length || 0
  if (p3Issues > issues?.length * 0.3) {
    alerts.push({
      type: 'prong',
      icon: 'scale',
      title: '⚖️ Prong 3 Requiere Atención Especial',
      message: 'USCIS está cuestionando fuertemente el balance de factores. Necesitan demostrar por qué es mejor aprobar el waiver que requerir labor certification.',
      action: 'Reforzar argumentos sobre urgencia, escasez de trabajadores calificados, y beneficio nacional inmediato.'
    })
  }
  
  return alerts
}

/**
 * Detecta patrones en los datos
 */
function detectPatterns(issues, documents) {
  const patterns = []
  
  // Patrón por service center
  const centerCounts = {}
  issues?.forEach(i => {
    const center = i.service_center || 'No especificado'
    centerCounts[center] = (centerCounts[center] || 0) + 1
  })
  
  const topCenter = Object.entries(centerCounts).sort((a, b) => b[1] - a[1])[0]
  if (topCenter && topCenter[1] > issues?.length * 0.4) {
    patterns.push({
      type: 'service_center',
      title: `Concentración en ${topCenter[0]}`,
      description: `${Math.round(topCenter[1] / issues.length * 100)}% de issues provienen de ${topCenter[0]}. Este centro puede tener criterios más estrictos.`,
      recommendation: 'Considerar estrategias específicas para este centro de servicio.'
    })
  }
  
  // Patrón temporal (si hay suficientes datos)
  const monthCounts = {}
  issues?.forEach(i => {
    const date = new Date(i.created_at)
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    monthCounts[month] = (monthCounts[month] || 0) + 1
  })
  
  const months = Object.keys(monthCounts).sort()
  if (months.length >= 2) {
    const recent = monthCounts[months[months.length - 1]] || 0
    const previous = monthCounts[months[months.length - 2]] || 0
    
    if (recent > previous * 1.5 && recent > 3) {
      patterns.push({
        type: 'temporal',
        title: 'Incremento Reciente de Issues',
        description: `Los issues aumentaron ${Math.round((recent - previous) / previous * 100)}% en el último período. USCIS puede estar siendo más estricto.`,
        recommendation: 'Reforzar la documentación y anticipar mayor escrutinio.'
      })
    }
  }
  
  return patterns
}

/**
 * Genera plan de acción
 */
function generateActionPlan(recommendations, alerts) {
  const plan = []
  
  // Acciones inmediatas (de alerts)
  alerts?.forEach((alert, idx) => {
    plan.push({
      priority: 1,
      timeframe: 'Inmediato',
      action: alert.action,
      reason: alert.message,
      type: 'alert'
    })
  })
  
  // Acciones a corto plazo (de top recommendations)
  recommendations?.slice(0, 3).forEach((rec, idx) => {
    plan.push({
      priority: 2,
      timeframe: 'Próximos 30 días',
      action: rec.title,
      reason: rec.description,
      impact: rec.impact,
      type: 'recommendation'
    })
  })
  
  // Acciones a mediano plazo
  recommendations?.slice(3).forEach((rec, idx) => {
    plan.push({
      priority: 3,
      timeframe: 'Próximos 90 días',
      action: rec.title,
      reason: rec.description,
      type: 'improvement'
    })
  })
  
  return plan
}

/**
 * Obtiene información detallada de un código de issue
 */
function getIssueInfo(code) {
  // Parsear el código (ej: NIW.P1.IMPORTANCIA_NO_DEMOSTRADA)
  const parts = code?.split('.') || []
  const visa = parts[0] || 'NIW'
  const prong = parts[1] || 'P1'
  const issueKey = parts[2] || ''
  
  // Buscar en taxonomía
  const visaTax = TAXONOMY[visa]
  const prongTax = visaTax?.prongs?.[prong] || visaTax?.criteria?.[prong]
  const issueTax = prongTax?.issues?.[issueKey]
  
  if (issueTax) {
    return {
      code: issueTax.code,
      label: issueTax.label,
      severity: issueTax.severity,
      description: issueTax.description,
      remediation: issueTax.remediation,
      prong: prong,
      whyItHappens: getWhyItHappens(code),
      whatUSCISWants: getWhatUSCISWants(code),
      evidenceNeeded: getEvidenceNeeded(code),
      actions: getActionsForIssue(code),
      evidenceTypes: getEvidenceTypes(code)
    }
  }
  
  // Fallback
  return {
    code: code,
    label: code?.split('.').pop()?.replace(/_/g, ' ') || 'Issue desconocido',
    severity: 'medium',
    description: 'Issue identificado en el documento',
    remediation: 'Revisar la documentación relacionada',
    prong: prong,
    whyItHappens: 'La evidencia presentada no convenció al oficial de USCIS.',
    whatUSCISWants: 'Evidencia más específica y cuantificable.',
    evidenceNeeded: ['Documentación adicional'],
    actions: ['Revisar petición', 'Consultar con experto'],
    evidenceTypes: ['Cartas de apoyo', 'Documentos oficiales']
  }
}

/**
 * Explica por qué ocurre un issue
 */
function getWhyItHappens(code) {
  const explanations = {
    'NIW.P1.IMPORTANCIA_NO_DEMOSTRADA': 'El oficial no ve cómo el trabajo impacta a nivel nacional. La evidencia se enfoca demasiado en el empleador o área local.',
    'NIW.P1.MERITO_INSUFICIENTE': 'No está claro qué problema resuelve el trabajo o por qué es valioso para la sociedad.',
    'NIW.P2.CALIFICACIONES_INSUFICIENTES': 'Los títulos y experiencia no demuestran claramente la capacidad de ejecutar el plan propuesto.',
    'NIW.P2.TRACCION_INSUFICIENTE': 'Falta evidencia de logros concretos o progreso medible en el campo.',
    'NIW.P3.BENEFICIO_WAIVER_NO_DEMOSTRADO': 'No se explica por qué aprobar el waiver beneficia más a EE.UU. que requerir el proceso laboral tradicional.',
    'NIW.P3.LABOR_MARKET_NO_ADDRESSED': 'No se argumenta sobre la escasez de trabajadores o la urgencia de la necesidad.'
  }
  
  return explanations[code] || 'La evidencia presentada no cumple con los estándares requeridos por USCIS.'
}

/**
 * Explica qué quiere ver USCIS
 */
function getWhatUSCISWants(code) {
  const wants = {
    'NIW.P1.IMPORTANCIA_NO_DEMOSTRADA': 'Evidencia de impacto a nivel nacional: estadísticas del sector, estudios de mercado, conexión con prioridades federales.',
    'NIW.P1.MERITO_INSUFICIENTE': 'Explicación clara del problema que resuelve y por qué es importante para la sociedad estadounidense.',
    'NIW.P2.CALIFICACIONES_INSUFICIENTES': 'Demostración de expertise: grados avanzados, publicaciones, proyectos completados, reconocimiento de pares.',
    'NIW.P2.TRACCION_INSUFICIENTE': 'Track record documentado: contratos, clientes, ingresos, premios, cobertura mediática.',
    'NIW.P3.BENEFICIO_WAIVER_NO_DEMOSTRADO': 'Argumentos sobre urgencia, escasez de talento calificado, y por qué el proceso laboral sería perjudicial.',
    'NIW.P3.LABOR_MARKET_NO_ADDRESSED': 'Datos sobre la escasez de profesionales en el campo y el tiempo que tomaría el proceso laboral.'
  }
  
  return wants[code] || 'Evidencia específica, cuantificable y verificable que apoye directamente el argumento.'
}

/**
 * Lista evidencia necesaria
 */
function getEvidenceNeeded(code) {
  const evidence = {
    'NIW.P1.IMPORTANCIA_NO_DEMOSTRADA': [
      'Cartas de expertos del sector explicando importancia nacional',
      'Estadísticas de mercado y tendencias de la industria',
      'Conexión con iniciativas o prioridades federales',
      'Estudios de impacto económico'
    ],
    'NIW.P2.CALIFICACIONES_INSUFICIENTES': [
      'Títulos académicos y certificaciones',
      'Lista de proyectos completados con resultados',
      'Publicaciones y presentaciones',
      'Cartas de recomendación de expertos'
    ],
    'NIW.P3.BENEFICIO_WAIVER_NO_DEMOSTRADO': [
      'Análisis de mercado laboral mostrando escasez',
      'Cartas explicando urgencia de la necesidad',
      'Comparación de tiempos: waiver vs labor certification',
      'Impacto de retrasos en el proyecto'
    ]
  }
  
  return evidence[code] || ['Documentación adicional específica', 'Cartas de apoyo', 'Evidencia cuantificable']
}

/**
 * Acciones específicas para resolver un issue
 */
function getActionsForIssue(code) {
  const actions = {
    'NIW.P1.IMPORTANCIA_NO_DEMOSTRADA': [
      'Obtener 3-5 cartas de expertos independientes del sector',
      'Incluir datos del BLS o reportes de industria',
      'Conectar el trabajo con prioridades nacionales (ej: CHIPS Act, Inflation Reduction Act)'
    ],
    'NIW.P2.TRACCION_INSUFICIENTE': [
      'Documentar todos los proyectos con resultados medibles',
      'Obtener testimonios de clientes o colaboradores',
      'Incluir métricas: ingresos, usuarios, impacto'
    ],
    'NIW.P3.BENEFICIO_WAIVER_NO_DEMOSTRADO': [
      'Argumentar escasez de profesionales calificados',
      'Explicar por qué labor certification tomaría demasiado tiempo',
      'Demostrar urgencia del proyecto'
    ]
  }
  
  return actions[code] || ['Revisar documentación', 'Fortalecer evidencia', 'Consultar con experto']
}

/**
 * Tipos de evidencia recomendados
 */
function getEvidenceTypes(code) {
  return [
    'Cartas de expertos independientes',
    'Datos estadísticos oficiales',
    'Contratos y acuerdos',
    'Publicaciones y patentes',
    'Cobertura mediática'
  ]
}

/**
 * Recomendaciones específicas por prong
 */
function getProngRecommendations(prong) {
  const recs = {
    P1: [{
      title: 'Fortalecer Argumento de Importancia Nacional',
      description: 'Conectar el trabajo con prioridades federales, incluir estadísticas de mercado nacional, y obtener cartas de expertos del sector.',
      actions: [
        'Investigar iniciativas federales relacionadas',
        'Obtener datos del BLS y reportes de industria',
        'Solicitar cartas a 5+ expertos independientes'
      ]
    }],
    P2: [{
      title: 'Demostrar Track Record Sólido',
      description: 'Documentar logros pasados con métricas, incluir testimonios de clientes/colaboradores, y mostrar progreso medible.',
      actions: [
        'Crear portfolio de proyectos con resultados',
        'Obtener cartas de clientes satisfechos',
        'Documentar premios y reconocimientos'
      ]
    }],
    P3: [{
      title: 'Reforzar Argumento de Balance',
      description: 'Explicar por qué el waiver es mejor que labor certification, argumentar escasez de talento, y demostrar urgencia.',
      actions: [
        'Investigar tiempos de labor certification',
        'Documentar escasez en el campo',
        'Explicar impacto de retrasos'
      ]
    }]
  }
  
  return recs[prong] || []
}
