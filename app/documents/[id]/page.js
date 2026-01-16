'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Brain, ArrowLeft, FileText, Download, Trash2, 
  Calendar, User, FolderOpen, Loader2, AlertCircle,
  CheckCircle, XCircle, FileCheck
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function DocumentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [document, setDocument] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
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
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setLoading(false)
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

  const getDocTypeBadge = (type) => {
    const badges = {
      'RFE': 'bg-orange-100 text-orange-800 border-orange-200',
      'NOID': 'bg-red-100 text-red-800 border-red-200',
      'Denial': 'bg-red-200 text-red-900 border-red-300',
      'Brief': 'bg-blue-100 text-blue-800 border-blue-200',
      'CV': 'bg-purple-100 text-purple-800 border-purple-200',
      'Recommendation': 'bg-green-100 text-green-800 border-green-200',
      'Other': 'bg-gray-100 text-gray-800 border-gray-200'
    }
    return badges[type] || badges['Other']
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

  // Parse analysis if available
  let analysis = null
  try {
    if (document.analysis_summary) {
      analysis = typeof document.analysis_summary === 'string' 
        ? JSON.parse(document.analysis_summary) 
        : document.analysis_summary
    }
  } catch (e) {
    console.error('Error parsing analysis:', e)
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
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="mb-6">
          <Link href="/documents">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Documentos
            </Button>
          </Link>
        </div>

        {/* Document Header Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FileText className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{document.name}</CardTitle>
                  <CardDescription className="mt-1">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${getDocTypeBadge(document.doc_type)}`}>
                      {document.doc_type}
                    </span>
                  </CardDescription>
                </div>
              </div>
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
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-gray-500">Fecha del Documento</p>
                  <p className="font-medium">
                    {document.document_date 
                      ? new Date(document.document_date + 'T00:00:00').toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : new Date(document.created_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <FolderOpen className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-gray-500">Caso Asociado</p>
                  <p className="font-medium">
                    {document.cases?.title || 'Sin caso'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <FileCheck className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-gray-500">Caracteres</p>
                  <p className="font-medium">
                    {document.char_count?.toLocaleString() || document.text_content?.length?.toLocaleString() || '0'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-gray-500">ID Documento</p>
                  <p className="font-medium text-xs">
                    {document.id?.substring(0, 8)}...
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analysis Results */}
        {analysis && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Brain className="h-5 w-5 mr-2 text-purple-600" />
                Análisis del Documento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Verdict */}
              {analysis.verdict && (
                <div className={`p-4 rounded-lg ${
                  analysis.verdict === 'APOYA AL CLIENTE' 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    {analysis.verdict === 'APOYA AL CLIENTE' ? (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-600" />
                    )}
                    <span className={`text-lg font-bold ${
                      analysis.verdict === 'APOYA AL CLIENTE' ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {analysis.verdict}
                    </span>
                  </div>
                </div>
              )}

              {/* Relevance Score */}
              {analysis.relevance_percentage !== undefined && (
                <div className="flex items-center space-x-4">
                  <span className="text-gray-600">Relevancia:</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full ${
                        analysis.relevance_percentage >= 70 ? 'bg-green-500' :
                        analysis.relevance_percentage >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${analysis.relevance_percentage}%` }}
                    />
                  </div>
                  <span className="font-bold text-lg">{analysis.relevance_percentage}%</span>
                </div>
              )}

              {/* Summary */}
              {analysis.summary && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Resumen</h4>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{analysis.summary}</p>
                </div>
              )}

              {/* Why it supports/doesn't support */}
              {analysis.why_supports && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">¿Por qué apoya la solicitud?</h4>
                  <p className="text-gray-700 bg-green-50 p-3 rounded-lg border border-green-100">
                    {analysis.why_supports}
                  </p>
                </div>
              )}

              {/* Prong Analysis */}
              {analysis.prong_analysis && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Análisis por Prongs EB-2 NIW</h4>
                  <div className="grid gap-2">
                    {Object.entries(analysis.prong_analysis).map(([prong, value]) => (
                      <div key={prong} className="flex items-start space-x-3 p-2 bg-gray-50 rounded">
                        <Badge variant="outline" className="shrink-0">{prong}</Badge>
                        <span className="text-sm text-gray-700">{value || 'N/A'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Points */}
              {analysis.key_points && analysis.key_points.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Puntos Clave</h4>
                  <ul className="space-y-1">
                    {analysis.key_points.map((point, idx) => (
                      <li key={idx} className="flex items-start space-x-2 text-sm">
                        <span className="text-green-500 mt-1">•</span>
                        <span className="text-gray-700">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Text Content Preview */}
        {document.text_content && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2 text-gray-600" />
                Contenido Extraído
              </CardTitle>
              <CardDescription>
                Vista previa del texto extraído del documento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-sm bg-gray-50 p-4 rounded-lg overflow-auto max-h-96 whitespace-pre-wrap font-mono">
                {document.text_content}
              </pre>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
