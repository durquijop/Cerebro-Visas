'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton-loaders'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  Brain, ArrowLeft, FileText, Trash2, Upload,
  Calendar, Loader2, AlertCircle, AlertTriangle,
  CheckCircle, XCircle, Clock, User, Building2,
  FolderOpen, BarChart3, ClipboardList, Eye,
  TrendingUp, ClipboardCheck, Target, Lightbulb, Shield,
  ChevronRight, AlertOctagon, Info, BookOpen, Pencil, Save
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const OUTCOME_CONFIG = {
  pending: { label: 'Pendiente', icon: Clock, color: 'bg-gray-100 text-gray-700' },
  approved: { label: 'Aprobado', icon: CheckCircle, color: 'bg-green-100 text-green-700' },
  rfe: { label: 'RFE Recibido', icon: AlertTriangle, color: 'bg-orange-100 text-orange-700' },
  noid: { label: 'NOID Recibido', icon: AlertTriangle, color: 'bg-red-100 text-red-700' },
  denied: { label: 'Denegado', icon: XCircle, color: 'bg-red-200 text-red-800' }
}

const SEVERITY_CONFIG = {
  critical: { label: 'Crítico', color: 'bg-red-100 text-red-800 border-red-200' },
  high: { label: 'Alto', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  medium: { label: 'Medio', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  low: { label: 'Bajo', color: 'bg-green-100 text-green-800 border-green-200' }
}

const PRONG_CONFIG = {
  P1: { label: 'Prong 1 - Mérito/Importancia', color: 'bg-purple-100 text-purple-800' },
  P2: { label: 'Prong 2 - Bien Posicionado', color: 'bg-blue-100 text-blue-800' },
  P3: { label: 'Prong 3 - Balance', color: 'bg-green-100 text-green-800' },
  EVIDENCE: { label: 'Evidencia', color: 'bg-amber-100 text-amber-800' },
  COHERENCE: { label: 'Coherencia', color: 'bg-pink-100 text-pink-800' },
  PROCEDURAL: { label: 'Procedural', color: 'bg-gray-100 text-gray-800' }
}

export default function CaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [caseData, setCaseData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [deletingDocId, setDeletingDocId] = useState(null)
  const [error, setError] = useState(null)
  
  // Auditor state
  const [auditReport, setAuditReport] = useState(null)
  const [auditing, setAuditing] = useState(false)
  const [activeTab, setActiveTab] = useState('documents')
  
  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    title: '',
    beneficiary_name: '',
    visa_category: '',
    outcome: '',
    service_center: '',
    filed_date: '',
    description: ''
  })

  useEffect(() => {
    if (params.id) {
      fetchCase()
    }
  }, [params.id])

  // Sincronizar editForm con caseData cuando se carga
  useEffect(() => {
    if (caseData) {
      setEditForm({
        title: caseData.title || '',
        beneficiary_name: caseData.beneficiary_name || '',
        visa_category: caseData.visa_category || 'EB2-NIW',
        outcome: caseData.outcome || 'pending',
        service_center: caseData.service_center || '',
        filed_date: caseData.filed_date ? caseData.filed_date.split('T')[0] : '',
        description: caseData.description || ''
      })
    }
  }, [caseData])

  const fetchCase = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/casos/${params.id}`)
      
      if (!response.ok) {
        throw new Error('Error al cargar el caso')
      }

      const data = await response.json()
      setCaseData(data.case)
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCase = async () => {
    if (!confirm('¿Está seguro de eliminar este caso y todos sus documentos?')) return

    try {
      setDeleting(true)
      const response = await fetch(`/api/casos/${params.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Error al eliminar el caso')
      }

      toast.success('Caso eliminado')
      router.push('/casos')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteDocument = async (docId, source) => {
    if (!confirm('¿Eliminar este documento?')) return

    try {
      setDeletingDocId(docId)
      const endpoint = source === 'documents' 
        ? `/api/documents/${docId}`
        : `/api/casos/documents/${docId}`
      
      const response = await fetch(endpoint, { method: 'DELETE' })

      if (!response.ok) {
        throw new Error('Error al eliminar')
      }

      toast.success('Documento eliminado')
      fetchCase() // Recargar caso
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeletingDocId(null)
    }
  }

  const runAudit = async () => {
    try {
      setAuditing(true)
      const response = await fetch('/api/casos/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: params.id })
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Error en la auditoría')
      }

      const report = await response.json()
      setAuditReport(report)
      setActiveTab('audit')
      toast.success('Auditoría completada')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setAuditing(false)
    }
  }

  const handleSaveCase = async () => {
    try {
      setSaving(true)
      const response = await fetch(`/api/casos/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Error al guardar')
      }

      toast.success('Caso actualizado correctamente')
      setEditModalOpen(false)
      fetchCase() // Recargar datos
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    if (score >= 40) return 'text-orange-600'
    return 'text-red-600'
  }

  const getScoreBg = (score) => {
    if (score >= 80) return 'bg-green-100 border-green-300'
    if (score >= 60) return 'bg-yellow-100 border-yellow-300'
    if (score >= 40) return 'bg-orange-100 border-orange-300'
    return 'bg-red-100 border-red-300'
  }

  const getPriorityColor = (priority) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-300',
      high: 'bg-orange-100 text-orange-800 border-orange-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      low: 'bg-green-100 text-green-800 border-green-300'
    }
    return colors[priority] || colors.medium
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header skeleton */}
        <header className="bg-navy-primary border-b border-navy-light">
          <div className="container mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Skeleton className="h-8 w-8 rounded-lg bg-navy-light" />
              <Skeleton className="h-6 w-32 bg-navy-light" />
            </div>
          </div>
        </header>
        <main className="container mx-auto px-6 py-8 max-w-7xl">
          <Skeleton className="h-10 w-32 mb-6" />
          {/* Case Header Skeleton */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <Skeleton className="h-14 w-14 rounded-lg" />
                  <div>
                    <Skeleton className="h-8 w-64 mb-2" />
                    <Skeleton className="h-4 w-40 mb-3" />
                    <div className="flex items-center space-x-4">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-24" />
                  <Skeleton className="h-9 w-24" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="flex items-center space-x-2">
                    <Skeleton className="h-4 w-4" />
                    <div>
                      <Skeleton className="h-3 w-20 mb-1" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          {/* Stats Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[1,2,3,4].map(i => (
              <Card key={i} className="border-l-4 border-l-gray-300">
                <CardContent className="pt-4">
                  <Skeleton className="h-3 w-16 mb-2" />
                  <Skeleton className="h-8 w-12" />
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Tabs Skeleton */}
          <Skeleton className="h-10 w-full max-w-lg mb-4" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8" />
                      <div>
                        <Skeleton className="h-4 w-48 mb-1" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  if (error || !caseData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{error || 'Caso no encontrado'}</p>
            <Link href="/casos">
              <Button><ArrowLeft className="mr-2 h-4 w-4" /> Volver a Casos</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const outcome = OUTCOME_CONFIG[caseData.outcome] || OUTCOME_CONFIG.pending
  const OutcomeIcon = outcome.icon
  const stats = caseData.stats || {}

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
      <main className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="mb-6">
          <Link href="/casos">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Casos
            </Button>
          </Link>
        </div>

        {/* Case Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FolderOpen className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-2xl flex items-center gap-3">
                    {caseData.title}
                    <Badge className={outcome.color}>
                      <OutcomeIcon className="h-3 w-3 mr-1" />
                      {outcome.label}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    <Badge variant="outline" className="mr-2">{caseData.visa_category}</Badge>
                    {caseData.beneficiary_name && (
                      <span className="text-gray-600">• {caseData.beneficiary_name}</span>
                    )}
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                {/* Botón Editar */}
                <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100">
                      <Pencil className="h-4 w-4 mr-1" /> Editar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[550px]">
                    <DialogHeader>
                      <DialogTitle>Editar Caso</DialogTitle>
                      <DialogDescription>
                        Modifica los datos del cliente y la visa
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="title">Nombre del Caso</Label>
                          <Input
                            id="title"
                            value={editForm.title}
                            onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                            placeholder="Ej: Juan Pérez - NIW"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="beneficiary_name">Nombre del Beneficiario</Label>
                          <Input
                            id="beneficiary_name"
                            value={editForm.beneficiary_name}
                            onChange={(e) => setEditForm({...editForm, beneficiary_name: e.target.value})}
                            placeholder="Nombre completo"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="visa_category">Categoría de Visa</Label>
                          <Select 
                            value={editForm.visa_category} 
                            onValueChange={(value) => setEditForm({...editForm, visa_category: value})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar visa" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EB2-NIW">EB2-NIW</SelectItem>
                              <SelectItem value="EB1A">EB1A - Habilidad Extraordinaria</SelectItem>
                              <SelectItem value="EB1B">EB1B - Investigador/Profesor</SelectItem>
                              <SelectItem value="EB1C">EB1C - Ejecutivo Multinacional</SelectItem>
                              <SelectItem value="O-1A">O-1A - Habilidad Extraordinaria</SelectItem>
                              <SelectItem value="O-1B">O-1B - Artes/Entretenimiento</SelectItem>
                              <SelectItem value="H-1B">H-1B - Trabajo Especializado</SelectItem>
                              <SelectItem value="L-1A">L-1A - Transferencia Ejecutivo</SelectItem>
                              <SelectItem value="L-1B">L-1B - Transferencia Conocimiento</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="outcome">Estado</Label>
                          <Select 
                            value={editForm.outcome} 
                            onValueChange={(value) => setEditForm({...editForm, outcome: value})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar estado" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendiente</SelectItem>
                              <SelectItem value="rfe">RFE Recibido</SelectItem>
                              <SelectItem value="noid">NOID Recibido</SelectItem>
                              <SelectItem value="approved">Aprobado</SelectItem>
                              <SelectItem value="denied">Denegado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="service_center">Centro de Servicio</Label>
                          <Select 
                            value={editForm.service_center || ''} 
                            onValueChange={(value) => setEditForm({...editForm, service_center: value})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar centro" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="TSC">Texas Service Center (TSC)</SelectItem>
                              <SelectItem value="NSC">Nebraska Service Center (NSC)</SelectItem>
                              <SelectItem value="CSC">California Service Center (CSC)</SelectItem>
                              <SelectItem value="VSC">Vermont Service Center (VSC)</SelectItem>
                              <SelectItem value="NBC">National Benefits Center (NBC)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="filed_date">Fecha de Presentación</Label>
                          <Input
                            id="filed_date"
                            type="date"
                            value={editForm.filed_date}
                            onChange={(e) => setEditForm({...editForm, filed_date: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">Descripción / Notas</Label>
                        <Textarea
                          id="description"
                          value={editForm.description}
                          onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                          placeholder="Notas sobre el caso..."
                          rows={3}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setEditModalOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleSaveCase} disabled={saving}>
                        {saving ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...</>
                        ) : (
                          <><Save className="h-4 w-4 mr-2" /> Guardar Cambios</>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={runAudit}
                  disabled={auditing}
                  className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                >
                  {auditing ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Auditando...</>
                  ) : (
                    <><ClipboardCheck className="h-4 w-4 mr-1" /> Auditar</>
                  )}
                </Button>
                <Link href={`/casos/${params.id}/claims`}>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                  >
                    <Shield className="h-4 w-4 mr-1" /> Claim Graph
                  </Button>
                </Link>
                <Link href="/documents/upload">
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-1" /> Subir Doc
                  </Button>
                </Link>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleDeleteCase}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-gray-500">Fecha Presentación</p>
                  <p className="font-medium">
                    {caseData.filed_date 
                      ? new Date(caseData.filed_date).toLocaleDateString('es-ES')
                      : 'No especificada'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Building2 className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-gray-500">Service Center</p>
                  <p className="font-medium">{caseData.service_center || 'No especificado'}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-gray-500">Documentos</p>
                  <p className="font-medium">{stats.totalDocuments || 0}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-gray-500">Issues</p>
                  <p className="font-medium">{stats.totalIssues || 0}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <ClipboardList className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-gray-500">Requests</p>
                  <p className="font-medium">{stats.totalRequests || 0}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        {stats.totalIssues > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="pt-4">
                <p className="text-sm text-gray-500">Críticos</p>
                <p className="text-2xl font-bold text-red-600">{stats.issuesBySeverity?.critical || 0}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="pt-4">
                <p className="text-sm text-gray-500">Altos</p>
                <p className="text-2xl font-bold text-orange-600">{stats.issuesBySeverity?.high || 0}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-yellow-500">
              <CardContent className="pt-4">
                <p className="text-sm text-gray-500">Medios</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.issuesBySeverity?.medium || 0}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-4">
                <p className="text-sm text-gray-500">Bajos</p>
                <p className="text-2xl font-bold text-green-600">{stats.issuesBySeverity?.low || 0}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documentos ({stats.totalDocuments || 0})
            </TabsTrigger>
            <TabsTrigger value="issues" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Issues ({stats.totalIssues || 0})
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Requests ({stats.totalRequests || 0})
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Auditoría {auditReport && <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">{auditReport.summary.overallScore}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle>Documentos del Caso</CardTitle>
                <CardDescription>
                  Documentos cargados para este caso
                </CardDescription>
              </CardHeader>
              <CardContent>
                {caseData.documents && caseData.documents.length > 0 ? (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {caseData.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <FileText className="h-8 w-8 text-blue-500" />
                          <div>
                            <p className="font-medium">{doc.name || doc.original_name || 'Sin nombre'}</p>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Badge variant="outline" className="text-xs">{doc.doc_type}</Badge>
                              {doc.document_date && (
                                <span>• {new Date(doc.document_date).toLocaleDateString('es-ES')}</span>
                              )}
                              {doc.outcome_type && (
                                <Badge className={`text-xs ${
                                  doc.outcome_type === 'RFE' ? 'bg-orange-100 text-orange-700' :
                                  doc.outcome_type === 'NOID' ? 'bg-red-100 text-red-700' :
                                  doc.outcome_type === 'Denial' ? 'bg-red-200 text-red-800' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {doc.outcome_type}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/documents/${doc.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteDocument(doc.id, doc.source)}
                            disabled={deletingDocId === doc.id}
                          >
                            {deletingDocId === doc.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>No hay documentos en este caso</p>
                    <Link href="/documents/upload">
                      <Button className="mt-4" variant="outline">
                        <Upload className="h-4 w-4 mr-2" /> Subir Documento
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Issues Tab */}
          <TabsContent value="issues">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Issues Identificados en el Caso
                </CardTitle>
                <CardDescription>
                  Deficiencias extraídas de documentos RFE/NOID/Denial
                </CardDescription>
              </CardHeader>
              <CardContent>
                {caseData.issues && caseData.issues.length > 0 ? (
                  <div className="space-y-4">
                    {/* Resumen por Prong */}
                    {stats.issuesByProng && (
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4 p-4 bg-gray-50 rounded-lg">
                        {Object.entries(stats.issuesByProng).filter(([,v]) => v > 0).map(([prong, count]) => (
                          <div key={prong} className="text-center">
                            <Badge className={PRONG_CONFIG[prong]?.color || 'bg-gray-100'}>
                              {prong}
                            </Badge>
                            <p className="text-lg font-bold mt-1">{count}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Lista de Issues */}
                    {caseData.issues.map((issue, idx) => (
                      <div key={idx} className={`p-4 border rounded-lg ${
                        issue.severity === 'critical' ? 'border-red-200 bg-red-50' :
                        issue.severity === 'high' ? 'border-orange-200 bg-orange-50' :
                        issue.severity === 'medium' ? 'border-yellow-200 bg-yellow-50' :
                        'border-gray-200 bg-gray-50'
                      }`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className={PRONG_CONFIG[issue.prong_affected]?.color || 'bg-gray-100'}>
                              {issue.prong_affected}
                            </Badge>
                            <Badge className={SEVERITY_CONFIG[issue.severity]?.color || ''}>
                              {SEVERITY_CONFIG[issue.severity]?.label || issue.severity}
                            </Badge>
                          </div>
                          {issue.page_ref && (
                            <span className="text-xs text-gray-400">Pág. {issue.page_ref}</span>
                          )}
                        </div>
                        
                        <code className="text-xs bg-white px-2 py-1 rounded border block mb-2">
                          {issue.taxonomy_code}
                        </code>
                        
                        {issue.officer_reasoning && (
                          <p className="text-sm text-gray-700 mb-2">{issue.officer_reasoning}</p>
                        )}
                        
                        {issue.extracted_quote && (
                          <blockquote className="text-sm text-gray-600 italic border-l-2 border-gray-300 pl-3">
                            "{issue.extracted_quote.substring(0, 300)}{issue.extracted_quote.length > 300 ? '...' : ''}"
                          </blockquote>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>No hay issues identificados</p>
                    <p className="text-sm">Sube documentos RFE/NOID para ver análisis</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Requests Tab */}
          <TabsContent value="requests">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-blue-500" />
                  Evidencia Solicitada por USCIS
                </CardTitle>
                <CardDescription>
                  Documentos y explicaciones requeridos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {caseData.requests && caseData.requests.length > 0 ? (
                  <div className="space-y-3">
                    {caseData.requests.map((req, idx) => (
                      <div key={idx} className="p-4 border rounded-lg bg-white hover:shadow-sm">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {req.prong_mapping && (
                              <Badge className={PRONG_CONFIG[req.prong_mapping]?.color || 'bg-gray-100'}>
                                {req.prong_mapping}
                              </Badge>
                            )}
                            <Badge variant={req.priority === 'required' ? 'default' : 'secondary'}>
                              {req.priority === 'required' ? '⚡ Requerido' : '📌 Recomendado'}
                            </Badge>
                          </div>
                          {req.evidence_type && (
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                              {req.evidence_type}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-800">{req.request_text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>No hay requests identificados</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit">
            {auditReport ? (
              <div className="space-y-6">
                {/* Score Overview */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className={`border-2 ${getScoreBg(auditReport.summary.overallScore)}`}>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <Target className={`h-8 w-8 mx-auto mb-2 ${getScoreColor(auditReport.summary.overallScore)}`} />
                        <p className="text-sm text-gray-600">Score General</p>
                        <p className={`text-4xl font-bold ${getScoreColor(auditReport.summary.overallScore)}`}>
                          {auditReport.summary.overallScore}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {Object.entries(auditReport.prongAnalysis).map(([key, prong]) => (
                    <Card key={key} className={`border-l-4 ${
                      prong.score >= 80 ? 'border-l-green-500' :
                      prong.score >= 60 ? 'border-l-yellow-500' :
                      prong.score >= 40 ? 'border-l-orange-500' : 'border-l-red-500'
                    }`}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">{key}</Badge>
                          <span className={`text-xl font-bold ${getScoreColor(prong.score)}`}>{prong.score}</span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-1">{prong.name.split(' - ')[1]}</p>
                        <Progress 
                          value={prong.score} 
                          className={`h-1.5 mt-2 ${
                            prong.score >= 80 ? '[&>div]:bg-green-500' :
                            prong.score >= 60 ? '[&>div]:bg-yellow-500' :
                            prong.score >= 40 ? '[&>div]:bg-orange-500' : '[&>div]:bg-red-500'
                          }`}
                        />
                        <p className="text-xs text-gray-400 mt-1">{prong.issueCount} issues • {prong.requestCount} requests</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Recommendations */}
                {auditReport.recommendations.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-yellow-600" />
                        Recomendaciones Prioritarias ({auditReport.recommendations.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {auditReport.recommendations.slice(0, 5).map((rec, i) => (
                          <div 
                            key={i}
                            className={`p-4 rounded-lg border-l-4 ${
                              rec.priority === 'critical' ? 'bg-red-50 border-red-500' :
                              rec.priority === 'high' ? 'bg-orange-50 border-orange-500' :
                              'bg-yellow-50 border-yellow-500'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={getPriorityColor(rec.priority)}>{rec.priority.toUpperCase()}</Badge>
                              {rec.prong && <Badge variant="outline">{rec.prong}</Badge>}
                            </div>
                            <p className="font-medium text-sm">{rec.title}</p>
                            <p className="text-xs text-gray-600 mt-1">{rec.description}</p>
                            {rec.actions && rec.actions.length > 0 && (
                              <ul className="mt-2 space-y-1">
                                {rec.actions.slice(0, 2).map((action, j) => (
                                  <li key={j} className="text-xs text-gray-700 flex items-start gap-1">
                                    <ChevronRight className="h-3 w-3 mt-0.5 text-gray-400 shrink-0" />
                                    {action}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Evidence Checklist */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      Checklist de Evidencia
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-3 text-sm text-gray-700">Documentos Esenciales</h4>
                        <ul className="space-y-2">
                          {auditReport.evidenceChecklist.essential.map((item, i) => (
                            <li key={i} className={`p-2 rounded flex items-center justify-between ${
                              item.status === 'present' ? 'bg-green-50' :
                              item.status === 'missing' ? 'bg-red-50' : 'bg-gray-50'
                            }`}>
                              <span className="text-sm">{item.item}</span>
                              {item.status === 'present' ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : item.status === 'missing' ? (
                                <XCircle className="h-4 w-4 text-red-600" />
                              ) : (
                                <Info className="h-4 w-4 text-gray-400" />
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium mb-3 text-sm text-gray-700">Solicitudes Pendientes ({auditReport.evidenceChecklist.requestedByUSCIS.length})</h4>
                        {auditReport.evidenceChecklist.requestedByUSCIS.length > 0 ? (
                          <ul className="space-y-2">
                            {auditReport.evidenceChecklist.requestedByUSCIS.slice(0, 4).map((item, i) => (
                              <li key={i} className="p-2 bg-purple-50 rounded">
                                <p className="text-xs text-gray-700 line-clamp-2">{item.item}</p>
                                <div className="flex gap-1 mt-1">
                                  <Badge className="text-xs" variant="outline">{item.importance}</Badge>
                                  {item.prong && <Badge className="text-xs" variant="outline">{item.prong}</Badge>}
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-500 text-center py-4">Sin solicitudes pendientes</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-16">
                  <div className="text-center text-gray-500">
                    <ClipboardCheck className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <h3 className="text-lg font-medium text-gray-700 mb-2">Auditoría del Expediente</h3>
                    <p className="mb-4">
                      {caseData.visa_category?.toUpperCase().includes('EB1') 
                        ? 'Analiza el caso contra los 10 criterios de EB-1A'
                        : 'Analiza el caso completo contra los 3 prongs del test Dhanasar'}
                    </p>
                    <Button onClick={runAudit} disabled={auditing} className="bg-purple-600 hover:bg-purple-700">
                      {auditing ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analizando...</>
                      ) : (
                        <><ClipboardCheck className="h-4 w-4 mr-2" /> Ejecutar Auditoría</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* CV Analysis if exists */}
        {caseData.cv_analysis && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                Análisis de Aptitud del Beneficiario
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {caseData.cv_analysis.aptitude_score && (
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">Puntuación de Aptitud</span>
                      <span className="font-bold text-lg">{caseData.cv_analysis.aptitude_score}%</span>
                    </div>
                    <Progress value={caseData.cv_analysis.aptitude_score} className="h-3" />
                  </div>
                )}
                {caseData.cv_analysis.executive_summary && (
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-purple-800">{caseData.cv_analysis.executive_summary}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
