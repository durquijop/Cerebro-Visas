'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { 
  Brain, FolderOpen, Plus, FileText, Upload, CheckCircle, 
  AlertTriangle, XCircle, Clock, Loader2, Eye, Trash2,
  Sparkles, FileUp, X, ChevronRight, BarChart3, Check, ChevronsUpDown, Search, ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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
  const [showDocumentDialog, setShowDocumentDialog] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [showFullAnalysis, setShowFullAnalysis] = useState(false)
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
  const [cvFile, setCvFile] = useState(null)
  const [cvAnalysis, setCvAnalysis] = useState(null)
  const [analyzingCv, setAnalyzingCv] = useState(false)

  // Upload form
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadDocType, setUploadDocType] = useState('i140')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [docTypeOpen, setDocTypeOpen] = useState(false)
  const [docTypeSearch, setDocTypeSearch] = useState('')

  // Filtrar tipos de documento por búsqueda
  const filteredDocTypes = useMemo(() => {
    if (!docTypeSearch) return DOC_TYPES
    const search = docTypeSearch.toLowerCase()
    return DOC_TYPES.filter(d => 
      d.label.toLowerCase().includes(search) || 
      d.category.toLowerCase().includes(search) ||
      d.value.toLowerCase().includes(search)
    )
  }, [docTypeSearch])

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

    if (!newCase.beneficiary_name.trim()) {
      toast.error('El nombre del beneficiario es requerido')
      return
    }

    if (!cvFile) {
      toast.error('El CV del beneficiario es obligatorio')
      return
    }

    if (!cvAnalysis) {
      toast.error('Primero debes analizar el CV')
      return
    }

    setCreatingCase(true)
    try {
      // 1. Crear el caso con el análisis de aptitud
      const res = await fetch('/api/casos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newCase,
          cv_analysis: cvAnalysis
        })
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error)
      
      // 2. Subir el CV al caso
      const formData = new FormData()
      formData.append('file', cvFile)
      formData.append('case_id', data.case.id)
      formData.append('doc_type', 'cv')

      await fetch('/api/casos/documents/upload', {
        method: 'POST',
        body: formData
      })
      
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
      setCvFile(null)
      setCvAnalysis(null)
      toast.success('Caso creado con análisis de aptitud')
      
      // Seleccionar el nuevo caso
      loadCaseDetails(data.case.id)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setCreatingCase(false)
    }
  }

  const handleAnalyzeCv = async () => {
    if (!cvFile) {
      toast.error('Primero selecciona un CV')
      return
    }

    if (!newCase.visa_category) {
      toast.error('Selecciona la categoría de visa primero')
      return
    }

    setAnalyzingCv(true)
    setCvAnalysis(null)

    try {
      const formData = new FormData()
      formData.append('file', cvFile)
      formData.append('visa_category', newCase.visa_category)
      formData.append('beneficiary_name', newCase.beneficiary_name || 'Candidato')

      const res = await fetch('/api/casos/analyze-cv', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error)
      
      setCvAnalysis(data.analysis)
      toast.success('CV analizado exitosamente')
    } catch (error) {
      toast.error('Error al analizar CV: ' + error.message)
    } finally {
      setAnalyzingCv(false)
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

  const handleDeleteCase = async (caseId) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este caso? Esta acción no se puede deshacer.')) return

    try {
      const res = await fetch(`/api/casos/${caseId}`, {
        method: 'DELETE'
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      
      // Actualizar la lista de casos
      setCases(cases.filter(c => c.id !== caseId))
      
      // Si el caso eliminado era el seleccionado, limpiar selección
      if (selectedCase?.id === caseId) {
        setSelectedCase(null)
      }
      
      toast.success('Caso eliminado')
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleDeleteDocument = async (docId) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este documento?')) return

    try {
      const res = await fetch(`/api/casos/documents/${docId}`, {
        method: 'DELETE'
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      
      // Recargar el caso para actualizar la lista de documentos
      if (selectedCase) {
        loadCaseDetails(selectedCase.id)
      }
      
      // Actualizar el conteo de documentos en la lista
      setCases(cases.map(c => 
        c.id === selectedCase?.id 
          ? { ...c, documents_count: Math.max(0, (c.documents_count || 1) - 1) }
          : c
      ))
      
      toast.success('Documento eliminado')
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleViewDocument = (doc) => {
    setSelectedDocument(doc)
    setShowFullAnalysis(false)
    setShowDocumentDialog(true)
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
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="flex items-center text-gold-muted hover:text-gold-primary transition-colors">
              <ArrowLeft className="h-5 w-5 mr-2" />
              <span>Volver al Dashboard</span>
            </Link>
          </div>
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
                  <DialogContent className="bg-navy-secondary border-navy-light max-w-2xl max-h-[90vh] overflow-auto">
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

                      {/* Sección de CV obligatorio */}
                      <div className="border-t border-navy-light pt-4 mt-4">
                        <Label className="text-gold-subtle flex items-center mb-2">
                          <FileText className="h-4 w-4 mr-2" />
                          CV del Beneficiario * (Obligatorio)
                        </Label>
                        <div className="space-y-3">
                          <Input
                            type="file"
                            accept=".pdf,.docx,.doc,.txt"
                            onChange={(e) => {
                              setCvFile(e.target.files?.[0] || null)
                              setCvAnalysis(null)
                            }}
                            className="bg-navy-primary border-navy-light text-gold-subtle"
                          />
                          {cvFile && (
                            <div className="flex items-center justify-between p-2 bg-navy-primary rounded border border-navy-light">
                              <span className="text-sm text-gold-muted truncate">{cvFile.name}</span>
                              <Button
                                size="sm"
                                onClick={handleAnalyzeCv}
                                disabled={analyzingCv || !cvFile}
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                              >
                                {analyzingCv ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                    Analizando...
                                  </>
                                ) : (
                                  <>
                                    <Brain className="h-4 w-4 mr-1" />
                                    Analizar Aptitud
                                  </>
                                )}
                              </Button>
                            </div>
                          )}

                          {/* Resultado del análisis de CV */}
                          {cvAnalysis && (
                            <div className="p-4 bg-navy-primary rounded-lg border border-navy-light space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-gold-subtle">Análisis de Aptitud</h4>
                                <div className="flex items-center gap-2">
                                  <div className={`text-2xl font-bold ${
                                    cvAnalysis.aptitude_score >= 70 ? 'text-green-400' :
                                    cvAnalysis.aptitude_score >= 50 ? 'text-yellow-400' :
                                    'text-red-400'
                                  }`}>
                                    {cvAnalysis.aptitude_score}%
                                  </div>
                                  <span className={`text-xs px-2 py-1 rounded ${
                                    cvAnalysis.recommendation === 'ALTAMENTE RECOMENDADO' ? 'bg-green-500/20 text-green-400' :
                                    cvAnalysis.recommendation === 'RECOMENDADO' ? 'bg-green-500/20 text-green-300' :
                                    cvAnalysis.recommendation === 'POSIBLE CON MEJORAS' ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-red-500/20 text-red-400'
                                  }`}>
                                    {cvAnalysis.recommendation}
                                  </span>
                                </div>
                              </div>
                              
                              <p className="text-sm text-gold-muted">{cvAnalysis.summary}</p>
                              
                              {cvAnalysis.prong_analysis && (
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div className="p-2 bg-navy-secondary rounded">
                                    <p className="text-gold-muted">Prong 1</p>
                                    <p className="text-gold-subtle font-semibold">{cvAnalysis.prong_analysis.prong1?.score || 0}%</p>
                                  </div>
                                  <div className="p-2 bg-navy-secondary rounded">
                                    <p className="text-gold-muted">Prong 2</p>
                                    <p className="text-gold-subtle font-semibold">{cvAnalysis.prong_analysis.prong2?.score || 0}%</p>
                                  </div>
                                  <div className="p-2 bg-navy-secondary rounded">
                                    <p className="text-gold-muted">Prong 3</p>
                                    <p className="text-gold-subtle font-semibold">{cvAnalysis.prong_analysis.prong3?.score || 0}%</p>
                                  </div>
                                </div>
                              )}

                              {cvAnalysis.key_qualifications?.length > 0 && (
                                <div>
                                  <p className="text-xs text-green-400 font-medium mb-1">✅ Fortalezas clave:</p>
                                  <ul className="text-xs text-gold-muted space-y-0.5">
                                    {cvAnalysis.key_qualifications.slice(0, 3).map((q, i) => (
                                      <li key={i}>• {q}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {cvAnalysis.missing_evidence?.length > 0 && (
                                <div>
                                  <p className="text-xs text-orange-400 font-medium mb-1">⚠️ Evidencia faltante:</p>
                                  <ul className="text-xs text-gold-muted space-y-0.5">
                                    {cvAnalysis.missing_evidence.slice(0, 2).map((m, i) => (
                                      <li key={i}>• {m}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              <p className="text-xs text-gold-muted border-t border-navy-light pt-2 mt-2">
                                <strong>Conclusión:</strong> {cvAnalysis.reasoning?.substring(0, 200)}...
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => {
                        setShowNewCaseDialog(false)
                        setCvFile(null)
                        setCvAnalysis(null)
                      }} className="border-navy-light text-gold-muted">
                        Cancelar
                      </Button>
                      <Button 
                        onClick={handleCreateCase} 
                        disabled={creatingCase || !cvAnalysis} 
                        className="bg-gold-primary text-navy-primary"
                      >
                        {creatingCase ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        {!cvAnalysis ? 'Analiza el CV primero' : 'Crear Caso'}
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
                        className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                          selectedCase?.id === caseItem.id
                            ? 'bg-gold-primary/10 border-gold-primary'
                            : 'bg-navy-primary border-navy-light hover:border-gold-muted'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1" onClick={() => loadCaseDetails(caseItem.id)}>
                            <h3 className="font-medium text-gold-subtle truncate">{caseItem.title}</h3>
                            <p className="text-xs text-gold-muted mt-1">{caseItem.visa_category}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <OutcomeIcon className={`h-5 w-5 ${outcomeInfo.color}`} />
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteCase(caseItem.id)
                              }}
                              className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                              title="Eliminar caso"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2" onClick={() => loadCaseDetails(caseItem.id)}>
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
                          <Popover open={docTypeOpen} onOpenChange={setDocTypeOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={docTypeOpen}
                                className="w-full justify-between bg-navy-primary border-navy-light text-gold-subtle hover:bg-navy-light"
                              >
                                {uploadDocType
                                  ? DOC_TYPES.find((d) => d.value === uploadDocType)?.label
                                  : "Seleccionar tipo..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0 bg-navy-secondary border-navy-light" align="start">
                              <div className="flex items-center border-b border-navy-light px-3">
                                <Search className="mr-2 h-4 w-4 shrink-0 text-gold-muted" />
                                <input
                                  placeholder="Buscar tipo de documento..."
                                  value={docTypeSearch}
                                  onChange={(e) => setDocTypeSearch(e.target.value)}
                                  className="flex h-10 w-full bg-transparent py-3 text-sm text-gold-subtle placeholder:text-gold-muted outline-none"
                                />
                                {docTypeSearch && (
                                  <button onClick={() => setDocTypeSearch('')} className="text-gold-muted hover:text-gold-subtle">
                                    <X className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                              <div className="max-h-[300px] overflow-auto">
                                {filteredDocTypes.length === 0 ? (
                                  <div className="py-6 text-center text-sm text-gold-muted">
                                    No se encontraron documentos
                                  </div>
                                ) : (
                                  [...new Set(filteredDocTypes.map(d => d.category))].map(category => (
                                    <div key={category}>
                                      <div className="px-3 py-2 text-xs font-semibold text-gold-primary bg-navy-primary sticky top-0">
                                        {category}
                                      </div>
                                      {filteredDocTypes.filter(d => d.category === category).map(docType => (
                                        <button
                                          key={docType.value}
                                          onClick={() => {
                                            setUploadDocType(docType.value)
                                            setDocTypeOpen(false)
                                            setDocTypeSearch('')
                                          }}
                                          className={cn(
                                            "flex w-full items-center px-3 py-2 text-sm cursor-pointer hover:bg-navy-light",
                                            uploadDocType === docType.value 
                                              ? "bg-gold-primary/10 text-gold-primary" 
                                              : "text-gold-subtle"
                                          )}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              uploadDocType === docType.value ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          {docType.label}
                                        </button>
                                      ))}
                                    </div>
                                  ))
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
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
                          <div 
                            key={doc.id} 
                            className={`p-3 bg-navy-primary rounded-lg border hover:border-gold-muted cursor-pointer transition-colors ${
                              doc.doc_type === 'cv' && selectedCase.cv_analysis 
                                ? 'border-purple-500/50' 
                                : 'border-navy-light'
                            }`}
                            onClick={() => handleViewDocument(doc)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <FileText className={`h-6 w-6 ${doc.doc_type === 'cv' ? 'text-purple-400' : 'text-gold-muted'}`} />
                                <div>
                                  <p className="text-gold-subtle font-medium">{doc.original_name}</p>
                                  <div className="flex items-center space-x-2 mt-1">
                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                      doc.doc_type === 'cv' ? 'bg-purple-500/20 text-purple-300' : 'bg-navy-light text-gold-muted'
                                    }`}>
                                      {getDocTypeLabel(doc.doc_type)}
                                    </span>
                                    <span className="text-xs text-gold-muted">
                                      {doc.word_count?.toLocaleString()} palabras
                                    </span>
                                    {/* Indicador de aptitud para CV */}
                                    {doc.doc_type === 'cv' && selectedCase.cv_analysis && (
                                      <span className={`text-xs font-bold ${
                                        selectedCase.cv_analysis.aptitude_score >= 70 ? 'text-green-400' :
                                        selectedCase.cv_analysis.aptitude_score >= 50 ? 'text-yellow-400' :
                                        'text-red-400'
                                      }`}>
                                        • {selectedCase.cv_analysis.aptitude_score}% Aptitud
                                      </span>
                                    )}
                                    {/* Indicador de si apoya al cliente para otros documentos */}
                                    {doc.doc_type !== 'cv' && doc.analysis_summary && (() => {
                                      try {
                                        const analysis = typeof doc.analysis_summary === 'string' 
                                          ? JSON.parse(doc.analysis_summary) 
                                          : doc.analysis_summary
                                        const supportsClient = analysis.supports_client !== false && analysis.relevance_score >= 50
                                        return (
                                          <span className={`text-xs font-bold ${supportsClient ? 'text-green-400' : 'text-red-400'}`}>
                                            • {supportsClient ? '✓ Apoya' : '✗ No apoya'}
                                          </span>
                                        )
                                      } catch (e) {
                                        return null
                                      }
                                    })()}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {doc.analysis_summary && (
                                  <span className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-300">
                                    Analizado
                                  </span>
                                )}
                                <Eye className="h-4 w-4 text-gold-muted" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteDocument(doc.id)
                                  }}
                                  className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                                  title="Eliminar documento"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
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

      {/* Dialog de Detalle del Documento */}
      <Dialog open={showDocumentDialog} onOpenChange={setShowDocumentDialog}>
        <DialogContent className="bg-navy-secondary border-navy-light max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-gold-subtle flex items-center">
              <FileText className="h-5 w-5 mr-2 text-gold-primary" />
              Detalle del Documento
            </DialogTitle>
            <DialogDescription className="text-gold-muted">
              {selectedDocument?.original_name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedDocument && (
            <div className="space-y-4 py-4">
              {/* Metadatos */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-navy-primary rounded-lg">
                  <p className="text-xs text-gold-muted">Tipo</p>
                  <p className="text-gold-subtle font-medium">{getDocTypeLabel(selectedDocument.doc_type)}</p>
                </div>
                <div className="p-3 bg-navy-primary rounded-lg">
                  <p className="text-xs text-gold-muted">Palabras</p>
                  <p className="text-gold-subtle font-medium">{selectedDocument.word_count?.toLocaleString() || 0}</p>
                </div>
                <div className="p-3 bg-navy-primary rounded-lg">
                  <p className="text-xs text-gold-muted">Caracteres</p>
                  <p className="text-gold-subtle font-medium">{selectedDocument.char_count?.toLocaleString() || 0}</p>
                </div>
                <div className="p-3 bg-navy-primary rounded-lg">
                  <p className="text-xs text-gold-muted">Páginas</p>
                  <p className="text-gold-subtle font-medium">{selectedDocument.page_count || 'N/A'}</p>
                </div>
              </div>

              {/* Análisis de Aptitud del CV (si el documento es CV y el caso tiene análisis) */}
              {selectedDocument.doc_type === 'cv' && selectedCase?.cv_analysis && (
                <div className="border border-purple-500/30 rounded-lg overflow-hidden">
                  {/* Header con resumen siempre visible */}
                  <div 
                    className="bg-purple-500/20 px-4 py-3 cursor-pointer hover:bg-purple-500/30 transition-colors"
                    onClick={() => setShowFullAnalysis(!showFullAnalysis)}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-purple-300 flex items-center">
                        <Brain className="h-5 w-5 mr-2" />
                        Análisis de Aptitud para {selectedCase.visa_category}
                      </h4>
                      <div className="flex items-center gap-3">
                        <div className={`text-3xl font-bold ${
                          selectedCase.cv_analysis.aptitude_score >= 70 ? 'text-green-400' :
                          selectedCase.cv_analysis.aptitude_score >= 50 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {selectedCase.cv_analysis.aptitude_score}%
                        </div>
                        <span className={`text-sm px-3 py-1 rounded-full ${
                          selectedCase.cv_analysis.recommendation === 'ALTAMENTE RECOMENDADO' ? 'bg-green-500/20 text-green-400' :
                          selectedCase.cv_analysis.recommendation === 'RECOMENDADO' ? 'bg-green-500/20 text-green-300' :
                          selectedCase.cv_analysis.recommendation === 'POSIBLE CON MEJORAS' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {selectedCase.cv_analysis.recommendation}
                        </span>
                      </div>
                    </div>
                    
                    {/* Resumen siempre visible */}
                    <p className="text-gold-muted mt-2 text-sm">{selectedCase.cv_analysis.summary}</p>
                    
                    {/* Puntajes de Prongs en una línea */}
                    {selectedCase.cv_analysis.prong_analysis && (
                      <div className="flex items-center gap-6 mt-3">
                        <span className="text-sm text-gold-muted">
                          Prong 1: <span className={`font-bold ${selectedCase.cv_analysis.prong_analysis.prong1?.score >= 60 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {selectedCase.cv_analysis.prong_analysis.prong1?.score}%
                          </span>
                        </span>
                        <span className="text-sm text-gold-muted">
                          Prong 2: <span className={`font-bold ${selectedCase.cv_analysis.prong_analysis.prong2?.score >= 60 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {selectedCase.cv_analysis.prong_analysis.prong2?.score}%
                          </span>
                        </span>
                        <span className="text-sm text-gold-muted">
                          Prong 3: <span className={`font-bold ${selectedCase.cv_analysis.prong_analysis.prong3?.score >= 60 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {selectedCase.cv_analysis.prong_analysis.prong3?.score}%
                          </span>
                        </span>
                        <span className="text-sm text-purple-300 ml-auto flex items-center">
                          {showFullAnalysis ? 'Ver menos' : 'Ver más'} 
                          <ChevronRight className={`h-4 w-4 ml-1 transition-transform ${showFullAnalysis ? 'rotate-90' : ''}`} />
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Detalle expandible */}
                  {showFullAnalysis && (
                    <div className="p-4 space-y-4 border-t border-purple-500/30">
                      {/* Análisis detallado de Prongs */}
                      {selectedCase.cv_analysis.prong_analysis && (
                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-3 bg-navy-primary rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm text-gold-muted font-medium">Prong 1</p>
                              <span className={`text-lg font-bold ${
                                selectedCase.cv_analysis.prong_analysis.prong1?.score >= 70 ? 'text-green-400' :
                                selectedCase.cv_analysis.prong_analysis.prong1?.score >= 50 ? 'text-yellow-400' : 'text-red-400'
                              }`}>
                                {selectedCase.cv_analysis.prong_analysis.prong1?.score || 0}%
                              </span>
                            </div>
                            <p className="text-xs text-gold-muted font-medium">Mérito e Importancia Nacional</p>
                            <p className="text-xs text-gold-muted mt-1">
                              {selectedCase.cv_analysis.prong_analysis.prong1?.analysis}
                            </p>
                          </div>
                          <div className="p-3 bg-navy-primary rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm text-gold-muted font-medium">Prong 2</p>
                              <span className={`text-lg font-bold ${
                                selectedCase.cv_analysis.prong_analysis.prong2?.score >= 70 ? 'text-green-400' :
                                selectedCase.cv_analysis.prong_analysis.prong2?.score >= 50 ? 'text-yellow-400' : 'text-red-400'
                              }`}>
                                {selectedCase.cv_analysis.prong_analysis.prong2?.score || 0}%
                              </span>
                            </div>
                            <p className="text-xs text-gold-muted font-medium">Bien Posicionado</p>
                            <p className="text-xs text-gold-muted mt-1">
                              {selectedCase.cv_analysis.prong_analysis.prong2?.analysis}
                            </p>
                          </div>
                          <div className="p-3 bg-navy-primary rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm text-gold-muted font-medium">Prong 3</p>
                              <span className={`text-lg font-bold ${
                                selectedCase.cv_analysis.prong_analysis.prong3?.score >= 70 ? 'text-green-400' :
                                selectedCase.cv_analysis.prong_analysis.prong3?.score >= 50 ? 'text-yellow-400' : 'text-red-400'
                              }`}>
                                {selectedCase.cv_analysis.prong_analysis.prong3?.score || 0}%
                              </span>
                            </div>
                            <p className="text-xs text-gold-muted font-medium">Balance de Factores</p>
                            <p className="text-xs text-gold-muted mt-1">
                              {selectedCase.cv_analysis.prong_analysis.prong3?.analysis}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Fortalezas */}
                      {selectedCase.cv_analysis.key_qualifications?.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-green-400 mb-2">✅ Fortalezas Clave</h5>
                          <ul className="space-y-1">
                            {selectedCase.cv_analysis.key_qualifications.map((q, i) => (
                              <li key={i} className="text-sm text-gold-muted flex items-start">
                                <CheckCircle className="h-4 w-4 mr-2 text-green-400 flex-shrink-0 mt-0.5" />
                                {q}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Debilidades/Evidencia Faltante */}
                      {selectedCase.cv_analysis.missing_evidence?.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-orange-400 mb-2">⚠️ Evidencia Faltante</h5>
                          <ul className="space-y-1">
                            {selectedCase.cv_analysis.missing_evidence.map((m, i) => (
                              <li key={i} className="text-sm text-gold-muted flex items-start">
                                <AlertTriangle className="h-4 w-4 mr-2 text-orange-400 flex-shrink-0 mt-0.5" />
                                {m}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Próximos Pasos */}
                      {selectedCase.cv_analysis.next_steps?.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-blue-400 mb-2">💡 Próximos Pasos Recomendados</h5>
                          <ul className="space-y-1">
                            {selectedCase.cv_analysis.next_steps.map((s, i) => (
                              <li key={i} className="text-sm text-gold-muted flex items-start">
                                <ChevronRight className="h-4 w-4 mr-2 text-blue-400 flex-shrink-0 mt-0.5" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Razonamiento */}
                      {selectedCase.cv_analysis.reasoning && (
                        <div className="pt-3 border-t border-navy-light">
                          <h5 className="text-sm font-medium text-gold-subtle mb-2">📋 Conclusión Detallada</h5>
                          <p className="text-sm text-gold-muted">{selectedCase.cv_analysis.reasoning}</p>
                        </div>
                      )}

                      {/* Probabilidad de Aprobación */}
                      {selectedCase.cv_analysis.estimated_approval_chance && (
                        <div className="flex items-center gap-2 pt-2">
                          <span className="text-sm text-gold-muted">Probabilidad de Aprobación:</span>
                          <span className={`text-sm font-bold px-2 py-1 rounded ${
                            selectedCase.cv_analysis.estimated_approval_chance === 'ALTA' ? 'bg-green-500/20 text-green-400' :
                            selectedCase.cv_analysis.estimated_approval_chance === 'MEDIA-ALTA' ? 'bg-green-500/20 text-green-300' :
                            selectedCase.cv_analysis.estimated_approval_chance === 'MEDIA' ? 'bg-yellow-500/20 text-yellow-400' :
                            selectedCase.cv_analysis.estimated_approval_chance === 'MEDIA-BAJA' ? 'bg-orange-500/20 text-orange-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {selectedCase.cv_analysis.estimated_approval_chance}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Contenido extraído */}
              <div>
                <h4 className="font-semibold text-gold-subtle mb-2 flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Texto Extraído
                </h4>
                <div className="p-4 bg-navy-primary rounded-lg border border-navy-light max-h-96 overflow-auto">
                  <pre className="text-gold-muted text-sm whitespace-pre-wrap font-mono">
                    {selectedDocument.text_content || 'Sin contenido extraído'}
                  </pre>
                </div>
              </div>

              {/* Análisis del documento si existe (para documentos que no son CV) */}
              {selectedDocument.analysis_summary && selectedDocument.doc_type !== 'cv' && (() => {
                let analysis
                try {
                  analysis = typeof selectedDocument.analysis_summary === 'string' 
                    ? JSON.parse(selectedDocument.analysis_summary) 
                    : selectedDocument.analysis_summary
                } catch (e) {
                  return (
                    <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                      <p className="text-gold-muted text-sm">{selectedDocument.analysis_summary}</p>
                    </div>
                  )
                }
                
                const supportsClient = analysis.supports_client !== false && analysis.relevance_score >= 50
                
                return (
                  <div className={`border rounded-lg overflow-hidden ${
                    supportsClient ? 'border-green-500/30' : 'border-red-500/30'
                  }`}>
                    {/* Header - ¿Apoya al cliente? */}
                    <div 
                      className={`px-4 py-3 cursor-pointer transition-colors ${
                        analysis.support_level === 'APOYA FUERTEMENTE' ? 'bg-green-500/30 hover:bg-green-500/40' :
                        analysis.support_level === 'APOYA' ? 'bg-green-500/20 hover:bg-green-500/30' :
                        analysis.support_level === 'APOYA PARCIALMENTE' ? 'bg-yellow-500/20 hover:bg-yellow-500/30' :
                        analysis.support_level === 'PERJUDICA' ? 'bg-red-600/30 hover:bg-red-600/40' :
                        'bg-red-500/20 hover:bg-red-500/30'
                      }`}
                      onClick={() => setShowFullAnalysis(!showFullAnalysis)}
                    >
                      {/* Veredicto principal */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {supportsClient ? (
                            <CheckCircle className="h-7 w-7 text-green-400" />
                          ) : (
                            <XCircle className="h-7 w-7 text-red-400" />
                          )}
                          <div>
                            <h4 className="font-bold text-lg text-gold-subtle">
                              {supportsClient ? '✅ APOYA AL CLIENTE' : '❌ NO APOYA AL CLIENTE'}
                            </h4>
                            <p className="text-sm text-gold-muted">{analysis.support_level || 'Sin determinar'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className={`text-3xl font-bold ${
                            analysis.relevance_score >= 70 ? 'text-green-400' :
                            analysis.relevance_score >= 50 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {analysis.relevance_score || 0}%
                          </div>
                          <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                            analysis.recommendation === 'INCLUIR' ? 'bg-green-500/30 text-green-400' :
                            analysis.recommendation === 'INCLUIR CON RESERVAS' ? 'bg-yellow-500/30 text-yellow-400' :
                            analysis.recommendation === 'REVISAR' ? 'bg-orange-500/30 text-orange-400' :
                            'bg-red-500/30 text-red-400'
                          }`}>
                            {analysis.recommendation || 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Razón principal */}
                      <div className={`p-3 rounded-lg mb-3 ${supportsClient ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        <p className="text-sm font-medium text-gold-subtle">
                          {supportsClient ? '¿Por qué APOYA?' : '¿Por qué NO APOYA?'}
                        </p>
                        <p className="text-gold-muted">{analysis.main_reason}</p>
                      </div>
                      
                      {/* Resumen */}
                      <p className="text-gold-muted text-sm mb-3">{analysis.summary}</p>

                      {/* Veredicto final */}
                      {analysis.final_verdict && (
                        <div className={`p-2 rounded text-center font-medium ${
                          analysis.final_verdict.includes('APOYA AL CLIENTE') ? 'bg-green-500/20 text-green-400' :
                          analysis.final_verdict.includes('PARCIAL') ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {analysis.final_verdict}
                        </div>
                      )}
                      
                      {/* Soporte a Prongs */}
                      {analysis.supports_prongs && (
                        <div className="flex items-center gap-4 mt-3">
                          <span className="text-sm text-gold-muted">
                            Prong 1: {analysis.supports_prongs.prong1?.supports ? 
                              <span className="text-green-400 font-bold">✓ Apoya</span> : 
                              <span className="text-red-400">✗ No</span>}
                          </span>
                          <span className="text-sm text-gold-muted">
                            Prong 2: {analysis.supports_prongs.prong2?.supports ? 
                              <span className="text-green-400 font-bold">✓ Apoya</span> : 
                              <span className="text-red-400">✗ No</span>}
                          </span>
                          <span className="text-sm text-gold-muted">
                            Prong 3: {analysis.supports_prongs.prong3?.supports ? 
                              <span className="text-green-400 font-bold">✓ Apoya</span> : 
                              <span className="text-red-400">✗ No</span>}
                          </span>
                          <span className="text-sm text-blue-300 ml-auto flex items-center">
                            {showFullAnalysis ? 'Ver menos' : 'Ver detalles'} 
                            <ChevronRight className={`h-4 w-4 ml-1 transition-transform ${showFullAnalysis ? 'rotate-90' : ''}`} />
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Detalle expandible */}
                    {showFullAnalysis && (
                      <div className="p-4 space-y-4 border-t border-navy-light">
                        {/* Beneficios para el caso */}
                        {analysis.benefits_for_case?.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-green-400 mb-2">✅ Beneficios para el Caso</h5>
                            <ul className="space-y-1">
                              {analysis.benefits_for_case.map((b, i) => (
                                <li key={i} className="text-sm text-gold-muted flex items-start">
                                  <CheckCircle className="h-4 w-4 mr-2 text-green-400 flex-shrink-0 mt-0.5" />
                                  {b}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Riesgos o problemas */}
                        {analysis.risks_or_problems?.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-red-400 mb-2">⚠️ Riesgos o Problemas</h5>
                            <ul className="space-y-1">
                              {analysis.risks_or_problems.map((r, i) => (
                                <li key={i} className="text-sm text-gold-muted flex items-start">
                                  <AlertTriangle className="h-4 w-4 mr-2 text-red-400 flex-shrink-0 mt-0.5" />
                                  {r}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Cómo apoya cada Prong */}
                        {analysis.supports_prongs && (
                          <div className="grid grid-cols-3 gap-3">
                            <div className={`p-3 rounded-lg ${analysis.supports_prongs.prong1?.supports ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                              <p className="text-sm font-medium text-gold-muted mb-1">Prong 1 - Mérito Nacional</p>
                              <p className="text-xs text-gold-muted">{analysis.supports_prongs.prong1?.explanation || 'N/A'}</p>
                            </div>
                            <div className={`p-3 rounded-lg ${analysis.supports_prongs.prong2?.supports ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                              <p className="text-sm font-medium text-gold-muted mb-1">Prong 2 - Bien Posicionado</p>
                              <p className="text-xs text-gold-muted">{analysis.supports_prongs.prong2?.explanation || 'N/A'}</p>
                            </div>
                            <div className={`p-3 rounded-lg ${analysis.supports_prongs.prong3?.supports ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                              <p className="text-sm font-medium text-gold-muted mb-1">Prong 3 - Balance</p>
                              <p className="text-xs text-gold-muted">{analysis.supports_prongs.prong3?.explanation || 'N/A'}</p>
                            </div>
                          </div>
                        )}

                        {/* Relación con el perfil */}
                        {analysis.relation_to_profile && (
                          <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                            <h5 className="text-sm font-medium text-purple-400 mb-2">🔗 Relación con el Perfil del Cliente</h5>
                            {analysis.relation_to_profile.strengthens?.length > 0 && (
                              <div className="mb-2">
                                <p className="text-xs text-green-400 font-medium">Refuerza:</p>
                                <ul className="text-xs text-gold-muted">
                                  {analysis.relation_to_profile.strengthens.map((s, i) => <li key={i}>• {s}</li>)}
                                </ul>
                              </div>
                            )}
                            {analysis.relation_to_profile.covers_weaknesses?.length > 0 && (
                              <div className="mb-2">
                                <p className="text-xs text-blue-400 font-medium">Cubre debilidades:</p>
                                <ul className="text-xs text-gold-muted">
                                  {analysis.relation_to_profile.covers_weaknesses.map((w, i) => <li key={i}>• {w}</li>)}
                                </ul>
                              </div>
                            )}
                            {analysis.relation_to_profile.inconsistencies?.length > 0 && (
                              <div>
                                <p className="text-xs text-orange-400 font-medium">Inconsistencias:</p>
                                <ul className="text-xs text-gold-muted">
                                  {analysis.relation_to_profile.inconsistencies.map((i, idx) => <li key={idx}>• {i}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Acción requerida */}
                        {analysis.action_required && analysis.action_required !== 'NINGUNA' && (
                          <div className={`p-3 rounded-lg ${
                            analysis.action_required === 'DESCARTAR' ? 'bg-red-500/20' :
                            analysis.action_required === 'MODIFICAR DOCUMENTO' ? 'bg-orange-500/20' :
                            'bg-blue-500/20'
                          }`}>
                            <h5 className="text-sm font-medium text-gold-subtle mb-1">
                              📋 Acción Requerida: {analysis.action_required}
                            </h5>
                            <p className="text-sm text-gold-muted">{analysis.action_details}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button 
              variant="destructive" 
              onClick={() => {
                handleDeleteDocument(selectedDocument?.id)
                setShowDocumentDialog(false)
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
            <Button onClick={() => setShowDocumentDialog(false)} className="bg-gold-primary text-navy-primary">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
