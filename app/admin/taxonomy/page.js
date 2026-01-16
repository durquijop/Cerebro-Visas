'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Brain, ArrowLeft, Plus, Pencil, Trash2, 
  Loader2, Search, Filter, Tag, ChevronDown, ChevronRight,
  AlertTriangle, CheckCircle
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const PRONG_OPTIONS = [
  { value: 'P1', label: 'Prong 1 - Mérito/Importancia', color: 'bg-purple-100 text-purple-800' },
  { value: 'P2', label: 'Prong 2 - Bien Posicionado', color: 'bg-blue-100 text-blue-800' },
  { value: 'P3', label: 'Prong 3 - Balance', color: 'bg-green-100 text-green-800' },
  { value: 'EVIDENCE', label: 'Evidencia', color: 'bg-amber-100 text-amber-800' },
  { value: 'COHERENCE', label: 'Coherencia', color: 'bg-pink-100 text-pink-800' },
  { value: 'PROCEDURAL', label: 'Procedural', color: 'bg-gray-100 text-gray-800' }
]

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Crítico', color: 'bg-red-100 text-red-800' },
  { value: 'high', label: 'Alto', color: 'bg-orange-100 text-orange-800' },
  { value: 'medium', label: 'Medio', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'low', label: 'Bajo', color: 'bg-green-100 text-green-800' }
]

const emptyForm = {
  code: '',
  level1: '',
  level2: '',
  level3: '',
  description: '',
  prong: '',
  severity_default: 'medium'
}

export default function TaxonomyPage() {
  const [taxonomy, setTaxonomy] = useState([])
  const [grouped, setGrouped] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [prongFilter, setProngFilter] = useState('all')
  const [expandedGroups, setExpandedGroups] = useState({})
  
  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState(emptyForm)

  useEffect(() => {
    fetchTaxonomy()
  }, [])

  const fetchTaxonomy = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/taxonomy')
      
      if (!response.ok) throw new Error('Error al cargar taxonomía')
      
      const data = await response.json()
      setTaxonomy(data.taxonomy || [])
      setGrouped(data.grouped || {})
      
      // Expandir todos los grupos por defecto
      const expanded = {}
      Object.keys(data.grouped || {}).forEach(key => {
        expanded[key] = true
      })
      setExpandedGroups(expanded)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!formData.code || !formData.level1 || !formData.level2) {
      toast.error('Completa los campos requeridos: Código, Nivel 1, Nivel 2')
      return
    }

    try {
      setSaving(true)
      const response = await fetch('/api/taxonomy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al crear')
      }

      toast.success('Código de taxonomía creado')
      setShowAddDialog(false)
      setFormData(emptyForm)
      fetchTaxonomy()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async () => {
    if (!editingItem) return

    try {
      setSaving(true)
      const response = await fetch(`/api/taxonomy/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al actualizar')
      }

      toast.success('Código actualizado')
      setShowEditDialog(false)
      setEditingItem(null)
      setFormData(emptyForm)
      fetchTaxonomy()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (item) => {
    if (!confirm(`¿Eliminar el código "${item.code}"?`)) return

    try {
      const response = await fetch(`/api/taxonomy/${item.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al eliminar')
      }

      toast.success('Código eliminado')
      fetchTaxonomy()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleToggleActive = async (item) => {
    try {
      const response = await fetch(`/api/taxonomy/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !item.active })
      })

      if (!response.ok) throw new Error('Error al actualizar')

      toast.success(item.active ? 'Código desactivado' : 'Código activado')
      fetchTaxonomy()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const openEditDialog = (item) => {
    setEditingItem(item)
    setFormData({
      code: item.code,
      level1: item.level1,
      level2: item.level2,
      level3: item.level3 || '',
      description: item.description || '',
      prong: item.prong || '',
      severity_default: item.severity_default || 'medium'
    })
    setShowEditDialog(true)
  }

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }))
  }

  const filteredTaxonomy = taxonomy.filter(item => {
    const matchesSearch = 
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.level1.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.level2.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesProng = prongFilter === 'all' || item.prong === prongFilter
    
    return matchesSearch && matchesProng
  })

  // Reagrupar los filtrados
  const filteredGrouped = {}
  filteredTaxonomy.forEach(item => {
    if (!filteredGrouped[item.level1]) {
      filteredGrouped[item.level1] = []
    }
    filteredGrouped[item.level1].push(item)
  })

  const getProngBadge = (prong) => {
    const option = PRONG_OPTIONS.find(p => p.value === prong)
    if (!option) return null
    return <Badge className={`${option.color} text-xs`}>{option.value}</Badge>
  }

  const getSeverityBadge = (severity) => {
    const option = SEVERITY_OPTIONS.find(s => s.value === severity)
    if (!option) return null
    return <Badge className={`${option.color} text-xs`}>{option.label}</Badge>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando taxonomía...</p>
        </div>
      </div>
    )
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
      <main className="container mx-auto px-6 py-8 max-w-6xl">
        <Link href="/dashboard">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Dashboard
          </Button>
        </Link>

        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Tag className="h-8 w-8 text-purple-600" />
              Taxonomía de Issues
            </h1>
            <p className="text-gray-600 mt-1">
              Gestiona los códigos para clasificar issues de RFE/NOID/Denial
            </p>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-700">
                <Plus className="h-4 w-4 mr-2" /> Nuevo Código
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nuevo Código de Taxonomía</DialogTitle>
                <DialogDescription>
                  Crea un nuevo código para clasificar issues
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="code">Código *</Label>
                    <Input
                      id="code"
                      placeholder="NIW.P1.MERITO.NUEVO_ISSUE"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="level1">Nivel 1 (Categoría) *</Label>
                    <Input
                      id="level1"
                      placeholder="Prong 1 - Mérito/Importancia"
                      value={formData.level1}
                      onChange={(e) => setFormData({ ...formData, level1: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="level2">Nivel 2 (Subcategoría) *</Label>
                    <Input
                      id="level2"
                      placeholder="Impacto económico"
                      value={formData.level2}
                      onChange={(e) => setFormData({ ...formData, level2: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="level3">Nivel 3 (Específico)</Label>
                    <Input
                      id="level3"
                      placeholder="No cuantificado"
                      value={formData.level3}
                      onChange={(e) => setFormData({ ...formData, level3: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="prong">Prong</Label>
                    <Select value={formData.prong} onValueChange={(v) => setFormData({ ...formData, prong: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar prong" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRONG_OPTIONS.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="severity">Severidad por defecto</Label>
                    <Select value={formData.severity_default} onValueChange={(v) => setFormData({ ...formData, severity_default: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEVERITY_OPTIONS.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe cuándo aplicar este código..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
                <Button onClick={handleAdd} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Crear Código
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por código, nivel o descripción..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <Select value={prongFilter} onValueChange={setProngFilter}>
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar por prong" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los prongs</SelectItem>
                  {PRONG_OPTIONS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-gray-500">Total Códigos</p>
              <p className="text-2xl font-bold">{taxonomy.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-gray-500">Activos</p>
              <p className="text-2xl font-bold text-green-600">{taxonomy.filter(t => t.active).length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-gray-500">Categorías</p>
              <p className="text-2xl font-bold text-blue-600">{Object.keys(grouped).length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-gray-500">Filtrados</p>
              <p className="text-2xl font-bold text-purple-600">{filteredTaxonomy.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Taxonomy List */}
        <Card>
          <CardHeader>
            <CardTitle>Códigos de Taxonomía</CardTitle>
            <CardDescription>
              Haz clic en una categoría para expandir/colapsar
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(filteredGrouped).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(filteredGrouped).map(([group, items]) => (
                  <div key={group} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleGroup(group)}
                      className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {expandedGroups[group] ? (
                          <ChevronDown className="h-5 w-5 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-500" />
                        )}
                        <span className="font-medium">{group}</span>
                        <Badge variant="outline">{items.length} códigos</Badge>
                      </div>
                    </button>
                    
                    {expandedGroups[group] && (
                      <div className="divide-y">
                        {items.map((item) => (
                          <div key={item.id} className={`p-4 hover:bg-gray-50 ${!item.active ? 'opacity-50 bg-gray-100' : ''}`}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <code className="text-sm bg-gray-200 px-2 py-0.5 rounded font-mono">
                                    {item.code}
                                  </code>
                                  {getProngBadge(item.prong)}
                                  {getSeverityBadge(item.severity_default)}
                                  {!item.active && (
                                    <Badge variant="outline" className="text-gray-500">Inactivo</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600">
                                  {item.level2}{item.level3 ? ` → ${item.level3}` : ''}
                                </p>
                                {item.description && (
                                  <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={item.active}
                                  onCheckedChange={() => handleToggleActive(item)}
                                />
                                <Button variant="ghost" size="sm" onClick={() => openEditDialog(item)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-red-600 hover:bg-red-50"
                                  onClick={() => handleDelete(item)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Tag className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>No se encontraron códigos</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar Código de Taxonomía</DialogTitle>
              <DialogDescription>
                Modifica los datos del código
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="edit-code">Código *</Label>
                  <Input
                    id="edit-code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-level1">Nivel 1 *</Label>
                  <Input
                    id="edit-level1"
                    value={formData.level1}
                    onChange={(e) => setFormData({ ...formData, level1: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-level2">Nivel 2 *</Label>
                  <Input
                    id="edit-level2"
                    value={formData.level2}
                    onChange={(e) => setFormData({ ...formData, level2: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-level3">Nivel 3</Label>
                  <Input
                    id="edit-level3"
                    value={formData.level3}
                    onChange={(e) => setFormData({ ...formData, level3: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-prong">Prong</Label>
                  <Select value={formData.prong} onValueChange={(v) => setFormData({ ...formData, prong: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRONG_OPTIONS.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="edit-severity">Severidad por defecto</Label>
                  <Select value={formData.severity_default} onValueChange={(v) => setFormData({ ...formData, severity_default: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEVERITY_OPTIONS.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="edit-description">Descripción</Label>
                  <Textarea
                    id="edit-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
              <Button onClick={handleEdit} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Guardar Cambios
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
