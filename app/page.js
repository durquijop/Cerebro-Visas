'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Brain, Shield, FileText, TrendingUp, Users, ChevronRight } from 'lucide-react'

export default function Home() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      } catch (error) {
        console.error('Error checking user:', error)
      } finally {
        setLoading(false)
      }
    }
    
    checkUser()
  }, [])

  const features = [
    {
      icon: Brain,
      title: 'Análisis Inteligente',
      description: 'Extrae y analiza motivos de RFE, NOID y denegaciones usando IA avanzada'
    },
    {
      icon: TrendingUp,
      title: 'Tendencias en Tiempo Real',
      description: 'Detecta cambios en los criterios de USCIS con nuestro Drift Detector'
    },
    {
      icon: FileText,
      title: 'Taxonomía Estructurada',
      description: 'Clasifica motivos con códigos normalizados (NIW.P1.IMPORTANCIA_NACIONAL)'
    },
    {
      icon: Shield,
      title: 'Auditoría de Expedientes',
      description: 'Identifica faltantes y debilidades antes de presentar'
    }
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-primary flex items-center justify-center">
        <div className="animate-pulse text-gold-primary text-xl">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy-primary">
      {/* Header */}
      <header className="border-b border-navy-light">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Brain className="h-8 w-8 text-gold-primary" />
            <span className="text-2xl font-bold text-gold-subtle">Cerebro Visas</span>
          </div>
          <div className="flex items-center space-x-4">
            {user ? (
              <Button 
                onClick={() => router.push('/dashboard')}
                className="bg-gold-primary text-navy-primary hover:bg-gold-dark"
              >
                Ir al Dashboard
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button 
                  variant="ghost" 
                  onClick={() => router.push('/auth/login')}
                  className="text-gold-subtle hover:text-gold-primary hover:bg-navy-secondary"
                >
                  Iniciar Sesión
                </Button>
                <Button 
                  onClick={() => router.push('/auth/signup')}
                  className="bg-gold-primary text-navy-primary hover:bg-gold-dark"
                >
                  Registrarse
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-gold-subtle mb-6">
          Inteligencia para Casos de
          <span className="text-gold-primary block mt-2">Inmigración EB-2 NIW</span>
        </h1>
        <p className="text-xl text-gold-muted max-w-3xl mx-auto mb-10">
          Transforma la forma en que analizas RFEs, NOIDs y denegaciones. 
          Pasa de la intuición a decisiones basadas en datos reales.
        </p>
        <div className="flex justify-center space-x-4">
          {!user && (
            <Button 
              size="lg"
              onClick={() => router.push('/auth/signup')}
              className="bg-gold-primary text-navy-primary hover:bg-gold-dark text-lg px-8 py-6"
            >
              Comenzar Ahora
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="bg-navy-secondary border border-navy-light rounded-lg p-6 hover:border-gold-dark transition-colors"
            >
              <feature.icon className="h-12 w-12 text-gold-primary mb-4" />
              <h3 className="text-xl font-semibold text-gold-subtle mb-2">
                {feature.title}
              </h3>
              <p className="text-gold-muted">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Roles Section */}
      <section className="container mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-gold-subtle text-center mb-12">
          Diseñado para tu equipo
        </h2>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { role: 'Admin', desc: 'Gestión de usuarios y configuración', icon: '👑' },
            { role: 'Attorney', desc: 'Consulta de tendencias y auditoría', icon: '⚖️' },
            { role: 'Drafter', desc: 'Acceso a prompts y carga de documentos', icon: '✍️' },
            { role: 'Analyst', desc: 'Gestión de data y reportes', icon: '📊' }
          ].map((item, index) => (
            <div key={index} className="text-center p-6 bg-navy-secondary rounded-lg border border-navy-light">
              <div className="text-4xl mb-3">{item.icon}</div>
              <h3 className="text-lg font-semibold text-gold-primary mb-2">{item.role}</h3>
              <p className="text-sm text-gold-muted">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-navy-light mt-16">
        <div className="container mx-auto px-6 py-8 text-center">
          <p className="text-gold-muted">
            © 2025 Urpe Integral Services. Cerebro Visas.
          </p>
        </div>
      </footer>
    </div>
  )
}
