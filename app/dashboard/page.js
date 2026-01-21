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
  Tag, Briefcase, MessageSquare
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function DashboardPage() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState({ casesCount: 0, documentsCount: 0 })
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [chatOpen, setChatOpen] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const loadData = async () => {
      try {
        // Obtener usuario actual
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !user) {
          router.push('/auth/login')
          return
        }

        setUser(user)

        // Obtener perfil
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', user.id)
          .single()

        setProfile(profileData || { full_name: user.email, role: 'analyst' })

        // Obtener estadísticas
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
    // Admin only
    ...(profile?.role === 'admin' ? [
      { href: '/admin/users', icon: Users, label: 'Gestionar Usuarios', desc: 'Administrar roles y permisos' },
    ] : []),
    // Admin & Attorney
    ...(profile?.role === 'admin' || profile?.role === 'attorney' ? [
      { href: '/trends', icon: TrendingUp, label: 'Tendencias', desc: 'Dashboard de análisis' },
      { href: '/auditor', icon: Shield, label: 'Auditor de Expediente', desc: 'Evaluar fortalezas y debilidades' },
    ] : []),
    // Admin, Attorney & Drafter
    ...(profile?.role !== 'analyst' ? [
      { href: '/documents/upload', icon: Upload, label: 'Subir Documento', desc: 'Cargar RFE/NOID/Denial' },
    ] : []),
    // All users
    { href: '/casos', icon: Briefcase, label: 'Casos', desc: 'Gestionar casos de visa' },
    { href: '/documents', icon: FileText, label: 'Documentos', desc: 'Ver documentos cargados' },
    { href: '/admin/taxonomy', icon: Tag, label: 'Taxonomía', desc: 'Gestionar códigos de issues' },
  ]

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Main Content - Panel izquierdo */}
      <div className={`transition-all duration-300 overflow-auto ${chatOpen ? 'w-1/2' : 'w-full'}`}>
        <div className="min-h-screen bg-gray-50">
          {/* Header */}
          <header className="bg-navy-primary border-b border-navy-light sticky top-0 z-10">
            <div className="px-6 py-4 flex justify-between items-center">
              <Link href="/" className="flex items-center space-x-3">
                <Brain className="h-8 w-8 text-gold-primary" />
                <span className="text-xl font-bold text-gold-subtle">Cerebro Visas</span>
              </Link>
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setChatOpen(!chatOpen)}
                  className="text-gold-muted hover:text-gold-primary hover:bg-navy-secondary"
                  title={chatOpen ? 'Cerrar chat' : 'Abrir chat'}
                >
                  <MessageSquare className="h-5 w-5" />
                </Button>
                <div className="text-right">
                  <p className="text-gold-subtle font-medium">{profile?.full_name || user?.email}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${getRoleBadgeColor(profile?.role)}`}>
                    {profile?.role?.toUpperCase() || 'USUARIO'}
                  </span>
                </div>
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
          <main className="px-6 py-8">
            {/* Welcome Section */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">
                ¡Bienvenido, {profile?.full_name?.split(' ')[0] || 'Usuario'}!
              </h1>
              <p className="text-gray-600 mt-1">
                Panel de control de Cerebro Visas - Sistema de Análisis EB-2 NIW
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Casos</CardTitle>
                  <FolderOpen className="h-5 w-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{stats.casesCount}</div>
                  <p className="text-xs text-gray-500">Casos registrados</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Documentos</CardTitle>
                  <FileText className="h-5 w-5 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{stats.documentsCount}</div>
                  <p className="text-xs text-gray-500">Archivos procesados</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Tu Rol</CardTitle>
                  <Shield className="h-5 w-5 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900 capitalize">{profile?.role || 'Analyst'}</div>
                  <p className="text-xs text-gray-500">Nivel de acceso</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Acciones Rápidas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {menuItems.map((item, index) => (
                <Link key={index} href={item.href}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                    <CardContent className="flex items-center p-6">
                      <div className="p-3 rounded-lg bg-navy-primary mr-4">
                        <item.icon className="h-6 w-6 text-gold-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{item.label}</h3>
                        <p className="text-sm text-gray-500">{item.desc}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Chat Tip */}
            {!chatOpen && (
              <Card className="mt-8 bg-purple-50 border-purple-200">
                <CardContent className="p-4 flex items-center gap-4">
                  <MessageSquare className="h-10 w-10 text-purple-600" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-purple-900">Chat RAG Disponible</h3>
                    <p className="text-sm text-purple-700">
                      Haz clic en el ícono de chat en el header para abrir el asistente inteligente.
                    </p>
                  </div>
                  <Button onClick={() => setChatOpen(true)} className="bg-purple-600 hover:bg-purple-700">
                    Abrir Chat
                  </Button>
                </CardContent>
              </Card>
            )}
          </main>
        </div>
      </div>

      {/* Chat Panel - Panel derecho 50% */}
      {chatOpen && (
        <div className="w-1/2 h-full">
          <ChatPanel isExpanded={true} onToggle={() => setChatOpen(false)} />
        </div>
      )}
    </div>
  )
}
