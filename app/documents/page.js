import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DocumentsClient from './DocumentsClient'

export default async function DocumentsPage() {
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

  // Obtener documentos según el rol
  let documentsQuery = supabase
    .from('documents')
    .select(`
      id,
      name,
      doc_type,
      storage_path,
      created_at,
      case_id,
      cases (
        id,
        title
      )
    `)
    .order('created_at', { ascending: false })

  // Si no es admin o attorney, solo mostrar sus documentos
  if (profile?.role !== 'admin' && profile?.role !== 'attorney') {
    documentsQuery = documentsQuery.eq('created_by', user.id)
  }

  const { data: documents } = await documentsQuery

  return <DocumentsClient documents={documents || []} userRole={profile?.role} />
}
