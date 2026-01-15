import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CasesClient from './CasesClient'

export default async function CasesPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  // Obtener el perfil del usuario
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Verificar permiso
  if (profile?.role !== 'admin' && profile?.role !== 'attorney') {
    redirect('/dashboard')
  }

  // Obtener casos
  const { data: cases } = await supabase
    .from('cases')
    .select('*')
    .order('created_at', { ascending: false })

  return <CasesClient cases={cases || []} userRole={profile.role} userId={user.id} />
}
