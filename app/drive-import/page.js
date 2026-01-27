'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  FolderOpen, FileText, Upload, Search, Loader2, CheckCircle, 
  XCircle, AlertTriangle, Brain, ArrowLeft, FolderTree,
  File, ChevronRight, RefreshCw, Sparkles, Folder
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
  'Evidencia Profesional': 'bg-amber-100 text-amber-800 border-amber-300',
  'Documento Personal': 'bg-gray-100 text-gray-800 border-gray-300',
  'Traducción': 'bg-cyan-100 text-cyan-800 border-cyan-300',
}

export default function DriveImportPage() {
  const router = useRouter()
  const [driveUrl, setDriveUrl] = useState('')
  const [clientName, setClientName] = useState('')
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState(new Set())
  const [excludedFolders, setExcludedFolders] = useState(new Set())
  const [generateEmbeddings, setGenerateEmbeddings] = useState(true)
  const [importProgress, setImportProgress] = useState(0)
  const [importResults, setImportResults] = useState(null)
  const [scanProgress, setScanProgress] = useState(null)

  const previewFolder = async () => {
    if (!driveUrl.trim()) {
      toast.error('Ingresa una URL de Google Drive')
      return
    }

    try {
      setLoading(true)
      setPreviewData(null)
      setScanProgress({ status: 'starting', message: 'Conectando con Google Drive...' })
      
      const res = await fetch('/api/drive-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drive_url: driveUrl,
          action: 'preview'
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al acceder a la carpeta')
      }

      setPreviewData(data)
      // Seleccionar todos por defecto
      setSelectedFiles(new Set(data.files.map(f => f.id)))
      setScanProgress({ status: 'complete', message: 'Escaneo completado' })
      toast.success(`${data.processable_files} archivos encontrados en ${data.folders_scanned || 0} carpetas`)

    } catch (error) {
      console.error('Preview error:', error)
      setScanProgress({ status: 'error', message: error.message })
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleFileSelection = (fileId) => {
    const newSelected = new Set(selectedFiles)
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId)
    } else {
      newSelected.add(fileId)
    }
    setSelectedFiles(newSelected)
  }

  const selectAllByType = (type) => {
    const filesOfType = previewData?.files?.filter(f => f.detectedType === type) || []
    const newSelected = new Set(selectedFiles)
    filesOfType.forEach(f => newSelected.add(f.id))
    setSelectedFiles(newSelected)
  }

  const deselectAllByType = (type) => {
    const filesOfType = previewData?.files?.filter(f => f.detectedType === type) || []
    const newSelected = new Set(selectedFiles)
    filesOfType.forEach(f => newSelected.delete(f.id))
    setSelectedFiles(newSelected)
  }

  const importFiles = async () => {
    if (selectedFiles.size === 0) {
      toast.error('Selecciona al menos un archivo')
      return
    }

    if (!clientName.trim()) {
      toast.error('Ingresa el nombre del cliente')
      return
    }

    try {
      setImporting(true)
      setImportProgress(0)

      const filesToImport = previewData.files.filter(f => selectedFiles.has(f.id))

      const res = await fetch('/api/drive-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import',
          folder_id: previewData.folder_id,
          client_name: clientName,
          files_to_import: filesToImport,
          generate_embeddings: generateEmbeddings
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al importar')
      }

      setImportResults(data)
      setImportProgress(100)
      toast.success(`${data.processed} archivos importados`)

      // Redirigir al caso después de 2 segundos
      if (data.case_id) {
        setTimeout(() => {
          router.push(`/casos/${data.case_id}`)
        }, 2000)
      }

    } catch (error) {
      console.error('Import error:', error)
      toast.error(error.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-navy-primary border-b border-navy-light">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <FolderOpen className="h-8 w-8 text-gold-primary" />
            <div>
              <span className="text-xl font-bold text-gold-subtle">Importar desde Google Drive</span>
              <p className="text-sm text-gold-muted">Carga expedientes completos automáticamente</p>
            </div>
          </div>
          <Link href="/dashboard">
            <Button variant="ghost" className="text-gold-muted hover:text-gold-primary">
              <ArrowLeft className="h-4 w-4 mr-2" /> Volver
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-5xl">
        {/* Paso 1: URL y Preview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-500" />
              Paso 1: Conectar Carpeta de Drive
            </CardTitle>
            <CardDescription>
              Pega el link de la carpeta compartida de Google Drive con los documentos del cliente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input
                placeholder="https://drive.google.com/drive/folders/..."
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                className="flex-1"
                disabled={loading}
              />
              <Button onClick={previewFolder} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FolderTree className="h-4 w-4 mr-2" />
                )}
                {loading ? 'Escaneando...' : 'Explorar Carpeta'}
              </Button>
            </div>

            {/* Barra de progreso del escaneo */}
            {loading && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <span className="font-medium text-blue-800">
                    {scanProgress?.message || 'Escaneando carpetas...'}
                  </span>
                </div>
                <Progress value={undefined} className="h-2" />
                <p className="text-xs text-blue-600 mt-2">
                  Explorando subcarpetas y detectando tipos de documentos...
                </p>
              </div>
            )}

            {scanProgress?.status === 'error' && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-red-800">Error: {scanProgress.message}</span>
                </div>
                <p className="text-sm text-red-600 mt-2">
                  Verifica que la carpeta esté compartida como "Cualquier persona con el link" y que la Google Drive API esté habilitada.
                </p>
              </div>
            )}

            <div className="text-sm text-gray-500">
              <p>💡 Asegúrate de que la carpeta esté compartida con "Cualquier persona con el link"</p>
            </div>
          </CardContent>
        </Card>

        {/* Preview de archivos */}
        {previewData && (
          <>
            {/* Resumen */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-green-500" />
                  Paso 2: Revisar Archivos Detectados
                </CardTitle>
                <CardDescription>
                  Se encontraron {previewData.total_files} archivos en {previewData.folders_scanned || previewData.folders?.length || 0} carpetas.
                  {previewData.processable_files} son procesables.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Carpetas encontradas */}
                {previewData.folders && previewData.folders.length > 0 && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Folder className="h-4 w-4" />
                      Carpetas escaneadas:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {previewData.folders.map((folder, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {folder}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Agrupados por tipo */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {Object.entries(previewData.files_by_type || {}).map(([type, files]) => (
                    <div 
                      key={type} 
                      className="p-3 border rounded-lg bg-white cursor-pointer hover:border-purple-300 transition-colors"
                      onClick={() => {
                        const allSelected = files.every(f => selectedFiles.has(f.id))
                        if (allSelected) {
                          deselectAllByType(type)
                        } else {
                          selectAllByType(type)
                        }
                      }}
                    >
                      <Badge className={DOC_TYPE_COLORS[type] || 'bg-gray-100 text-gray-800'}>
                        {type}
                      </Badge>
                      <p className="text-2xl font-bold mt-2">{files.length}</p>
                      <p className="text-xs text-gray-500">
                        {files.filter(f => selectedFiles.has(f.id)).length} seleccionados
                      </p>
                    </div>
                  ))}
                </div>

                {/* Lista de archivos */}
                <ScrollArea className="h-[400px] border rounded-lg p-4">
                  <div className="space-y-2">
                    {previewData.files.map((file) => (
                      <div 
                        key={file.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                          selectedFiles.has(file.id) 
                            ? 'bg-purple-50 border-purple-300' 
                            : 'bg-white hover:bg-gray-50'
                        }`}
                        onClick={() => toggleFileSelection(file.id)}
                      >
                        <Checkbox 
                          checked={selectedFiles.has(file.id)}
                          onCheckedChange={() => toggleFileSelection(file.id)}
                        />
                        <File className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">{file.path}</p>
                        </div>
                        <Badge className={DOC_TYPE_COLORS[file.detectedType] || 'bg-gray-100'}>
                          {file.detectedType}
                        </Badge>
                        <span className="text-xs text-gray-400">{file.sizeFormatted}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="flex justify-between items-center mt-4">
                  <p className="text-sm text-gray-600">
                    {selectedFiles.size} de {previewData.processable_files} archivos seleccionados
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedFiles(new Set(previewData.files.map(f => f.id)))}
                    >
                      Seleccionar todos
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedFiles(new Set())}
                    >
                      Deseleccionar todos
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Paso 3: Importar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-purple-500" />
                  Paso 3: Crear Cliente e Importar
                </CardTitle>
                <CardDescription>
                  Ingresa el nombre del cliente y comienza la importación
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Nombre del Cliente</label>
                  <Input
                    placeholder="Ej: Juan Pérez - NIW Tech"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="embeddings"
                    checked={generateEmbeddings}
                    onCheckedChange={setGenerateEmbeddings}
                  />
                  <label htmlFor="embeddings" className="text-sm">
                    Generar embeddings para RAG (solo RFE/NOID/Denial)
                  </label>
                </div>

                {importing && (
                  <div className="space-y-2">
                    <Progress value={importProgress} />
                    <p className="text-sm text-gray-500 text-center">
                      Importando archivos... {importProgress}%
                    </p>
                  </div>
                )}

                {importResults && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">
                        ¡Importación completada!
                      </span>
                    </div>
                    <p className="text-sm text-green-700">
                      {importResults.processed} archivos importados, {importResults.failed} fallidos.
                    </p>
                    <p className="text-sm text-green-700">
                      Redirigiendo al caso...
                    </p>
                  </div>
                )}

                <Button 
                  onClick={importFiles} 
                  disabled={importing || selectedFiles.size === 0 || !clientName.trim()}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  size="lg"
                >
                  {importing ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-5 w-5 mr-2" />
                  )}
                  {importing 
                    ? 'Importando...' 
                    : `Crear Cliente e Importar ${selectedFiles.size} Archivos`
                  }
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
