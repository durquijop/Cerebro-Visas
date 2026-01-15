import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TrendsClient from './TrendsClient'

export default async function TrendsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  // Verificar permiso (admin, attorney, analyst)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'drafter') {
    redirect('/dashboard')
  }

  // Obtener issues de los últimos 6 meses
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const { data: issues } = await supabase
    .from('issues')
    .select(`
      id,
      taxonomy_code,
      severity,
      created_at,
      cases (
        id,
        title,
        visa_category,
        outcome
      )
    `)
    .gte('created_at', sixMonthsAgo.toISOString())
    .order('created_at', { ascending: false })

  // Obtener estadísticas generales
  const { count: totalCases } = await supabase
    .from('cases')
    .select('*', { count: 'exact', head: true })

  const { count: totalDocuments } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })

  const { count: totalIssues } = await supabase
    .from('issues')
    .select('*', { count: 'exact', head: true })

  return (
    <TrendsClient 
      issues={issues || []} 
      stats={{
        totalCases: totalCases || 0,
        totalDocuments: totalDocuments || 0,
        totalIssues: totalIssues || 0
      }}
    />
  )
}
