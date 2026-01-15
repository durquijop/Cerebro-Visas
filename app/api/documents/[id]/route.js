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

    // Primero intentar en la tabla 'documents'
    let { data: document, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single()

    // Si no se encuentra, intentar en 'case_documents'
    if (error && error.code === 'PGRST116') {
      const result = await supabase
        .from('case_documents')
        .select('*')
        .eq('id', id)
        .single()
      
      document = result.data
      error = result.error
    }

    if (error) {
      console.error('Error fetching document:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Si tiene case_id, obtener info del caso
    if (document.case_id) {
      const { data: caseData } = await supabase
        .from('visa_cases')
        .select('id, title')
        .eq('id', document.case_id)
        .single()
      
      if (caseData) {
        document.cases = caseData
      }
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

    // Primero intentar obtener de 'documents'
    let { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('storage_path')
      .eq('id', id)
      .single()

    let tableName = 'documents'

    // Si no está en documents, buscar en case_documents
    if (fetchError && fetchError.code === 'PGRST116') {
      const result = await supabase
        .from('case_documents')
        .select('file_path')
        .eq('id', id)
        .single()
      
      if (result.data) {
        document = { storage_path: result.data.file_path }
        tableName = 'case_documents'
        fetchError = null
      } else {
        fetchError = result.error
      }
    }

    if (fetchError) {
      console.error('Error fetching document for delete:', fetchError)
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    // Eliminar el archivo del storage si existe
    const storagePath = document?.storage_path || document?.file_path
    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([storagePath])
      
      if (storageError) {
        console.warn('Warning: Could not delete file from storage:', storageError)
      }
    }

    // Eliminar el registro de la base de datos
    const { error: deleteError } = await supabase
      .from(tableName)
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
