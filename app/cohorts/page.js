'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft, Loader2, TrendingUp, TrendingDown, Minus,
  BarChart3, Calendar, RefreshCw, ArrowUp, ArrowDown,
  AlertTriangle, Layers, Activity, Zap, Target,
  ChevronRight, Lightbulb, ArrowRightLeft, Clock
} from 'lucide-react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, Cell
} from 'recharts'

const COLORS = {
  P1: '#8b5cf6',
  P2: '#3b82f6',
  P3: '#10b981',
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e'
}

export default function CohortsPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  
  // Comparison mode
  const [periodA, setPeriodA] = useState('') // Período anterior
  const [periodB, setPeriodB] = useState('') // Período reciente
  const [comparison, setComparison] = useState(null)
  
  // Filters
  const [outcomeType, setOutcomeType] = useState('all')

  useEffect(() => {
    fetchData()
  }, [outcomeType])

  useEffect(() => {
    if (periodA && periodB && data) {
      calculateComparison()
    }
  }, [periodA, periodB, data])

  const fetchData = async () => {
    try {
      setLoading(true)
      // Obtener datos de múltiples años para comparación más rica
      const years = ['2024', '2025', '2026']
      let allCohorts = []
      
      for (const y of years) {
        const params = new URLSearchParams({ 
          groupBy: 'quarter', 
          year: y,
          outcome_type: outcomeType !== 'all' ? outcomeType : ''
        })
        const response = await fetch(`/api/trends/cohorts?${params}`)
        const result = await response.json()
        
        if (result.cohorts) {
          allCohorts = [...allCohorts, ...result.cohorts]
        }
      }
      
      // Ordenar por fecha
      allCohorts.sort((a, b) => a.key.localeCompare(b.key))
      
      // Filtrar solo los que tienen datos o son recientes
      const relevantCohorts = allCohorts.filter(c => 
        c.stats?.total > 0 || c.key.startsWith('2026') || c.key.startsWith('2025')
      )
      
      setData({ cohorts: relevantCohorts })

      // Auto-seleccionar períodos con datos
      const withData = relevantCohorts.filter(c => c.stats?.total > 0)
      if (withData.length >= 2) {
        setPeriodA(withData[withData.length - 2].key)
        setPeriodB(withData[withData.length - 1].key)
      } else if (withData.length === 1) {
        const idx = relevantCohorts.findIndex(c => c.key === withData[0].key)
        if (idx > 0) {
          setPeriodA(relevantCohorts[idx - 1].key)
          setPeriodB(withData[0].key)
        }
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateComparison = () => {
    if (!data?.cohorts) return

    const cohortA = data.cohorts.find(c => c.key === periodA)
    const cohortB = data.cohorts.find(c => c.key === periodB)

    if (!cohortA || !cohortB) return

    // Calcular cambios por issue code
    const issueCodesA = {}
    const issueCodesB = {}

    cohortA.issues?.forEach(i => {
      const code = i.taxonomy_code || 'UNKNOWN'
      issueCodesA[code] = (issueCodesA[code] || 0) + 1
    })

    cohortB.issues?.forEach(i => {
      const code = i.taxonomy_code || 'UNKNOWN'
      issueCodesB[code] = (issueCodesB[code] || 0) + 1
    })

    // Issues emergentes (nuevos o aumentaron significativamente)
    const emerging = []
    const declining = []
    const stable = []

    const allCodes = new Set([...Object.keys(issueCodesA), ...Object.keys(issueCodesB)])

    allCodes.forEach(code => {
      const countA = issueCodesA[code] || 0
      const countB = issueCodesB[code] || 0
      const diff = countB - countA
      const pctChange = countA > 0 ? Math.round((diff / countA) * 100) : (countB > 0 ? 100 : 0)

      const item = { code, countA, countB, diff, pctChange }

      if (countA === 0 && countB > 0) {
        emerging.push({ ...item, isNew: true })
      } else if (diff > 0) {
        emerging.push(item)
      } else if (diff < 0) {
        declining.push(item)
      } else if (countA > 0 && countB > 0) {
        stable.push(item)
      }
    })

    // Ordenar
    emerging.sort((a, b) => b.diff - a.diff)
    declining.sort((a, b) => a.diff - b.diff)

    // Cambios por prong
    const prongChanges = {}
    const prongs = ['P1', 'P2', 'P3']
    prongs.forEach(p => {
      const countA = cohortA.stats?.byProng?.[p] || 0
      const countB = cohortB.stats?.byProng?.[p] || 0
      const diff = countB - countA
      const pctChange = countA > 0 ? Math.round((diff / countA) * 100) : (countB > 0 ? 100 : 0)
      prongChanges[p] = { countA, countB, diff, pctChange }
    })

    // Cambios por severidad
    const severityChanges = {}
    const severities = ['critical', 'high', 'medium', 'low']
    severities.forEach(s => {
      const countA = cohortA.stats?.bySeverity?.[s] || 0
      const countB = cohortB.stats?.bySeverity?.[s] || 0
      const diff = countB - countA
      severityChanges[s] = { countA, countB, diff }
    })

    // Generar insights
    const insights = generateInsights(cohortA, cohortB, emerging, declining, prongChanges, severityChanges)

    setComparison({
      periodA: cohortA,
      periodB: cohortB,
      totalA: cohortA.stats?.total || 0,
      totalB: cohortB.stats?.total || 0,
      totalDiff: (cohortB.stats?.total || 0) - (cohortA.stats?.total || 0),
      emerging,
      declining,
      stable,
      prongChanges,
      severityChanges,
      insights
    })
  }

  const generateInsights = (cohortA, cohortB, emerging, declining, prongChanges, severityChanges) => {
    const insights = []
    const totalA = cohortA.stats?.total || 0
    const totalB = cohortB.stats?.total || 0
    const totalDiff = totalB - totalA

    // Insight sobre volumen total
    if (totalDiff > 0 && totalA > 0) {
      const pct = Math.round((totalDiff / totalA) * 100)
      if (pct >= 50) {
        insights.push({
          type: 'warning',
          icon: AlertTriangle,
          title: 'Aumento significativo de issues',
          text: `Los issues aumentaron ${pct}% (de ${totalA} a ${totalB}). USCIS puede estar aplicando criterios más estrictos.`,
          action: 'Revisar los nuevos issues emergentes y reforzar esas áreas en peticiones futuras.'
        })
      }
    } else if (totalDiff < 0 && totalA > 0) {
      const pct = Math.round(Math.abs(totalDiff / totalA) * 100)
      if (pct >= 30) {
        insights.push({
          type: 'success',
          icon: TrendingDown,
          title: 'Reducción en issues',
          text: `Los issues disminuyeron ${pct}% (de ${totalA} a ${totalB}). Tendencia positiva.`,
          action: 'Mantener las estrategias actuales de documentación.'
        })
      }
    }

    // Insight sobre issues emergentes
    const newIssues = emerging.filter(e => e.isNew)
    if (newIssues.length >= 2) {
      insights.push({
        type: 'alert',
        icon: Zap,
        title: `${newIssues.length} nuevos tipos de issues`,
        text: `Aparecieron issues que no existían antes: ${newIssues.slice(0, 2).map(i => i.code.split('.').pop()).join(', ')}`,
        action: 'Investigar estos nuevos criterios y ajustar la preparación de casos.'
      })
    }

    // Insight sobre prongs
    const p1Change = prongChanges.P1?.pctChange || 0
    const p2Change = prongChanges.P2?.pctChange || 0
    
    if (p1Change > 30) {
      insights.push({
        type: 'warning',
        icon: Target,
        title: 'Mayor escrutinio en Prong 1',
        text: `Issues de P1 (Mérito Nacional) aumentaron ${p1Change}%. USCIS está cuestionando más la importancia nacional.`,
        action: 'Fortalecer argumentos de impacto nacional con datos cuantificables.'
      })
    }
    
    if (p2Change > 30) {
      insights.push({
        type: 'warning',
        icon: Target,
        title: 'Mayor escrutinio en Prong 2',
        text: `Issues de P2 (Bien Posicionado) aumentaron ${p2Change}%. USCIS cuestiona la capacidad de ejecución.`,
        action: 'Incluir evidencia sólida de recursos, experiencia y plan de acción.'
      })
    }

    // Insight sobre severidad
    const criticalDiff = severityChanges.critical?.diff || 0
    if (criticalDiff > 0) {
      insights.push({
        type: 'alert',
        icon: AlertTriangle,
        title: 'Aumento en issues críticos',
        text: `Los issues de severidad crítica aumentaron en ${criticalDiff}. Mayor riesgo de denegación.`,
        action: 'Priorizar la respuesta a estos issues en casos activos.'
      })
    }

    // Si no hay issues en el período más reciente
    if (totalB === 0 && totalA > 0) {
      insights.push({
        type: 'info',
        icon: Clock,
        title: 'Sin datos recientes',
        text: 'No hay issues registrados en el período seleccionado.',
        action: 'Puede que no haya documentos procesados en este período.'
      })
    }

    return insights
  }

  const getChangeIcon = (diff) => {
    if (diff > 0) return <ArrowUp className="h-4 w-4 text-red-500" />
    if (diff < 0) return <ArrowDown className="h-4 w-4 text-green-500" />
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  const formatCode = (code) => {
    if (!code) return 'N/A'
    const parts = code.split('.')
    return parts.length > 2 ? parts.slice(2).join('.') : code
  }

  // Datos para gráficos
  const timelineData = data?.cohorts?.map(c => ({
    name: c.shortLabel,
    issues: c.stats?.total || 0,
    critical: c.stats?.bySeverity?.critical || 0,
    high: c.stats?.bySeverity?.high || 0
  })) || []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <nav className="flex items-center space-x-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" /> Dashboard
              </Button>
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-gray-600 font-medium">Cohort Analyzer</span>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Layers className="h-8 w-8 text-indigo-600" />
            Cohort Analyzer
          </h1>
          <p className="text-gray-600 mt-1">
            Compara períodos para detectar cambios en los criterios de USCIS
          </p>
        </div>

        {/* Period Selector */}
        <Card className="mb-6 border-indigo-200 bg-indigo-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-indigo-600" />
              Comparar Períodos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-gray-100">Período A</Badge>
                <Select value={periodA} onValueChange={setPeriodA}>
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {data?.cohorts?.map(c => (
                      <SelectItem key={c.key} value={c.key}>
                        {c.label} ({c.stats?.total || 0} issues)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <ChevronRight className="h-5 w-5 text-gray-400" />

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-indigo-100 text-indigo-700">Período B</Badge>
                <Select value={periodB} onValueChange={setPeriodB}>
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {data?.cohorts?.map(c => (
                      <SelectItem key={c.key} value={c.key}>
                        {c.label} ({c.stats?.total || 0} issues)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 ml-4 pl-4 border-l">
                <span className="text-sm text-gray-500">Filtrar por tipo:</span>
                <Select value={outcomeType} onValueChange={setOutcomeType}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="RFE">Solo RFE</SelectItem>
                    <SelectItem value="NOID">Solo NOID</SelectItem>
                    <SelectItem value="Denial">Solo Denial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button variant="outline" onClick={fetchData} disabled={loading} className="ml-auto">
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
          </div>
        ) : comparison ? (
          <>
            {/* Comparison Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-500 mb-1">{comparison.periodA.shortLabel}</p>
                  <p className="text-3xl font-bold text-gray-700">{comparison.totalA}</p>
                  <p className="text-xs text-gray-400">issues</p>
                </CardContent>
              </Card>

              <Card className="border-indigo-200 bg-indigo-50">
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-500 mb-1">{comparison.periodB.shortLabel}</p>
                  <p className="text-3xl font-bold text-indigo-700">{comparison.totalB}</p>
                  <p className="text-xs text-gray-400">issues</p>
                </CardContent>
              </Card>

              <Card className={comparison.totalDiff > 0 ? 'border-red-200 bg-red-50' : comparison.totalDiff < 0 ? 'border-green-200 bg-green-50' : ''}>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-500 mb-1">Cambio</p>
                  <div className="flex items-center gap-2">
                    {getChangeIcon(comparison.totalDiff)}
                    <p className={`text-3xl font-bold ${comparison.totalDiff > 0 ? 'text-red-600' : comparison.totalDiff < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                      {comparison.totalDiff > 0 ? '+' : ''}{comparison.totalDiff}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-500 mb-1">Issues Emergentes</p>
                  <p className="text-3xl font-bold text-orange-600">{comparison.emerging.length}</p>
                  <p className="text-xs text-gray-400">{comparison.emerging.filter(e => e.isNew).length} nuevos</p>
                </CardContent>
              </Card>
            </div>

            {/* Insights */}
            {comparison.insights.length > 0 && (
              <Card className="mb-6 border-yellow-200 bg-yellow-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-yellow-800">
                    <Lightbulb className="h-5 w-5" />
                    Insights Clave ({comparison.insights.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {comparison.insights.map((insight, i) => (
                      <div 
                        key={i}
                        className={`p-4 rounded-lg border ${
                          insight.type === 'alert' ? 'bg-red-50 border-red-200' :
                          insight.type === 'warning' ? 'bg-orange-50 border-orange-200' :
                          insight.type === 'success' ? 'bg-green-50 border-green-200' :
                          'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <insight.icon className={`h-5 w-5 shrink-0 mt-0.5 ${
                            insight.type === 'alert' ? 'text-red-600' :
                            insight.type === 'warning' ? 'text-orange-600' :
                            insight.type === 'success' ? 'text-green-600' :
                            'text-blue-600'
                          }`} />
                          <div>
                            <p className="font-semibold text-sm text-gray-900">{insight.title}</p>
                            <p className="text-sm text-gray-600 mt-1">{insight.text}</p>
                            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                              <ChevronRight className="h-3 w-3" />
                              {insight.action}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Main Content Tabs */}
            <Tabs defaultValue="changes" className="space-y-6">
              <TabsList className="grid w-full max-w-md grid-cols-3">
                <TabsTrigger value="changes">¿Qué Cambió?</TabsTrigger>
                <TabsTrigger value="prongs">Por Prong</TabsTrigger>
                <TabsTrigger value="timeline">Tendencia</TabsTrigger>
              </TabsList>

              {/* Changes Tab */}
              <TabsContent value="changes">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Emerging Issues */}
                  <Card className="border-red-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-red-700">
                        <TrendingUp className="h-5 w-5" />
                        Issues en Aumento ({comparison.emerging.length})
                      </CardTitle>
                      <CardDescription>Requieren atención - están aumentando</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {comparison.emerging.length > 0 ? (
                        <div className="space-y-2">
                          {comparison.emerging.slice(0, 8).map((item, i) => (
                            <div key={i} className={`p-3 rounded-lg border ${item.isNew ? 'bg-red-100 border-red-300' : 'bg-red-50 border-red-200'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {item.isNew && <Badge className="bg-red-600 text-white text-xs">NUEVO</Badge>}
                                  <code className="text-xs font-mono">{formatCode(item.code)}</code>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-500">{item.countA}</span>
                                  <ArrowUp className="h-3 w-3 text-red-500" />
                                  <span className="text-sm font-bold text-red-600">{item.countB}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center py-8 text-gray-500">No hay issues en aumento</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Declining Issues */}
                  <Card className="border-green-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-green-700">
                        <TrendingDown className="h-5 w-5" />
                        Issues en Descenso ({comparison.declining.length})
                      </CardTitle>
                      <CardDescription>Buenas noticias - están disminuyendo</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {comparison.declining.length > 0 ? (
                        <div className="space-y-2">
                          {comparison.declining.slice(0, 8).map((item, i) => (
                            <div key={i} className="p-3 rounded-lg border bg-green-50 border-green-200">
                              <div className="flex items-center justify-between">
                                <code className="text-xs font-mono">{formatCode(item.code)}</code>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-500">{item.countA}</span>
                                  <ArrowDown className="h-3 w-3 text-green-500" />
                                  <span className="text-sm font-bold text-green-600">{item.countB}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center py-8 text-gray-500">No hay issues en descenso</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Prongs Tab */}
              <TabsContent value="prongs">
                <Card>
                  <CardHeader>
                    <CardTitle>Cambios por Prong</CardTitle>
                    <CardDescription>Cómo cambió el escrutinio en cada área del test Dhanasar</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {['P1', 'P2', 'P3'].map(prong => {
                        const change = comparison.prongChanges[prong]
                        const labels = {
                          P1: { name: 'Prong 1', desc: 'Mérito Sustancial e Importancia Nacional' },
                          P2: { name: 'Prong 2', desc: 'Bien Posicionado para Avanzar' },
                          P3: { name: 'Prong 3', desc: 'Balance de Factores' }
                        }
                        return (
                          <Card key={prong} className={`border-2 ${
                            change.diff > 0 ? 'border-red-200 bg-red-50' :
                            change.diff < 0 ? 'border-green-200 bg-green-50' :
                            'border-gray-200'
                          }`}>
                            <CardContent className="pt-6">
                              <div className="flex items-center justify-between mb-2">
                                <Badge style={{ backgroundColor: COLORS[prong], color: 'white' }}>{prong}</Badge>
                                {getChangeIcon(change.diff)}
                              </div>
                              <p className="font-semibold">{labels[prong].name}</p>
                              <p className="text-xs text-gray-500 mb-4">{labels[prong].desc}</p>
                              
                              <div className="flex items-end justify-between">
                                <div className="text-center">
                                  <p className="text-2xl font-bold text-gray-500">{change.countA}</p>
                                  <p className="text-xs text-gray-400">{comparison.periodA.shortLabel}</p>
                                </div>
                                <div className="text-center">
                                  <p className={`text-3xl font-bold ${
                                    change.diff > 0 ? 'text-red-600' : change.diff < 0 ? 'text-green-600' : 'text-gray-700'
                                  }`}>
                                    {change.countB}
                                  </p>
                                  <p className="text-xs text-gray-400">{comparison.periodB.shortLabel}</p>
                                </div>
                              </div>
                              
                              {change.pctChange !== 0 && (
                                <p className={`text-sm font-medium mt-3 text-center ${
                                  change.diff > 0 ? 'text-red-600' : 'text-green-600'
                                }`}>
                                  {change.pctChange > 0 ? '+' : ''}{change.pctChange}%
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>

                    {/* Severity Changes */}
                    <div className="mt-6 pt-6 border-t">
                      <h4 className="font-medium mb-4">Cambios por Severidad</h4>
                      <div className="grid grid-cols-4 gap-4">
                        {['critical', 'high', 'medium', 'low'].map(sev => {
                          const change = comparison.severityChanges[sev]
                          const labels = { critical: 'Crítico', high: 'Alto', medium: 'Medio', low: 'Bajo' }
                          return (
                            <div key={sev} className={`p-4 rounded-lg text-center ${
                              change.diff > 0 && sev === 'critical' ? 'bg-red-100' :
                              change.diff < 0 && sev === 'critical' ? 'bg-green-100' :
                              'bg-gray-50'
                            }`}>
                              <Badge className="mb-2" style={{ backgroundColor: COLORS[sev], color: 'white' }}>
                                {labels[sev]}
                              </Badge>
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-gray-500">{change.countA}</span>
                                {getChangeIcon(change.diff)}
                                <span className="font-bold">{change.countB}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Timeline Tab */}
              <TabsContent value="timeline">
                <Card>
                  <CardHeader>
                    <CardTitle>Evolución en {year}</CardTitle>
                    <CardDescription>Tendencia de issues por trimestre</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={timelineData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="issues" fill="#6366f1" name="Total Issues" />
                          <Bar dataKey="critical" fill={COLORS.critical} name="Críticos" />
                          <Bar dataKey="high" fill={COLORS.high} name="Altos" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <Card>
            <CardContent className="py-16">
              <div className="text-center text-gray-500">
                <Layers className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p>Selecciona dos períodos para comparar</p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
