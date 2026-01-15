import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import UploadClient from './UploadClient'

export default async function UploadPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  // Verificar que el usuario tenga permiso para subir
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role === 'analyst') {
    redirect('/dashboard')
  }

  // Obtener casos disponibles para asociar
  const { data: cases } = await supabase
    .from('cases')
    .select('id, title')
    .order('created_at', { ascending: false })

  return <UploadClient userId={user.id} cases={cases || []} userRole={profile.role} />
}
