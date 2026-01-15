'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Brain, ArrowLeft, TrendingUp, BarChart3, AlertTriangle, 
  FileText, FolderOpen, PieChart, ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react'
import Link from 'next/link'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts'
import { TAXONOMY, getTaxonomyDetails } from '@/lib/taxonomy'

const COLORS = ['#DC2626', '#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

const SEVERITY_COLORS = {
  critical: '#DC2626',
  high: '#F59E0B', 
  medium: '#3B82F6',
  low: '#10B981'
}

export default function TrendsClient({ issues, stats }) {
  const [timeRange, setTimeRange] = useState('6m')
  const [selectedProng, setSelectedProng] = useState('all')

  // Procesar datos para gráficas
  const processedData = useMemo(() => {
    // Agrupar issues por mes
    const byMonth = {}
    const byTaxonomy = {}
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 }
    const byProng = { P1: 0, P2: 0, P3: 0 }

    issues.forEach(issue => {
      // Por mes
      const date = new Date(issue.created_at)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const monthName = date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
      
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = { month: monthName, count: 0, critical: 0, high: 0, medium: 0, low: 0 }
      }
      byMonth[monthKey].count++
      byMonth[monthKey][issue.severity]++

      // Por taxonomía
      if (!byTaxonomy[issue.taxonomy_code]) {
        const details = getTaxonomyDetails(issue.taxonomy_code)
        byTaxonomy[issue.taxonomy_code] = {
          code: issue.taxonomy_code,
          label: details?.label || issue.taxonomy_code,
          count: 0,
          severity: issue.severity
        }
      }
      byTaxonomy[issue.taxonomy_code].count++

      // Por severidad
      bySeverity[issue.severity]++

      // Por prong
      const prong = issue.taxonomy_code?.split('.')[1]
      if (prong && byProng[prong] !== undefined) {
        byProng[prong]++
      }
    })

    // Convertir a arrays ordenados
    const monthlyData = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month))
    const taxonomyData = Object.values(byTaxonomy).sort((a, b) => b.count - a.count).slice(0, 10)
    const severityData = Object.entries(bySeverity).map(([name, value]) => ({ name, value }))
    const prongData = Object.entries(byProng).map(([name, value]) => ({ 
      name, 
      value,
      fullName: name === 'P1' ? 'Mérito/Importancia' : name === 'P2' ? 'Bien Posicionado' : 'Balance Test'
    }))

    return { monthlyData, taxonomyData, severityData, prongData }
  }, [issues])

  // Calcular drift (comparar últimos 60 días vs 60-120 días)
  const driftAnalysis = useMemo(() => {
    const now = new Date()
    const days60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
    const days120 = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000)

    const recent = issues.filter(i => new Date(i.created_at) >= days60)
    const previous = issues.filter(i => {
      const date = new Date(i.created_at)
      return date >= days120 && date < days60
    })

    // Contar por taxonomía en cada período
    const recentCounts = {}
    const previousCounts = {}

    recent.forEach(i => {
      recentCounts[i.taxonomy_code] = (recentCounts[i.taxonomy_code] || 0) + 1
    })
    previous.forEach(i => {
      previousCounts[i.taxonomy_code] = (previousCounts[i.taxonomy_code] || 0) + 1
    })

    // Calcular cambios
    const allCodes = new Set([...Object.keys(recentCounts), ...Object.keys(previousCounts)])
    const changes = []

    allCodes.forEach(code => {
      const recentCount = recentCounts[code] || 0
      const previousCount = previousCounts[code] || 0
      const change = previousCount > 0 
        ? ((recentCount - previousCount) / previousCount * 100).toFixed(0)
        : recentCount > 0 ? 100 : 0

      if (Math.abs(change) >= 20 || recentCount >= 2) {
        const details = getTaxonomyDetails(code)
        changes.push({
          code,
          label: details?.label || code,
          recentCount,
          previousCount,
          change: Number(change),
          trend: change > 20 ? 'up' : change < -20 ? 'down' : 'stable'
        })
      }
    })

    return changes.sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 8)
  }, [issues])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-navy-primary border-b border-navy-light">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-3">
            <Brain className="h-8 w-8 text-gold-primary" />
            <span className="text-xl font-bold text-gold-subtle">Cerebro Visas</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Dashboard
            </Button>
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <TrendingUp className="mr-3 h-8 w-8 text-blue-600" />
                Dashboard de Tendencias
              </h1>
              <p className="text-gray-600 mt-1">
                Análisis de motivos RFE/NOID y detección de cambios en criterios USCIS
              </p>
            </div>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1m">Último mes</SelectItem>
                <SelectItem value="3m">Últimos 3 meses</SelectItem>
                <SelectItem value="6m">Últimos 6 meses</SelectItem>
                <SelectItem value="1y">Último año</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Casos</p>
                  <p className="text-3xl font-bold">{stats.totalCases}</p>
                </div>
                <FolderOpen className="h-10 w-10 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Documentos</p>
                  <p className="text-3xl font-bold">{stats.totalDocuments}</p>
                </div>
                <FileText className="h-10 w-10 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Issues Detectados</p>
                  <p className="text-3xl font-bold">{stats.totalIssues}</p>
                </div>
                <AlertTriangle className="h-10 w-10 text-orange-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Período</p>
                  <p className="text-3xl font-bold">6M</p>
                </div>
                <BarChart3 className="h-10 w-10 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview">Vista General</TabsTrigger>
            <TabsTrigger value="taxonomy">Por Taxonomía</TabsTrigger>
            <TabsTrigger value="drift">Drift Detector</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Issues por Mes */}
              <Card>
                <CardHeader>
                  <CardTitle>Issues por Mes</CardTitle>
                  <CardDescription>Evolución temporal de motivos detectados</CardDescription>
                </CardHeader>
                <CardContent>
                  {processedData.monthlyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={processedData.monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Area type="monotone" dataKey="critical" stackId="1" stroke="#DC2626" fill="#DC2626" name="Crítico" />
                        <Area type="monotone" dataKey="high" stackId="1" stroke="#F59E0B" fill="#F59E0B" name="Alto" />
                        <Area type="monotone" dataKey="medium" stackId="1" stroke="#3B82F6" fill="#3B82F6" name="Medio" />
                        <Area type="monotone" dataKey="low" stackId="1" stroke="#10B981" fill="#10B981" name="Bajo" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No hay datos suficientes</p>
                        <p className="text-sm">Sube documentos para ver tendencias</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Por Severidad */}
              <Card>
                <CardHeader>
                  <CardTitle>Distribución por Severidad</CardTitle>
                  <CardDescription>Clasificación de issues por nivel de impacto</CardDescription>
                </CardHeader>
                <CardContent>
                  {processedData.severityData.some(d => d.value > 0) ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPie>
                        <Pie
                          data={processedData.severityData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {processedData.severityData.map((entry, index) => (
                            <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPie>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <PieChart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No hay datos suficientes</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Por Prong */}
              <Card>
                <CardHeader>
                  <CardTitle>Issues por Prong (Dhanasar)</CardTitle>
                  <CardDescription>Distribución según los 3 criterios NIW</CardDescription>
                </CardHeader>
                <CardContent>
                  {processedData.prongData.some(d => d.value > 0) ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={processedData.prongData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={40} />
                        <Tooltip 
                          formatter={(value, name, props) => [value, props.payload.fullName]}
                        />
                        <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]}>
                          {processedData.prongData.map((entry, index) => (
                            <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No hay datos suficientes</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Leyenda de Prongs */}
              <Card>
                <CardHeader>
                  <CardTitle>Criterios NIW (Dhanasar)</CardTitle>
                  <CardDescription>Referencia de los 3 prongs evaluados</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-900">P1 - Mérito Sustancial e Importancia Nacional</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      El endeavor propuesto tiene mérito sustancial e importancia para EE.UU.
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-900">P2 - Bien Posicionado para Avanzar</h4>
                    <p className="text-sm text-green-700 mt-1">
                      El beneficiario está bien posicionado para avanzar el endeavor propuesto.
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <h4 className="font-semibold text-purple-900">P3 - Balance Test (Waiver)</h4>
                    <p className="text-sm text-purple-700 mt-1">
                      En balance, sería beneficioso eximir el requisito de oferta laboral.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Taxonomy Tab */}
          <TabsContent value="taxonomy" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Motivos Más Frecuentes</CardTitle>
                <CardDescription>Códigos de taxonomía con mayor incidencia</CardDescription>
              </CardHeader>
              <CardContent>
                {processedData.taxonomyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={processedData.taxonomyData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="code" type="category" width={200} tick={{ fontSize: 11 }} />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            return (
                              <div className="bg-white p-3 rounded-lg shadow-lg border">
                                <p className="font-semibold">{data.label}</p>
                                <p className="text-sm text-gray-600">{data.code}</p>
                                <p className="text-lg font-bold mt-1">{data.count} ocurrencias</p>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {processedData.taxonomyData.map((entry, index) => (
                          <Cell key={entry.code} fill={SEVERITY_COLORS[entry.severity] || COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No hay datos de taxonomía</p>
                      <p className="text-sm">Procesa documentos con IA para ver análisis</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Drift Detector Tab */}
          <TabsContent value="drift" className="space-y-6">
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center text-orange-900">
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  Drift Detector - Cambios en Criterios USCIS
                </CardTitle>
                <CardDescription className="text-orange-700">
                  Comparación: Últimos 60 días vs 60-120 días anteriores
                </CardDescription>
              </CardHeader>
              <CardContent>
                {driftAnalysis.length > 0 ? (
                  <div className="space-y-3">
                    {driftAnalysis.map((item, idx) => (
                      <div 
                        key={item.code}
                        className={`p-4 rounded-lg border ${
                          item.trend === 'up' ? 'bg-red-50 border-red-200' :
                          item.trend === 'down' ? 'bg-green-50 border-green-200' :
                          'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <code className="text-xs bg-white px-2 py-1 rounded border">
                              {item.code}
                            </code>
                            <p className="font-medium mt-1">{item.label}</p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center space-x-2">
                              {item.trend === 'up' ? (
                                <ArrowUpRight className="h-5 w-5 text-red-600" />
                              ) : item.trend === 'down' ? (
                                <ArrowDownRight className="h-5 w-5 text-green-600" />
                              ) : (
                                <Minus className="h-5 w-5 text-gray-400" />
                              )}
                              <span className={`text-xl font-bold ${
                                item.trend === 'up' ? 'text-red-600' :
                                item.trend === 'down' ? 'text-green-600' :
                                'text-gray-600'
                              }`}>
                                {item.change > 0 ? '+' : ''}{item.change}%
                              </span>
                            </div>
                            <p className="text-sm text-gray-500">
                              {item.previousCount} → {item.recentCount}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No hay suficientes datos para detectar drift</p>
                    <p className="text-sm">Se necesitan al menos 120 días de datos</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>¿Qué es el Drift Detector?</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  El <strong>Drift Detector</strong> compara los motivos de RFE de los últimos 60 días 
                  contra los 60 días anteriores para identificar cambios en los criterios de USCIS.
                </p>
                <ul className="mt-2 space-y-1">
                  <li><span className="text-red-600 font-semibold">↑ Aumento</span>: Este motivo está apareciendo más frecuentemente (USCIS más estricto)</li>
                  <li><span className="text-green-600 font-semibold">↓ Disminución</span>: Este motivo está apareciendo menos (USCIS más flexible)</li>
                  <li><span className="text-gray-600 font-semibold">— Estable</span>: Sin cambios significativos</li>
                </ul>
                <p className="mt-4 text-sm text-gray-500">
                  * Cambios ≥20% se consideran significativos. Actualización de enero 2025 puede afectar estos criterios.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
