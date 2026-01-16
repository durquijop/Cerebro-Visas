import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// GET - Obtener requests de un documento
export async function GET(request, { params }) {
  try {
    const { id } = params

    const { data: requests, error } = await supabase
      .from('document_requests')
      .select('*')
      .eq('document_id', id)
      .order('priority', { ascending: true })

    if (error) {
      console.error('Error fetching requests:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ requests: requests || [] })
  } catch (error) {
    console.error('Error in GET /api/documents/[id]/requests:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
