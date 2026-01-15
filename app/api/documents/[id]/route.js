import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// GET - Obtener documento por ID
export async function GET(request, { params }) {
  try {
    const { id } = params

    const { data: document, error } = await supabase
      .from('case_documents')
      .select(`
        *,
        cases:case_id (
          id,
          title
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching document:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(document)
  } catch (error) {
    console.error('Error in GET /api/documents/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Eliminar documento
export async function DELETE(request, { params }) {
  try {
    const { id } = params

    // Primero obtener el documento para saber el path del archivo
    const { data: document, error: fetchError } = await supabase
      .from('case_documents')
      .select('file_path')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('Error fetching document for delete:', fetchError)
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    // Eliminar el archivo del storage si existe
    if (document?.file_path) {
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([document.file_path])
      
      if (storageError) {
        console.warn('Warning: Could not delete file from storage:', storageError)
      }
    }

    // Eliminar el registro de la base de datos
    const { error: deleteError } = await supabase
      .from('case_documents')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting document:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Documento eliminado' })
  } catch (error) {
    console.error('Error in DELETE /api/documents/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
