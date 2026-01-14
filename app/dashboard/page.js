import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  // Get user profile with role
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  // Get recent cases count
  const { count: casesCount } = await supabase
    .from('cases')
    .select('*', { count: 'exact', head: true })

  // Get documents count
  const { count: documentsCount } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })

  return (
    <DashboardClient 
      user={user}
      profile={profile}
      stats={{
        casesCount: casesCount || 0,
        documentsCount: documentsCount || 0
      }}
    />
  )
}
