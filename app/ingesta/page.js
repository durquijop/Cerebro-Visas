'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Brain, Upload, FileText, CheckCircle, AlertCircle, 
  Loader2, FileUp, X, Eye, Download, Trash2, RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const DOC_TYPES = [
  { value: 'RFE', label: 'RFE (Request for Evidence)' },
  { value: 'NOID', label: 'NOID (Notice of Intent to Deny)' },
  { value: 'Denial', label: 'Denial (Denegación)' },
  { value: 'CoverLetter', label: 'Cover Letter' },
  { value: 'Brief', label: 'Brief / Legal Memo' },
  { value: 'RecommendationLetter', label: 'Carta de Recomendación' },
  { value: 'BusinessPlan', label: 'Business Plan' },
  { value: 'Econometric', label: 'Estudio Econométrico' },
  { value: 'ExhibitIndex', label: 'Exhibit Index' },
  { value: 'Other', label: 'Otro' }
]

export default function IngestaPage() {
  const [file, setFile] = useState(null)
  const [docType, setDocType] = useState('RFE')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [documents, setDocuments] = useState([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState(null)

  // Cargar documentos existentes
  const loadDocuments = async () => {
    setLoadingDocs(true)
    try {
      const res = await fetch('/api/ingesta/documents')
      const data = await res.json()
      if (data.documents) {
        setDocuments(data.documents)
      }
    } catch (error) {
      console.error('Error loading documents:', error)
    } finally {
      setLoadingDocs(false)
    }
  }

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
      validateAndSetFile(e.dataTransfer.files[0])
    }
  }, [])

  const validateAndSetFile = (selectedFile) => {
    const validExtensions = ['.pdf', '.docx', '.doc', '.txt']
    const extension = '.' + selectedFile.name.split('.').pop().toLowerCase()
    
    if (!validExtensions.includes(extension)) {
      toast.error('Formato no soportado. Use PDF, DOCX, DOC o TXT.')
      return
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      toast.error('El archivo excede el límite de 50MB')
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

      setUploadProgress(30)

      const response = await fetch('/api/ingesta/upload', {
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
      
      // Recargar lista de documentos
      loadDocuments()

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

  const viewDocument = async (docId) => {
    try {
      const res = await fetch(`/api/ingesta/documents/${docId}`)
      const data = await res.json()
      if (data.document) {
        setSelectedDoc(data.document)
      }
    } catch (error) {
      toast.error('Error al cargar documento')
    }
  }

  const getDocTypeBadge = (type) => {
    const badges = {
      'RFE': 'bg-orange-100 text-orange-800',
      'NOID': 'bg-red-100 text-red-800',
      'Denial': 'bg-red-200 text-red-900',
      'CoverLetter': 'bg-blue-100 text-blue-800',
      'Brief': 'bg-purple-100 text-purple-800',
      'RecommendationLetter': 'bg-green-100 text-green-800',
      'BusinessPlan': 'bg-cyan-100 text-cyan-800',
      'Econometric': 'bg-indigo-100 text-indigo-800',
      'ExhibitIndex': 'bg-gray-100 text-gray-800',
      'Other': 'bg-gray-100 text-gray-800'
    }
    return badges[type] || badges['Other']
  }

  return (
    <div className="min-h-screen bg-navy-primary">
      {/* Header */}
      <header className="border-b border-navy-light">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-3">
            <Brain className="h-8 w-8 text-gold-primary" />
            <span className="text-2xl font-bold text-gold-subtle">Cerebro Visas</span>
          </Link>
          <span className="text-gold-muted text-sm">Módulo de Ingesta de Documentos</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gold-subtle flex items-center">
            <Upload className="mr-3 h-8 w-8 text-gold-primary" />
            Ingesta de Documentos
          </h1>
          <p className="text-gold-muted mt-2">
            Sube documentos de inmigración para extraer y canonicalizar su contenido
          </p>
        </div>

        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList className="bg-navy-secondary border border-navy-light">
            <TabsTrigger value="upload" className="data-[state=active]:bg-gold-primary data-[state=active]:text-navy-primary">
              <Upload className="mr-2 h-4 w-4" /> Subir Documento
            </TabsTrigger>
            <TabsTrigger value="documents" className="data-[state=active]:bg-gold-primary data-[state=active]:text-navy-primary" onClick={loadDocuments}>
              <FileText className="mr-2 h-4 w-4" /> Documentos ({documents.length})
            </TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload">
            {!result ? (
              <Card className="bg-navy-secondary border-navy-light">
                <CardHeader>
                  <CardTitle className="text-gold-subtle">Cargar Nuevo Documento</CardTitle>
                  <CardDescription className="text-gold-muted">
                    Formatos soportados: PDF, DOCX, DOC, TXT (máximo 50MB)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Drag & Drop Zone */}
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragActive 
                        ? 'border-gold-primary bg-navy-light/50' 
                        : file 
                          ? 'border-green-500 bg-green-500/10' 
                          : 'border-navy-light hover:border-gold-muted'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    {file ? (
                      <div className="flex items-center justify-center space-x-4">
                        <FileText className="h-12 w-12 text-green-500" />
                        <div className="text-left">
                          <p className="font-medium text-gold-subtle">{file.name}</p>
                          <p className="text-sm text-gold-muted">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setFile(null)}
                          className="text-gold-muted hover:text-red-400"
                        >
                          <X className="h-5 w-5" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <FileUp className="h-12 w-12 text-gold-muted mx-auto mb-4" />
                        <p className="text-gold-muted mb-2">
                          Arrastra tu archivo aquí o
                        </p>
                        <label className="cursor-pointer">
                          <span className="text-gold-primary hover:underline">
                            selecciona un archivo
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.docx,.doc,.txt"
                            onChange={handleFileChange}
                          />
                        </label>
                      </>
                    )}
                  </div>

                  {/* Document Type Selection */}
                  <div className="space-y-2">
                    <Label className="text-gold-subtle">Tipo de Documento</Label>
                    <Select value={docType} onValueChange={setDocType}>
                      <SelectTrigger className="bg-navy-primary border-navy-light text-gold-subtle">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-navy-secondary border-navy-light">
                        {DOC_TYPES.map((type) => (
                          <SelectItem 
                            key={type.value} 
                            value={type.value}
                            className="text-gold-subtle hover:bg-navy-light"
                          >
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Upload Progress */}
                  {uploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-gold-muted">
                        <span>Procesando documento...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                    </div>
                  )}

                  {/* Upload Button */}
                  <Button
                    onClick={handleUpload}
                    disabled={!file || uploading}
                    className="w-full bg-gold-primary text-navy-primary hover:bg-gold-dark"
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
                <Card className="border-green-500/50 bg-green-500/10">
                  <CardContent className="pt-6">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-8 w-8 text-green-500" />
                      <div>
                        <h3 className="font-semibold text-green-400">Documento Procesado Exitosamente</h3>
                        <p className="text-green-300">{result.document?.original_name}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Canonical Data Preview */}
                <Card className="bg-navy-secondary border-navy-light">
                  <CardHeader>
                    <CardTitle className="text-gold-subtle">Datos Canonicalizados (JSON)</CardTitle>
                    <CardDescription className="text-gold-muted">
                      Formato estándar extraído del documento
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Metadata */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 bg-navy-primary rounded-lg">
                          <p className="text-xs text-gold-muted">Tipo</p>
                          <p className="text-gold-subtle font-medium">{result.canonical?.metadata?.doc_type}</p>
                        </div>
                        <div className="p-3 bg-navy-primary rounded-lg">
                          <p className="text-xs text-gold-muted">Páginas</p>
                          <p className="text-gold-subtle font-medium">{result.canonical?.metadata?.page_count || 'N/A'}</p>
                        </div>
                        <div className="p-3 bg-navy-primary rounded-lg">
                          <p className="text-xs text-gold-muted">Caracteres</p>
                          <p className="text-gold-subtle font-medium">{result.canonical?.metadata?.char_count?.toLocaleString()}</p>
                        </div>
                        <div className="p-3 bg-navy-primary rounded-lg">
                          <p className="text-xs text-gold-muted">Palabras</p>
                          <p className="text-gold-subtle font-medium">{result.canonical?.metadata?.word_count?.toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Text Preview */}
                      <div>
                        <p className="text-sm text-gold-muted mb-2">Vista previa del texto extraído:</p>
                        <pre className="text-xs text-gold-subtle bg-navy-primary p-4 rounded-lg overflow-auto max-h-60 whitespace-pre-wrap">
                          {result.canonical?.text_clean?.substring(0, 2000)}
                          {result.canonical?.text_clean?.length > 2000 && '...'}
                        </pre>
                      </div>

                      {/* Raw JSON */}
                      <details className="group">
                        <summary className="cursor-pointer text-gold-primary hover:text-gold-dark text-sm">
                          Ver JSON completo
                        </summary>
                        <pre className="mt-2 text-xs text-gold-muted bg-navy-primary p-4 rounded-lg overflow-auto max-h-96">
                          {JSON.stringify(result.canonical, null, 2)}
                        </pre>
                      </details>
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex space-x-4">
                  <Button onClick={resetForm} variant="outline" className="flex-1 border-gold-muted text-gold-subtle hover:bg-navy-light">
                    Subir Otro Documento
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Documents List Tab */}
          <TabsContent value="documents">
            <Card className="bg-navy-secondary border-navy-light">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-gold-subtle">Documentos Procesados</CardTitle>
                  <CardDescription className="text-gold-muted">
                    {documents.length} documento(s) en el sistema
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadDocuments}
                  disabled={loadingDocs}
                  className="border-gold-muted text-gold-subtle"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loadingDocs ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
              </CardHeader>
              <CardContent>
                {loadingDocs ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-gold-primary" />
                    <p className="mt-2 text-gold-muted">Cargando documentos...</p>
                  </div>
                ) : documents.length > 0 ? (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div 
                        key={doc.id}
                        className="flex items-center justify-between p-4 bg-navy-primary rounded-lg border border-navy-light hover:border-gold-muted transition-colors"
                      >
                        <div className="flex items-center space-x-4">
                          <FileText className="h-8 w-8 text-gold-muted" />
                          <div>
                            <p className="font-medium text-gold-subtle">{doc.original_name}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${getDocTypeBadge(doc.doc_type)}`}>
                                {doc.doc_type}
                              </span>
                              <span className="text-xs text-gold-muted">
                                {new Date(doc.created_at).toLocaleDateString('es-ES')}
                              </span>
                              <span className="text-xs text-gold-muted">
                                {doc.char_count?.toLocaleString()} chars
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => viewDocument(doc.id)}
                          className="text-gold-primary hover:text-gold-dark"
                        >
                          <Eye className="h-4 w-4 mr-1" /> Ver
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-navy-light mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gold-subtle">No hay documentos</h3>
                    <p className="text-gold-muted mt-1">Sube tu primer documento para comenzar</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Document Detail Modal */}
            {selectedDoc && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                <Card className="bg-navy-secondary border-navy-light max-w-4xl w-full max-h-[90vh] overflow-auto">
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-gold-subtle">{selectedDoc.original_name}</CardTitle>
                      <CardDescription className="text-gold-muted">
                        {selectedDoc.doc_type} • {new Date(selectedDoc.created_at).toLocaleString('es-ES')}
                      </CardDescription>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setSelectedDoc(null)}
                      className="text-gold-muted hover:text-gold-primary"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-4 gap-4">
                      <div className="p-3 bg-navy-primary rounded-lg">
                        <p className="text-xs text-gold-muted">Páginas</p>
                        <p className="text-gold-subtle font-medium">{selectedDoc.page_count || 'N/A'}</p>
                      </div>
                      <div className="p-3 bg-navy-primary rounded-lg">
                        <p className="text-xs text-gold-muted">Caracteres</p>
                        <p className="text-gold-subtle font-medium">{selectedDoc.char_count?.toLocaleString()}</p>
                      </div>
                      <div className="p-3 bg-navy-primary rounded-lg">
                        <p className="text-xs text-gold-muted">Palabras</p>
                        <p className="text-gold-subtle font-medium">{selectedDoc.word_count?.toLocaleString()}</p>
                      </div>
                      <div className="p-3 bg-navy-primary rounded-lg">
                        <p className="text-xs text-gold-muted">Formato</p>
                        <p className="text-gold-subtle font-medium">{selectedDoc.file_type?.toUpperCase()}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gold-muted mb-2">Contenido extraído:</p>
                      <pre className="text-sm text-gold-subtle bg-navy-primary p-4 rounded-lg overflow-auto max-h-96 whitespace-pre-wrap">
                        {selectedDoc.text_content}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
