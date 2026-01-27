import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

/**
 * GET /api/import-jobs
 * Lista todos los trabajos de importación
 */
export async function GET(request) {
  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')
    
    let query = supabase
      .from('import_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data: jobs, error } = await query
    
    if (error) throw error
    
    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('Error fetching import jobs:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/import-jobs
 * Crea un nuevo trabajo de importación
 */
export async function POST(request) {
  try {
    const supabase = getSupabaseAdmin()
    const body = await request.json()
    const { client_name, zip_file_name, zip_file_size, storage_path, total_files } = body

    if (!client_name) {
      return NextResponse.json({ error: 'client_name es requerido' }, { status: 400 })
    }

    const jobId = uuidv4()
    
    const { data: job, error } = await supabase
      .from('import_jobs')
      .insert({
        id: jobId,
        client_name,
        zip_file_name,
        zip_file_size,
        storage_path,
        total_files: total_files || 0,
        status: 'pending'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ job })
  } catch (error) {
    console.error('Error creating import job:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
