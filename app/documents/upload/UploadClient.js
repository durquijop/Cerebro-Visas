'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { 
  Brain, ArrowLeft, Upload, FileText, CheckCircle, 
  AlertCircle, Loader2, FileUp, X 
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function UploadClient({ userId, cases, userRole }) {
  const [file, setFile] = useState(null)
  const [docType, setDocType] = useState('RFE')
  const [caseId, setCaseId] = useState('none')
  const [processWithAI, setProcessWithAI] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const router = useRouter()

  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      validateAndSetFile(droppedFile)
    }
  }, [])

  const validateAndSetFile = (selectedFile) => {
    const validExtensions = ['.pdf', '.docx', '.txt']
    const extension = '.' + selectedFile.name.split('.').pop().toLowerCase()
    
    if (!validExtensions.includes(extension)) {
      toast.error('Formato no soportado. Use PDF, DOCX o TXT.')
      return
    }

    if (selectedFile.size > 20 * 1024 * 1024) { // 20MB limit
      toast.error('El archivo excede el límite de 20MB')
      return
    }

    setFile(selectedFile)
    setResult(null)
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error('Seleccione un archivo')
      return
    }

    setUploading(true)
    setUploadProgress(10)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('doc_type', docType)
      formData.append('user_id', userId)
      formData.append('process_with_ai', processWithAI.toString())
      if (caseId && caseId !== 'none') {
        formData.append('case_id', caseId)
      }

      setUploadProgress(30)

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData
      })

      setUploadProgress(70)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al subir el archivo')
      }

      setUploadProgress(100)
      setResult(data)
      toast.success('Documento procesado exitosamente')

    } catch (error) {
      toast.error(error.message)
    } finally {
      setUploading(false)
    }
  }

  const resetForm = () => {
    setFile(null)
    setResult(null)
    setUploadProgress(0)
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
          <Link href="/dashboard">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Upload className="mr-3 h-8 w-8 text-blue-600" />
            Subir Documento
          </h1>
          <p className="text-gray-600 mt-1">
            Carga documentos RFE, NOID o Denial para análisis automático
          </p>
        </div>

        {!result ? (
          <Card>
            <CardHeader>
              <CardTitle>Cargar Nuevo Documento</CardTitle>
              <CardDescription>
                Formatos soportados: PDF, DOCX, TXT (máximo 20MB)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Drag & Drop Zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive 
                    ? 'border-blue-500 bg-blue-50' 
                    : file 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {file ? (
                  <div className="flex items-center justify-center space-x-4">
                    <FileText className="h-12 w-12 text-green-600" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setFile(null)}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <FileUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2">
                      Arrastra tu archivo aquí o
                    </p>
                    <label className="cursor-pointer">
                      <span className="text-blue-600 hover:underline">
                        selecciona un archivo
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.docx,.txt"
                        onChange={handleFileChange}
                      />
                    </label>
                  </>
                )}
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Documento</Label>
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RFE">RFE (Request for Evidence)</SelectItem>
                      <SelectItem value="NOID">NOID (Notice of Intent to Deny)</SelectItem>
                      <SelectItem value="Denial">Denial (Denegación)</SelectItem>
                      <SelectItem value="Brief">Brief / Cover Letter</SelectItem>
                      <SelectItem value="Other">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Asociar a Caso (opcional)</Label>
                  <Select value={caseId} onValueChange={setCaseId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin caso asociado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin caso asociado</SelectItem>
                      {cases.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* AI Processing Toggle */}
              <div className="flex items-center justify-between p-4 bg-navy-primary/5 rounded-lg">
                <div>
                  <Label className="text-base">Procesar con IA</Label>
                  <p className="text-sm text-gray-500">
                    Extraer motivos y taxonomía automáticamente
                  </p>
                </div>
                <Switch
                  checked={processWithAI}
                  onCheckedChange={setProcessWithAI}
                />
              </div>

              {/* Upload Progress */}
              {uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Procesando...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}

              {/* Upload Button */}
              <Button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                {uploading ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Procesando...</>
                ) : (
                  <><Upload className="mr-2 h-5 w-5" /> Subir y Procesar</>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Results View */
          <div className="space-y-6">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-green-900">Documento Procesado</h3>
                    <p className="text-green-700">{result.document.name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Text Extraction Result */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Extracción de Texto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Caracteres extraídos:</span>
                    <span className="font-medium">{result.extraction.textLength.toLocaleString()}</span>
                  </div>
                  {result.extraction.preview && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-600 mb-2">Vista previa:</p>
                      <pre className="text-xs bg-gray-100 p-4 rounded-lg overflow-auto max-h-40">
                        {result.extraction.preview}
                      </pre>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* AI Analysis Result */}
            {result.aiAnalysis && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Brain className="mr-2 h-5 w-5 text-purple-600" />
                    Análisis con IA
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Summary */}
                  {result.aiAnalysis.summary && (
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-medium text-purple-900 mb-2">Resumen</h4>
                      <p className="text-purple-800">{result.aiAnalysis.summary}</p>
                    </div>
                  )}

                  {/* Document Info */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Tipo:</span>
                      <span className="ml-2 font-medium">{result.aiAnalysis.document_type}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Categoría:</span>
                      <span className="ml-2 font-medium">{result.aiAnalysis.visa_category}</span>
                    </div>
                    {result.aiAnalysis.receipt_number && (
                      <div>
                        <span className="text-gray-600">Receipt #:</span>
                        <span className="ml-2 font-medium">{result.aiAnalysis.receipt_number}</span>
                      </div>
                    )}
                    {result.aiAnalysis.service_center && (
                      <div>
                        <span className="text-gray-600">Service Center:</span>
                        <span className="ml-2 font-medium">{result.aiAnalysis.service_center}</span>
                      </div>
                    )}
                  </div>

                  {/* Issues Found */}
                  {result.aiAnalysis.issues && result.aiAnalysis.issues.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Motivos Identificados</h4>
                      <div className="space-y-2">
                        {result.aiAnalysis.issues.map((issue, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg border ${
                              issue.severity === 'critical' ? 'bg-red-50 border-red-200' :
                              issue.severity === 'high' ? 'bg-orange-50 border-orange-200' :
                              issue.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                              'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <code className="text-xs bg-white px-2 py-1 rounded">
                                  {issue.taxonomy_code}
                                </code>
                                <p className="mt-1 text-sm font-medium">{issue.description}</p>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                issue.severity === 'critical' ? 'bg-red-200 text-red-800' :
                                issue.severity === 'high' ? 'bg-orange-200 text-orange-800' :
                                issue.severity === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                                'bg-gray-200 text-gray-800'
                              }`}>
                                {issue.severity}
                              </span>
                            </div>
                            {issue.quote && (
                              <blockquote className="mt-2 text-xs text-gray-600 italic border-l-2 border-gray-300 pl-2">
                                "{issue.quote}"
                              </blockquote>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Evidence Requested */}
                  {result.aiAnalysis.evidence_requested && result.aiAnalysis.evidence_requested.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Evidencia Solicitada</h4>
                      <ul className="space-y-2">
                        {result.aiAnalysis.evidence_requested.map((item, idx) => (
                          <li key={idx} className="flex items-start space-x-2 text-sm">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              item.priority === 'required' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {item.prong_mapping}
                            </span>
                            <span>{item.item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex space-x-4">
              <Button onClick={resetForm} variant="outline" className="flex-1">
                Subir Otro Documento
              </Button>
              {result.document?.id && (
                <Button 
                  onClick={() => router.push(`/documents/${result.document.id}`)} 
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  Ver Documento
                </Button>
              )}
              <Button onClick={() => router.push('/documents')} variant="outline" className="flex-1">
                Ver Todos
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
