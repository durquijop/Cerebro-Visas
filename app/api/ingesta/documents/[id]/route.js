import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request, { params }) {
  try {
    const { id } = params

    const { data: document, error } = await supabaseAdmin
      .from('ingesta_documents')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    if (!document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ document })
  } catch (error) {
    console.error('Error fetching document:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
