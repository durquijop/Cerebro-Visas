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
  FileText, ChevronRight, Zap, Shield, TrendingUp
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
  const [selectedIssues, setSelectedIssues] = useState([])
  const [improving, setImproving] = useState(false)
  const [improvedPrompt, setImprovedPrompt] = useState(null)
  const [activeTab, setActiveTab] = useState('analyze')

  const analyzePrompt = async () => {
    if (!prompt.trim()) {
      toast.error('Ingresa un prompt para analizar')
      return
    }

    setAnalyzing(true)
    setAnalysis(null)
    setSelectedIssues([])
    setImprovedPrompt(null)

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
      toast.success(`Análisis completado - ${data.documentsAnalyzed} documentos consultados`)
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
          selectedIssues
        })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      setImprovedPrompt(data.result)
      setActiveTab('result')
      toast.success('Prompt mejorado generado')
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
          <Link href="/dashboard">
            <Button variant="ghost" className="text-gold-muted hover:text-gold-primary">
              <ArrowLeft className="h-4 w-4 mr-2" /> Volver
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-6xl">
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
