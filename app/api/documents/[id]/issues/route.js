import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// GET - Obtener issues de un documento
export async function GET(request, { params }) {
  try {
    const { id } = params

    const { data: issues, error } = await supabase
      .from('document_issues')
      .select('*')
      .eq('document_id', id)
      .order('severity', { ascending: true })

    if (error) {
      console.error('Error fetching issues:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ issues: issues || [] })
  } catch (error) {
    console.error('Error in GET /api/documents/[id]/issues:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
