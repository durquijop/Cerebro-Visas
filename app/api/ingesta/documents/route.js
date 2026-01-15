import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    const { data: documents, error } = await supabaseAdmin
      .from('ingesta_documents')
      .select('id, original_name, doc_type, file_type, page_count, char_count, word_count, created_at, extraction_success')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json({ documents: documents || [] })
  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json({ documents: [], error: error.message })
  }
}
