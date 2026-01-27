import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

/**
 * GET /api/import-jobs/[id]
 * Obtiene el estado de un trabajo específico
 */
export async function GET(request, { params }) {
  try {
    const supabase = getSupabaseAdmin()
    const { id } = params
    
    const { data: job, error } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!job) {
      return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ job })
  } catch (error) {
    console.error('Error fetching job:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * PATCH /api/import-jobs/[id]
 * Actualiza el estado de un trabajo
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = getSupabaseAdmin()
    const { id } = params
    const updates = await request.json()
    
    // Agregar timestamp de actualización
    updates.updated_at = new Date().toISOString()
    
    // Si el status cambia a processing, registrar inicio
    if (updates.status === 'processing' && !updates.started_at) {
      updates.started_at = new Date().toISOString()
    }
    
    // Si el status cambia a completed o failed, registrar fin
    if ((updates.status === 'completed' || updates.status === 'failed') && !updates.completed_at) {
      updates.completed_at = new Date().toISOString()
    }

    const { data: job, error } = await supabase
      .from('import_jobs')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ job })
  } catch (error) {
    console.error('Error updating job:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * DELETE /api/import-jobs/[id]
 * Elimina un trabajo y su archivo ZIP asociado
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = getSupabaseAdmin()
    const { id } = params
    
    // Obtener el job para saber la ruta del archivo
    const { data: job } = await supabase
      .from('import_jobs')
      .select('storage_path')
      .eq('id', id)
      .single()

    // Eliminar archivo de storage si existe
    if (job?.storage_path) {
      await supabase.storage
        .from('imports')
        .remove([job.storage_path])
    }

    // Eliminar el job
    const { error } = await supabase
      .from('import_jobs')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting job:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
