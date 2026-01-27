'use client'

import { useState, useRef } from 'react'
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
  HardDrive, Cloud, Trash2, FileUp, Archive, FileArchive
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

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
  
  // Estado común
  const [clientName, setClientName] = useState('')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, currentFile: '' })
  const [importResults, setImportResults] = useState(null)
  
  // Estado para archivos locales
  const [localFiles, setLocalFiles] = useState([])
  
  // Estado para Google Drive (mantenemos pero simplificamos)
  const [driveUrl, setDriveUrl] = useState('')
  const [driveLoading, setDriveLoading] = useState(false)
  const [driveFiles, setDriveFiles] = useState([])
  const [driveError, setDriveError] = useState(null)

  // Manejar selección de archivos locales
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    const newFiles = files.map(file => ({
      id: `${file.name}-${file.size}-${Date.now()}`,
      file: file,
      name: file.name,
      size: file.size,
      type: detectDocType(file.name),
      status: 'pending'
    }))
    setLocalFiles(prev => [...prev, ...newFiles])
    toast.success(`${files.length} archivo(s) agregado(s)`)
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

        // Actualizar estado del archivo a "uploading"
        setLocalFiles(prev => prev.map(f => 
          f.id === fileData.id ? { ...f, status: 'uploading' } : f
        ))

        try {
          const formData = new FormData()
          formData.append('file', fileData.file)
          formData.append('case_id', caseId)
          formData.append('doc_type', fileData.type)
          formData.append('skip_analysis', 'true') // Análisis masivo después

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

        // Pequeña pausa entre archivos
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
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // Limpiar todo
  const clearAll = () => {
    setLocalFiles([])
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
                  disabled={importing}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs para métodos de importación */}
        <Tabs defaultValue="local" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="local" className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" /> Subir Archivos
            </TabsTrigger>
            <TabsTrigger value="drive" className="flex items-center gap-2">
              <Cloud className="h-4 w-4" /> Google Drive
              <Badge variant="outline" className="text-xs">Beta</Badge>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Archivos Locales */}
          <TabsContent value="local">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileUp className="h-5 w-5 text-blue-600" />
                  Subir Archivos desde tu Computadora
                </CardTitle>
                <CardDescription>
                  Selecciona múltiples PDFs, documentos Word, imágenes, etc.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Zona de drop/selección */}
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer mb-4"
                  onClick={() => fileInputRef.current?.click()}
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
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-700">
                    Haz clic para seleccionar archivos
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    o arrastra y suelta aquí
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    PDF, Word, Excel, Imágenes (máx. 50MB por archivo)
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

                    <ScrollArea className="h-[300px] border rounded-lg p-2">
                      <div className="space-y-2">
                        {localFiles.map((file) => (
                          <div 
                            key={file.id}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              file.status === 'success' ? 'bg-green-50 border-green-200' :
                              file.status === 'error' ? 'bg-red-50 border-red-200' :
                              file.status === 'uploading' ? 'bg-blue-50 border-blue-200' :
                              'bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {file.status === 'success' ? (
                                <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                              ) : file.status === 'error' ? (
                                <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                              ) : file.status === 'uploading' ? (
                                <Loader2 className="h-5 w-5 text-blue-600 animate-spin shrink-0" />
                              ) : (
                                <FileText className="h-5 w-5 text-gray-400 shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm truncate">{file.name}</p>
                                <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
                              </div>
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
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFile(file.id)}
                                  className="h-8 w-8 p-0"
                                >
                                  <XCircle className="h-4 w-4 text-gray-400 hover:text-red-500" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    {/* Progreso de importación */}
                    {importing && (
                      <div className="space-y-2 p-4 bg-blue-50 rounded-lg">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-blue-700">
                            Importando: {importProgress.currentFile}
                          </span>
                          <span className="text-blue-600">
                            {importProgress.current} / {importProgress.total}
                          </span>
                        </div>
                        <Progress 
                          value={(importProgress.current / importProgress.total) * 100} 
                          className="h-2"
                        />
                      </div>
                    )}

                    {/* Botón de importar */}
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

          {/* Tab: Google Drive */}
          <TabsContent value="drive">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-blue-600" />
                  Importar desde Google Drive
                </CardTitle>
                <CardDescription>
                  Conecta una carpeta de Google Drive para importar archivos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Advertencia */}
                  <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800">Función en desarrollo</p>
                      <p className="text-sm text-amber-700 mt-1">
                        La integración con Google Drive puede tener limitaciones debido a restricciones de la API.
                        Te recomendamos usar la opción de "Subir Archivos" para una experiencia más confiable.
                      </p>
                    </div>
                  </div>

                  {/* Input de URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      URL de la carpeta de Google Drive
                    </label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://drive.google.com/drive/folders/..."
                        value={driveUrl}
                        onChange={(e) => setDriveUrl(e.target.value)}
                        disabled={driveLoading}
                      />
                      <Button disabled={driveLoading || !driveUrl.trim()}>
                        {driveLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Escanear'
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Asegúrate de que la carpeta tenga permisos de "Cualquier persona con el enlace"
                    </p>
                  </div>

                  {/* Alternativa recomendada */}
                  <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                    <Cloud className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600 mb-4">
                      ¿Tienes problemas con Google Drive?
                    </p>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        const tabTrigger = document.querySelector('[data-state="inactive"][value="local"]')
                        if (tabTrigger) tabTrigger.click()
                      }}
                    >
                      <HardDrive className="h-4 w-4 mr-2" />
                      Usar Subida de Archivos
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Tips */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Tips para mejores resultados
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Nombra tus archivos descriptivamente (ej: "RFE_2024.pdf", "CV_Juan_Perez.pdf")</li>
              <li>• El sistema detecta automáticamente el tipo de documento por el nombre</li>
              <li>• Puedes cambiar el tipo de documento manualmente antes de importar</li>
              <li>• Los documentos se procesan para extraer texto y permitir búsquedas</li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
