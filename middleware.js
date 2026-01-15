import { NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Public routes that don't require authentication
const publicRoutes = ['/', '/auth/login', '/auth/signup', '/auth/verify', '/auth/callback']

export async function middleware(request) {
  const { supabaseResponse, user } = await updateSession(request)
  const pathname = request.nextUrl.pathname

  // Check if it's a public route or API
  const isPublicRoute = publicRoutes.some(route => pathname === route) || pathname.startsWith('/api')
  
  if (isPublicRoute) {
    return supabaseResponse
  }

  // Check if user is authenticated for protected routes
  if (!user) {
    const redirectUrl = new URL('/auth/login', request.url)
    redirectUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
