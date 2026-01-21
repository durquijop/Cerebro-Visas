'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Brain, ArrowLeft, Upload, FileText, CheckCircle, 
  AlertCircle, Loader2, FileUp, X, Files, Sparkles, Trash2,
  Database
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function UploadClient({ userId, cases, userRole }) {
  // Single file upload state
  const [file, setFile] = useState(null)
  const [docType, setDocType] = useState('RFE')
  const [caseId, setCaseId] = useState('none')
  const [processWithAI, setProcessWithAI] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  
  // Bulk upload state
  const [bulkFiles, setBulkFiles] = useState([])
  const [bulkDocType, setBulkDocType] = useState('RFE')
  const [generateEmbeddings, setGenerateEmbeddings] = useState(true)
  const [bulkUploading, setBulkUploading] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 })
  const [bulkResults, setBulkResults] = useState(null)
  const [bulkDragActive, setBulkDragActive] = useState(false)
  
  const router = useRouter()

  // ============ SINGLE FILE UPLOAD ============
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

    if (selectedFile.size > 20 * 1024 * 1024) {
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
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('docType', docType)
      formData.append('processWithAI', processWithAI.toString())
      
      if (caseId && caseId !== 'none') {
        formData.append('caseId', caseId)
      }

      setUploadProgress(30)

      const endpoint = caseId && caseId !== 'none' 
        ? '/api/casos/documents/upload'
        : '/api/documents/upload'

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      })

      setUploadProgress(70)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al subir archivo')
      }

      setUploadProgress(100)
      setResult({
        success: true,
        message: 'Documento subido exitosamente',
        documentId: data.document?.id,
        textExtracted: data.textExtracted,
        aiProcessed: data.aiProcessed
      })

      toast.success('Documento subido exitosamente')
      setFile(null)

    } catch (error) {
      setResult({
        success: false,
        message: error.message
      })
      toast.error(error.message)
    } finally {
      setUploading(false)
    }
  }

  // ============ BULK UPLOAD FOR RAG ============
  const handleBulkDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setBulkDragActive(true)
    } else if (e.type === 'dragleave') {
      setBulkDragActive(false)
    }
  }, [])

  const handleBulkDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setBulkDragActive(false)

    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files).filter(validateBulkFile)
      setBulkFiles(prev => [...prev, ...newFiles])
    }
  }, [])

  const validateBulkFile = (file) => {
    const validExtensions = ['.pdf', '.docx', '.txt']
    const extension = '.' + file.name.split('.').pop().toLowerCase()
    
    if (!validExtensions.includes(extension)) {
      toast.error(`${file.name}: Formato no soportado`)
      return false
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error(`${file.name}: Excede 20MB`)
      return false
    }

    return true
  }

  const handleBulkFileChange = (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(validateBulkFile)
      setBulkFiles(prev => [...prev, ...newFiles])
    }
  }

  const removeBulkFile = (index) => {
    setBulkFiles(prev => prev.filter((_, i) => i !== index))
  }

  const clearBulkFiles = () => {
    setBulkFiles([])
    setBulkResults(null)
  }

  const handleBulkUpload = async () => {
    if (bulkFiles.length === 0) {
      toast.error('Agregue al menos un archivo')
      return
    }

    setBulkUploading(true)
    setBulkProgress({ current: 0, total: bulkFiles.length })
    setBulkResults(null)

    try {
      const formData = new FormData()
      bulkFiles.forEach(file => formData.append('files', file))
      formData.append('docType', bulkDocType)
      formData.append('generateEmbeddings', generateEmbeddings.toString())

      const response = await fetch('/api/documents/bulk-upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error en carga masiva')
      }

      setBulkResults(data)
      
      const totalEmbeddings = data.results?.reduce((sum, r) => sum + (r.embeddingsGenerated || 0), 0) || 0
      
      toast.success(
        `${data.processed} documentos procesados` + 
        (generateEmbeddings ? `, ${totalEmbeddings} embeddings generados` : '')
      )

      if (data.processed > 0) {
        setBulkFiles([])
      }

    } catch (error) {
      toast.error(error.message)
      setBulkResults({ error: error.message })
    } finally {
      setBulkUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-navy-primary border-b border-navy-light">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Brain className="h-8 w-8 text-gold-primary" />
            <span className="text-xl font-bold text-gold-subtle">Subir Documentos</span>
          </div>
          <Link href="/dashboard">
            <Button variant="ghost" className="text-gold-muted hover:text-gold-primary">
              <ArrowLeft className="h-4 w-4 mr-2" /> Volver
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-4xl">
        <Tabs defaultValue="single" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <FileUp className="h-4 w-4" />
              Documento Individual
            </TabsTrigger>
            <TabsTrigger value="bulk" className="flex items-center gap-2">
              <Files className="h-4 w-4" />
              Carga Masiva (RAG)
            </TabsTrigger>
          </TabsList>

          {/* ============ TAB: SINGLE FILE ============ */}
          <TabsContent value="single">
            <Card>
              <CardHeader>
                <CardTitle>Subir Documento</CardTitle>
                <CardDescription>
                  Sube un documento RFE, NOID o Denial para análisis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Drop Zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`
                    border-2 border-dashed rounded-lg p-8 text-center transition-colors
                    ${dragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-300'}
                    ${file ? 'bg-green-50 border-green-500' : ''}
                  `}
                >
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="h-8 w-8 text-green-600" />
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
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-2">
                        Arrastra un archivo o haz clic para seleccionar
                      </p>
                      <p className="text-sm text-gray-400">
                        PDF, DOCX o TXT (máx. 20MB)
                      </p>
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt"
                        onChange={handleFileChange}
                        className="hidden"
                        id="file-upload"
                      />
                      <label htmlFor="file-upload">
                        <Button variant="outline" className="mt-4" asChild>
                          <span>Seleccionar Archivo</span>
                        </Button>
                      </label>
                    </>
                  )}
                </div>

                {/* Options */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo de Documento</Label>
                    <Select value={docType} onValueChange={setDocType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RFE">RFE</SelectItem>
                        <SelectItem value="NOID">NOID</SelectItem>
                        <SelectItem value="Denial">Denial</SelectItem>
                        <SelectItem value="Approval">Approval</SelectItem>
                        <SelectItem value="Other">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Asociar a Caso (opcional)</Label>
                    <Select value={caseId} onValueChange={setCaseId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin caso" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin caso</SelectItem>
                        {cases?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.title || c.beneficiary_name || c.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <Label className="text-base">Procesar con IA</Label>
                    <p className="text-sm text-gray-500">Extraer issues y requests automáticamente</p>
                  </div>
                  <Switch checked={processWithAI} onCheckedChange={setProcessWithAI} />
                </div>

                {/* Upload Button */}
                <Button
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  size="lg"
                >
                  {uploading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Subiendo...</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-2" /> Subir Documento</>
                  )}
                </Button>

                {uploading && (
                  <Progress value={uploadProgress} className="w-full" />
                )}

                {/* Result */}
                {result && (
                  <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className={result.success ? 'text-green-800' : 'text-red-800'}>
                        {result.message}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ TAB: BULK UPLOAD ============ */}
          <TabsContent value="bulk">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-purple-600" />
                  Carga Masiva para RAG
                </CardTitle>
                <CardDescription>
                  Sube múltiples documentos RFE/NOID/Denial para alimentar el sistema de búsqueda inteligente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Drop Zone */}
                <div
                  onDragEnter={handleBulkDrag}
                  onDragLeave={handleBulkDrag}
                  onDragOver={handleBulkDrag}
                  onDrop={handleBulkDrop}
                  className={`
                    border-2 border-dashed rounded-lg p-8 text-center transition-colors
                    ${bulkDragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-300'}
                  `}
                >
                  <Files className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">
                    Arrastra múltiples archivos o haz clic para seleccionar
                  </p>
                  <p className="text-sm text-gray-400 mb-4">
                    PDF, DOCX o TXT (máx. 20MB cada uno)
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleBulkFileChange}
                    className="hidden"
                    id="bulk-file-upload"
                    multiple
                  />
                  <label htmlFor="bulk-file-upload">
                    <Button variant="outline" asChild>
                      <span>Seleccionar Archivos</span>
                    </Button>
                  </label>
                </div>

                {/* Files List */}
                {bulkFiles.length > 0 && (
                  <div className="border rounded-lg divide-y">
                    <div className="p-3 bg-gray-50 flex items-center justify-between">
                      <span className="font-medium text-gray-700">
                        {bulkFiles.length} archivo(s) seleccionado(s)
                      </span>
                      <Button variant="ghost" size="sm" onClick={clearBulkFiles}>
                        <Trash2 className="h-4 w-4 mr-1" /> Limpiar
                      </Button>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      {bulkFiles.map((f, idx) => (
                        <div key={idx} className="p-3 flex items-center justify-between hover:bg-gray-50">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-700 truncate max-w-[300px]">{f.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {(f.size / 1024 / 1024).toFixed(1)} MB
                            </Badge>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => removeBulkFile(idx)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Options */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo de Documentos</Label>
                    <Select value={bulkDocType} onValueChange={setBulkDocType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RFE">RFE</SelectItem>
                        <SelectItem value="NOID">NOID</SelectItem>
                        <SelectItem value="Denial">Denial</SelectItem>
                        <SelectItem value="Mixed">Mixto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div>
                    <Label className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      Generar Embeddings para RAG
                    </Label>
                    <p className="text-sm text-purple-700">
                      Permite buscar en estos documentos desde el Chat
                    </p>
                  </div>
                  <Switch 
                    checked={generateEmbeddings} 
                    onCheckedChange={setGenerateEmbeddings}
                    className="data-[state=checked]:bg-purple-600"
                  />
                </div>

                {/* Upload Button */}
                <Button
                  onClick={handleBulkUpload}
                  disabled={bulkFiles.length === 0 || bulkUploading}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  size="lg"
                >
                  {bulkUploading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando documentos...</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-2" /> Subir {bulkFiles.length} Documento(s)</>
                  )}
                </Button>

                {/* Results */}
                {bulkResults && (
                  <div className="space-y-3">
                    {bulkResults.error ? (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-2 text-red-800">
                          <AlertCircle className="h-5 w-5" />
                          {bulkResults.error}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center gap-2 text-green-800 mb-2">
                            <CheckCircle className="h-5 w-5" />
                            <span className="font-medium">
                              {bulkResults.processed} documento(s) procesado(s)
                            </span>
                          </div>
                          {bulkResults.failed > 0 && (
                            <p className="text-sm text-orange-700">
                              {bulkResults.failed} archivo(s) con errores
                            </p>
                          )}
                        </div>

                        {bulkResults.results && bulkResults.results.length > 0 && (
                          <div className="border rounded-lg divide-y">
                            {bulkResults.results.map((r, idx) => (
                              <div key={idx} className="p-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <span className="text-sm">{r.file}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{r.textLength} chars</Badge>
                                  {r.embeddingsGenerated > 0 && (
                                    <Badge className="bg-purple-100 text-purple-700">
                                      {r.embeddingsGenerated} embeddings
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {bulkResults.errors && bulkResults.errors.length > 0 && (
                          <div className="border border-red-200 rounded-lg divide-y">
                            {bulkResults.errors.map((e, idx) => (
                              <div key={idx} className="p-3 flex items-center gap-2 text-red-700">
                                <AlertCircle className="h-4 w-4" />
                                <span className="text-sm">{e.file}: {e.error}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
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
