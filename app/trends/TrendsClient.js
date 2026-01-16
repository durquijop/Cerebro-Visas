'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { 
  Brain, TrendingUp, AlertTriangle, FileText, 
  BarChart3, PieChart, Loader2, RefreshCw,
  ArrowUp, ArrowDown, Minus, Building2
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

  useEffect(() => {
    fetchTrends()
  }, [period])

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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              Dashboard de Tendencias
            </h1>
            <p className="text-gray-600 mt-1">
              Análisis de issues y patrones en RFE/NOID/Denial
            </p>
          </div>
          <div className="flex items-center gap-4">
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
        </div>

        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-700">{error}</p>
            </CardContent>
          </Card>
        )}

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
      </main>
    </div>
  )
}
