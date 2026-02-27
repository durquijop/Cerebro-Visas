'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Brain, ArrowLeft, FileText, Upload, Search, Filter, Eye, Trash2, Loader2, RefreshCw, Database } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function DocumentsClient({ documents: initialDocuments, userRole }) {
  const [documents, setDocuments] = useState(initialDocuments)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [deletingId, setDeletingId] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  // Auto-refresh si hay documentos en procesamiento
  const hasPendingDocs = documents.some(d => 
    d.extraction_status === 'pending' || 
    d.extraction_status === 'extracting' || 
    d.extraction_status === 'analyzing'
  )

  const refreshDocuments = useCallback(async () => {
    try {
      const response = await fetch('/api/documents')
      if (response.ok) {
        const data = await response.json()
        const docs = Array.isArray(data) ? data : (data.documents || data.data || [])
        setDocuments(docs)
      }
    } catch (err) {
      console.error('Error refreshing documents:', err)
    }
  }, [])

  useEffect(() => {
    if (!hasPendingDocs) return

    const interval = setInterval(() => {
      refreshDocuments()
    }, 5000) // Refresh cada 5 segundos si hay docs pendientes

    return () => clearInterval(interval)
  }, [hasPendingDocs, refreshDocuments])

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshDocuments()
    setRefreshing(false)
    toast.success('Lista actualizada')
  }

  const handleDelete = async (docId, docName) => {
    if (!confirm(`¿Está seguro de eliminar "${docName}"?`)) return

    try {
      setDeletingId(docId)
      const response = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Error al eliminar el documento')
      }

      // Actualizar lista local
      setDocuments(documents.filter(d => d.id !== docId))
      toast.success('Documento eliminado correctamente')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = typeFilter === 'all' || doc.doc_type === typeFilter
    return matchesSearch && matchesType
  })

  const getDocTypeBadge = (type) => {
    const badges = {
      'RFE': 'bg-orange-100 text-orange-800',
      'NOID': 'bg-red-100 text-red-800',
      'Denial': 'bg-red-200 text-red-900',
      'Brief': 'bg-blue-100 text-blue-800',
      'Other': 'bg-gray-100 text-gray-800'
    }
    return badges[type] || badges['Other']
  }

  const getStatusBadge = (status) => {
    const statuses = {
      'pending': { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800 animate-pulse' },
      'extracting': { label: 'Extrayendo texto...', className: 'bg-blue-100 text-blue-800 animate-pulse' },
      'analyzing': { label: 'Analizando con IA...', className: 'bg-purple-100 text-purple-800 animate-pulse' },
      'completed': { label: 'Completado', className: 'bg-green-100 text-green-800' },
      'failed': { label: 'Error', className: 'bg-red-100 text-red-800' }
    }
    return statuses[status] || statuses['pending']
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
      <main className="container mx-auto px-6 py-8">
        <div className="mb-6 flex justify-between items-start">
          <div>
            <Link href="/dashboard">
              <Button variant="ghost" className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Dashboard
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <FileText className="mr-3 h-8 w-8 text-green-600" />
              Documentos
            </h1>
            <p className="text-gray-600 mt-1">
              {filteredDocuments.length} documento(s) encontrado(s)
            </p>
          </div>
          {(userRole === 'admin' || userRole === 'attorney' || userRole === 'drafter') && (
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> 
                Actualizar
              </Button>
              <Link href="/documents/upload">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Upload className="mr-2 h-4 w-4" /> Subir Documento
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="w-full md:w-48">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    <SelectItem value="RFE">RFE</SelectItem>
                    <SelectItem value="NOID">NOID</SelectItem>
                    <SelectItem value="Denial">Denial</SelectItem>
                    <SelectItem value="Brief">Brief</SelectItem>
                    <SelectItem value="Other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents Table */}
        <Card>
          <CardContent className="pt-6">
            {filteredDocuments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Chunks</TableHead>
                    <TableHead>Caso Asociado</TableHead>
                    <TableHead>Fecha Doc.</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => {
                    const status = getStatusBadge(doc.extraction_status)
                    const isProcessing = doc.extraction_status === 'pending' || doc.extraction_status === 'extracting' || doc.extraction_status === 'analyzing'
                    
                    return (
                    <TableRow key={doc.id} className={isProcessing ? 'bg-yellow-50/50' : ''}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          {isProcessing ? (
                            <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4 text-gray-400" />
                          )}
                          <span>{doc.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDocTypeBadge(doc.doc_type)}`}>
                          {doc.doc_type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        {doc.embeddings_count != null ? (
                          <span className="flex items-center gap-1 text-sm text-gray-600">
                            <Database className="h-3.5 w-3.5" />
                            {doc.embeddings_count}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {doc.cases?.title || (
                          <span className="text-gray-400">Sin caso</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {doc.document_date 
                          ? new Date(doc.document_date + 'T00:00:00').toLocaleDateString('es-ES')
                          : <span className="text-gray-400 italic">Sin fecha</span>
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {!isProcessing && (
                            <Link href={`/documents/${doc.id}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4 mr-1" /> Ver
                              </Button>
                            </Link>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(doc.id, doc.name)}
                            disabled={deletingId === doc.id}
                          >
                            {deletingId === doc.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No hay documentos</h3>
                <p className="text-gray-500 mt-1">
                  {searchTerm || typeFilter !== 'all' 
                    ? 'No se encontraron documentos con esos filtros'
                    : 'Comienza subiendo tu primer documento'}
                </p>
                {(userRole === 'admin' || userRole === 'attorney' || userRole === 'drafter') && (
                  <Link href="/documents/upload">
                    <Button className="mt-4">
                      <Upload className="mr-2 h-4 w-4" /> Subir Documento
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
