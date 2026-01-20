'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Brain, TrendingUp, AlertTriangle, FileText, 
  BarChart3, PieChart, Loader2, RefreshCw,
  ArrowUp, ArrowDown, Minus, Building2, ArrowLeft,
  Activity, Zap, Bell, TrendingDown, Sparkles, AlertOctagon,
  Filter, X, Calendar, SlidersHorizontal
} from 'lucide-react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts'

const COLORS = {
  critical: '#ef4444',
  high: '#f97316', 
  medium: '#eab308',
  low: '#22c55e',
  P1: '#8b5cf6',
  P2: '#3b82f6',
  P3: '#10b981',
  EVIDENCE: '#f59e0b',
  COHERENCE: '#ec4899',
  PROCEDURAL: '#6b7280'
}

const PRONG_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#6b7280']

export default function TrendsClient() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('6months')
  const [error, setError] = useState(null)
  
  // Filtros state
  const [filters, setFilters] = useState({
    visaCategory: '',
    serviceCenter: '',
    outcomeType: '',
    dateFrom: '',
    dateTo: ''
  })
  const [filterOptions, setFilterOptions] = useState({
    visaCategories: [],
    serviceCenters: [],
    outcomeTypes: ['RFE', 'NOID', 'Denial']
  })
  const [showFilters, setShowFilters] = useState(false)
  
  // Drift Detector state
  const [driftData, setDriftData] = useState(null)
  const [driftLoading, setDriftLoading] = useState(false)
  const [driftConfig, setDriftConfig] = useState({ recentDays: '60', baselineDays: '180' })
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchTrends()
  }, [period, filters])

  useEffect(() => {
    if (activeTab === 'drift') {
      fetchDriftData()
    }
  }, [activeTab, driftConfig])

  const fetchTrends = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/trends?period=${period}`)
      
      if (!response.ok) {
        throw new Error('Error al cargar tendencias')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchDriftData = async () => {
    try {
      setDriftLoading(true)
      const response = await fetch(
        `/api/trends/drift?recentDays=${driftConfig.recentDays}&baselineDays=${driftConfig.baselineDays}`
      )
      
      if (!response.ok) {
        throw new Error('Error al cargar drift data')
      }

      const result = await response.json()
      setDriftData(result)
    } catch (err) {
      console.error('Error fetching drift:', err)
    } finally {
      setDriftLoading(false)
    }
  }

  const getSeverityColor = (severity) => COLORS[severity] || '#6b7280'
  
  const formatMonth = (monthStr) => {
    const [year, month] = monthStr.split('-')
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    return `${months[parseInt(month) - 1]} ${year.slice(2)}`
  }

  const getTaxonomyShortName = (code) => {
    if (!code) return 'N/A'
    const parts = code.split('.')
    return parts.length > 2 ? parts.slice(2).join('.') : code
  }

  const getDriftScoreColor = (score) => {
    if (score >= 70) return 'text-red-600'
    if (score >= 40) return 'text-orange-500'
    if (score >= 20) return 'text-yellow-500'
    return 'text-green-500'
  }

  const getDriftScoreBg = (score) => {
    if (score >= 70) return 'bg-red-100 border-red-300'
    if (score >= 40) return 'bg-orange-100 border-orange-300'
    if (score >= 20) return 'bg-yellow-100 border-yellow-300'
    return 'bg-green-100 border-green-300'
  }

  const getDirectionIcon = (direction) => {
    if (direction === 'up') return <ArrowUp className="h-4 w-4 text-red-500" />
    if (direction === 'down') return <ArrowDown className="h-4 w-4 text-green-500" />
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando tendencias...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-navy-primary border-b border-navy-light">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-3">
            <Brain className="h-8 w-8 text-gold-primary" />
            <span className="text-xl font-bold text-gold-subtle">Cerebro Visas</span>
          </Link>
          <nav className="flex items-center space-x-4">
            <Link href="/documents">
              <Button variant="ghost" className="text-gray-300 hover:text-white">
                <FileText className="mr-2 h-4 w-4" /> Documentos
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Back Button */}
        <Link href="/dashboard">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Dashboard
          </Button>
        </Link>

        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              Dashboard de Tendencias
            </h1>
            <p className="text-gray-600 mt-1">
              Análisis de issues y patrones en RFE/NOID/Denial
            </p>
          </div>
        </div>

        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-700">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Vista General
            </TabsTrigger>
            <TabsTrigger value="drift" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Drift Detector
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview">
            {/* Period Selector */}
            <div className="flex items-center gap-4 mb-6">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3months">Últimos 3 meses</SelectItem>
                  <SelectItem value="6months">Últimos 6 meses</SelectItem>
                  <SelectItem value="1year">Último año</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={fetchTrends}>
                <RefreshCw className="h-4 w-4 mr-2" /> Actualizar
              </Button>
            </div>

            {data && (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Total Documentos</p>
                          <p className="text-3xl font-bold text-gray-900">{data.totalDocuments}</p>
                        </div>
                        <FileText className="h-10 w-10 text-blue-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Issues</p>
                      <p className="text-3xl font-bold text-gray-900">{data.totalIssues}</p>
                    </div>
                    <AlertTriangle className="h-10 w-10 text-orange-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">RFEs</p>
                      <p className="text-3xl font-bold text-orange-600">{data.documentsByType?.RFE || 0}</p>
                    </div>
                    <Badge className="bg-orange-100 text-orange-800">RFE</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Denegaciones</p>
                      <p className="text-3xl font-bold text-red-600">
                        {(data.documentsByType?.NOID || 0) + (data.documentsByType?.Denial || 0)}
                      </p>
                    </div>
                    <Badge className="bg-red-100 text-red-800">NOID/Denial</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Top Issues */}
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Top Issues Más Frecuentes
                  </CardTitle>
                  <CardDescription>
                    Issues que más se repiten en los documentos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.topIssues && data.topIssues.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={data.topIssues.slice(0, 8)} 
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis 
                            type="category" 
                            dataKey="code" 
                            width={150}
                            tick={{ fontSize: 11 }}
                            tickFormatter={getTaxonomyShortName}
                          />
                          <Tooltip 
                            formatter={(value, name) => [value, 'Ocurrencias']}
                            labelFormatter={(label) => `Issue: ${label}`}
                          />
                          <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                        <p>No hay datos suficientes</p>
                        <p className="text-sm">Sube documentos RFE/NOID para ver tendencias</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Prong Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-purple-600" />
                    Distribución por Prong
                  </CardTitle>
                  <CardDescription>
                    Qué prongs del test Dhanasar son más cuestionados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.prongDistribution && data.prongDistribution.length > 0 ? (
                    <div className="h-96">
                      <ResponsiveContainer width="100%" height="70%">
                        <RechartsPie>
                          <Pie
                            data={data.prongDistribution}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ prong, percentage }) => `${prong} (${percentage}%)`}
                            outerRadius={90}
                            fill="#8884d8"
                            dataKey="count"
                            nameKey="label"
                          >
                            {data.prongDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[entry.prong] || PRONG_COLORS[index % PRONG_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value, name, props) => [value + ' issues', props.payload.label]} />
                        </RechartsPie>
                      </ResponsiveContainer>
                      {/* Leyenda personalizada */}
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        {data.prongDistribution.map((item, index) => (
                          <div key={item.prong} className="flex items-center gap-2">
                            <span 
                              className="w-3 h-3 rounded-full shrink-0" 
                              style={{ backgroundColor: COLORS[item.prong] || PRONG_COLORS[index % PRONG_COLORS.length] }}
                            />
                            <span className="text-gray-700 truncate">
                              <strong>{item.prong}:</strong> {item.label.replace('Prong 1 - ', '').replace('Prong 2 - ', '').replace('Prong 3 - ', '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <PieChart className="h-12 w-12 mx-auto mb-2 opacity-30" />
                        <p>No hay datos de prongs</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Issues by Month */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Issues por Mes
                  </CardTitle>
                  <CardDescription>
                    Evolución temporal de issues identificados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.issuesByMonth && data.issuesByMonth.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.issuesByMonth}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" tickFormatter={formatMonth} />
                          <YAxis />
                          <Tooltip 
                            labelFormatter={formatMonth}
                            formatter={(value, name) => {
                              const labels = { total: 'Total', critical: 'Críticos', high: 'Altos', medium: 'Medios', low: 'Bajos' }
                              return [value, labels[name] || name]
                            }}
                          />
                          <Legend />
                          <Area type="monotone" dataKey="critical" stackId="1" stroke={COLORS.critical} fill={COLORS.critical} name="Críticos" />
                          <Area type="monotone" dataKey="high" stackId="1" stroke={COLORS.high} fill={COLORS.high} name="Altos" />
                          <Area type="monotone" dataKey="medium" stackId="1" stroke={COLORS.medium} fill={COLORS.medium} name="Medios" />
                          <Area type="monotone" dataKey="low" stackId="1" stroke={COLORS.low} fill={COLORS.low} name="Bajos" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-30" />
                        <p>No hay datos históricos</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Severity Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    Distribución por Severidad
                  </CardTitle>
                  <CardDescription>
                    Clasificación de issues por nivel de criticidad
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.severityDistribution && data.severityDistribution.length > 0 ? (
                    <div className="space-y-4 pt-4">
                      {data.severityDistribution.map((item) => (
                        <div key={item.severity} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <span 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: getSeverityColor(item.severity) }}
                              />
                              <span className="font-medium">{item.label}</span>
                            </span>
                            <span className="text-gray-600">{item.count} ({item.percentage}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                              className="h-3 rounded-full transition-all"
                              style={{ 
                                width: `${item.percentage}%`,
                                backgroundColor: getSeverityColor(item.severity)
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-60 flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-30" />
                        <p>No hay datos de severidad</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Top Issues List */}
            <Card>
              <CardHeader>
                <CardTitle>Detalle de Issues Más Frecuentes</CardTitle>
                <CardDescription>
                  Lista completa con códigos de taxonomía y frecuencia
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.topIssues && data.topIssues.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium text-gray-600">#</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Código Taxonomía</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Ocurrencias</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">%</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Severidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topIssues.map((issue, idx) => (
                          <tr key={issue.code} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4 text-gray-500">{idx + 1}</td>
                            <td className="py-3 px-4">
                              <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                                {issue.code}
                              </code>
                            </td>
                            <td className="py-3 px-4 font-medium">{issue.count}</td>
                            <td className="py-3 px-4">
                              <span className="text-blue-600 font-medium">{issue.percentage}%</span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-1">
                                {issue.severities.critical > 0 && (
                                  <Badge className="bg-red-100 text-red-700 text-xs">
                                    {issue.severities.critical} críticos
                                  </Badge>
                                )}
                                {issue.severities.high > 0 && (
                                  <Badge className="bg-orange-100 text-orange-700 text-xs">
                                    {issue.severities.high} altos
                                  </Badge>
                                )}
                                {issue.severities.medium > 0 && (
                                  <Badge className="bg-yellow-100 text-yellow-700 text-xs">
                                    {issue.severities.medium} medios
                                  </Badge>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>No hay issues registrados</p>
                    <p className="text-sm mt-1">Sube documentos RFE/NOID/Denial para comenzar el análisis</p>
                  </div>
                )}
              </CardContent>
            </Card>
              </>
            )}
          </TabsContent>

          {/* DRIFT DETECTOR TAB */}
          <TabsContent value="drift">
            {/* Drift Config */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Período reciente:</span>
                <Select value={driftConfig.recentDays} onValueChange={(v) => setDriftConfig({...driftConfig, recentDays: v})}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 días</SelectItem>
                    <SelectItem value="60">60 días</SelectItem>
                    <SelectItem value="90">90 días</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">vs Período base:</span>
                <Select value={driftConfig.baselineDays} onValueChange={(v) => setDriftConfig({...driftConfig, baselineDays: v})}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="180">180 días</SelectItem>
                    <SelectItem value="365">1 año</SelectItem>
                    <SelectItem value="730">2 años</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={fetchDriftData} disabled={driftLoading}>
                {driftLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Analizar
              </Button>
            </div>

            {driftLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
                  <p className="mt-4 text-gray-600">Analizando cambios en criterios...</p>
                </div>
              </div>
            ) : driftData ? (
              <>
                {/* Drift Score Card */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <Card className={`border-2 ${getDriftScoreBg(driftData.overallDriftScore)}`}>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <Activity className={`h-10 w-10 mx-auto mb-2 ${getDriftScoreColor(driftData.overallDriftScore)}`} />
                        <p className="text-sm text-gray-600 mb-1">Índice de Cambio</p>
                        <p className={`text-5xl font-bold ${getDriftScoreColor(driftData.overallDriftScore)}`}>
                          {driftData.overallDriftScore}
                        </p>
                        <p className="text-sm mt-2 font-medium">{driftData.summary?.statusLabel}</p>
                        <p className="text-xs text-gray-500 mt-1">{driftData.summary?.statusDescription}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Período Reciente</span>
                          <Badge variant="outline">{driftData.periods?.recent?.label}</Badge>
                        </div>
                        <p className="text-2xl font-bold">{driftData.periods?.recent?.totalIssues} issues</p>
                        <p className="text-xs text-gray-500">{driftData.periods?.recent?.uniqueCodes} tipos únicos</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Período Base</span>
                          <Badge variant="outline">{driftData.periods?.baseline?.label}</Badge>
                        </div>
                        <p className="text-2xl font-bold">{driftData.periods?.baseline?.totalIssues} issues</p>
                        <p className="text-xs text-gray-500">{driftData.periods?.baseline?.uniqueCodes} tipos únicos</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Alerts */}
                {driftData.alerts && driftData.alerts.length > 0 && (
                  <Card className="mb-8 border-orange-200 bg-orange-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-orange-800">
                        <Bell className="h-5 w-5" />
                        Alertas de Cambios Detectados ({driftData.alerts.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {driftData.alerts.map((alert, idx) => (
                          <div key={idx} className={`p-4 rounded-lg border ${
                            alert.severity === 'high' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
                          }`}>
                            <div className="flex items-start gap-3">
                              {alert.severity === 'high' ? (
                                <AlertOctagon className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                              ) : (
                                <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                              )}
                              <div>
                                <p className={`font-medium ${alert.severity === 'high' ? 'text-red-800' : 'text-yellow-800'}`}>
                                  {alert.message}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">
                                  💡 {alert.recommendation}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Prong Drifts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-600" />
                        Cambios por Prong
                      </CardTitle>
                      <CardDescription>
                        Evolución del escrutinio por área del test Dhanasar
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {driftData.prongDrifts?.map((drift) => (
                          <div key={drift.prong} className={`p-3 rounded-lg border ${
                            drift.isSignificant && drift.direction === 'up' ? 'bg-red-50 border-red-200' :
                            drift.isSignificant && drift.direction === 'down' ? 'bg-green-50 border-green-200' :
                            'bg-gray-50 border-gray-200'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge className={COLORS[drift.prong] ? `bg-opacity-20` : ''} style={{
                                  backgroundColor: COLORS[drift.prong] + '30',
                                  color: COLORS[drift.prong]
                                }}>
                                  {drift.prong}
                                </Badge>
                                <span className="text-sm font-medium">{drift.label}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {getDirectionIcon(drift.direction)}
                                <span className={`font-bold ${
                                  drift.direction === 'up' ? 'text-red-600' : 
                                  drift.direction === 'down' ? 'text-green-600' : 'text-gray-500'
                                }`}>
                                  {drift.direction === 'up' ? '+' : ''}{drift.absoluteChange}%
                                </span>
                              </div>
                            </div>
                            <div className="mt-2 flex gap-4 text-xs text-gray-500">
                              <span>Reciente: {drift.recentPercentage}%</span>
                              <span>Base: {drift.baselinePercentage}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* New Issues */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-yellow-600" />
                        Nuevos Issues Detectados
                      </CardTitle>
                      <CardDescription>
                        Issues que aparecen recientemente pero no en el período base
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {driftData.newIssues && driftData.newIssues.length > 0 ? (
                        <div className="space-y-2">
                          {driftData.newIssues.map((issue) => (
                            <div key={issue.code} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <div className="flex items-center justify-between">
                                <code className="text-xs bg-yellow-100 px-2 py-1 rounded">{issue.code}</code>
                                <Badge className="bg-yellow-100 text-yellow-800">
                                  {issue.count} ocurrencias
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p>No hay nuevos issues</p>
                          <p className="text-sm">Los patrones se mantienen consistentes</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Top Drifts Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Detalle de Cambios por Issue</CardTitle>
                    <CardDescription>
                      Issues con cambios más significativos entre períodos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {driftData.drifts && driftData.drifts.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-3 px-4 font-medium text-gray-600">Código</th>
                              <th className="text-center py-3 px-4 font-medium text-gray-600">Reciente</th>
                              <th className="text-center py-3 px-4 font-medium text-gray-600">Base</th>
                              <th className="text-center py-3 px-4 font-medium text-gray-600">Cambio</th>
                              <th className="text-center py-3 px-4 font-medium text-gray-600">Tendencia</th>
                            </tr>
                          </thead>
                          <tbody>
                            {driftData.drifts.slice(0, 12).map((drift) => (
                              <tr key={drift.code} className={`border-b ${
                                drift.isSignificant ? (drift.direction === 'up' ? 'bg-red-50' : 'bg-green-50') : ''
                              }`}>
                                <td className="py-3 px-4">
                                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">{drift.code}</code>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className="font-medium">{drift.recentPercentage}%</span>
                                  <span className="text-xs text-gray-400 ml-1">({drift.recentCount})</span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className="font-medium">{drift.baselinePercentage}%</span>
                                  <span className="text-xs text-gray-400 ml-1">({drift.baselineCount})</span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className={`font-bold ${
                                    drift.direction === 'up' ? 'text-red-600' : 
                                    drift.direction === 'down' ? 'text-green-600' : 'text-gray-500'
                                  }`}>
                                    {drift.direction === 'up' ? '+' : ''}{drift.relativeChange}%
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    {getDirectionIcon(drift.direction)}
                                    {drift.isSignificant && (
                                      <Badge className={drift.direction === 'up' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                                        Significativo
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Activity className="h-12 w-12 mx-auto mb-2 opacity-30" />
                        <p>No hay suficientes datos para detectar cambios</p>
                        <p className="text-sm mt-1">Sube más documentos para habilitar el análisis de drift</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12 text-gray-500">
                    <Activity className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <h3 className="text-lg font-medium text-gray-700 mb-2">Drift Detector</h3>
                    <p className="mb-4">Detecta cambios en los criterios de evaluación de USCIS</p>
                    <p className="text-sm">Compara la distribución de issues entre dos períodos para identificar tendencias emergentes.</p>
                    <Button className="mt-4" onClick={fetchDriftData}>
                      <Activity className="h-4 w-4 mr-2" /> Iniciar Análisis
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
