'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Brain, ArrowLeft, FileText, Upload, Search, Filter, Eye } from 'lucide-react'
import Link from 'next/link'

export default function DocumentsClient({ documents, userRole }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

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
            <Link href="/documents/upload">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Upload className="mr-2 h-4 w-4" /> Subir Documento
              </Button>
            </Link>
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
                    <TableHead>Caso Asociado</TableHead>
                    <TableHead>Fecha Doc.</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <span>{doc.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDocTypeBadge(doc.doc_type)}`}>
                          {doc.doc_type}
                        </span>
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
                        <Link href={`/documents/${doc.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4 mr-1" /> Ver
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
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
