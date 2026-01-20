'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function TestAuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    // Verificar si hay sesión actual
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      console.log('Session check:', session, error)
      setMessage(`Session: ${session ? 'Existe - ' + session.user.email : 'No hay sesión'}`)
      if (session) {
        setUser(session.user)
      }
    }
    checkSession()

    // Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event, session)
      setMessage(`Event: ${event}, User: ${session?.user?.email || 'none'}`)
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('Intentando login...')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      console.log('Login result:', data, error)

      if (error) {
        setMessage(`Error: ${error.message}`)
      } else if (data.session) {
        setMessage(`Login exitoso! User: ${data.user.email}`)
        setUser(data.user)
        // Esperar un momento y redirigir usando router para navegación más rápida
        setTimeout(() => {
          window.location.href = '/dashboard' // Mantenemos window.location aquí para test/debug
        }, 1500)
      } else {
        setMessage('No se recibió sesión')
      }
    } catch (err) {
      setMessage(`Exception: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setMessage('Sesión cerrada')
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8">Test de Autenticación Supabase</h1>
      
      <div className="mb-8 p-4 bg-gray-800 rounded">
        <h2 className="text-xl mb-2">Estado Actual:</h2>
        <p className="text-yellow-400">{message}</p>
        {user && (
          <div className="mt-4 p-4 bg-green-900 rounded">
            <p><strong>Usuario logueado:</strong></p>
            <p>ID: {user.id}</p>
            <p>Email: {user.email}</p>
            <button 
              onClick={handleLogout}
              className="mt-2 px-4 py-2 bg-red-600 rounded hover:bg-red-700"
            >
              Cerrar Sesión
            </button>
          </div>
        )}
      </div>

      {!user && (
        <form onSubmit={handleLogin} className="max-w-md space-y-4">
          <div>
            <label className="block mb-1">Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 rounded bg-gray-800 border border-gray-600"
              required
            />
          </div>
          <div>
            <label className="block mb-1">Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 rounded bg-gray-800 border border-gray-600"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full p-3 bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Cargando...' : 'Iniciar Sesión'}
          </button>
        </form>
      )}

      <div className="mt-8 p-4 bg-gray-800 rounded">
        <h2 className="text-xl mb-2">Config:</h2>
        <p className="text-xs break-all">URL: {process.env.NEXT_PUBLIC_SUPABASE_URL}</p>
        <p className="text-xs break-all">Key: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 50)}...</p>
      </div>
    </div>
  )
}
