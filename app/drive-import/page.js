'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  FolderOpen, FileText, Upload, Loader2, CheckCircle, 
  XCircle, AlertTriangle, ArrowLeft, Sparkles, Folder,
  HardDrive, Cloud, Trash2, FileUp, Archive, FileArchive,
  Clock, RefreshCw, Eye
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@supabase/supabase-js'

// Cliente de Supabase para el frontend
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const DOC_TYPE_COLORS = {
  'RFE': 'bg-red-100 text-red-800 border-red-300',
  'NOID': 'bg-orange-100 text-orange-800 border-orange-300',
  'Denial': 'bg-red-200 text-red-900 border-red-400',
  'Carta de Recomendación': 'bg-blue-100 text-blue-800 border-blue-300',
  'Business Plan': 'bg-purple-100 text-purple-800 border-purple-300',
  'CV/Resume': 'bg-green-100 text-green-800 border-green-300',
  'Petition Letter': 'bg-indigo-100 text-indigo-800 border-indigo-300',
  'Evidencia': 'bg-amber-100 text-amber-800 border-amber-300',
  'Documento Personal': 'bg-gray-100 text-gray-800 border-gray-300',
  'Traducción': 'bg-cyan-100 text-cyan-800 border-cyan-300',
  'Otro': 'bg-slate-100 text-slate-800 border-slate-300',
}

const STATUS_CONFIG = {
  pending: { label: 'Pendiente', color: 'bg-gray-100 text-gray-800', icon: Clock },
  uploading: { label: 'Subiendo', color: 'bg-blue-100 text-blue-800', icon: Upload },
  processing: { label: 'Procesando', color: 'bg-yellow-100 text-yellow-800', icon: Loader2 },
  completed: { label: 'Completado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  failed: { label: 'Error', color: 'bg-red-100 text-red-800', icon: XCircle },
}

// Detectar tipo de documento por nombre
function detectDocType(filename) {
  const lower = filename.toLowerCase()
  if (lower.includes('rfe') || lower.includes('request for evidence')) return 'RFE'
  if (lower.includes('noid') || lower.includes('notice of intent')) return 'NOID'
  if (lower.includes('denial') || lower.includes('denegación')) return 'Denial'
  if (lower.includes('carta') || lower.includes('recomendación') || lower.includes('recommendation') || lower.includes('letter')) return 'Carta de Recomendación'
  if (lower.includes('business') || lower.includes('plan') || lower.includes('negocio')) return 'Business Plan'
  if (lower.includes('cv') || lower.includes('resume') || lower.includes('curriculum') || lower.includes('hoja de vida')) return 'CV/Resume'
  if (lower.includes('petition') || lower.includes('petición') || lower.includes('i-140')) return 'Petition Letter'
  if (lower.includes('traducción') || lower.includes('translation') || lower.includes('translated')) return 'Traducción'
  if (lower.includes('diploma') || lower.includes('certificado') || lower.includes('título') || lower.includes('grado')) return 'Documento Personal'
  if (lower.includes('evidencia') || lower.includes('evidence') || lower.includes('exhibit') || lower.includes('premio') || lower.includes('award')) return 'Evidencia'
  return 'Otro'
}

export default function ImportPage() {
  const router = useRouter()
  const fileInputRef = useRef(null)
  const zipInputRef = useRef(null)
  
  // Estado común
  const [clientName, setClientName] = useState('')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, currentFile: '' })
  const [importResults, setImportResults] = useState(null)
  
  // Estado para archivos locales
  const [localFiles, setLocalFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  
  // Estado para ZIP grande (background)
  const [zipFile, setZipFile] = useState(null)
  const [uploadingZip, setUploadingZip] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  
  // Estado para trabajos en segundo plano
  const [backgroundJobs, setBackgroundJobs] = useState([])
  const [loadingJobs, setLoadingJobs] = useState(true)

  // Cargar trabajos en segundo plano
  const loadBackgroundJobs = async () => {
    try {
      const res = await fetch('/api/import-jobs?limit=10')
      if (res.ok) {
        const data = await res.json()
        setBackgroundJobs(data.jobs || [])
      }
    } catch (err) {
      console.error('Error loading jobs:', err)
    } finally {
      setLoadingJobs(false)
    }
  }

  // Cargar jobs al montar y hacer polling
  useEffect(() => {
    loadBackgroundJobs()
    
    // Polling cada 5 segundos para actualizar el estado
    const interval = setInterval(() => {
      loadBackgroundJobs()
    }, 5000)
    
    return () => clearInterval(interval)
  }, [])

  // Función para agregar archivos (usada por click y drag&drop)
  const addFiles = (files) => {
    const newFiles = files.map(file => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file: file,
      name: file.name,
      size: file.size,
      type: detectDocType(file.name),
      status: 'pending'
    }))
    setLocalFiles(prev => [...prev, ...newFiles])
    toast.success(`${files.length} archivo(s) agregado(s)`)
  }

  // Manejar selección de archivos locales
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    addFiles(files)
  }

  // Manejar drag and drop
  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      const validFiles = files.filter(file => {
        const ext = file.name.toLowerCase()
        return ext.endsWith('.pdf') || ext.endsWith('.doc') || ext.endsWith('.docx') || 
               ext.endsWith('.txt') || ext.endsWith('.png') || ext.endsWith('.jpg') || 
               ext.endsWith('.jpeg') || ext.endsWith('.xlsx') || ext.endsWith('.xls')
      })
      
      if (validFiles.length > 0) {
        addFiles(validFiles)
      } else {
        toast.error('No se encontraron archivos válidos (PDF, Word, Excel, Imágenes)')
      }
    }
  }

  // Manejar selección de archivo ZIP
  const handleZipSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast.error('Por favor selecciona un archivo .zip')
      return
    }

    setZipFile(file)
  }

  // Subir ZIP grande a Storage y crear job
  const uploadLargeZip = async () => {
    if (!clientName.trim()) {
      toast.error('Ingresa el nombre del cliente')
      return
    }
    
    if (!zipFile) {
      toast.error('Selecciona un archivo ZIP')
      return
    }

    setUploadingZip(true)
    setUploadProgress(0)

    try {
      // 1. Subir el ZIP a Supabase Storage
      const timestamp = Date.now()
      const storagePath = `zips/${timestamp}_${zipFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      
      toast.info('Subiendo archivo ZIP a la nube...')
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('imports')
        .upload(storagePath, zipFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        throw new Error(`Error subiendo archivo: ${uploadError.message}`)
      }

      setUploadProgress(50)
      toast.success('ZIP subido, creando trabajo de importación...')

      // 2. Crear el job de importación
      const jobRes = await fetch('/api/import-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: clientName,
          zip_file_name: zipFile.name,
          zip_file_size: zipFile.size,
          storage_path: storagePath
        })
      })

      if (!jobRes.ok) {
        throw new Error('Error creando trabajo de importación')
      }

      const { job } = await jobRes.json()
      setUploadProgress(75)

      // 3. Iniciar procesamiento en segundo plano (fire and forget)
      fetch(`/api/import-jobs/${job.id}/process`, {
        method: 'POST'
      }).catch(err => console.error('Error starting process:', err))

      setUploadProgress(100)
      toast.success('¡Importación iniciada! Puedes seguir el progreso abajo.')

      // Limpiar estado
      setZipFile(null)
      setClientName('')
      
      // Recargar jobs
      setTimeout(loadBackgroundJobs, 1000)

    } catch (err) {
      console.error('Error uploading ZIP:', err)
      toast.error(err.message)
    } finally {
      setUploadingZip(false)
      setUploadProgress(0)
    }
  }

  // Remover archivo de la lista
  const removeFile = (fileId) => {
    setLocalFiles(prev => prev.filter(f => f.id !== fileId))
  }

  // Cambiar tipo de documento
  const changeFileType = (fileId, newType) => {
    setLocalFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, type: newType } : f
    ))
  }

  // Importar archivos locales
  const importLocalFiles = async () => {
    if (!clientName.trim()) {
      toast.error('Ingresa el nombre del cliente')
      return
    }
    
    if (localFiles.length === 0) {
      toast.error('Selecciona al menos un archivo')
      return
    }

    setImporting(true)
    setImportProgress({ current: 0, total: localFiles.length, currentFile: '' })
    
    const results = { success: [], failed: [] }
    let caseId = null

    try {
      // Crear el caso primero
      const caseRes = await fetch('/api/casos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: clientName,
          beneficiary_name: clientName,
          visa_category: 'EB2-NIW',
          outcome: 'pending'
        })
      })

      if (!caseRes.ok) {
        throw new Error('Error creando el caso')
      }

      const caseData = await caseRes.json()
      caseId = caseData.case?.id

      if (!caseId) {
        throw new Error('No se pudo obtener el ID del caso')
      }

      toast.success(`Caso "${clientName}" creado`)

      // Subir cada archivo
      for (let i = 0; i < localFiles.length; i++) {
        const fileData = localFiles[i]
        setImportProgress({
          current: i + 1,
          total: localFiles.length,
          currentFile: fileData.name
        })

        setLocalFiles(prev => prev.map(f => 
          f.id === fileData.id ? { ...f, status: 'uploading' } : f
        ))

        try {
          const formData = new FormData()
          formData.append('file', fileData.file)
          formData.append('case_id', caseId)
          formData.append('doc_type', fileData.type)
          formData.append('skip_analysis', 'true')

          const uploadRes = await fetch('/api/casos/documents/upload', {
            method: 'POST',
            body: formData
          })

          if (uploadRes.ok) {
            results.success.push(fileData.name)
            setLocalFiles(prev => prev.map(f => 
              f.id === fileData.id ? { ...f, status: 'success' } : f
            ))
          } else {
            const error = await uploadRes.json()
            throw new Error(error.error || 'Error subiendo archivo')
          }
        } catch (err) {
          console.error(`Error subiendo ${fileData.name}:`, err)
          results.failed.push({ name: fileData.name, error: err.message })
          setLocalFiles(prev => prev.map(f => 
            f.id === fileData.id ? { ...f, status: 'error', error: err.message } : f
          ))
        }

        await new Promise(r => setTimeout(r, 300))
      }

      setImportResults({ ...results, caseId })
      
      if (results.success.length > 0) {
        toast.success(`${results.success.length} archivo(s) importado(s) correctamente`)
      }
      if (results.failed.length > 0) {
        toast.error(`${results.failed.length} archivo(s) fallaron`)
      }

    } catch (err) {
      console.error('Error en importación:', err)
      toast.error(err.message)
    } finally {
      setImporting(false)
    }
  }

  // Formatear tamaño de archivo
  const formatSize = (bytes) => {
    if (!bytes) return '0 B'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
  }

  // Limpiar todo
  const clearAll = () => {
    setLocalFiles([])
    setZipFile(null)
    setImportResults(null)
    setClientName('')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" /> Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Upload className="h-6 w-6 text-blue-600" />
                Importar Expediente
              </h1>
              <p className="text-sm text-gray-500">Sube múltiples archivos para crear un nuevo caso</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {/* Resultado de importación */}
        {importResults && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-green-900">Importación Completada</h3>
                    <p className="text-sm text-green-700">
                      {importResults.success.length} archivos importados
                      {importResults.failed.length > 0 && `, ${importResults.failed.length} fallaron`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={clearAll}>
                    Nueva Importación
                  </Button>
                  <Button onClick={() => router.push(`/casos/${importResults.caseId}`)}>
                    Ver Caso <Sparkles className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Nombre del cliente */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Información del Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Cliente / Caso
                </label>
                <Input
                  placeholder="Ej: Juan Pérez"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  disabled={importing || uploadingZip}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs para métodos de importación */}
        <Tabs defaultValue="local" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="local" className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" /> Archivos
            </TabsTrigger>
            <TabsTrigger value="zip" className="flex items-center gap-2">
              <FileArchive className="h-4 w-4" /> ZIP Grande
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700">Nuevo</Badge>
            </TabsTrigger>
            <TabsTrigger value="jobs" className="flex items-center gap-2">
              <Clock className="h-4 w-4" /> En Proceso
              {backgroundJobs.filter(j => j.status === 'processing').length > 0 && (
                <Badge className="bg-yellow-500">{backgroundJobs.filter(j => j.status === 'processing').length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab: Archivos Locales */}
          <TabsContent value="local">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileUp className="h-5 w-5 text-blue-600" />
                  Subir Archivos Individuales
                </CardTitle>
                <CardDescription>
                  Selecciona o arrastra múltiples PDFs, Word, etc. (máx. 50MB c/u)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Zona de drop/selección */}
                <div 
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer mb-4 ${
                    isDragging 
                      ? 'border-blue-500 bg-blue-50 scale-[1.02]' 
                      : 'border-gray-300 hover:border-blue-400'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={importing}
                  />
                  <Upload className={`h-12 w-12 mx-auto mb-4 transition-colors ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
                  <p className={`text-lg font-medium ${isDragging ? 'text-blue-700' : 'text-gray-700'}`}>
                    {isDragging ? '¡Suelta los archivos aquí!' : 'Haz clic o arrastra archivos aquí'}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    PDF, Word, Excel, Imágenes
                  </p>
                </div>

                {/* Lista de archivos seleccionados */}
                {localFiles.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-700">
                        {localFiles.length} archivo(s) seleccionado(s)
                      </h4>
                      {!importing && (
                        <Button variant="ghost" size="sm" onClick={() => setLocalFiles([])}>
                          <Trash2 className="h-4 w-4 mr-1" /> Limpiar
                        </Button>
                      )}
                    </div>

                    <ScrollArea className="h-[250px] border rounded-lg p-2">
                      <div className="space-y-2">
                        {localFiles.map((file) => (
                          <div 
                            key={file.id}
                            className={`flex items-center justify-between p-2 rounded-lg border ${
                              file.status === 'success' ? 'bg-green-50 border-green-200' :
                              file.status === 'error' ? 'bg-red-50 border-red-200' :
                              file.status === 'uploading' ? 'bg-blue-50 border-blue-200' :
                              'bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {file.status === 'success' ? (
                                <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                              ) : file.status === 'error' ? (
                                <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                              ) : file.status === 'uploading' ? (
                                <Loader2 className="h-4 w-4 text-blue-600 animate-spin shrink-0" />
                              ) : (
                                <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                              )}
                              <span className="text-sm truncate">{file.name}</span>
                              <span className="text-xs text-gray-400">{formatSize(file.size)}</span>
                            </div>
                            
                            <div className="flex items-center gap-2 shrink-0">
                              <select
                                value={file.type}
                                onChange={(e) => changeFileType(file.id, e.target.value)}
                                disabled={importing}
                                className={`text-xs px-2 py-1 rounded border ${DOC_TYPE_COLORS[file.type] || DOC_TYPE_COLORS['Otro']}`}
                              >
                                {Object.keys(DOC_TYPE_COLORS).map(type => (
                                  <option key={type} value={type}>{type}</option>
                                ))}
                              </select>
                              
                              {!importing && (
                                <Button variant="ghost" size="sm" onClick={() => removeFile(file.id)} className="h-6 w-6 p-0">
                                  <XCircle className="h-4 w-4 text-gray-400 hover:text-red-500" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    {importing && (
                      <div className="space-y-2 p-4 bg-blue-50 rounded-lg">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-blue-700">
                            {importProgress.currentFile}
                          </span>
                          <span className="text-blue-600">
                            {importProgress.current} / {importProgress.total}
                          </span>
                        </div>
                        <Progress value={(importProgress.current / importProgress.total) * 100} className="h-2" />
                      </div>
                    )}

                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={importLocalFiles}
                      disabled={importing || !clientName.trim() || localFiles.length === 0}
                    >
                      {importing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Importando {importProgress.current} de {importProgress.total}...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Crear Caso e Importar {localFiles.length} Archivo(s)
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: ZIP Grande (Background) */}
          <TabsContent value="zip">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Archive className="h-5 w-5 text-purple-600" />
                  Importar ZIP Grande (Segundo Plano)
                </CardTitle>
                <CardDescription>
                  Para archivos ZIP de cualquier tamaño. Se procesan en segundo plano mientras continúas trabajando.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Info */}
                  <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <Sparkles className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-purple-800">¿Cómo funciona?</p>
                      <ol className="text-sm text-purple-700 mt-1 list-decimal list-inside space-y-1">
                        <li>Sube tu archivo ZIP (sin límite de tamaño)</li>
                        <li>El sistema lo procesa en segundo plano</li>
                        <li>Puedes seguir trabajando mientras tanto</li>
                        <li>Recibirás una notificación cuando esté listo</li>
                      </ol>
                    </div>
                  </div>

                  {/* Zona de selección de ZIP */}
                  {!zipFile ? (
                    <div 
                      className="border-2 border-dashed border-purple-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors cursor-pointer bg-purple-50/50"
                      onClick={() => zipInputRef.current?.click()}
                    >
                      <input
                        ref={zipInputRef}
                        type="file"
                        accept=".zip"
                        onChange={handleZipSelect}
                        className="hidden"
                        disabled={uploadingZip}
                      />
                      <Archive className="h-12 w-12 text-purple-400 mx-auto mb-4" />
                      <p className="text-lg font-medium text-purple-700">
                        Haz clic para seleccionar un archivo ZIP
                      </p>
                      <p className="text-sm text-purple-600 mt-1">
                        Sin límite de tamaño - se procesa en segundo plano
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Info del ZIP */}
                      <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <div className="flex items-center gap-3">
                          <FileArchive className="h-8 w-8 text-purple-600" />
                          <div>
                            <p className="font-medium text-purple-900">{zipFile.name}</p>
                            <p className="text-sm text-purple-600">{formatSize(zipFile.size)}</p>
                          </div>
                        </div>
                        {!uploadingZip && (
                          <Button variant="ghost" size="sm" onClick={() => setZipFile(null)}>
                            <XCircle className="h-4 w-4 mr-1" /> Cambiar
                          </Button>
                        )}
                      </div>

                      {/* Progreso de subida */}
                      {uploadingZip && (
                        <div className="space-y-2 p-4 bg-purple-50 rounded-lg">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-purple-700 flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Subiendo a la nube...
                            </span>
                            <span className="text-purple-600">{uploadProgress}%</span>
                          </div>
                          <Progress value={uploadProgress} className="h-2" />
                        </div>
                      )}

                      {/* Botón */}
                      <Button 
                        className="w-full bg-purple-600 hover:bg-purple-700" 
                        size="lg"
                        onClick={uploadLargeZip}
                        disabled={uploadingZip || !clientName.trim()}
                      >
                        {uploadingZip ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Subiendo ZIP...
                          </>
                        ) : (
                          <>
                            <Archive className="h-4 w-4 mr-2" />
                            Iniciar Importación en Segundo Plano
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Trabajos en Proceso */}
          <TabsContent value="jobs">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-gray-600" />
                      Importaciones en Proceso
                    </CardTitle>
                    <CardDescription>
                      Estado de tus importaciones en segundo plano
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadBackgroundJobs}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Actualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingJobs ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
                    <span className="text-gray-500">Cargando...</span>
                  </div>
                ) : backgroundJobs.length === 0 ? (
                  <div className="text-center p-8 text-gray-500">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No hay importaciones en proceso</p>
                    <p className="text-sm mt-1">Las importaciones de ZIP grandes aparecerán aquí</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {backgroundJobs.map((job) => {
                      const StatusIcon = STATUS_CONFIG[job.status]?.icon || Clock
                      const progress = job.total_files > 0 
                        ? Math.round((job.processed_files / job.total_files) * 100) 
                        : 0

                      return (
                        <div 
                          key={job.id}
                          className="p-4 border rounded-lg hover:border-gray-300 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${STATUS_CONFIG[job.status]?.color || 'bg-gray-100'}`}>
                                <StatusIcon className={`h-4 w-4 ${job.status === 'processing' ? 'animate-spin' : ''}`} />
                              </div>
                              <div>
                                <p className="font-medium">{job.client_name}</p>
                                <p className="text-xs text-gray-500">
                                  {job.zip_file_name} • {formatSize(job.zip_file_size)}
                                </p>
                              </div>
                            </div>
                            <Badge className={STATUS_CONFIG[job.status]?.color}>
                              {STATUS_CONFIG[job.status]?.label}
                            </Badge>
                          </div>

                          {/* Progreso */}
                          {(job.status === 'processing' || job.status === 'completed') && (
                            <div className="mt-3">
                              <div className="flex justify-between text-xs text-gray-500 mb-1">
                                <span>{job.current_file || 'Procesando...'}</span>
                                <span>{job.processed_files} / {job.total_files} archivos</span>
                              </div>
                              <Progress value={progress} className="h-2" />
                            </div>
                          )}

                          {/* Error */}
                          {job.status === 'failed' && job.error_message && (
                            <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                              {job.error_message}
                            </div>
                          )}

                          {/* Acciones */}
                          {job.status === 'completed' && job.case_id && (
                            <div className="mt-3 flex justify-end">
                              <Button 
                                size="sm"
                                onClick={() => router.push(`/casos/${job.case_id}`)}
                              >
                                <Eye className="h-4 w-4 mr-1" /> Ver Caso
                              </Button>
                            </div>
                          )}

                          {/* Resumen de completado */}
                          {job.status === 'completed' && (
                            <div className="mt-2 flex gap-4 text-sm">
                              <span className="text-green-600">✓ {job.successful_files} exitosos</span>
                              {job.failed_files > 0 && (
                                <span className="text-red-600">✗ {job.failed_files} fallaron</span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Tips */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Tips
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Archivos pequeños (&lt;50MB c/u):</strong> Usa "Archivos" para subida inmediata</li>
              <li>• <strong>ZIP grandes (&gt;300MB):</strong> Usa "ZIP Grande" para procesamiento en segundo plano</li>
              <li>• El sistema detecta automáticamente el tipo de documento por el nombre</li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
