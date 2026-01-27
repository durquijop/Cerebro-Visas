'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Brain, ArrowLeft, RefreshCw, Shield, AlertTriangle, CheckCircle, 
  FileText, Link2, Plus, ChevronRight, Target, Zap, Scale,
  AlertCircle, HelpCircle, Loader2
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function ClaimGraphPage() {
  const params = useParams()
  const router = useRouter()
  const caseId = params.id
  
  const [loading, setLoading] = useState(true)
  const [extracting, setExtracting] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [caseData, setCaseData] = useState(null)
  const [claimsData, setClaimsData] = useState(null)

  useEffect(() => {
    if (caseId) {
      loadCaseData()
      loadClaims()
    }
  }, [caseId])

  const loadCaseData = async () => {
    try {
      const res = await fetch(`/api/casos/${caseId}`)
      const data = await res.json()
      if (data) {
        setCaseData(data)
      }
    } catch (error) {
      console.error('Error loading case:', error)
    }
  }

  const loadClaims = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/claims?case_id=${caseId}`)
      const data = await res.json()
      if (data.success) {
        setClaimsData(data)
      }
    } catch (error) {
      console.error('Error loading claims:', error)
      toast.error('Error cargando claims')
    } finally {
      setLoading(false)
    }
  }

  const extractClaims = async () => {
    try {
      setExtracting(true)
      toast.info('Extrayendo claims del expediente...')
      
      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, action: 'extract' })
      })
      
      const data = await res.json()
      
      if (data.success) {
        toast.success(`${data.claims?.length || 0} claims extraídos`)
        loadClaims()
      } else {
        toast.error(data.error || 'Error extrayendo claims')
      }
    } catch (error) {
      console.error('Error extracting claims:', error)
      toast.error('Error extrayendo claims')
    } finally {
      setExtracting(false)
    }
  }

  const analyzeEvidence = async () => {
    try {
      setAnalyzing(true)
      toast.info('Analizando y vinculando evidencia...')
      
      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, action: 'analyze_evidence' })
      })
      
      const data = await res.json()
      
      if (data.success) {
        toast.success(data.message || 'Evidencia analizada')
        loadClaims()
      } else {
        toast.error(data.error || 'Error analizando evidencia')
      }
    } catch (error) {
      console.error('Error analyzing evidence:', error)
      toast.error('Error analizando evidencia')
    } finally {
      setAnalyzing(false)
    }
  }

  const getRobustnessColor = (score) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    if (score >= 40) return 'text-orange-600'
    return 'text-red-600'
  }

  const getRobustnessLabel = (score) => {
    if (score >= 80) return { label: 'Fuerte', color: 'bg-green-500' }
    if (score >= 60) return { label: 'Moderado', color: 'bg-yellow-500' }
    if (score >= 40) return { label: 'Débil', color: 'bg-orange-500' }
    return { label: 'Crítico', color: 'bg-red-500' }
  }

  const getStatusBadge = (status) => {
    const styles = {
      validated: 'bg-green-100 text-green-800 border-green-300',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      weak: 'bg-orange-100 text-orange-800 border-orange-300',
      missing_evidence: 'bg-red-100 text-red-800 border-red-300'
    }
    const labels = {
      validated: 'Validado',
      pending: 'Pendiente',
      weak: 'Débil',
      missing_evidence: 'Sin Evidencia'
    }
    return (
      <Badge className={styles[status] || styles.pending}>
        {labels[status] || status}
      </Badge>
    )
  }

  const getCriticalityBadge = (criticality) => {
    const styles = {
      critical: 'bg-red-500 text-white',
      high: 'bg-orange-500 text-white',
      medium: 'bg-yellow-500 text-black',
      low: 'bg-gray-400 text-white'
    }
    return (
      <Badge className={styles[criticality] || styles.medium}>
        {criticality}
      </Badge>
    )
  }

  const getProngIcon = (prong) => {
    switch (prong) {
      case 'P1': return <Target className="h-5 w-5 text-blue-500" />
      case 'P2': return <Zap className="h-5 w-5 text-purple-500" />
      case 'P3': return <Scale className="h-5 w-5 text-green-500" />
      default: return <HelpCircle className="h-5 w-5 text-gray-400" />
    }
  }

  const claimsByProng = {
    P1: claimsData?.claims?.filter(c => c.prong_mapping === 'P1') || [],
    P2: claimsData?.claims?.filter(c => c.prong_mapping === 'P2') || [],
    P3: claimsData?.claims?.filter(c => c.prong_mapping === 'P3') || [],
    GENERAL: claimsData?.claims?.filter(c => !['P1', 'P2', 'P3'].includes(c.prong_mapping)) || []
  }

  const summary = claimsData?.summary || {}
  const robustness = getRobustnessLabel(summary.robustness_score || 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-navy-primary border-b border-navy-light">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Brain className="h-8 w-8 text-gold-primary" />
            <div>
              <span className="text-xl font-bold text-gold-subtle">Claim Graph</span>
              {caseData && (
                <p className="text-sm text-gold-muted">
                  Caso: {caseData.title || caseData.beneficiary_name}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={extractClaims} 
              disabled={extracting || analyzing}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {extracting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {extracting ? 'Extrayendo...' : 'Extraer Claims'}
            </Button>
            {claimsData?.claims?.length > 0 && (
              <Button 
                onClick={analyzeEvidence} 
                disabled={analyzing || extracting}
                variant="outline"
                className="border-green-500 text-green-700 hover:bg-green-50"
              >
                {analyzing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                {analyzing ? 'Analizando...' : 'Vincular Evidencia'}
              </Button>
            )}
            <Link href={`/casos/${caseId}`}>
              <Button variant="ghost" className="text-gold-muted hover:text-gold-primary">
                <ArrowLeft className="h-4 w-4 mr-2" /> Volver al Caso
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            <span className="ml-3 text-gray-600">Cargando claims...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Score de Robustez - PROMINENTE */}
            <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-full ${robustness.color}`}>
                      <Shield className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Score de Robustez</h2>
                      <p className="text-gray-600">
                        Qué tan preparado está el expediente para evitar RFEs
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-5xl font-bold ${getRobustnessColor(summary.robustness_score || 0)}`}>
                      {summary.robustness_score || 0}%
                    </div>
                    <Badge className={`${robustness.color} text-white mt-2`}>
                      {robustness.label}
                    </Badge>
                  </div>
                </div>
                
                <div className="mt-6">
                  <Progress 
                    value={summary.robustness_score || 0} 
                    className="h-3"
                  />
                </div>

                <div className="grid grid-cols-4 gap-4 mt-6">
                  <div className="text-center p-3 bg-white rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{summary.total_claims || 0}</div>
                    <div className="text-sm text-gray-500">Claims Totales</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{summary.critical_claims || 0}</div>
                    <div className="text-sm text-gray-500">Críticos</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{summary.weak_claims || 0}</div>
                    <div className="text-sm text-gray-500">Débiles</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {((summary.average_strength || 0) * 100).toFixed(0)}%
                    </div>
                    <div className="text-sm text-gray-500">Fuerza Promedio</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Claims por Prong */}
            {claimsData?.claims?.length > 0 ? (
              <Tabs defaultValue="P1" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="P1" className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Prong 1 ({claimsByProng.P1.length})
                  </TabsTrigger>
                  <TabsTrigger value="P2" className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Prong 2 ({claimsByProng.P2.length})
                  </TabsTrigger>
                  <TabsTrigger value="P3" className="flex items-center gap-2">
                    <Scale className="h-4 w-4" />
                    Prong 3 ({claimsByProng.P3.length})
                  </TabsTrigger>
                  <TabsTrigger value="GENERAL" className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4" />
                    General ({claimsByProng.GENERAL.length})
                  </TabsTrigger>
                </TabsList>

                {['P1', 'P2', 'P3', 'GENERAL'].map(prong => (
                  <TabsContent key={prong} value={prong}>
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          {getProngIcon(prong)}
                          {prong === 'P1' && 'Mérito Sustancial e Importancia Nacional'}
                          {prong === 'P2' && 'Bien Posicionado para Avanzar el Endeavor'}
                          {prong === 'P3' && 'Balance de Factores (Waiver PERM)'}
                          {prong === 'GENERAL' && 'Claims Generales'}
                        </CardTitle>
                        <CardDescription>
                          {prong === 'P1' && 'Claims sobre el mérito y la importancia del endeavor'}
                          {prong === 'P2' && 'Claims sobre por qué el beneficiario puede lograr el endeavor'}
                          {prong === 'P3' && 'Claims sobre por qué se debe eximir del proceso PERM'}
                          {prong === 'GENERAL' && 'Claims que aplican a múltiples prongs'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {claimsByProng[prong].length > 0 ? (
                          <div className="space-y-4">
                            {claimsByProng[prong].map((claim, idx) => (
                              <ClaimCard key={claim.id} claim={claim} index={idx + 1} />
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                            <p>No hay claims para este prong</p>
                            <p className="text-sm">Usa "Extraer Claims" para analizar el expediente</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                ))}
              </Tabs>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Brain className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    No hay claims extraídos
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Haz clic en "Extraer Claims" para analizar el expediente con IA
                    y mapear los claims con su evidencia.
                  </p>
                  <Button 
                    onClick={extractClaims} 
                    disabled={extracting}
                    size="lg"
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {extracting ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                      <Brain className="h-5 w-5 mr-2" />
                    )}
                    Extraer Claims con IA
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// Componente para mostrar un claim individual
function ClaimCard({ claim, index }) {
  const [expanded, setExpanded] = useState(false)
  
  const strengthPercent = (claim.evidence_strength_score || 0) * 100
  const strengthColor = strengthPercent >= 70 ? 'bg-green-500' 
    : strengthPercent >= 40 ? 'bg-yellow-500' 
    : 'bg-red-500'

  const getStatusBadge = (status) => {
    const styles = {
      validated: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      weak: 'bg-orange-100 text-orange-800',
      missing_evidence: 'bg-red-100 text-red-800'
    }
    const labels = {
      validated: 'Validado',
      pending: 'Pendiente',
      weak: 'Débil',
      missing_evidence: 'Sin Evidencia'
    }
    return (
      <Badge className={styles[status] || styles.pending}>
        {labels[status] || status}
      </Badge>
    )
  }

  const getCriticalityBadge = (criticality) => {
    const styles = {
      critical: 'bg-red-500 text-white',
      high: 'bg-orange-500 text-white',
      medium: 'bg-yellow-500 text-black',
      low: 'bg-gray-400 text-white'
    }
    return (
      <Badge className={styles[criticality] || styles.medium}>
        {criticality}
      </Badge>
    )
  }

  return (
    <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-bold text-purple-600">#{index}</span>
            {getCriticalityBadge(claim.criticality)}
            {getStatusBadge(claim.status)}
            <Badge variant="outline">{claim.claim_type}</Badge>
          </div>
          <p className="text-gray-800">{claim.claim_text}</p>
        </div>
        <div className="ml-4 text-right">
          <div className="text-lg font-bold">{strengthPercent.toFixed(0)}%</div>
          <div className="text-xs text-gray-500">fuerza</div>
          <div className={`w-16 h-2 rounded-full mt-1 ${strengthColor}`} 
               style={{ width: `${strengthPercent}%`, minWidth: '10%' }} />
        </div>
      </div>

      {/* Evidencia vinculada */}
      {claim.claim_evidence && claim.claim_evidence.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <button 
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800"
          >
            <Link2 className="h-4 w-4" />
            {claim.claim_evidence.length} evidencia(s) vinculada(s)
            <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
          
          {expanded && (
            <div className="mt-3 space-y-2">
              {claim.claim_evidence.map((evidence, eIdx) => (
                <div key={evidence.id} className="bg-gray-100 rounded p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">{evidence.exhibit_ref || `Evidencia ${eIdx + 1}`}</span>
                      <Badge variant="outline" className="text-xs">
                        {evidence.evidence_type}
                      </Badge>
                    </div>
                    <span className={`font-bold ${
                      evidence.strength_score >= 0.7 ? 'text-green-600' : 
                      evidence.strength_score >= 0.4 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {(evidence.strength_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  {evidence.rationale && (
                    <p className="text-gray-600 mt-2">{evidence.rationale}</p>
                  )}
                  {evidence.gaps_identified && evidence.gaps_identified.length > 0 && (
                    <div className="mt-2">
                      <span className="text-red-600 text-xs font-medium">Brechas:</span>
                      <ul className="list-disc list-inside text-red-600 text-xs">
                        {evidence.gaps_identified.map((gap, gIdx) => (
                          <li key={gIdx}>{gap}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sin evidencia */}
      {(!claim.claim_evidence || claim.claim_evidence.length === 0) && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-orange-600">
            <AlertTriangle className="h-4 w-4" />
            Sin evidencia vinculada - Este claim necesita soporte
          </div>
        </div>
      )}
    </div>
  )
}
