'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Brain, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, 
  ArrowLeft, Activity, Minus, CheckCircle, Bell, BarChart3
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function DriftDetectorPage() {
  const [loading, setLoading] = useState(true)
  const [driftData, setDriftData] = useState(null)
  const [frequencyData, setFrequencyData] = useState(null)
  const [shortWindow, setShortWindow] = useState('60')
  const [longWindow, setLongWindow] = useState('180')
  const [frequencyPeriod, setFrequencyPeriod] = useState('month')

  useEffect(() => {
    loadDriftData()
    loadFrequencyData()
  }, [shortWindow, longWindow, frequencyPeriod])

  const loadDriftData = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/drift-detector?short=${shortWindow}&long=${longWindow}`)
      const data = await res.json()
      if (data.success) {
        setDriftData(data)
      }
    } catch (error) {
      console.error('Error loading drift data:', error)
      toast.error('Error cargando datos de drift')
    } finally {
      setLoading(false)
    }
  }

  const loadFrequencyData = async () => {
    try {
      const res = await fetch(`/api/issue-frequency?period=${frequencyPeriod}&limit=6`)
      const data = await res.json()
      if (data.success) {
        setFrequencyData(data)
      }
    } catch (error) {
      console.error('Error loading frequency data:', error)
    }
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white'
      case 'high': return 'bg-orange-500 text-white'
      case 'medium': return 'bg-yellow-500 text-black'
      default: return 'bg-gray-500 text-white'
    }
  }

  const getAlertIcon = (type) => {
    switch (type) {
      case 'increase': return <TrendingUp className="h-5 w-5 text-red-500" />
      case 'decrease': return <TrendingDown className="h-5 w-5 text-green-500" />
      case 'new_pattern': return <AlertTriangle className="h-5 w-5 text-orange-500" />
      default: return <Minus className="h-5 w-5 text-gray-500" />
    }
  }

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="h-4 w-4 text-red-500" />
      case 'decreasing': return <TrendingDown className="h-4 w-4 text-green-500" />
      default: return <Minus className="h-4 w-4 text-gray-400" />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-navy-primary border-b border-navy-light">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Brain className="h-8 w-8 text-gold-primary" />
            <span className="text-xl font-bold text-gold-subtle">Drift Detector</span>
            <Badge variant="outline" className="text-gold-muted border-gold-muted">
              Inteligencia de Tendencias
            </Badge>
          </div>
          <Link href="/dashboard">
            <Button variant="ghost" className="text-gold-muted hover:text-gold-primary">
              <ArrowLeft className="h-4 w-4 mr-2" /> Volver
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs defaultValue="drift" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="drift" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Drift Detector
            </TabsTrigger>
            <TabsTrigger value="frequency" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Frecuencia de Issues
            </TabsTrigger>
          </TabsList>

          {/* ========== TAB: DRIFT DETECTOR ========== */}
          <TabsContent value="drift" className="space-y-6">
            {/* Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-purple-600" />
                  Configuración de Detección
                </CardTitle>
                <CardDescription>
                  Compara la distribución de issues entre dos ventanas temporales para detectar cambios de criterio
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 items-end">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Ventana Corta</label>
                    <Select value={shortWindow} onValueChange={setShortWindow}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 días</SelectItem>
                        <SelectItem value="60">60 días</SelectItem>
                        <SelectItem value="90">90 días</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Ventana Larga</label>
                    <Select value={longWindow} onValueChange={setLongWindow}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="90">90 días</SelectItem>
                        <SelectItem value="180">180 días</SelectItem>
                        <SelectItem value="365">365 días</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={loadDriftData} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Analizar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            {driftData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-red-600">
                      {driftData.summary?.alerts?.critical || 0}
                    </div>
                    <p className="text-sm text-gray-500">Alertas Críticas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-orange-600">
                      {driftData.summary?.alerts?.high || 0}
                    </div>
                    <p className="text-sm text-gray-500">Alertas Altas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-green-600">
                      {driftData.summary?.alerts?.increases || 0}
                    </div>
                    <p className="text-sm text-gray-500">En Aumento</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-blue-600">
                      {driftData.summary?.alerts?.new_patterns || 0}
                    </div>
                    <p className="text-sm text-gray-500">Nuevos Patrones</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Alerts List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Alertas de Cambio de Criterio
                </CardTitle>
                <CardDescription>
                  Issues que están cambiando significativamente en frecuencia
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : driftData?.alerts?.length > 0 ? (
                  <div className="space-y-4">
                    {driftData.alerts.map((alert, idx) => (
                      <div 
                        key={idx} 
                        className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            {getAlertIcon(alert.alert_type)}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {alert.taxonomy?.description || alert.taxonomy_code}
                                </span>
                                <Badge className={getSeverityColor(alert.severity)}>
                                  {alert.severity}
                                </Badge>
                                {alert.taxonomy?.prong && (
                                  <Badge variant="outline">{alert.taxonomy.prong}</Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 mt-1">
                                {alert.taxonomy?.level1} → {alert.taxonomy?.level2}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-bold ${
                              alert.drift_percentage > 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {alert.drift_percentage > 0 ? '+' : ''}{alert.drift_percentage.toFixed(1)}%
                            </div>
                            <p className="text-xs text-gray-500">cambio</p>
                          </div>
                        </div>
                        
                        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                          <div className="bg-blue-50 rounded p-2">
                            <span className="text-blue-700 font-medium">
                              Últimos {alert.short_window.days} días:
                            </span>
                            <span className="ml-2">
                              {alert.short_window.count} ({alert.short_window.percentage}%)
                            </span>
                          </div>
                          <div className="bg-gray-100 rounded p-2">
                            <span className="text-gray-700 font-medium">
                              Período anterior:
                            </span>
                            <span className="ml-2">
                              {alert.long_window.count} ({alert.long_window.percentage}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p className="font-medium">No se detectaron cambios significativos</p>
                    <p className="text-sm">Los patrones de issues se mantienen estables</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== TAB: FRECUENCIA ========== */}
          <TabsContent value="frequency" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-purple-600" />
                      Frecuencia de Issues por Período
                    </CardTitle>
                    <CardDescription>
                      Top issues más frecuentes y su tendencia temporal
                    </CardDescription>
                  </div>
                  <Select value={frequencyPeriod} onValueChange={setFrequencyPeriod}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">Por Semana</SelectItem>
                      <SelectItem value="month">Por Mes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {frequencyData?.top_issues?.length > 0 ? (
                  <div className="space-y-3">
                    {frequencyData.top_issues.map((issue, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-gray-400 w-6">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-medium">{issue.description}</div>
                            {issue.prong && (
                              <Badge variant="outline" className="text-xs mt-1">
                                {issue.prong}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-lg font-bold">{issue.count}</div>
                            <p className="text-xs text-gray-500">ocurrencias</p>
                          </div>
                          {getTrendIcon(issue.trend)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No hay datos de frecuencia disponibles</p>
                  </div>
                )}

                {frequencyData?.summary && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-purple-600">
                          {frequencyData.summary.total_issues}
                        </div>
                        <p className="text-sm text-gray-500">Issues Totales</p>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-600">
                          {frequencyData.summary.unique_taxonomy_codes}
                        </div>
                        <p className="text-sm text-gray-500">Códigos Únicos</p>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">
                          {frequencyData.summary.periods_analyzed}
                        </div>
                        <p className="text-sm text-gray-500">Períodos</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
