import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import DocumentsClient from './DocumentsClient'

// Deshabilitar caché para siempre mostrar datos frescos
export const dynamic = 'force-dynamic'
export const revalidate = 0

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

  // Usar admin client para evitar RLS que bloquea lectura de documentos
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Obtener documentos de la tabla 'documents' con admin client
  let documentsQuery = supabaseAdmin
    .from('documents')
    .select(`
      id,
      name,
      doc_type,
      storage_path,
      created_at,
      document_date,
      case_id,
      extraction_status
    `)
    .order('created_at', { ascending: false })

  // Si no es admin o attorney, solo mostrar sus documentos
  if (profile?.role !== 'admin' && profile?.role !== 'attorney') {
    documentsQuery = documentsQuery.eq('created_by', user.id)
  }

  const { data: documents, error } = await documentsQuery
  
  if (error) {
    console.error('Error fetching documents:', error)
  }

  return <DocumentsClient documents={documents || []} userRole={profile?.role} />
}
