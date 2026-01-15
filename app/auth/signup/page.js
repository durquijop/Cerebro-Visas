'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Brain, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignUp = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: 'analyst' // Default role
          }
        }
      })

      if (error) throw error

      // Si la confirmación de email está desactivada, redirigir directo al dashboard
      if (data.session) {
        toast.success('¡Cuenta creada exitosamente!')
        window.location.href = '/dashboard'
      } else {
        toast.success('¡Cuenta creada! Revisa tu email para verificar.')
        router.push('/auth/verify')
      }
    } catch (error) {
      toast.error(error.message || 'Error al crear la cuenta')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-navy-secondary border-navy-light">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Brain className="h-12 w-12 text-gold-primary" />
          </div>
          <CardTitle className="text-2xl text-gold-subtle">Crear Cuenta</CardTitle>
          <CardDescription className="text-gold-muted">
            Únete al sistema de análisis de casos de inmigración
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSignUp}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-gold-subtle">Nombre Completo</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Juan Pérez"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="bg-navy-primary border-navy-light text-gold-subtle placeholder:text-gold-muted/50 focus:border-gold-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gold-subtle">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-navy-primary border-navy-light text-gold-subtle placeholder:text-gold-muted/50 focus:border-gold-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gold-subtle">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-navy-primary border-navy-light text-gold-subtle placeholder:text-gold-muted/50 focus:border-gold-primary"
              />
              <p className="text-xs text-gold-muted">Mínimo 6 caracteres</p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              type="submit" 
              className="w-full bg-gold-primary text-navy-primary hover:bg-gold-dark"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando cuenta...</>
              ) : (
                'Crear Cuenta'
              )}
            </Button>
            <p className="text-sm text-gold-muted text-center">
              ¿Ya tienes cuenta?{' '}
              <Link href="/auth/login" className="text-gold-primary hover:underline">
                Inicia sesión
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
