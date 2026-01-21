'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ReactMarkdown from 'react-markdown'
import { 
  Brain, ArrowLeft, Sparkles, AlertTriangle, CheckCircle, 
  XCircle, Loader2, Copy, RefreshCw, Lightbulb, Target,
  FileText, ChevronRight, Zap, Shield, TrendingUp, Clock, X
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const DOCUMENT_TYPES = [
  { value: 'propuesta_eb2_niw', label: 'Propuestas EB-2 NIW', desc: 'Documentos profesionales alineados con USCIS' },
  { value: 'patentes_uspto', label: 'Patentes USPTO', desc: 'Aplicaciones provisionales completas' },
  { value: 'libros_completos', label: 'Libros Completos', desc: 'Libros con capítulos estructurados' },
  { value: 'estudios_econometricos', label: 'Estudios Econométricos', desc: 'Análisis riguroso con 16 secciones' },
  { value: 'white_paper', label: 'White Paper Técnico', desc: 'Documentos técnicos de 16 secciones profesionales' },
  { value: 'cartas_recomendacion', label: 'Cartas de Recomendación', desc: 'Cartas profesionales para visas EB-2 NIW y O-1' },
  { value: 'casos_estudio', label: 'Casos de Estudio Empresariales', desc: 'Análisis estilo Harvard Business School' },
  { value: 'reporte_impacto', label: 'Reporte de Impacto Social', desc: 'Policy papers con impacto social' },
  { value: 'cartas_expertos', label: 'Cartas de Expertos', desc: 'Cartas profesionales de expertos para visas' },
  { value: 'cartas_autopeticion', label: 'Cartas de Autopetición', desc: 'Cover Letters EB-2 NIW I-140' },
  { value: 'rfe_response', label: 'Respuesta a RFE', desc: 'Respuesta a Request for Evidence' },
  { value: 'noid_response', label: 'Respuesta a NOID', desc: 'Respuesta a Notice of Intent to Deny' },
  { value: 'personal_statement', label: 'Declaración Personal', desc: 'Statement personal del beneficiario' },
  { value: 'evidence_summary', label: 'Resumen de Evidencia', desc: 'Summary de evidencia para petición' },
]

export default function PromptAnalyzerPage() {
  const [prompt, setPrompt] = useState('')
  const [documentType, setDocumentType] = useState('propuesta_eb2_niw')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [analysisMetadata, setAnalysisMetadata] = useState(null)
  const [historyId, setHistoryId] = useState(null)
  const [selectedIssues, setSelectedIssues] = useState([])
  const [improving, setImproving] = useState(false)
  const [improvedPrompt, setImprovedPrompt] = useState(null)
  const [activeTab, setActiveTab] = useState('analyze')
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const loadHistory = async () => {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/prompt-analyzer')
      const data = await res.json()
      if (data.history) setHistory(data.history)
    } catch (err) {
      console.error('Error loading history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  const analyzePrompt = async () => {
    if (!prompt.trim()) {
      toast.error('Ingresa un prompt para analizar')
      return
    }

    setAnalyzing(true)
    setAnalysis(null)
    setSelectedIssues([])
    setImprovedPrompt(null)
    setHistoryId(null)

    try {
      const res = await fetch('/api/prompt-analyzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          documentType: DOCUMENT_TYPES.find(d => d.value === documentType)?.label,
          action: 'analyze'
        })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      setAnalysis(data.analysis)
      setHistoryId(data.historyId)
      setAnalysisMetadata({
        documentsAnalyzed: data.documentsAnalyzed,
        documentsUsed: data.documentsUsed,
        docTypeCount: data.docTypeCount,
        taxonomyItemsUsed: data.taxonomyItemsUsed
      })
      toast.success(`Análisis completado - ${data.documentsAnalyzed} fragmentos de ${data.documentsUsed?.length || 0} documentos`)
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  const toggleIssue = (issue) => {
    setSelectedIssues(prev => {
      const exists = prev.find(i => i.id === issue.id)
      if (exists) {
        return prev.filter(i => i.id !== issue.id)
      }
      return [...prev, issue]
    })
  }

  const improvePromptHandler = async () => {
    if (selectedIssues.length === 0) {
      toast.error('Selecciona al menos un issue para mejorar')
      return
    }

    setImproving(true)

    try {
      const res = await fetch('/api/prompt-analyzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          documentType: DOCUMENT_TYPES.find(d => d.value === documentType)?.label,
          action: 'improve',
          selectedIssues,
          historyId
        })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      setImprovedPrompt(data.result)
      setActiveTab('result')
      toast.success('Prompt mejorado generado y guardado')
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setImproving(false)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado al portapapeles')
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'alta': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'media': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'baja': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const getCategoryIcon = (category) => {
    if (category?.includes('Prong 1')) return <Target className="h-4 w-4" />
    if (category?.includes('Prong 2')) return <TrendingUp className="h-4 w-4" />
    if (category?.includes('Prong 3')) return <Shield className="h-4 w-4" />
    if (category?.includes('Evidencia')) return <FileText className="h-4 w-4" />
    return <Lightbulb className="h-4 w-4" />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-navy-primary border-b border-navy-light">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Brain className="h-8 w-8 text-gold-primary" />
            <span className="text-xl font-bold text-gold-subtle">Analizador de Prompts</span>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              className="text-gold-muted hover:text-gold-primary"
              onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory(); }}
            >
              <Clock className="h-4 w-4 mr-2" /> Historial
            </Button>
            <Link href="/dashboard">
              <Button variant="ghost" className="text-gold-muted hover:text-gold-primary">
                <ArrowLeft className="h-4 w-4 mr-2" /> Volver
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-6xl">
        {/* Historial Panel */}
        {showHistory && (
          <Card className="mb-6 border-purple-200 bg-purple-50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-purple-900 flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Historial de Optimizaciones
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-purple-700 text-center py-4">No hay historial aún</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {history.map((item) => (
                    <div 
                      key={item.id} 
                      className="p-3 bg-white rounded-lg border border-purple-200 cursor-pointer hover:border-purple-400 transition-colors"
                      onClick={() => {
                        // Cargar prompt original
                        setPrompt(item.original_prompt)
                        
                        // Cargar análisis si existe
                        if (item.analysis_issues || item.analysis_score) {
                          setAnalysis({
                            overallScore: item.analysis_score,
                            summary: item.analysis_summary,
                            issues: item.analysis_issues || [],
                            strengths: item.analysis_strengths || []
                          })
                          setAnalysisMetadata({
                            documentsUsed: item.documents_used || [],
                            documentsAnalyzed: item.documents_used?.length || 0,
                            docTypeCount: {},
                            taxonomyItemsUsed: 0
                          })
                          setHistoryId(item.id)
                        }
                        
                        // Cargar prompt mejorado si existe
                        if (item.improved_prompt) {
                          setImprovedPrompt({
                            improvedPrompt: item.improved_prompt,
                            changesExplained: item.changes_explained,
                            additionalTips: item.additional_tips
                          })
                          setActiveTab('result')
                        } else {
                          setImprovedPrompt(null)
                          setActiveTab('analyze')
                        }
                        
                        // Cargar issues seleccionados si existen
                        if (item.selected_issues) {
                          setSelectedIssues(item.selected_issues)
                        } else {
                          setSelectedIssues([])
                        }
                        
                        setShowHistory(false)
                        toast.success('Prompt y análisis cargados desde historial')
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {item.document_type || 'Sin tipo'}
                        </span>
                        <div className="flex items-center gap-2">
                          {item.analysis_score && (
                            <Badge className="bg-purple-100 text-purple-700">
                              {item.analysis_score}/10
                            </Badge>
                          )}
                          {item.improved_prompt && (
                            <Badge className="bg-green-100 text-green-700">
                              Mejorado
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {item.original_prompt?.substring(0, 100)}...
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(item.created_at).toLocaleString('es-ES')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Intro */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Optimizador de Prompts</h1>
          <p className="text-gray-600">
            Analiza tus prompts contra issues reales de RFEs, NOIDs y Denials para crear documentos más sólidos.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel Izquierdo - Input */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-600" />
                  Tu Prompt
                </CardTitle>
                <CardDescription>
                  Ingresa el prompt que usas para generar documentos de inmigración
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Tipo de Documento
                  </label>
                  <Select value={documentType} onValueChange={setDocumentType}>
                    <SelectTrigger className="h-auto py-2">
                      <SelectValue>
                        {DOCUMENT_TYPES.find(t => t.value === documentType)?.label}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {DOCUMENT_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value} className="py-2">
                          <div>
                            <div className="font-medium">{type.label}</div>
                            <div className="text-xs text-gray-500">{type.desc}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Prompt a Analizar
                  </label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ej: Genera una carta de petición EB-2 NIW para un ingeniero de software especializado en inteligencia artificial..."
                    className="min-h-[250px] font-mono text-sm"
                  />
                </div>

                <Button
                  onClick={analyzePrompt}
                  disabled={analyzing || !prompt.trim()}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {analyzing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analizando...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" /> Analizar Prompt</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Strengths */}
            {analysis?.strengths && analysis.strengths.length > 0 && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-green-800 flex items-center gap-2 text-base">
                    <CheckCircle className="h-5 w-5" />
                    Puntos Fuertes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {analysis.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-green-700 flex items-start gap-2">
                        <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Panel Derecho - Results */}
          <div className="space-y-4">
            {!analysis ? (
              <Card className="h-full flex items-center justify-center min-h-[400px] border-dashed">
                <div className="text-center p-8">
                  <Brain className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-500 mb-2">
                    Ingresa un prompt para analizar
                  </h3>
                  <p className="text-sm text-gray-400 max-w-sm">
                    El sistema buscará en RFEs, NOIDs y Denials para identificar 
                    áreas de mejora en tu prompt.
                  </p>
                </div>
              </Card>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="analyze" className="flex-1">Análisis</TabsTrigger>
                  <TabsTrigger value="result" className="flex-1" disabled={!improvedPrompt}>
                    Prompt Mejorado
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="analyze" className="space-y-4 mt-4">
                  {/* Documents Used Info */}
                  {analysisMetadata && (
                    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="h-5 w-5 text-blue-600" />
                          <span className="font-medium text-blue-900">
                            Análisis basado en {analysisMetadata.documentsAnalyzed} fragmentos de {analysisMetadata.documentsUsed?.length || 0} documentos
                          </span>
                        </div>
                        
                        {/* Conteo por tipo */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {analysisMetadata.docTypeCount?.RFE > 0 && (
                            <Badge className="bg-red-100 text-red-700 border-red-200">
                              {analysisMetadata.docTypeCount.RFE} RFE
                            </Badge>
                          )}
                          {analysisMetadata.docTypeCount?.NOID > 0 && (
                            <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                              {analysisMetadata.docTypeCount.NOID} NOID
                            </Badge>
                          )}
                          {analysisMetadata.docTypeCount?.Denial > 0 && (
                            <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                              {analysisMetadata.docTypeCount.Denial} Denial
                            </Badge>
                          )}
                          {analysisMetadata.docTypeCount?.Otro > 0 && (
                            <Badge className="bg-gray-100 text-gray-700 border-gray-200">
                              {analysisMetadata.docTypeCount.Otro} Otros
                            </Badge>
                          )}
                          {analysisMetadata.taxonomyItemsUsed > 0 && (
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              {analysisMetadata.taxonomyItemsUsed} códigos de taxonomía
                            </Badge>
                          )}
                        </div>

                        {/* Lista de documentos */}
                        {analysisMetadata.documentsUsed && analysisMetadata.documentsUsed.length > 0 && (
                          <details className="text-sm">
                            <summary className="cursor-pointer text-blue-700 hover:text-blue-800 font-medium">
                              Ver documentos consultados
                            </summary>
                            <div className="mt-2 space-y-1 pl-2 border-l-2 border-blue-200">
                              {analysisMetadata.documentsUsed.map((doc, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs py-1">
                                  <span className="text-gray-700 truncate flex-1 mr-2">
                                    {doc.name}
                                  </span>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <Badge variant="outline" className="text-[10px]">
                                      {doc.type}
                                    </Badge>
                                    <span className="text-blue-600 font-medium">
                                      {doc.similarity}%
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Score */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">Puntuación General</span>
                        <span className="text-2xl font-bold text-purple-600">
                          {analysis.overallScore || 'N/A'}/10
                        </span>
                      </div>
                      <Progress value={(analysis.overallScore || 0) * 10} className="h-2" />
                      {analysis.summary && (
                        <p className="text-sm text-gray-600 mt-3">{analysis.summary}</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Issues */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-yellow-600" />
                          Issues Detectados ({analysis.issues?.length || 0})
                        </span>
                        {selectedIssues.length > 0 && (
                          <Badge className="bg-purple-100 text-purple-700">
                            {selectedIssues.length} seleccionados
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        Selecciona los issues que deseas abordar en el prompt mejorado
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                        {analysis.issues?.map((issue, idx) => (
                          <div
                            key={issue.id || idx}
                            className={`p-3 rounded-lg border transition-all cursor-pointer ${
                              selectedIssues.find(i => i.id === issue.id)
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                            onClick={() => toggleIssue(issue)}
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={!!selectedIssues.find(i => i.id === issue.id)}
                                onChange={() => toggleIssue(issue)}
                                className="mt-1"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {getCategoryIcon(issue.category)}
                                  <span className="font-medium text-gray-900">{issue.title}</span>
                                  <Badge className={getSeverityColor(issue.severity)}>
                                    {issue.severity}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 mb-2">{issue.description}</p>
                                <div className="text-sm bg-gray-50 p-2 rounded border-l-2 border-purple-400">
                                  <span className="font-medium text-purple-700">Sugerencia: </span>
                                  <span className="text-gray-700">{issue.suggestion}</span>
                                </div>
                                {issue.relatedUSCISIssue && (
                                  <Badge variant="outline" className="mt-2 text-xs">
                                    {issue.relatedUSCISIssue}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {analysis.issues?.length > 0 && (
                        <Button
                          onClick={improvePromptHandler}
                          disabled={improving || selectedIssues.length === 0}
                          className="w-full mt-4 bg-green-600 hover:bg-green-700"
                        >
                          {improving ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generando...</>
                          ) : (
                            <><Zap className="h-4 w-4 mr-2" /> Generar Prompt Mejorado ({selectedIssues.length})</>
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="result" className="space-y-4 mt-4">
                  {improvedPrompt && (
                    <>
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                              <Sparkles className="h-5 w-5 text-green-600" />
                              Prompt Mejorado
                            </CardTitle>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(improvedPrompt.improvedPrompt)}
                            >
                              <Copy className="h-4 w-4 mr-2" /> Copiar
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                            {improvedPrompt.improvedPrompt}
                          </div>
                        </CardContent>
                      </Card>

                      {improvedPrompt.changesExplained && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Cambios Realizados</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {improvedPrompt.changesExplained.map((change, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-sm">
                                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <span className="font-medium">{change.issueAddressed}:</span>{' '}
                                    <span className="text-gray-600">{change.changeDescription}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {improvedPrompt.additionalTips && (
                        <Card className="bg-blue-50 border-blue-200">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base text-blue-800 flex items-center gap-2">
                              <Lightbulb className="h-5 w-5" />
                              Tips Adicionales
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-1">
                              {improvedPrompt.additionalTips.map((tip, idx) => (
                                <li key={idx} className="text-sm text-blue-700 flex items-start gap-2">
                                  <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                  {tip}
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
