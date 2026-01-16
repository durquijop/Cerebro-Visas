'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Brain, ArrowLeft, FileText, Trash2, 
  Calendar, FolderOpen, Loader2, AlertCircle,
  AlertTriangle, CheckCircle2, XCircle, FileCheck,
  ClipboardList, Scale, Target, MessageSquareWarning,
  Building2, User2, Hash, Clock
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function DocumentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [document, setDocument] = useState(null)
  const [issues, setIssues] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (params.id) {
      fetchDocument()
    }
  }, [params.id])

  const fetchDocument = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/documents/${params.id}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Documento no encontrado')
        } else {
          throw new Error('Error al cargar el documento')
        }
        return
      }

      const data = await response.json()
      setDocument(data)
      
      // Cargar issues y requests si existen
      if (data.id) {
        fetchIssuesAndRequests(data.id)
      }
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchIssuesAndRequests = async (docId) => {
    try {
      // Fetch issues
      const issuesRes = await fetch(`/api/documents/${docId}/issues`)
      if (issuesRes.ok) {
        const issuesData = await issuesRes.json()
        setIssues(issuesData.issues || [])
      }
      
      // Fetch requests
      const requestsRes = await fetch(`/api/documents/${docId}/requests`)
      if (requestsRes.ok) {
        const requestsData = await requestsRes.json()
        setRequests(requestsData.requests || [])
      }
    } catch (err) {
      console.error('Error fetching issues/requests:', err)
    }
  }

  const handleDelete = async () => {
    if (!confirm('¿Está seguro de eliminar este documento?')) return

    try {
      setDeleting(true)
      const response = await fetch(`/api/documents/${params.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Error al eliminar el documento')
      }

      toast.success('Documento eliminado')
      router.push('/documents')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleProcessWithAI = async () => {
    if (!document?.text_content || document.text_content.length < 100) {
      toast.error('El documento no tiene suficiente texto para procesar')
      return
    }

    try {
      setProcessing(true)
      toast.info('Procesando documento con IA... Esto puede tardar un momento.')

      const response = await fetch(`/api/documents/${params.id}/process`, {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al procesar el documento')
      }

      const result = await response.json()
      
      toast.success(`Procesamiento completado: ${result.issues_count || 0} issues encontrados`)
      
      // Recargar el documento para ver los resultados
      fetchDocument()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const getSeverityBadge = (severity) => {
    const styles = {
      critical: 'bg-red-100 text-red-800 border-red-300',
      high: 'bg-orange-100 text-orange-800 border-orange-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      low: 'bg-blue-100 text-blue-800 border-blue-300'
    }
    const labels = {
      critical: 'Crítico',
      high: 'Alto',
      medium: 'Medio',
      low: 'Bajo'
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[severity] || styles.medium}`}>
        {labels[severity] || severity}
      </span>
    )
  }

  const getProngBadge = (prong) => {
    const styles = {
      P1: 'bg-purple-100 text-purple-800',
      P2: 'bg-blue-100 text-blue-800',
      P3: 'bg-green-100 text-green-800',
      EVIDENCE: 'bg-amber-100 text-amber-800',
      COHERENCE: 'bg-pink-100 text-pink-800',
      PROCEDURAL: 'bg-gray-100 text-gray-800'
    }
    const labels = {
      P1: 'Prong 1 - Mérito/Importancia',
      P2: 'Prong 2 - Bien Posicionado',
      P3: 'Prong 3 - Balance',
      EVIDENCE: 'Evidencia',
      COHERENCE: 'Coherencia',
      PROCEDURAL: 'Procedural'
    }
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[prong] || 'bg-gray-100'}`}>
        {labels[prong] || prong}
      </span>
    )
  }

  const getOutcomeIcon = (outcome) => {
    switch (outcome) {
      case 'RFE': return <AlertTriangle className="h-5 w-5 text-orange-500" />
      case 'NOID': return <XCircle className="h-5 w-5 text-red-500" />
      case 'Denial': return <XCircle className="h-5 w-5 text-red-700" />
      case 'Approval': return <CheckCircle2 className="h-5 w-5 text-green-500" />
      default: return <FileText className="h-5 w-5 text-gray-500" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando documento...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Link href="/documents">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Documentos
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!document) return null

  // Parsear structured_data o analysis_summary
  let structuredData = document.structured_data || {}
  
  // Si no hay structured_data, intentar parsear analysis_summary
  if (Object.keys(structuredData).length === 0 && document.analysis_summary) {
    try {
      const parsed = typeof document.analysis_summary === 'string' 
        ? JSON.parse(document.analysis_summary) 
        : document.analysis_summary
      
      // Si tiene formato de summary, envolverlo
      if (parsed && !parsed.document_info && !parsed.issues) {
        structuredData = { summary: parsed }
      } else {
        structuredData = parsed
      }
    } catch (e) {
      console.error('Error parsing analysis_summary:', e)
    }
  }
  
  const docInfo = structuredData.document_info || {}
  const summary = structuredData.summary || {}
  
  // Usar issues de structuredData si existen, sino usar del estado
  const displayIssues = structuredData.issues || issues
  const displayRequests = structuredData.requests || requests

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
      <main className="container mx-auto px-6 py-8 max-w-6xl">
        <div className="mb-6">
          <Link href="/documents">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Documentos
            </Button>
          </Link>
        </div>

        {/* Document Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  {getOutcomeIcon(document.outcome_type || document.doc_type)}
                </div>
                <div>
                  <CardTitle className="text-2xl flex items-center gap-3">
                    {document.name || document.original_name || 'Sin nombre'}
                    {document.outcome_type && (
                      <Badge variant="outline" className="text-sm">
                        {document.outcome_type}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-2">
                    {document.visa_category && (
                      <Badge className="bg-indigo-100 text-indigo-800">
                        {document.visa_category}
                      </Badge>
                    )}
                    {summary.overall_severity && getSeverityBadge(summary.overall_severity)}
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                {/* Botón Procesar con IA - solo si no tiene análisis */}
                {(!structuredData.issues || structuredData.issues.length === 0) && document.text_content && document.text_content.length > 100 && (
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={handleProcessWithAI}
                    disabled={processing}
                    className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                  >
                    {processing ? (
                      <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Procesando...</>
                    ) : (
                      <><Brain className="h-4 w-4 mr-1" /> Procesar con IA</>
                    )}
                  </Button>
                )}
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-gray-500">Fecha Documento</p>
                  <p className="font-medium">
                    {document.document_date || docInfo.document_date
                      ? new Date((document.document_date || docInfo.document_date) + 'T00:00:00').toLocaleDateString('es-ES', {
                          year: 'numeric', month: 'long', day: 'numeric'
                        })
                      : 'No detectada'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-gray-500">Deadline Respuesta</p>
                  <p className="font-medium">
                    {docInfo.response_deadline 
                      ? new Date(docInfo.response_deadline + 'T00:00:00').toLocaleDateString('es-ES')
                      : 'No especificado'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Building2 className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-gray-500">Service Center</p>
                  <p className="font-medium">{document.service_center || docInfo.service_center || 'No especificado'}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Hash className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-gray-500">Receipt #</p>
                  <p className="font-medium text-xs">{document.receipt_number || docInfo.receipt_number || 'No detectado'}</p>
                </div>
              </div>
            </div>
            
            {/* Beneficiary Info */}
            {(document.beneficiary_name || docInfo.beneficiary_name) && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <User2 className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-500">Beneficiario:</span>
                  <span className="font-medium">{document.beneficiary_name || docInfo.beneficiary_name}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Executive Summary */}
        {summary.executive_summary && (
          <Card className="mb-6 border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5 text-blue-600" />
                Resumen Ejecutivo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{summary.executive_summary}</p>
              
              {/* Prongs Affected */}
              {summary.prongs_affected && (
                <div className="mt-4 flex items-center gap-4">
                  <span className="text-sm text-gray-500">Prongs afectados:</span>
                  <div className="flex gap-2">
                    <Badge variant={summary.prongs_affected.P1 ? "destructive" : "outline"} className="text-xs">
                      P1 {summary.prongs_affected.P1 ? '⚠️' : '✓'}
                    </Badge>
                    <Badge variant={summary.prongs_affected.P2 ? "destructive" : "outline"} className="text-xs">
                      P2 {summary.prongs_affected.P2 ? '⚠️' : '✓'}
                    </Badge>
                    <Badge variant={summary.prongs_affected.P3 ? "destructive" : "outline"} className="text-xs">
                      P3 {summary.prongs_affected.P3 ? '⚠️' : '✓'}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tabs for Issues, Requests, Text */}
        <Tabs defaultValue="issues" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="issues" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Issues ({displayIssues.length})
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Requests ({displayRequests.length})
            </TabsTrigger>
            <TabsTrigger value="text" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Texto
            </TabsTrigger>
          </TabsList>

          {/* Issues Tab */}
          <TabsContent value="issues">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquareWarning className="h-5 w-5 text-orange-500" />
                  Deficiencias Identificadas
                </CardTitle>
                <CardDescription>
                  Issues extraídos del documento mapeados a la taxonomía NIW
                </CardDescription>
              </CardHeader>
              <CardContent>
                {displayIssues.length > 0 ? (
                  <div className="space-y-4">
                    {displayIssues.map((issue, idx) => (
                      <div key={idx} className="p-4 border rounded-lg bg-white hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getProngBadge(issue.prong_affected)}
                            {getSeverityBadge(issue.severity)}
                          </div>
                          {issue.page_ref && (
                            <span className="text-xs text-gray-400">Pág. {issue.page_ref}</span>
                          )}
                        </div>
                        
                        <p className="text-sm font-medium text-gray-800 mb-2">
                          <code className="text-xs bg-gray-100 px-1 rounded mr-2">{issue.taxonomy_code}</code>
                        </p>
                        
                        {issue.officer_reasoning && (
                          <p className="text-sm text-gray-700 mb-2">{issue.officer_reasoning}</p>
                        )}
                        
                        {issue.extracted_quote && (
                          <blockquote className="text-sm text-gray-600 italic border-l-2 border-gray-300 pl-3 mt-2">
                            "{issue.extracted_quote}"
                          </blockquote>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No se encontraron issues estructurados.</p>
                    <p className="text-sm">El documento puede no haber sido procesado con IA aún.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Requests Tab */}
          <TabsContent value="requests">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-blue-500" />
                  Evidencia Solicitada por USCIS
                </CardTitle>
                <CardDescription>
                  Documentos y explicaciones que USCIS pide en este {document.outcome_type || document.doc_type}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(structuredData.requests || requests).length > 0 ? (
                  <div className="space-y-3">
                    {(structuredData.requests || requests).map((req, idx) => (
                      <div key={idx} className="p-4 border rounded-lg bg-white hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {req.prong_mapping && getProngBadge(req.prong_mapping)}
                            <Badge variant={req.priority === 'required' ? 'default' : 'secondary'} className="text-xs">
                              {req.priority === 'required' ? '⚡ Requerido' : '📌 Recomendado'}
                            </Badge>
                          </div>
                          {req.evidence_type && (
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                              {req.evidence_type}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-800">{req.request_text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No se encontraron requests estructurados.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Text Tab */}
          <TabsContent value="text">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-500" />
                  Contenido Extraído
                </CardTitle>
                <CardDescription>
                  {document.text_content?.length?.toLocaleString() || 0} caracteres extraídos del documento
                </CardDescription>
              </CardHeader>
              <CardContent>
                {document.text_content ? (
                  <pre className="text-sm bg-gray-50 p-4 rounded-lg overflow-auto max-h-[600px] whitespace-pre-wrap font-mono">
                    {document.text_content}
                  </pre>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No hay texto extraído disponible.</p>
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
