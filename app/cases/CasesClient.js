'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Brain, ArrowLeft, FolderOpen, Plus, Search, Eye, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function CasesClient({ cases: initialCases, userRole, userId }) {
  const [cases, setCases] = useState(initialCases)
  const [searchTerm, setSearchTerm] = useState('')
  const [outcomeFilter, setOutcomeFilter] = useState('all')
  const [isCreating, setIsCreating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newCase, setNewCase] = useState({
    title: '',
    description: '',
    visa_category: 'EB-2 NIW',
    outcome: 'pending',
    service_center: ''
  })
  const router = useRouter()
  const supabase = createClient()

  const filteredCases = cases.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesOutcome = outcomeFilter === 'all' || c.outcome === outcomeFilter
    return matchesSearch && matchesOutcome
  })

  const getOutcomeBadge = (outcome) => {
    const badges = {
      'pending': 'bg-gray-100 text-gray-800',
      'RFE': 'bg-orange-100 text-orange-800',
      'NOID': 'bg-red-100 text-red-800',
      'Denial': 'bg-red-200 text-red-900',
      'Approved': 'bg-green-100 text-green-800'
    }
    return badges[outcome] || badges['pending']
  }

  const handleCreateCase = async () => {
    if (!newCase.title.trim()) {
      toast.error('El título es requerido')
      return
    }

    setIsCreating(true)
    try {
      const { data, error } = await supabase
        .from('cases')
        .insert({
          ...newCase,
          created_by: userId
        })
        .select()
        .single()

      if (error) throw error

      setCases([data, ...cases])
      setDialogOpen(false)
      setNewCase({
        title: '',
        description: '',
        visa_category: 'EB-2 NIW',
        outcome: 'pending',
        service_center: ''
      })
      toast.success('Caso creado exitosamente')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setIsCreating(false)
    }
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
              <FolderOpen className="mr-3 h-8 w-8 text-blue-600" />
              Casos
            </h1>
            <p className="text-gray-600 mt-1">
              {filteredCases.length} caso(s) encontrado(s)
            </p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="mr-2 h-4 w-4" /> Nuevo Caso
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Caso</DialogTitle>
                <DialogDescription>
                  Registra un nuevo caso de inmigración
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Input
                    placeholder="Ej: Caso Dr. García - NIW Investigación Médica"
                    value={newCase.title}
                    onChange={(e) => setNewCase({...newCase, title: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Textarea
                    placeholder="Descripción del caso..."
                    value={newCase.description}
                    onChange={(e) => setNewCase({...newCase, description: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoría de Visa</Label>
                    <Select 
                      value={newCase.visa_category} 
                      onValueChange={(v) => setNewCase({...newCase, visa_category: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EB-2 NIW">EB-2 NIW</SelectItem>
                        <SelectItem value="EB-1A">EB-1A</SelectItem>
                        <SelectItem value="EB-1B">EB-1B</SelectItem>
                        <SelectItem value="Other">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Service Center</Label>
                    <Select 
                      value={newCase.service_center} 
                      onValueChange={(v) => setNewCase({...newCase, service_center: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TSC">Texas (TSC)</SelectItem>
                        <SelectItem value="NSC">Nebraska (NSC)</SelectItem>
                        <SelectItem value="CSC">California (CSC)</SelectItem>
                        <SelectItem value="VSC">Vermont (VSC)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateCase} disabled={isCreating}>
                  {isCreating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando...</>
                  ) : (
                    'Crear Caso'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por título..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="w-full md:w-48">
                <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="RFE">RFE</SelectItem>
                    <SelectItem value="NOID">NOID</SelectItem>
                    <SelectItem value="Denial">Denegado</SelectItem>
                    <SelectItem value="Approved">Aprobado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cases Table */}
        <Card>
          <CardContent className="pt-6">
            {filteredCases.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Service Center</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCases.map((caseItem) => (
                    <TableRow key={caseItem.id}>
                      <TableCell className="font-medium">
                        {caseItem.title}
                      </TableCell>
                      <TableCell>{caseItem.visa_category}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getOutcomeBadge(caseItem.outcome)}`}>
                          {caseItem.outcome}
                        </span>
                      </TableCell>
                      <TableCell>{caseItem.service_center || '-'}</TableCell>
                      <TableCell className="text-gray-500">
                        {new Date(caseItem.created_at).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell>
                        <Link href={`/cases/${caseItem.id}`}>
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
                <FolderOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No hay casos</h3>
                <p className="text-gray-500 mt-1">Comienza creando tu primer caso</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
