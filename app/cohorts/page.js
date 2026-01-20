'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft, Loader2, TrendingUp, TrendingDown, Minus,
  BarChart3, Calendar, Building2, RefreshCw, ArrowUp, ArrowDown,
  AlertTriangle, PieChart, Layers, Activity
} from 'lucide-react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart as RechartsPie, Pie, Cell
} from 'recharts'

const COLORS = {
  P1: '#8b5cf6',
  P2: '#3b82f6',
  P3: '#10b981',
  EVIDENCE: '#f59e0b',
  COHERENCE: '#ec4899',
  PROCEDURAL: '#6b7280',
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e'
}

const PRONG_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#6b7280']

export default function CohortsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [groupBy, setGroupBy] = useState('quarter')
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [availableYears, setAvailableYears] = useState([])

  useEffect(() => {
    fetchCohortData()
  }, [groupBy, year])

  const fetchCohortData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ groupBy, year })
      const response = await fetch(`/api/trends/cohorts?${params}`)
      
      if (!response.ok) throw new Error('Error al cargar datos')

      const result = await response.json()
      setData(result)
      
      if (result.filters?.availableYears?.length > 0) {
        setAvailableYears(result.filters.availableYears)
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const getChangeIcon = (direction) => {
    if (direction === 'up') return <ArrowUp className="h-4 w-4 text-red-500" />
    if (direction === 'down') return <ArrowDown className="h-4 w-4 text-green-500" />
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  const getChangeColor = (change) => {
    if (change > 20) return 'text-red-600'
    if (change > 0) return 'text-orange-500'
    if (change < -20) return 'text-green-600'
    if (change < 0) return 'text-green-500'
    return 'text-gray-500'
  }

  const getTrendIcon = (trend) => {
    if (trend === 'increasing') return <TrendingUp className="h-5 w-5 text-red-500" />
    if (trend === 'decreasing') return <TrendingDown className="h-5 w-5 text-green-500" />
    return <Minus className="h-5 w-5 text-gray-400" />
  }

  // Preparar datos para gráficos
  const chartData = data?.cohorts?.map(c => ({
    name: c.shortLabel,
    fullName: c.label,
    total: c.stats.total,
    critical: c.stats.bySeverity.critical,
    high: c.stats.bySeverity.high,
    medium: c.stats.bySeverity.medium,
    low: c.stats.bySeverity.low,
    P1: c.stats.byProng.P1,
    P2: c.stats.byProng.P2,
    P3: c.stats.byProng.P3,
    severityScore: c.stats.severityScore
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
            <Link href="/trends">
              <Button variant="ghost" size="sm">Tendencias</Button>
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-gray-600 font-medium">Cohort Analyzer</span>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Layers className="h-8 w-8 text-indigo-600" />
              Cohort Analyzer
            </h1>
            <p className="text-gray-600 mt-1">
              Compara tendencias de issues por períodos de tiempo o segmentos
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Agrupar por:</span>
                <Select value={groupBy} onValueChange={setGroupBy}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Por Mes</SelectItem>
                    <SelectItem value="quarter">Por Trimestre</SelectItem>
                    <SelectItem value="year">Por Año</SelectItem>
                    <SelectItem value="industry">Por Industria</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(groupBy === 'month' || groupBy === 'quarter') && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Año:</span>
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(availableYears.length > 0 ? availableYears : [2026, 2025, 2024]).map(y => (
                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button variant="outline" onClick={fetchCohortData} disabled={loading}>
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
        ) : data ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Issues</p>
                      <p className="text-3xl font-bold">{data.summary?.totalIssues || 0}</p>
                    </div>
                    <AlertTriangle className="h-10 w-10 text-orange-500 opacity-50" />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Promedio: {data.summary?.avgPerCohort || 0} por {groupBy === 'month' ? 'mes' : groupBy === 'quarter' ? 'trimestre' : 'período'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Períodos Analizados</p>
                      <p className="text-3xl font-bold">{data.summary?.cohortsAnalyzed || 0}</p>
                    </div>
                    <Calendar className="h-10 w-10 text-indigo-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Pico de Issues</p>
                      <p className="text-xl font-bold">{data.summary?.peakCohort?.label}</p>
                      <p className="text-sm text-gray-400">{data.summary?.peakCohort?.count} issues</p>
                    </div>
                    <BarChart3 className="h-10 w-10 text-red-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>

              <Card className={`border-2 ${
                data.summary?.trend === 'increasing' ? 'border-red-200 bg-red-50' :
                data.summary?.trend === 'decreasing' ? 'border-green-200 bg-green-50' :
                'border-gray-200'
              }`}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Tendencia</p>
                      <p className="text-xl font-bold">{data.summary?.trendLabel}</p>
                    </div>
                    {getTrendIcon(data.summary?.trend)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Charts */}
            <Tabs defaultValue="timeline" className="space-y-6">
              <TabsList className="grid w-full max-w-lg grid-cols-3">
                <TabsTrigger value="timeline">Línea de Tiempo</TabsTrigger>
                <TabsTrigger value="comparison">Comparación</TabsTrigger>
                <TabsTrigger value="prongs">Por Prong</TabsTrigger>
              </TabsList>

              {/* Timeline Tab */}
              <TabsContent value="timeline">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Total Issues Over Time */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Issues por {groupBy === 'month' ? 'Mes' : groupBy === 'quarter' ? 'Trimestre' : 'Período'}</CardTitle>
                      <CardDescription>Evolución del volumen total de issues</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip 
                              formatter={(value, name) => [value, name === 'total' ? 'Total Issues' : name]}
                              labelFormatter={(label) => chartData.find(d => d.name === label)?.fullName || label}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="total" 
                              stroke="#6366f1" 
                              fill="#6366f1" 
                              fillOpacity={0.3}
                              name="Total Issues"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Severity Score Over Time */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Índice de Severidad</CardTitle>
                      <CardDescription>Ponderación de severidad (0-100, mayor = más severo)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis domain={[0, 100]} />
                            <Tooltip />
                            <Line 
                              type="monotone" 
                              dataKey="severityScore" 
                              stroke="#ef4444" 
                              strokeWidth={2}
                              dot={{ fill: '#ef4444' }}
                              name="Severidad"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Stacked Bar - By Severity */}
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Distribución por Severidad</CardTitle>
                      <CardDescription>Desglose de issues por nivel de severidad en cada período</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="critical" stackId="a" fill={COLORS.critical} name="Crítico" />
                            <Bar dataKey="high" stackId="a" fill={COLORS.high} name="Alto" />
                            <Bar dataKey="medium" stackId="a" fill={COLORS.medium} name="Medio" />
                            <Bar dataKey="low" stackId="a" fill={COLORS.low} name="Bajo" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Comparison Tab */}
              <TabsContent value="comparison">
                <Card>
                  <CardHeader>
                    <CardTitle>Cambios Entre Períodos</CardTitle>
                    <CardDescription>Comparación secuencial de volumen y severidad</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.comparisons && data.comparisons.length > 0 ? (
                      <div className="space-y-4">
                        {data.comparisons.map((comp, idx) => (
                          <div 
                            key={idx}
                            className={`p-4 rounded-lg border ${
                              comp.totalChange > 20 ? 'bg-red-50 border-red-200' :
                              comp.totalChange < -20 ? 'bg-green-50 border-green-200' :
                              'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{comp.fromLabel}</Badge>
                                <span className="text-gray-400">→</span>
                                <Badge variant="outline">{comp.toLabel}</Badge>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1">
                                  {getChangeIcon(comp.totalDirection)}
                                  <span className={`font-bold ${getChangeColor(comp.totalChange)}`}>
                                    {comp.totalChange > 0 ? '+' : ''}{comp.totalChange}%
                                  </span>
                                  <span className="text-xs text-gray-500">issues</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {getChangeIcon(comp.severityDirection)}
                                  <span className={`font-bold ${
                                    comp.severityChange > 0 ? 'text-red-600' : 
                                    comp.severityChange < 0 ? 'text-green-600' : 'text-gray-500'
                                  }`}>
                                    {comp.severityChange > 0 ? '+' : ''}{comp.severityChange}
                                  </span>
                                  <span className="text-xs text-gray-500">severidad</span>
                                </div>
                              </div>
                            </div>

                            {/* Prong changes */}
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(comp.prongChanges)
                                .filter(([_, data]) => data.change !== 0)
                                .map(([prong, data]) => (
                                  <Badge 
                                    key={prong}
                                    className={`${
                                      data.direction === 'up' ? 'bg-red-100 text-red-700' :
                                      data.direction === 'down' ? 'bg-green-100 text-green-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}
                                  >
                                    {prong}: {data.change > 0 ? '+' : ''}{data.change}%
                                  </Badge>
                                ))
                              }
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <Activity className="h-12 w-12 mx-auto mb-2 opacity-30" />
                        <p>No hay suficientes datos para comparar</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Prongs Tab */}
              <TabsContent value="prongs">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Stacked Bar by Prong */}
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Issues por Prong</CardTitle>
                      <CardDescription>Distribución por área del test Dhanasar</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="P1" fill={COLORS.P1} name="P1 - Mérito" />
                            <Bar dataKey="P2" fill={COLORS.P2} name="P2 - Posición" />
                            <Bar dataKey="P3" fill={COLORS.P3} name="P3 - Balance" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top Issues by Cohort */}
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Top Issues por Período</CardTitle>
                      <CardDescription>Los 5 issues más frecuentes en cada período</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-3 font-medium text-gray-600">Período</th>
                              <th className="text-left py-2 px-3 font-medium text-gray-600">Top Issues</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.cohorts?.map(cohort => (
                              <tr key={cohort.key} className="border-b hover:bg-gray-50">
                                <td className="py-3 px-3">
                                  <span className="font-medium">{cohort.shortLabel}</span>
                                  <span className="text-gray-400 text-xs ml-2">({cohort.stats.total})</span>
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex flex-wrap gap-1">
                                    {cohort.stats.topCodes.slice(0, 3).map((item, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">
                                        {item.code.split('.').slice(-1)[0]} ({item.count})
                                      </Badge>
                                    ))}
                                    {cohort.stats.topCodes.length === 0 && (
                                      <span className="text-gray-400 text-xs">Sin datos</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>

            {/* Cohort Details Table */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Detalle por {groupBy === 'month' ? 'Mes' : groupBy === 'quarter' ? 'Trimestre' : 'Período'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Período</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Total</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Crítico</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Alto</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Medio</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Bajo</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">P1</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">P2</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">P3</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Severidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.cohorts?.map(cohort => (
                        <tr key={cohort.key} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{cohort.label}</td>
                          <td className="py-3 px-4 text-center font-bold">{cohort.stats.total}</td>
                          <td className="py-3 px-4 text-center">
                            <Badge className="bg-red-100 text-red-700">{cohort.stats.bySeverity.critical}</Badge>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge className="bg-orange-100 text-orange-700">{cohort.stats.bySeverity.high}</Badge>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge className="bg-yellow-100 text-yellow-700">{cohort.stats.bySeverity.medium}</Badge>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge className="bg-green-100 text-green-700">{cohort.stats.bySeverity.low}</Badge>
                          </td>
                          <td className="py-3 px-4 text-center">{cohort.stats.byProng.P1}</td>
                          <td className="py-3 px-4 text-center">{cohort.stats.byProng.P2}</td>
                          <td className="py-3 px-4 text-center">{cohort.stats.byProng.P3}</td>
                          <td className="py-3 px-4 text-center">
                            <Badge className={`${
                              cohort.stats.severityScore >= 70 ? 'bg-red-100 text-red-700' :
                              cohort.stats.severityScore >= 50 ? 'bg-orange-100 text-orange-700' :
                              cohort.stats.severityScore >= 30 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {cohort.stats.severityScore}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-16">
              <div className="text-center text-gray-500">
                <Layers className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p>No hay datos disponibles</p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
