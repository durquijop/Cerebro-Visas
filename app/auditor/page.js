'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  ClipboardCheck, ArrowLeft, Loader2, AlertTriangle, CheckCircle2, 
  XCircle, FileText, TrendingUp, Shield, Target, Lightbulb,
  ChevronRight, AlertOctagon, Info, BookOpen, User, Briefcase
} from 'lucide-react'
import Link from 'next/link'

export default function AuditorPage() {
  const [cases, setCases] = useState([])
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingCases, setLoadingCases] = useState(true)
  const [auditReport, setAuditReport] = useState(null)
  const [error, setError] = useState(null)
  const router = useRouter()

  useEffect(() => {
    fetchCases()
  }, [])

  const fetchCases = async () => {
    try {
      const response = await fetch('/api/casos')
      if (response.ok) {
        const data = await response.json()
        setCases(data.cases || [])
      }
    } catch (err) {
      console.error('Error fetching cases:', err)
    } finally {
      setLoadingCases(false)
    }
  }

  const runAudit = async () => {
    if (!selectedCaseId) return

    setLoading(true)
    setError(null)
    setAuditReport(null)

    try {
      const response = await fetch('/api/casos/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: selectedCaseId })
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Error en la auditoría')
      }

      const report = await response.json()
      setAuditReport(report)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    if (score >= 40) return 'text-orange-600'
    return 'text-red-600'
  }

  const getScoreBg = (score) => {
    if (score >= 80) return 'bg-green-100'
    if (score >= 60) return 'bg-yellow-100'
    if (score >= 40) return 'bg-orange-100'
    return 'bg-red-100'
  }

  const getScoreLabel = (score) => {
    if (score >= 80) return 'Fuerte'
    if (score >= 60) return 'Moderado'
    if (score >= 40) return 'Débil'
    return 'Crítico'
  }

  const getPriorityColor = (priority) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-300',
      high: 'bg-orange-100 text-orange-800 border-orange-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      low: 'bg-green-100 text-green-800 border-green-300'
    }
    return colors[priority] || colors.medium
  }

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return <AlertOctagon className="h-4 w-4 text-red-600" />
      case 'high': return <AlertTriangle className="h-4 w-4 text-orange-600" />
      case 'medium': return <Info className="h-4 w-4 text-yellow-600" />
      default: return <Info className="h-4 w-4 text-gray-400" />
    }
  }

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
            <span className="text-gray-600 font-medium">Auditor de Expediente</span>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ClipboardCheck className="h-8 w-8 text-purple-600" />
            Auditor de Expediente
          </h1>
          <p className="text-gray-600 mt-1">
            Análisis integral del caso contra los 3 prongs del test Dhanasar para NIW
          </p>
        </div>

        {/* Case Selector */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Seleccionar Caso para Auditar
            </CardTitle>
            <CardDescription>
              Elige un caso existente para generar un reporte completo de fortalezas y debilidades
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Select 
                value={selectedCaseId} 
                onValueChange={setSelectedCaseId}
                disabled={loadingCases}
              >
                <SelectTrigger className="w-80">
                  <SelectValue placeholder={loadingCases ? "Cargando casos..." : "Selecciona un caso"} />
                </SelectTrigger>
                <SelectContent>
                  {cases.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title || c.beneficiary_name || `Caso ${c.id.substring(0, 8)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button 
                onClick={runAudit} 
                disabled={!selectedCaseId || loading}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analizando...</>
                ) : (
                  <><ClipboardCheck className="h-4 w-4 mr-2" /> Ejecutar Auditoría</>
                )}
              </Button>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit Report */}
        {auditReport && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Overall Score */}
              <Card className={`border-2 ${getScoreBg(auditReport.summary.overallScore)}`}>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Target className={`h-10 w-10 mx-auto mb-2 ${getScoreColor(auditReport.summary.overallScore)}`} />
                    <p className="text-sm text-gray-600 mb-1">Score General</p>
                    <p className={`text-5xl font-bold ${getScoreColor(auditReport.summary.overallScore)}`}>
                      {auditReport.summary.overallScore}
                    </p>
                    <Badge className={`mt-2 ${getPriorityColor(
                      auditReport.summary.overallScore >= 80 ? 'low' :
                      auditReport.summary.overallScore >= 60 ? 'medium' :
                      auditReport.summary.overallScore >= 40 ? 'high' : 'critical'
                    )}`}>
                      {getScoreLabel(auditReport.summary.overallScore)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Documentos</p>
                      <p className="text-3xl font-bold">{auditReport.summary.totalDocuments}</p>
                    </div>
                    <FileText className="h-10 w-10 text-blue-500 opacity-50" />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {auditReport.summary.rfeCount} RFE/NOID | {auditReport.summary.supportingDocsCount} soporte
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Issues Detectados</p>
                      <p className="text-3xl font-bold text-orange-600">{auditReport.summary.totalIssues}</p>
                    </div>
                    <AlertTriangle className="h-10 w-10 text-orange-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Solicitudes USCIS</p>
                      <p className="text-3xl font-bold text-purple-600">{auditReport.summary.totalRequests}</p>
                    </div>
                    <BookOpen className="h-10 w-10 text-purple-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Case Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {auditReport.caseName}
                </CardTitle>
                <CardDescription>
                  {auditReport.beneficiary && `Beneficiario: ${auditReport.beneficiary} | `}
                  Tipo: {auditReport.visaType} | 
                  Auditado: {new Date(auditReport.auditDate).toLocaleDateString('es-ES')}
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Main Tabs */}
            <Tabs defaultValue="prongs" className="space-y-6">
              <TabsList className="grid w-full max-w-2xl grid-cols-4">
                <TabsTrigger value="prongs">Análisis por Prong</TabsTrigger>
                <TabsTrigger value="checklist">Checklist</TabsTrigger>
                <TabsTrigger value="recommendations">Recomendaciones</TabsTrigger>
                <TabsTrigger value="issues">Issues</TabsTrigger>
              </TabsList>

              {/* PRONGS TAB */}
              <TabsContent value="prongs">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {Object.entries(auditReport.prongAnalysis).map(([key, prong]) => (
                    <Card key={key} className={`border-2 ${
                      prong.score >= 80 ? 'border-green-200' :
                      prong.score >= 60 ? 'border-yellow-200' :
                      prong.score >= 40 ? 'border-orange-200' : 'border-red-200'
                    }`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-lg font-bold">{key}</Badge>
                          <span className={`text-2xl font-bold ${getScoreColor(prong.score)}`}>
                            {prong.score}
                          </span>
                        </div>
                        <CardTitle className="text-base">{prong.name.split(' - ')[1]}</CardTitle>
                        <CardDescription className="text-xs">{prong.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Progress 
                          value={prong.score} 
                          className={`h-2 mb-4 ${
                            prong.score >= 80 ? '[&>div]:bg-green-500' :
                            prong.score >= 60 ? '[&>div]:bg-yellow-500' :
                            prong.score >= 40 ? '[&>div]:bg-orange-500' : '[&>div]:bg-red-500'
                          }`} 
                        />

                        {/* Strengths */}
                        {prong.strengths.length > 0 && (
                          <div className="mb-4">
                            <p className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4" /> Fortalezas
                            </p>
                            <ul className="space-y-1">
                              {prong.strengths.slice(0, 3).map((s, i) => (
                                <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                                  <ChevronRight className="h-3 w-3 mt-0.5 text-green-500 shrink-0" />
                                  {s.description}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Weaknesses */}
                        {prong.weaknesses.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                              <XCircle className="h-4 w-4" /> Debilidades ({prong.weaknesses.length})
                            </p>
                            <ul className="space-y-1">
                              {prong.weaknesses.slice(0, 3).map((w, i) => (
                                <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                                  {getSeverityIcon(w.severity)}
                                  <span className="line-clamp-2">
                                    {w.type === 'request' ? w.text : w.code}
                                  </span>
                                </li>
                              ))}
                              {prong.weaknesses.length > 3 && (
                                <li className="text-xs text-gray-400">
                                  +{prong.weaknesses.length - 3} más...
                                </li>
                              )}
                            </ul>
                          </div>
                        )}

                        <div className="mt-4 pt-3 border-t flex justify-between text-xs text-gray-500">
                          <span>{prong.issueCount} issues</span>
                          <span>{prong.requestCount} solicitudes</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* CHECKLIST TAB */}
              <TabsContent value="checklist">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Essential Documents */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        Documentos Esenciales
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3">
                        {auditReport.evidenceChecklist.essential.map((item, i) => (
                          <li key={i} className={`p-3 rounded-lg border ${
                            item.status === 'present' ? 'bg-green-50 border-green-200' :
                            item.status === 'missing' ? 'bg-red-50 border-red-200' :
                            'bg-gray-50 border-gray-200'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{item.item}</span>
                              {item.status === 'present' ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : item.status === 'missing' ? (
                                <XCircle className="h-5 w-5 text-red-600" />
                              ) : (
                                <Info className="h-5 w-5 text-gray-400" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {item.importance}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {item.status === 'present' ? 'Presente' :
                                 item.status === 'missing' ? 'Faltante' : 'No verificado'}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* USCIS Requests */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-purple-600" />
                        Solicitudes de USCIS ({auditReport.evidenceChecklist.requestedByUSCIS.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {auditReport.evidenceChecklist.requestedByUSCIS.length > 0 ? (
                        <ul className="space-y-3">
                          {auditReport.evidenceChecklist.requestedByUSCIS.map((item, i) => (
                            <li key={i} className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                              <p className="text-sm font-medium">{item.item}...</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge className={getPriorityColor(item.importance)}>
                                  {item.importance}
                                </Badge>
                                {item.prong && (
                                  <Badge variant="outline">{item.prong}</Badge>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                          <p>No hay solicitudes pendientes de USCIS</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Recommended Evidence */}
                {auditReport.evidenceChecklist.recommended.length > 0 && (
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-yellow-600" />
                        Evidencia Recomendada
                      </CardTitle>
                      <CardDescription>
                        Basado en los issues detectados, se recomienda agregar la siguiente documentación
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {auditReport.evidenceChecklist.recommended.map((item, i) => (
                          <li key={i} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="font-medium text-sm">{item.item}</p>
                            <p className="text-xs text-gray-600 mt-1">{item.reason}</p>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* RECOMMENDATIONS TAB */}
              <TabsContent value="recommendations">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-yellow-600" />
                      Plan de Acción Recomendado
                    </CardTitle>
                    <CardDescription>
                      Acciones prioritarias para fortalecer el caso
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {auditReport.recommendations.length > 0 ? (
                      <div className="space-y-4">
                        {auditReport.recommendations.map((rec, i) => (
                          <div 
                            key={i} 
                            className={`p-4 rounded-lg border-l-4 ${
                              rec.priority === 'critical' ? 'bg-red-50 border-red-500' :
                              rec.priority === 'high' ? 'bg-orange-50 border-orange-500' :
                              rec.priority === 'medium' ? 'bg-yellow-50 border-yellow-500' :
                              'bg-gray-50 border-gray-300'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className={getPriorityColor(rec.priority)}>
                                    {rec.priority.toUpperCase()}
                                  </Badge>
                                  {rec.prong && (
                                    <Badge variant="outline">{rec.prong}</Badge>
                                  )}
                                </div>
                                <h4 className="font-semibold text-gray-900">{rec.title}</h4>
                                <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                              </div>
                            </div>
                            {rec.actions && rec.actions.length > 0 && (
                              <ul className="mt-3 space-y-1">
                                {rec.actions.map((action, j) => (
                                  <li key={j} className="text-sm text-gray-700 flex items-start gap-2">
                                    <ChevronRight className="h-4 w-4 mt-0.5 text-gray-400 shrink-0" />
                                    {action}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
                        <p className="text-lg font-medium">¡El caso está bien preparado!</p>
                        <p className="text-sm">No hay recomendaciones críticas en este momento.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ISSUES TAB */}
              <TabsContent value="issues">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                      Todos los Issues Detectados ({auditReport.summary.totalIssues})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {auditReport.rawData.issues.length > 0 ? (
                      <div className="space-y-6">
                        {/* Critical */}
                        {auditReport.issuesByPrior.critical.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                              <AlertOctagon className="h-4 w-4" />
                              Críticos ({auditReport.issuesByPrior.critical.length})
                            </h4>
                            <div className="space-y-2">
                              {auditReport.issuesByPrior.critical.map((issue, i) => (
                                <IssueCard key={i} issue={issue} />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* High */}
                        {auditReport.issuesByPrior.high.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-orange-700 mb-2 flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4" />
                              Altos ({auditReport.issuesByPrior.high.length})
                            </h4>
                            <div className="space-y-2">
                              {auditReport.issuesByPrior.high.map((issue, i) => (
                                <IssueCard key={i} issue={issue} />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Medium */}
                        {auditReport.issuesByPrior.medium.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-yellow-700 mb-2 flex items-center gap-2">
                              <Info className="h-4 w-4" />
                              Medios ({auditReport.issuesByPrior.medium.length})
                            </h4>
                            <div className="space-y-2">
                              {auditReport.issuesByPrior.medium.map((issue, i) => (
                                <IssueCard key={i} issue={issue} />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Low */}
                        {auditReport.issuesByPrior.low.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-gray-600 mb-2">
                              Bajos ({auditReport.issuesByPrior.low.length})
                            </h4>
                            <div className="space-y-2">
                              {auditReport.issuesByPrior.low.map((issue, i) => (
                                <IssueCard key={i} issue={issue} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
                        <p>No se han detectado issues en este caso</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Empty State */}
        {!auditReport && !loading && (
          <Card className="mt-8">
            <CardContent className="py-16">
              <div className="text-center text-gray-500">
                <ClipboardCheck className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">Auditor de Expediente</h3>
                <p className="mb-2">Selecciona un caso y ejecuta la auditoría para obtener:</p>
                <ul className="text-sm space-y-1">
                  <li>• Análisis detallado de cada Prong del test Dhanasar</li>
                  <li>• Checklist de evidencia esencial y faltante</li>
                  <li>• Recomendaciones priorizadas de mejora</li>
                  <li>• Listado completo de issues por severidad</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}

function IssueCard({ issue }) {
  const getSeverityStyle = (severity) => {
    const styles = {
      critical: 'bg-red-50 border-red-200',
      high: 'bg-orange-50 border-orange-200',
      medium: 'bg-yellow-50 border-yellow-200',
      low: 'bg-gray-50 border-gray-200'
    }
    return styles[severity] || styles.medium
  }

  return (
    <div className={`p-3 rounded-lg border ${getSeverityStyle(issue.severity)}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <code className="text-xs bg-gray-200 px-2 py-0.5 rounded">{issue.taxonomy_code}</code>
          {issue.prong_affected && (
            <Badge variant="outline" className="ml-2 text-xs">{issue.prong_affected}</Badge>
          )}
        </div>
      </div>
      {issue.extracted_quote && (
        <p className="text-xs text-gray-600 mt-2 italic line-clamp-2">"{issue.extracted_quote}"</p>
      )}
      <p className="text-xs text-gray-400 mt-1">Fuente: {issue.document_name}</p>
    </div>
  )
}
