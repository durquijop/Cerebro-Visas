'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  Brain, FolderOpen, Plus, FileText, Upload, CheckCircle, 
  AlertTriangle, XCircle, Clock, Loader2, Eye, Trash2,
  Sparkles, FileUp, X, ChevronRight, BarChart3
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const VISA_CATEGORIES = [
  { value: 'EB2-NIW', label: 'EB-2 NIW (National Interest Waiver)' },
  { value: 'EB1A', label: 'EB-1A (Extraordinary Ability)' },
  { value: 'EB1B', label: 'EB-1B (Outstanding Researcher)' },
  { value: 'EB1C', label: 'EB-1C (Multinational Manager)' },
  { value: 'Other', label: 'Otro' }
]

const CASE_OUTCOMES = [
  { value: 'pending', label: 'Pendiente', icon: Clock, color: 'text-gray-400' },
  { value: 'approved', label: 'Aprobado', icon: CheckCircle, color: 'text-green-500' },
  { value: 'rfe', label: 'RFE Recibido', icon: AlertTriangle, color: 'text-orange-500' },
  { value: 'noid', label: 'NOID Recibido', icon: AlertTriangle, color: 'text-red-400' },
  { value: 'denied', label: 'Denegado', icon: XCircle, color: 'text-red-600' }
]

const DOC_TYPES = [
  // Formularios USCIS
  { value: 'i140', label: 'Formulario I-140 (Petition for Alien Worker)', category: 'Formularios USCIS' },
  { value: 'i907', label: 'Formulario I-907 (Premium Processing)', category: 'Formularios USCIS' },
  { value: 'g1450', label: 'Formulario G-1450 (Authorization Credit Card)', category: 'Formularios USCIS' },
  { value: 'g1145', label: 'Formulario G-1145 (E-Notification)', category: 'Formularios USCIS' },
  
  // Documentos de Inmigración
  { value: 'i94', label: 'I-94 (Registro de Entrada)', category: 'Documentos Inmigración' },
  { value: 'passport', label: 'Pasaporte (bio page + visas)', category: 'Documentos Inmigración' },
  { value: 'visa', label: 'Visa actual/anterior', category: 'Documentos Inmigración' },
  
  // Carta NIW
  { value: 'niw_letter', label: 'Carta Autopetición NIW completa', category: 'Carta NIW' },
  
  // Project Documentation
  { value: 'policy_paper', label: '1.1 Policy Paper', category: 'Project Documentation' },
  { value: 'white_paper', label: '1.2 White Paper', category: 'Project Documentation' },
  { value: 'econometric', label: '1.3 Econometric Study', category: 'Project Documentation' },
  { value: 'mvp', label: '1.4 MVP Documentation', category: 'Project Documentation' },
  { value: 'patent', label: '1.5 Patent Documentation', category: 'Project Documentation' },
  { value: 'libro', label: '1.6 Libro/Publicación', category: 'Project Documentation' },
  
  // CV
  { value: 'cv', label: 'Curriculum Vitae', category: 'CV' },
  
  // Certificates
  { value: 'titulo', label: 'Títulos Académicos', category: 'Certificates of Study' },
  { value: 'certificado_academico', label: 'Certificados Académicos', category: 'Certificates of Study' },
  
  // Expert Evaluation
  { value: 'expert_evaluation', label: 'Expert Evaluation Letter (firmada + CV + ID)', category: 'Expert Evaluation' },
  
  // Recommendation Letters
  { value: 'recommendation', label: 'Carta de Recomendación (firmada + credenciales)', category: 'Recommendation Letters' },
  
  // Employment
  { value: 'employment', label: 'Carta Laboral (fechas, cargo, funciones)', category: 'Employment Letters' },
  
  // Letter of Intent
  { value: 'intent_letter', label: 'Letter of Intent (firmada + CV + ID)', category: 'Letter of Intent' },
  
  // Family Documents
  { value: 'family_i94', label: 'I-94 Familiares', category: 'Documents Family' },
  { value: 'family_passport', label: 'Pasaportes Familiares', category: 'Documents Family' },
  { value: 'family_visa', label: 'Visas Familiares', category: 'Documents Family' },
  
  // Traducciones
  { value: 'translation', label: 'Documento Traducido al Inglés', category: 'Traducciones' },
  
  // RFE/NOID/Respuestas
  { value: 'rfe_document', label: 'Documento RFE (de USCIS)', category: 'RFE/NOID' },
  { value: 'noid_document', label: 'Documento NOID (de USCIS)', category: 'RFE/NOID' },
  { value: 'rfe_response', label: 'Respuesta a RFE', category: 'RFE/NOID' },
  { value: 'approval_notice', label: 'Notificación de Aprobación', category: 'Resultado' },
  { value: 'denial_notice', label: 'Notificación de Denegación', category: 'Resultado' },
  
  // Otro
  { value: 'other', label: 'Otro documento', category: 'Otro' }
]

export default function CasosPage() {
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCase, setSelectedCase] = useState(null)
  const [showNewCaseDialog, setShowNewCaseDialog] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  
  // New case form
  const [newCase, setNewCase] = useState({
    title: '',
    description: '',
    visa_category: 'EB2-NIW',
    outcome: 'pending',
    beneficiary_name: '',
    filed_date: '',
    service_center: ''
  })
  const [creatingCase, setCreatingCase] = useState(false)

  // Upload form
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadDocType, setUploadDocType] = useState('i140')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  useEffect(() => {
    loadCases()
  }, [])

  const loadCases = async () => {
    try {
      const res = await fetch('/api/casos')
      const data = await res.json()
      setCases(data.cases || [])
    } catch (error) {
      console.error('Error loading cases:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCaseDetails = async (caseId) => {
    try {
      const res = await fetch(`/api/casos/${caseId}`)
      const data = await res.json()
      setSelectedCase(data.case)
    } catch (error) {
      toast.error('Error al cargar el caso')
    }
  }

  const handleCreateCase = async () => {
    if (!newCase.title.trim()) {
      toast.error('El título es requerido')
      return
    }

    setCreatingCase(true)
    try {
      const res = await fetch('/api/casos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCase)
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error)
      
      setCases([data.case, ...cases])
      setShowNewCaseDialog(false)
      setNewCase({
        title: '',
        description: '',
        visa_category: 'EB2-NIW',
        outcome: 'pending',
        beneficiary_name: '',
        filed_date: '',
        service_center: ''
      })
      toast.success('Caso creado exitosamente')
      
      // Seleccionar el nuevo caso
      setSelectedCase(data.case)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setCreatingCase(false)
    }
  }

  const handleUploadDocument = async () => {
    if (!uploadFile || !selectedCase) return

    setUploading(true)
    setUploadProgress(10)

    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('case_id', selectedCase.id)
      formData.append('doc_type', uploadDocType)

      setUploadProgress(30)

      const res = await fetch('/api/casos/documents/upload', {
        method: 'POST',
        body: formData
      })

      setUploadProgress(70)

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setUploadProgress(100)
      toast.success('Documento subido y procesado')
      
      // Recargar el caso para ver el nuevo documento
      loadCaseDetails(selectedCase.id)
      setShowUploadDialog(false)
      setUploadFile(null)
      setUploadDocType('petition')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleAnalyzeCase = async () => {
    if (!selectedCase) return

    setAnalyzing(true)
    setAnalysisResult(null)
    setShowAnalysisDialog(true)

    try {
      const res = await fetch(`/api/casos/${selectedCase.id}/analyze`, {
        method: 'POST'
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error)
      
      setAnalysisResult(data.analysis)
      
      // Recargar el caso para ver el análisis guardado
      loadCaseDetails(selectedCase.id)
    } catch (error) {
      toast.error(error.message)
      setShowAnalysisDialog(false)
    } finally {
      setAnalyzing(false)
    }
  }

  const updateCaseOutcome = async (newOutcome) => {
    if (!selectedCase) return

    try {
      const res = await fetch(`/api/casos/${selectedCase.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome: newOutcome })
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error)
      
      setSelectedCase({ ...selectedCase, outcome: newOutcome })
      setCases(cases.map(c => c.id === selectedCase.id ? { ...c, outcome: newOutcome } : c))
      toast.success('Estado actualizado')
    } catch (error) {
      toast.error(error.message)
    }
  }

  const getOutcomeInfo = (outcome) => {
    return CASE_OUTCOMES.find(o => o.value === outcome) || CASE_OUTCOMES[0]
  }

  const getDocTypeLabel = (type) => {
    return DOC_TYPES.find(d => d.value === type)?.label || type
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
          <span className="text-gold-muted text-sm">Gestión de Casos de Visa</span>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de Casos */}
          <div className="lg:col-span-1">
            <Card className="bg-navy-secondary border-navy-light">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-gold-subtle">Casos</CardTitle>
                  <CardDescription className="text-gold-muted">
                    {cases.length} caso(s)
                  </CardDescription>
                </div>
                <Dialog open={showNewCaseDialog} onOpenChange={setShowNewCaseDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-gold-primary text-navy-primary hover:bg-gold-dark">
                      <Plus className="h-4 w-4 mr-1" /> Nuevo
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-navy-secondary border-navy-light max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="text-gold-subtle">Crear Nuevo Caso</DialogTitle>
                      <DialogDescription className="text-gold-muted">
                        Registra un nuevo caso de visa para análisis
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label className="text-gold-subtle">Título del Caso *</Label>
                        <Input
                          placeholder="Ej: Caso Dr. García - NIW Investigación"
                          value={newCase.title}
                          onChange={(e) => setNewCase({...newCase, title: e.target.value})}
                          className="bg-navy-primary border-navy-light text-gold-subtle"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gold-subtle">Nombre del Beneficiario</Label>
                        <Input
                          placeholder="Nombre completo"
                          value={newCase.beneficiary_name}
                          onChange={(e) => setNewCase({...newCase, beneficiary_name: e.target.value})}
                          className="bg-navy-primary border-navy-light text-gold-subtle"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-gold-subtle">Categoría de Visa</Label>
                          <Select value={newCase.visa_category} onValueChange={(v) => setNewCase({...newCase, visa_category: v})}>
                            <SelectTrigger className="bg-navy-primary border-navy-light text-gold-subtle">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-navy-secondary border-navy-light">
                              {VISA_CATEGORIES.map(cat => (
                                <SelectItem key={cat.value} value={cat.value} className="text-gold-subtle">
                                  {cat.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-gold-subtle">Estado</Label>
                          <Select value={newCase.outcome} onValueChange={(v) => setNewCase({...newCase, outcome: v})}>
                            <SelectTrigger className="bg-navy-primary border-navy-light text-gold-subtle">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-navy-secondary border-navy-light">
                              {CASE_OUTCOMES.map(out => (
                                <SelectItem key={out.value} value={out.value} className="text-gold-subtle">
                                  {out.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-gold-subtle">Fecha de Presentación</Label>
                          <Input
                            type="date"
                            value={newCase.filed_date}
                            onChange={(e) => setNewCase({...newCase, filed_date: e.target.value})}
                            className="bg-navy-primary border-navy-light text-gold-subtle"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-gold-subtle">Service Center</Label>
                          <Select value={newCase.service_center} onValueChange={(v) => setNewCase({...newCase, service_center: v})}>
                            <SelectTrigger className="bg-navy-primary border-navy-light text-gold-subtle">
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent className="bg-navy-secondary border-navy-light">
                              <SelectItem value="TSC" className="text-gold-subtle">Texas (TSC)</SelectItem>
                              <SelectItem value="NSC" className="text-gold-subtle">Nebraska (NSC)</SelectItem>
                              <SelectItem value="CSC" className="text-gold-subtle">California (CSC)</SelectItem>
                              <SelectItem value="VSC" className="text-gold-subtle">Vermont (VSC)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gold-subtle">Descripción</Label>
                        <Textarea
                          placeholder="Descripción del caso..."
                          value={newCase.description}
                          onChange={(e) => setNewCase({...newCase, description: e.target.value})}
                          className="bg-navy-primary border-navy-light text-gold-subtle"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowNewCaseDialog(false)} className="border-navy-light text-gold-muted">
                        Cancelar
                      </Button>
                      <Button onClick={handleCreateCase} disabled={creatingCase} className="bg-gold-primary text-navy-primary">
                        {creatingCase ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Crear Caso
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[calc(100vh-300px)] overflow-auto">
                {loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-gold-primary" />
                  </div>
                ) : cases.length > 0 ? (
                  cases.map((caseItem) => {
                    const outcomeInfo = getOutcomeInfo(caseItem.outcome)
                    const OutcomeIcon = outcomeInfo.icon
                    return (
                      <div
                        key={caseItem.id}
                        onClick={() => loadCaseDetails(caseItem.id)}
                        className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                          selectedCase?.id === caseItem.id
                            ? 'bg-gold-primary/10 border-gold-primary'
                            : 'bg-navy-primary border-navy-light hover:border-gold-muted'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium text-gold-subtle truncate">{caseItem.title}</h3>
                            <p className="text-xs text-gold-muted mt-1">{caseItem.visa_category}</p>
                          </div>
                          <OutcomeIcon className={`h-5 w-5 ${outcomeInfo.color}`} />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gold-muted">
                            {caseItem.documents_count || 0} docs
                          </span>
                          <span className="text-xs text-gold-muted">
                            {new Date(caseItem.created_at).toLocaleDateString('es-ES')}
                          </span>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-8">
                    <FolderOpen className="h-12 w-12 text-navy-light mx-auto mb-2" />
                    <p className="text-gold-muted">No hay casos</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detalle del Caso */}
          <div className="lg:col-span-2">
            {selectedCase ? (
              <div className="space-y-6">
                {/* Header del Caso */}
                <Card className="bg-navy-secondary border-navy-light">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-gold-subtle">{selectedCase.title}</h2>
                        <p className="text-gold-muted mt-1">{selectedCase.beneficiary_name || 'Sin beneficiario'}</p>
                        <div className="flex items-center space-x-4 mt-3">
                          <span className="text-sm text-gold-muted">{selectedCase.visa_category}</span>
                          {selectedCase.service_center && (
                            <span className="text-sm text-gold-muted">• {selectedCase.service_center}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <Select value={selectedCase.outcome} onValueChange={updateCaseOutcome}>
                          <SelectTrigger className="w-40 bg-navy-primary border-navy-light text-gold-subtle">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-navy-secondary border-navy-light">
                            {CASE_OUTCOMES.map(out => (
                              <SelectItem key={out.value} value={out.value} className="text-gold-subtle">
                                <div className="flex items-center">
                                  <out.icon className={`h-4 w-4 mr-2 ${out.color}`} />
                                  {out.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Acciones Principales */}
                <div className="flex space-x-4">
                  <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                    <DialogTrigger asChild>
                      <Button className="flex-1 bg-blue-600 hover:bg-blue-700">
                        <Upload className="h-4 w-4 mr-2" /> Subir Documento
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-navy-secondary border-navy-light">
                      <DialogHeader>
                        <DialogTitle className="text-gold-subtle">Subir Documento al Caso</DialogTitle>
                        <DialogDescription className="text-gold-muted">
                          Sube un documento para asociarlo a este caso
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div
                          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                            uploadFile ? 'border-green-500 bg-green-500/10' : 'border-navy-light hover:border-gold-muted'
                          }`}
                        >
                          {uploadFile ? (
                            <div className="flex items-center justify-center space-x-3">
                              <FileText className="h-8 w-8 text-green-500" />
                              <div className="text-left">
                                <p className="text-gold-subtle font-medium">{uploadFile.name}</p>
                                <p className="text-xs text-gold-muted">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                              </div>
                              <Button variant="ghost" size="icon" onClick={() => setUploadFile(null)}>
                                <X className="h-4 w-4 text-gold-muted" />
                              </Button>
                            </div>
                          ) : (
                            <label className="cursor-pointer">
                              <FileUp className="h-10 w-10 text-gold-muted mx-auto mb-2" />
                              <p className="text-gold-muted">Arrastra o <span className="text-gold-primary">selecciona</span></p>
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.docx,.doc,.txt"
                                onChange={(e) => setUploadFile(e.target.files[0])}
                              />
                            </label>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-gold-subtle">Tipo de Documento</Label>
                          <Select value={uploadDocType} onValueChange={setUploadDocType}>
                            <SelectTrigger className="bg-navy-primary border-navy-light text-gold-subtle">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-navy-secondary border-navy-light max-h-80">
                              {/* Agrupar por categoría */}
                              {[...new Set(DOC_TYPES.map(d => d.category))].map(category => (
                                <div key={category}>
                                  <div className="px-2 py-1.5 text-xs font-semibold text-gold-primary bg-navy-primary sticky top-0">
                                    {category}
                                  </div>
                                  {DOC_TYPES.filter(d => d.category === category).map(type => (
                                    <SelectItem key={type.value} value={type.value} className="text-gold-subtle pl-4">
                                      {type.label}
                                    </SelectItem>
                                  ))}
                                </div>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {uploading && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm text-gold-muted">
                              <span>Procesando...</span>
                              <span>{uploadProgress}%</span>
                            </div>
                            <Progress value={uploadProgress} />
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowUploadDialog(false)} className="border-navy-light text-gold-muted">
                          Cancelar
                        </Button>
                        <Button onClick={handleUploadDocument} disabled={!uploadFile || uploading} className="bg-gold-primary text-navy-primary">
                          {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                          Subir
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Button 
                    onClick={handleAnalyzeCase}
                    disabled={!selectedCase.documents || selectedCase.documents.length === 0}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    <Sparkles className="h-4 w-4 mr-2" /> Analizar Caso con IA
                  </Button>
                </div>

                {/* Documentos del Caso */}
                <Card className="bg-navy-secondary border-navy-light">
                  <CardHeader>
                    <CardTitle className="text-gold-subtle">Documentos del Caso</CardTitle>
                    <CardDescription className="text-gold-muted">
                      {selectedCase.documents?.length || 0} documento(s) asociado(s)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedCase.documents && selectedCase.documents.length > 0 ? (
                      <div className="space-y-3">
                        {selectedCase.documents.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between p-3 bg-navy-primary rounded-lg border border-navy-light">
                            <div className="flex items-center space-x-3">
                              <FileText className="h-6 w-6 text-gold-muted" />
                              <div>
                                <p className="text-gold-subtle font-medium">{doc.original_name}</p>
                                <div className="flex items-center space-x-2 mt-1">
                                  <span className="text-xs px-2 py-0.5 rounded bg-navy-light text-gold-muted">
                                    {getDocTypeLabel(doc.doc_type)}
                                  </span>
                                  <span className="text-xs text-gold-muted">
                                    {doc.word_count?.toLocaleString()} palabras
                                  </span>
                                </div>
                              </div>
                            </div>
                            {doc.analysis_summary && (
                              <span className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-300">
                                Analizado
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <FileText className="h-12 w-12 text-navy-light mx-auto mb-2" />
                        <p className="text-gold-muted">No hay documentos</p>
                        <p className="text-sm text-gold-muted mt-1">Sube documentos para analizar el caso</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Análisis del Caso (si existe) */}
                {selectedCase.case_analysis && (
                  <Card className={`border ${
                    selectedCase.outcome === 'approved' ? 'bg-green-500/10 border-green-500/30' :
                    selectedCase.outcome === 'rfe' || selectedCase.outcome === 'noid' ? 'bg-orange-500/10 border-orange-500/30' :
                    selectedCase.outcome === 'denied' ? 'bg-red-500/10 border-red-500/30' :
                    'bg-navy-secondary border-navy-light'
                  }`}>
                    <CardHeader>
                      <CardTitle className="text-gold-subtle flex items-center">
                        <Sparkles className="h-5 w-5 mr-2 text-purple-400" />
                        Análisis del Caso
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Resumen */}
                      <div className="p-4 bg-navy-primary/50 rounded-lg">
                        <h4 className="font-semibold text-gold-subtle mb-2">Resumen</h4>
                        <p className="text-gold-muted">{selectedCase.case_analysis.summary}</p>
                      </div>

                      {/* Fortalezas (para casos aprobados) */}
                      {selectedCase.case_analysis.strengths && selectedCase.case_analysis.strengths.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-green-400 mb-2">✅ Fortalezas (Lo que se hizo bien)</h4>
                          <ul className="space-y-2">
                            {selectedCase.case_analysis.strengths.map((item, idx) => (
                              <li key={idx} className="flex items-start space-x-2 text-gold-muted">
                                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Debilidades (para RFE/NOID/Denied) */}
                      {selectedCase.case_analysis.weaknesses && selectedCase.case_analysis.weaknesses.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-orange-400 mb-2">⚠️ Debilidades Identificadas</h4>
                          <ul className="space-y-2">
                            {selectedCase.case_analysis.weaknesses.map((item, idx) => (
                              <li key={idx} className="flex items-start space-x-2 text-gold-muted">
                                <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Recomendaciones */}
                      {selectedCase.case_analysis.recommendations && selectedCase.case_analysis.recommendations.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-blue-400 mb-2">💡 Recomendaciones</h4>
                          <ul className="space-y-2">
                            {selectedCase.case_analysis.recommendations.map((item, idx) => (
                              <li key={idx} className="flex items-start space-x-2 text-gold-muted">
                                <ChevronRight className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card className="bg-navy-secondary border-navy-light h-full flex items-center justify-center">
                <CardContent className="text-center py-16">
                  <FolderOpen className="h-16 w-16 text-navy-light mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gold-subtle">Selecciona un caso</h3>
                  <p className="text-gold-muted mt-2">Elige un caso de la lista o crea uno nuevo</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Dialog de Análisis */}
      <Dialog open={showAnalysisDialog} onOpenChange={setShowAnalysisDialog}>
        <DialogContent className="bg-navy-secondary border-navy-light max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-gold-subtle flex items-center">
              <Sparkles className="h-5 w-5 mr-2 text-purple-400" />
              Análisis con IA
            </DialogTitle>
          </DialogHeader>
          {analyzing ? (
            <div className="text-center py-12">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-purple-400" />
              <p className="mt-4 text-gold-muted">Analizando documentos del caso...</p>
              <p className="text-sm text-gold-muted mt-2">Esto puede tomar unos segundos</p>
            </div>
          ) : analysisResult ? (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-navy-primary rounded-lg">
                <h4 className="font-semibold text-gold-subtle mb-2">Resumen</h4>
                <p className="text-gold-muted">{analysisResult.summary}</p>
              </div>

              {analysisResult.strengths?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-green-400 mb-2">✅ Fortalezas</h4>
                  <ul className="space-y-1">
                    {analysisResult.strengths.map((item, idx) => (
                      <li key={idx} className="text-gold-muted text-sm">• {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysisResult.weaknesses?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-orange-400 mb-2">⚠️ Debilidades</h4>
                  <ul className="space-y-1">
                    {analysisResult.weaknesses.map((item, idx) => (
                      <li key={idx} className="text-gold-muted text-sm">• {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysisResult.recommendations?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-blue-400 mb-2">💡 Recomendaciones</h4>
                  <ul className="space-y-1">
                    {analysisResult.recommendations.map((item, idx) => (
                      <li key={idx} className="text-gold-muted text-sm">• {item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setShowAnalysisDialog(false)} className="bg-gold-primary text-navy-primary">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
