import './globals.css'
import { Toaster } from '@/components/ui/sonner'

export const metadata = {
  title: 'Cerebro Visas - Urpe Integral Services',
  description: 'Sistema de análisis inteligente para casos de inmigración EB-2 NIW',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
