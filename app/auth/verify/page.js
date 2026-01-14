import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Brain, Mail } from 'lucide-react'
import Link from 'next/link'

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-navy-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-navy-secondary border-navy-light text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Brain className="h-12 w-12 text-gold-primary" />
              <Mail className="h-6 w-6 text-gold-dark absolute -bottom-1 -right-1" />
            </div>
          </div>
          <CardTitle className="text-2xl text-gold-subtle">Verifica tu Email</CardTitle>
          <CardDescription className="text-gold-muted">
            Hemos enviado un enlace de verificación a tu correo electrónico
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gold-muted">
            Por favor, revisa tu bandeja de entrada y haz clic en el enlace de verificación
            para activar tu cuenta.
          </p>
          <p className="text-sm text-gold-muted">
            ¿No recibiste el email? Revisa tu carpeta de spam o{' '}
            <Link href="/auth/signup" className="text-gold-primary hover:underline">
              intenta de nuevo
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
