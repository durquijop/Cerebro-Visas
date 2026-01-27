'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardSkeleton } from '@/components/ui/skeleton-loaders'
import ChatPanel from '@/components/ChatPanel'
import { 
  Brain, LogOut, Users, FileText, TrendingUp, Upload, 
  FolderOpen, Settings, BarChart3, Shield, ChevronRight, Loader2,
  Tag, Briefcase, MessageSquare, X, PanelRightOpen, PanelRightClose, Sparkles,
  AlertTriangle, Activity, Files
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function DashboardPage() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState({ casesCount: 0, documentsCount: 0 })
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [chatOpen, setChatOpen] = useState(false) // Inicia cerrado en móvil
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Detectar tamaño de pantalla
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
      // Auto-abrir chat en desktop
      if (window.innerWidth >= 1024) {
        setChatOpen(true)
      }
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !user) {
          router.push('/auth/login')
          return
        }

        setUser(user)

        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', user.id)
          .single()

        setProfile(profileData || { full_name: user.email, role: 'analyst' })

        const [casesResult, docsResult] = await Promise.all([
          supabase.from('cases').select('*', { count: 'exact', head: true }),
          supabase.from('documents').select('*', { count: 'exact', head: true })
        ])

        setStats({
          casesCount: casesResult.count || 0,
          documentsCount: docsResult.count || 0
        })

      } catch (error) {
        console.error('Error loading dashboard:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [supabase, router])

  const handleLogout = async () => {
    setLoggingOut(true)
    await supabase.auth.signOut()
    toast.success('Sesión cerrada')
    router.push('/')
    router.refresh()
  }

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      attorney: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      drafter: 'bg-green-500/20 text-green-300 border-green-500/30',
      analyst: 'bg-orange-500/20 text-orange-300 border-orange-500/30'
    }
    return colors[role] || colors.analyst
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  const menuItems = [
    ...(profile?.role === 'admin' ? [
      { href: '/admin/users', icon: Users, label: 'Gestionar Usuarios', desc: 'Administrar roles y permisos' },
    ] : []),
    ...(profile?.role === 'admin' || profile?.role === 'attorney' ? [
      { href: '/trends', icon: TrendingUp, label: 'Tendencias', desc: 'Dashboard de análisis' },
      { href: '/drift-detector', icon: AlertTriangle, label: 'Drift Detector', desc: 'Detectar cambios de criterio', highlight: true },
      { href: '/prompt-analyzer', icon: Sparkles, label: 'Analizador de Prompts', desc: 'Optimiza tus prompts con IA' },
    ] : []),
    ...(profile?.role !== 'analyst' ? [
      { href: '/drive-import', icon: FolderOpen, label: 'Importar desde Drive', desc: 'Cargar expediente completo', highlight: true },
      { href: '/documents/upload', icon: Upload, label: 'Subir Documento', desc: 'Individual o carga masiva' },
    ] : []),
    { href: '/casos', icon: Briefcase, label: 'Casos', desc: 'Gestionar casos de visa' },
    { href: '/documents', icon: FileText, label: 'Documentos', desc: 'Ver documentos cargados' },
    { href: '/admin/taxonomy', icon: Tag, label: 'Taxonomía', desc: 'Gestionar códigos de issues' },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Main Content - Panel izquierdo */}
      <div className={`
        transition-all duration-300 overflow-auto flex-1
        ${chatOpen && !isMobile ? 'lg:w-[60%] xl:w-[55%]' : 'w-full'}
      `}>
        <div className="min-h-screen">
          {/* Header */}
          <header className="bg-navy-primary border-b border-navy-light sticky top-0 z-20">
            <div className="px-4 md:px-6 py-3 md:py-4 flex justify-between items-center">
              <Link href="/" className="flex items-center space-x-2 md:space-x-3">
                <Brain className="h-7 w-7 md:h-8 md:w-8 text-gold-primary" />
                <span className="text-lg md:text-xl font-bold text-gold-subtle hidden sm:inline">Cerebro Visas</span>
              </Link>
              
              <div className="flex items-center space-x-2 md:space-x-4">
                {/* Chat Toggle Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setChatOpen(!chatOpen)}
                  className={`
                    flex items-center gap-2 
                    ${chatOpen ? 'bg-purple-600/20 text-purple-300' : 'text-gold-muted hover:text-gold-primary'}
                    hover:bg-navy-secondary
                  `}
                >
                  {chatOpen ? (
                    <>
                      <PanelRightClose className="h-4 w-4" />
                      <span className="hidden md:inline text-sm">Cerrar Chat</span>
                    </>
                  ) : (
                    <>
                      <MessageSquare className="h-4 w-4" />
                      <span className="hidden md:inline text-sm">Abrir Chat</span>
                    </>
                  )}
                </Button>

                {/* User Info */}
                <div className="text-right hidden sm:block">
                  <p className="text-gold-subtle font-medium text-sm md:text-base truncate max-w-[150px]">
                    {profile?.full_name || user?.email}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${getRoleBadgeColor(profile?.role)}`}>
                    {profile?.role?.toUpperCase() || 'USUARIO'}
                  </span>
                </div>

                {/* Logout */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="text-gold-muted hover:text-gold-primary hover:bg-navy-secondary"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="p-4 md:p-6 lg:p-8">
            {/* Welcome Section */}
            <div className="mb-6 md:mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                ¡Bienvenido, {profile?.full_name?.split(' ')[0] || 'Usuario'}!
              </h1>
              <p className="text-gray-600 mt-1 text-sm md:text-base">
                Panel de control - Sistema de análisis inteligente para casos EB-2 NIW
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium text-gray-600">Total Casos</CardTitle>
                  <FolderOpen className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                </CardHeader>
                <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                  <div className="text-2xl md:text-3xl font-bold text-gray-900">{stats.casesCount}</div>
                  <p className="text-[10px] md:text-xs text-gray-500">Casos registrados</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium text-gray-600">Documentos</CardTitle>
                  <FileText className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                </CardHeader>
                <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                  <div className="text-2xl md:text-3xl font-bold text-gray-900">{stats.documentsCount}</div>
                  <p className="text-[10px] md:text-xs text-gray-500">RFEs/NOIDs</p>
                </CardContent>
              </Card>
              <Card className="col-span-2 lg:col-span-1">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium text-gray-600">Tu Rol</CardTitle>
                  <Shield className="h-4 w-4 md:h-5 md:w-5 text-purple-600" />
                </CardHeader>
                <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                  <div className="text-xl md:text-2xl font-bold text-gray-900 capitalize">{profile?.role || 'Analyst'}</div>
                  <p className="text-[10px] md:text-xs text-gray-500">Nivel de acceso</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-3 md:mb-4">Acciones Rápidas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              {menuItems.map((item, index) => (
                <Link key={index} href={item.href}>
                  <Card className={`
                    hover:shadow-lg transition-all cursor-pointer h-full 
                    ${item.highlight 
                      ? 'hover:border-orange-400 border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50' 
                      : 'hover:border-purple-300'
                    }
                  `}>
                    <CardContent className="flex items-center p-4 md:p-5">
                      <div className={`
                        p-2 md:p-3 rounded-lg mr-3 md:mr-4 flex-shrink-0
                        ${item.highlight ? 'bg-orange-500' : 'bg-navy-primary'}
                      `}>
                        <item.icon className={`h-5 w-5 md:h-6 md:w-6 ${item.highlight ? 'text-white' : 'text-gold-primary'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 text-sm md:text-base">{item.label}</h3>
                          {item.highlight && (
                            <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-medium">
                              NUEVO
                            </span>
                          )}
                        </div>
                        <p className="text-xs md:text-sm text-gray-500 truncate">{item.desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-gray-400 flex-shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Chat Tip - solo cuando chat está cerrado */}
            {!chatOpen && (
              <Card className="mt-6 md:mt-8 bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
                <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="p-3 bg-purple-100 rounded-full">
                    <MessageSquare className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-purple-900">Chat RAG Disponible</h3>
                    <p className="text-sm text-purple-700">
                      Pregunta sobre tus casos y documentos usando inteligencia artificial.
                    </p>
                  </div>
                  <Button 
                    onClick={() => setChatOpen(true)} 
                    className="bg-purple-600 hover:bg-purple-700 w-full sm:w-auto"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Abrir Chat
                  </Button>
                </CardContent>
              </Card>
            )}
          </main>
        </div>
      </div>

      {/* Chat Panel - Desktop: panel lateral / Mobile: overlay */}
      {chatOpen && (
        <>
          {/* Overlay para móvil */}
          {isMobile && (
            <div 
              className="fixed inset-0 bg-black/50 z-30 lg:hidden"
              onClick={() => setChatOpen(false)}
            />
          )}
          
          {/* Panel del Chat */}
          <div className={`
            ${isMobile 
              ? 'fixed right-0 top-0 bottom-0 w-full max-w-md z-40' 
              : 'lg:w-[40%] xl:w-[45%] h-full'
            }
            transition-all duration-300
          `}>
            <ChatPanel 
              isExpanded={true} 
              onToggle={() => setChatOpen(false)} 
            />
          </div>
        </>
      )}

      {/* Botón flotante para móvil cuando el chat está cerrado */}
      {!chatOpen && isMobile && (
        <Button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-purple-600 hover:bg-purple-700 shadow-lg z-30"
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
      )}
    </div>
  )
}
