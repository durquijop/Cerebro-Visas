import { NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Define protected routes and required roles
const protectedRoutes = [
  { path: '/dashboard', roles: ['admin', 'attorney', 'drafter', 'analyst'] },
  { path: '/admin', roles: ['admin'] },
  { path: '/cases/create', roles: ['admin', 'attorney'] },
  { path: '/documents/upload', roles: ['admin', 'attorney', 'drafter'] },
  { path: '/trends', roles: ['admin', 'attorney', 'analyst'] },
]

// Public routes that don't require authentication
const publicRoutes = ['/', '/auth/login', '/auth/signup', '/auth/verify', '/auth/callback']

export async function middleware(request) {
  const { supabaseResponse, user, supabase } = await updateSession(request)
  const pathname = request.nextUrl.pathname

  // Check if it's a public route
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith('/api'))
  
  if (isPublicRoute) {
    return supabaseResponse
  }

  // Check if user is authenticated
  if (!user) {
    const redirectUrl = new URL('/auth/login', request.url)
    redirectUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Check if the current path is protected with specific roles
  const matchedRoute = protectedRoutes.find(route => pathname.startsWith(route.path))
  
  if (matchedRoute) {
    // Get the user's role from their profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    const userRole = profile?.role
    
    // Check if the user has the required role
    if (!userRole || !matchedRoute.roles.includes(userRole)) {
      // Redirect to dashboard if they don't have permission
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
