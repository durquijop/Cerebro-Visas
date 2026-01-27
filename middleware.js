import { NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Rutas públicas que no requieren autenticación
const publicRoutes = [
  '/',
  '/auth/login',
  '/auth/signup',
  '/auth/verify',
  '/auth/callback',
  '/auth/auth-code-error',
  '/drift-detector',  // Temporalmente público para desarrollo
  '/taxonomy',        // Temporalmente público para desarrollo
  '/drive-import'     // Temporalmente público para desarrollo
]

// Rutas que son públicas si empiezan con estos prefijos
const publicPrefixes = [
  '/api/',        // Todas las APIs son públicas (tienen su propia protección)
  '/_next/',      // Assets de Next.js
  '/favicon',     // Favicon
]

export async function middleware(request) {
  const pathname = request.nextUrl.pathname

  // 1. Verificar si es una ruta de assets (siempre permitir)
  if (
    pathname.includes('.') && 
    (pathname.endsWith('.png') || 
     pathname.endsWith('.jpg') || 
     pathname.endsWith('.svg') || 
     pathname.endsWith('.ico') ||
     pathname.endsWith('.webp'))
  ) {
    return NextResponse.next()
  }

  // 2. Verificar prefijos públicos
  for (const prefix of publicPrefixes) {
    if (pathname.startsWith(prefix)) {
      return NextResponse.next()
    }
  }

  // 3. Actualizar sesión de Supabase (siempre hacer esto para mantener cookies)
  const { supabaseResponse, user } = await updateSession(request)

  // 4. Verificar si es una ruta pública exacta
  if (publicRoutes.includes(pathname)) {
    // Si el usuario está autenticado y va a login/signup, redirigir a dashboard
    if (user && (pathname === '/auth/login' || pathname === '/auth/signup')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return supabaseResponse
  }

  // 5. Para rutas protegidas, verificar autenticación
  if (!user) {
    // Guardar la URL a la que el usuario intentaba acceder
    const redirectUrl = new URL('/auth/login', request.url)
    
    // Solo agregar redirectTo si no es la página principal
    if (pathname !== '/') {
      redirectUrl.searchParams.set('redirectTo', pathname)
    }
    
    console.log(`[Auth] Redirecting unauthenticated user from ${pathname} to login`)
    return NextResponse.redirect(redirectUrl)
  }

  // 6. Usuario autenticado, permitir acceso
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
