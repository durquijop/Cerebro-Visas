import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// GET - Obtener issues
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const caseId = searchParams.get('case_id')
  const documentId = searchParams.get('document_id')
  const taxonomyCode = searchParams.get('taxonomy_code')
  const limit = parseInt(searchParams.get('limit') || '100')

  try {
    let query = supabaseAdmin
      .from('issues')
      .select(`
        *,
        cases (id, title, visa_category),
        documents (id, name, doc_type)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (caseId) query = query.eq('case_id', caseId)
    if (documentId) query = query.eq('document_id', documentId)
    if (taxonomyCode) query = query.eq('taxonomy_code', taxonomyCode)

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ issues: data })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Crear issue
export async function POST(request) {
  try {
    const body = await request.json()
    const { case_id, document_id, taxonomy_code, severity, description, extracted_quote, page_ref } = body

    if (!taxonomy_code) {
      return NextResponse.json({ error: 'taxonomy_code es requerido' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('issues')
      .insert({
        case_id,
        document_id,
        taxonomy_code,
        severity: severity || 'medium',
        description,
        extracted_quote,
        page_ref
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ issue: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
