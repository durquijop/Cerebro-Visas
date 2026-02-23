'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  AlertTriangle, AlertOctagon, Target, Scale, Flag, 
  Lightbulb, TrendingUp, CheckCircle2, ArrowRight,
  BookOpen, FileText, ChevronDown, ChevronUp
} from 'lucide-react'
import { useState } from 'react'

export default function AnalysisPanel({ analysis }) {
  const [expandedInsights, setExpandedInsights] = useState({})
  
  if (!analysis?.hasData) {
    return (
      <Card className="border-dashed border-2 border-gray-300 bg-gray-50">
        <CardContent className="py-12 text-center">
          <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Sin Datos para Análisis</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Sube documentos RFE, NOID o Denial para generar un análisis completo con conclusiones y recomendaciones.
          </p>
        </CardContent>
      </Card>
    )
  }
  
  const toggleInsight = (index) => {
    setExpandedInsights(prev => ({
      ...prev,
      [index]: !prev[index]
    }))
  }
  
  return (
    <div className="space-y-6">
      {/* Resumen Ejecutivo */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <BookOpen className="h-5 w-5" />
            Resumen Ejecutivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-blue-800 leading-relaxed">{analysis.summary}</p>
        </CardContent>
      </Card>
      
      {/* Alertas Críticas */}
      {analysis.criticalAlerts?.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertOctagon className="h-5 w-5" />
              Alertas Críticas ({analysis.criticalAlerts.length})
            </CardTitle>
            <CardDescription className="text-red-600">
              Requieren atención inmediata
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis.criticalAlerts.map((alert, idx) => (
              <div key={idx} className="bg-white p-4 rounded-lg border border-red-200 shadow-sm">
                <div className="flex items-start gap-3">
                  {alert.type === 'critical' ? (
                    <AlertOctagon className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  ) : alert.type === 'prong' ? (
                    <Scale className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                  ) : (
                    <TrendingUp className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{alert.title}</h4>
                    <p className="text-gray-600 text-sm mt-1">{alert.message}</p>
                    <div className="mt-3 p-2 bg-red-100 rounded border border-red-200">
                      <p className="text-sm font-medium text-red-800 flex items-center gap-1">
                        <ArrowRight className="h-4 w-4" />
                        {alert.action}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      {/* Hallazgos Clave */}
      {analysis.keyFindings?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-600" />
              Hallazgos Clave
            </CardTitle>
            <CardDescription>
              Patrones identificados en tus documentos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis.keyFindings.map((finding, idx) => (
              <div 
                key={idx} 
                className={`p-4 rounded-lg border ${
                  finding.severity === 'high' ? 'bg-orange-50 border-orange-200' :
                  finding.type === 'prong' ? 'bg-purple-50 border-purple-200' :
                  'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {finding.icon === 'alert-triangle' && <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0" />}
                  {finding.icon === 'scale' && <Scale className="h-5 w-5 text-purple-600 shrink-0" />}
                  {finding.icon === 'flag' && <Flag className="h-5 w-5 text-blue-600 shrink-0" />}
                  {finding.icon === 'target' && <Target className="h-5 w-5 text-indigo-600 shrink-0" />}
                  <div>
                    <h4 className="font-semibold text-gray-900">{finding.title}</h4>
                    <p className="text-gray-600 text-sm mt-1">{finding.description}</p>
                    {finding.issues && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {finding.issues.map((code, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {code.split('.').pop()}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      {/* Insights Profundos - Por qué ocurren los issues */}
      {analysis.insights?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-600" />
              ¿Por Qué Ocurren Estos Issues?
            </CardTitle>
            <CardDescription>
              Análisis profundo de las causas raíz
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.insights.slice(0, 5).map((insight, idx) => (
              <div 
                key={idx} 
                className="border rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleInsight(idx)}
                  className="w-full p-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge className={`${
                      insight.severity === 'critical' ? 'bg-red-100 text-red-800' :
                      insight.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {insight.percentage}%
                    </Badge>
                    <span className="font-medium text-gray-900">{insight.label}</span>
                    <span className="text-sm text-gray-500">({insight.count} casos)</span>
                  </div>
                  {expandedInsights[idx] ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </button>
                
                {expandedInsights[idx] && (
                  <div className="p-4 space-y-4 border-t bg-white">
                    {/* Por qué ocurre */}
                    <div>
                      <h5 className="font-medium text-gray-700 mb-1 flex items-center gap-2">
                        <span className="text-red-500">❓</span> Por qué ocurre
                      </h5>
                      <p className="text-gray-600 text-sm pl-6">{insight.whyItHappens}</p>
                    </div>
                    
                    {/* Qué quiere USCIS */}
                    <div>
                      <h5 className="font-medium text-gray-700 mb-1 flex items-center gap-2">
                        <span className="text-blue-500">🎯</span> Qué quiere ver USCIS
                      </h5>
                      <p className="text-gray-600 text-sm pl-6">{insight.whatUSCISWants}</p>
                    </div>
                    
                    {/* Cómo solucionarlo */}
                    <div>
                      <h5 className="font-medium text-gray-700 mb-1 flex items-center gap-2">
                        <span className="text-green-500">✅</span> Cómo solucionarlo
                      </h5>
                      <p className="text-gray-600 text-sm pl-6">{insight.howToFix}</p>
                    </div>
                    
                    {/* Evidencia necesaria */}
                    {insight.evidenceNeeded?.length > 0 && (
                      <div>
                        <h5 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                          <span className="text-purple-500">📋</span> Evidencia recomendada
                        </h5>
                        <ul className="pl-6 space-y-1">
                          {insight.evidenceNeeded.map((ev, i) => (
                            <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                              {ev}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      {/* Recomendaciones Priorizadas */}
      {analysis.recommendations?.length > 0 && (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle2 className="h-5 w-5" />
              Plan de Acción Recomendado
            </CardTitle>
            <CardDescription className="text-green-600">
              Pasos priorizados para mejorar tus casos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.recommendations.slice(0, 5).map((rec, idx) => (
              <div 
                key={idx} 
                className="bg-white p-4 rounded-lg border border-green-200 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-white ${
                    rec.priority === 'critical' ? 'bg-red-500' :
                    rec.priority === 'high' ? 'bg-orange-500' :
                    'bg-blue-500'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900">{rec.title}</h4>
                      <Badge className={`text-xs ${
                        rec.priority === 'critical' ? 'bg-red-100 text-red-700' :
                        rec.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {rec.priority === 'critical' ? 'Crítico' : rec.priority === 'high' ? 'Alto' : 'Medio'}
                      </Badge>
                    </div>
                    
                    {rec.impact && (
                      <p className="text-green-700 text-sm font-medium mb-2">
                        💡 {rec.impact}
                      </p>
                    )}
                    
                    {rec.actions?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-gray-500 mb-1">Acciones específicas:</p>
                        <ul className="space-y-1">
                          {rec.actions.map((action, i) => (
                            <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                              <ArrowRight className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      {/* Patrones Detectados */}
      {analysis.patterns?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              Patrones Detectados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis.patterns.map((pattern, idx) => (
              <div key={idx} className="p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                <h4 className="font-semibold text-indigo-900">{pattern.title}</h4>
                <p className="text-indigo-700 text-sm mt-1">{pattern.description}</p>
                <p className="text-indigo-600 text-sm mt-2 font-medium">
                  💡 {pattern.recommendation}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
