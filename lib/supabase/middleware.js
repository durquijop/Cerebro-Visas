import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, {
              ...options,
              // Asegurar que las cookies funcionen correctamente
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
            })
          })
        },
      },
    }
  )

  // IMPORTANTE: No usar destructuring aquí - getUser() refresca la sesión
  // y actualiza las cookies automáticamente
  const { data: { user }, error } = await supabase.auth.getUser()

  // Log para debugging (quitar en producción)
  if (process.env.NODE_ENV === 'development') {
    const pathname = request.nextUrl.pathname
    if (!pathname.startsWith('/api') && !pathname.startsWith('/_next')) {
      console.log(`[Auth] ${pathname} - User: ${user?.email || 'none'}`)
    }
  }

  return { supabaseResponse, user, supabase }
}
