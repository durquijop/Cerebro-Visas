import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// GET - Obtener todos los casos
export async function GET() {
  try {
    const { data: cases, error } = await supabaseAdmin
      .from('visa_cases')
      .select(`
        id, title, description, visa_category, outcome, 
        beneficiary_name, filed_date, service_center,
        created_at, updated_at
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Obtener conteo de documentos para cada caso
    const casesWithCount = await Promise.all((cases || []).map(async (c) => {
      const { count } = await supabaseAdmin
        .from('case_documents')
        .select('*', { count: 'exact', head: true })
        .eq('case_id', c.id)
      return { ...c, documents_count: count || 0 }
    }))

    return NextResponse.json({ cases: casesWithCount })
  } catch (error) {
    console.error('Error fetching cases:', error)
    return NextResponse.json({ cases: [], error: error.message })
  }
}

// POST - Crear nuevo caso
export async function POST(request) {
  try {
    const body = await request.json()
    const { title, description, visa_category, outcome, beneficiary_name, filed_date, service_center, cv_analysis } = body

    if (!title) {
      return NextResponse.json({ error: 'El título es requerido' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('visa_cases')
      .insert({
        id: uuidv4(),
        title,
        description,
        visa_category: visa_category || 'EB2-NIW',
        outcome: outcome || 'pending',
        beneficiary_name,
        filed_date: filed_date || null,
        service_center,
        cv_analysis: cv_analysis || null
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ case: data }, { status: 201 })
  } catch (error) {
    console.error('Error creating case:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
