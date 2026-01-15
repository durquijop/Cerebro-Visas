'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  ArrowLeft, FileText, Upload, Trash2, Download, 
  Calendar, User, Building, CheckCircle, AlertCircle,
  Clock, Brain, Loader2, Eye
} from 'lucide-react'

const DOCUMENT_TYPES = [
  { value: 'petition', label: 'Petición I-140' },
  { value: 'rfe', label: 'RFE (Request for Evidence)' },
  { value: 'rfe_response', label: 'Respuesta a RFE' },
  { value: 'noid', label: 'NOID (Notice of Intent to Deny)' },
  { value: 'approval', label: 'Aprobación' },
  { value: 'denial', label: 'Denegación' },
  { value: 'support_letter', label: 'Carta de Apoyo' },
  { value: 'cv', label: 'CV / Resume' },
  { value: 'evidence', label: 'Evidencia' },
  { value: 'other', label: 'Otro' }
]

const OUTCOME_COLORS = {
  pending: 'bg-yellow-500',
  approved: 'bg-green-500',
  rfe: 'bg-orange-500',
  noid: 'bg-red-400',
  denied: 'bg-red-600'
}

const OUTCOME_LABELS = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rfe: 'RFE',
  noid: 'NOID',
  denied: 'Denegado'
}

export default function CaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const fileInputRef = useRef(null)
  
  const [caseData, setCaseData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [selectedDocType, setSelectedDocType] = useState('other')
  const [analyzing, setAnalyzing] = useState(false)

  // Cargar datos del caso
  useEffect(() => {
    if (params.id) {
      fetchCase()
    }
  }, [params.id])

  const fetchCase = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/casos/${params.id}`)
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      setCaseData(data.case)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('case_id', params.id)
      formData.append('doc_type', selectedDocType)

      const response = await fetch('/api/casos/documents/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al subir archivo')
      }

      // Recargar datos del caso
      await fetchCase()
      setUploadDialogOpen(false)
      setSelectedDocType('other')
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      const response = await fetch(`/api/casos/${params.id}/analyze`, {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al analizar')
      }

      // Recargar datos del caso
      await fetchCase()
      alert('Análisis completado')
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDeleteDocument = async (docId) => {
    if (!confirm('¿Eliminar este documento?')) return

    try {
      const response = await fetch(`/api/casos/documents/${docId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Error al eliminar')
      }

      await fetchCase()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#d4af37]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a1628] p-8">
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" onClick={() => router.push('/casos')} className="mb-4 text-white">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
          <Card className="bg-red-900/20 border-red-500">
            <CardContent className="pt-6">
              <p className="text-red-400">Error: {error}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-[#0a1628] p-8">
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" onClick={() => router.push('/casos')} className="mb-4 text-white">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
          <Card className="bg-[#1a2744] border-[#2a3f5f]">
            <CardContent className="pt-6">
              <p className="text-gray-400">Caso no encontrado</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a1628]">
      {/* Header */}
      <header className="bg-[#0d1d35] border-b border-[#1a2744] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push('/casos')} className="text-gray-300 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Casos
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#d4af37] hover:bg-[#c9a432] text-black">
                  <Upload className="mr-2 h-4 w-4" /> Subir Documento
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#1a2744] border-[#2a3f5f]">
                <DialogHeader>
                  <DialogTitle className="text-white">Subir Documento al Caso</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label className="text-gray-300">Tipo de Documento</Label>
                    <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                      <SelectTrigger className="bg-[#0d1d35] border-[#2a3f5f] text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a2744] border-[#2a3f5f]">
                        {DOCUMENT_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value} className="text-white">
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-gray-300">Archivo (PDF, DOCX, TXT)</Label>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="bg-[#0d1d35] border-[#2a3f5f] text-white mt-1"
                    />
                  </div>
                  {uploading && (
                    <div className="flex items-center gap-2 text-[#d4af37]">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Subiendo y extrayendo texto...</span>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Button 
              onClick={handleAnalyze} 
              disabled={analyzing || !caseData.documents?.length}
              variant="outline"
              className="border-[#d4af37] text-[#d4af37] hover:bg-[#d4af37]/10"
            >
              {analyzing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Brain className="mr-2 h-4 w-4" />
              )}
              Analizar con IA
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Case Info */}
        <Card className="bg-[#1a2744] border-[#2a3f5f]">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl text-white flex items-center gap-3">
                  {caseData.title}
                  <Badge className={`${OUTCOME_COLORS[caseData.outcome] || 'bg-gray-500'} text-white`}>
                    {OUTCOME_LABELS[caseData.outcome] || caseData.outcome}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-gray-400 mt-1">
                  {caseData.visa_category || 'EB-2 NIW'} • {caseData.documents?.length || 0} documentos
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2 text-gray-300">
                <User className="h-4 w-4 text-[#d4af37]" />
                <div>
                  <p className="text-xs text-gray-500">Beneficiario</p>
                  <p>{caseData.beneficiary_name || 'No especificado'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <Building className="h-4 w-4 text-[#d4af37]" />
                <div>
                  <p className="text-xs text-gray-500">Service Center</p>
                  <p>{caseData.service_center || 'No especificado'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <Calendar className="h-4 w-4 text-[#d4af37]" />
                <div>
                  <p className="text-xs text-gray-500">Fecha</p>
                  <p>{caseData.filed_date ? new Date(caseData.filed_date).toLocaleDateString() : 'No especificada'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <Clock className="h-4 w-4 text-[#d4af37]" />
                <div>
                  <p className="text-xs text-gray-500">Creado</p>
                  <p>{new Date(caseData.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
            {caseData.description && (
              <div className="mt-4 pt-4 border-t border-[#2a3f5f]">
                <p className="text-gray-400 text-sm">{caseData.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Analysis Results */}
        {caseData.case_analysis && (
          <Card className="bg-[#1a2744] border-[#2a3f5f]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Brain className="h-5 w-5 text-[#d4af37]" />
                Análisis IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-invert max-w-none">
                {typeof caseData.case_analysis === 'string' ? (
                  <p className="text-gray-300">{caseData.case_analysis}</p>
                ) : (
                  <pre className="text-gray-300 text-sm bg-[#0d1d35] p-4 rounded-lg overflow-auto">
                    {JSON.stringify(caseData.case_analysis, null, 2)}
                  </pre>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Documents */}
        <Card className="bg-[#1a2744] border-[#2a3f5f]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#d4af37]" />
              Documentos ({caseData.documents?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!caseData.documents?.length ? (
              <div className="text-center py-8 text-gray-400">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay documentos en este caso</p>
                <p className="text-sm">Sube documentos para comenzar el análisis</p>
              </div>
            ) : (
              <div className="space-y-3">
                {caseData.documents.map((doc) => (
                  <div 
                    key={doc.id} 
                    className="flex items-center justify-between p-4 bg-[#0d1d35] rounded-lg border border-[#2a3f5f]"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-[#d4af37]" />
                      <div>
                        <p className="text-white font-medium">{doc.original_name}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-400">
                          <Badge variant="outline" className="text-xs">
                            {DOCUMENT_TYPES.find(t => t.value === doc.doc_type)?.label || doc.doc_type}
                          </Badge>
                          <span>{doc.word_count || 0} palabras</span>
                          {doc.extraction_success ? (
                            <span className="text-green-400 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> Extraído
                            </span>
                          ) : (
                            <span className="text-red-400 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> Sin texto
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
