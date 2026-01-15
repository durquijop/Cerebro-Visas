import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// DELETE - Eliminar documento
export async function DELETE(request, { params }) {
  try {
    const { docId } = params

    // Obtener info del documento para eliminar de storage
    const { data: doc, error: fetchError } = await supabaseAdmin
      .from('case_documents')
      .select('storage_path')
      .eq('id', docId)
      .single()

    if (fetchError) throw fetchError

    // Eliminar de storage si existe
    if (doc?.storage_path) {
      await supabaseAdmin.storage
        .from('documents')
        .remove([doc.storage_path])
    }

    // Eliminar de la base de datos
    const { error: deleteError } = await supabaseAdmin
      .from('case_documents')
      .delete()
      .eq('id', docId)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting document:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET - Obtener documento específico
export async function GET(request, { params }) {
  try {
    const { docId } = params

    const { data: doc, error } = await supabaseAdmin
      .from('case_documents')
      .select('*')
      .eq('id', docId)
      .single()

    if (error) throw error

    return NextResponse.json({ document: doc })
  } catch (error) {
    console.error('Error fetching document:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
