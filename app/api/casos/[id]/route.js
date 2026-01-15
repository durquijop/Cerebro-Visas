import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// GET - Obtener caso específico con documentos
export async function GET(request, { params }) {
  try {
    const { id } = params

    // Obtener el caso
    const { data: caseData, error: caseError } = await supabaseAdmin
      .from('visa_cases')
      .select('*')
      .eq('id', id)
      .single()

    if (caseError) throw caseError

    // Obtener documentos del caso
    const { data: documents, error: docsError } = await supabaseAdmin
      .from('case_documents')
      .select('*')
      .eq('case_id', id)
      .order('created_at', { ascending: false })

    if (docsError) throw docsError

    return NextResponse.json({ 
      case: { 
        ...caseData, 
        documents: documents || [] 
      } 
    })
  } catch (error) {
    console.error('Error fetching case:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - Actualizar caso
export async function PATCH(request, { params }) {
  try {
    const { id } = params
    const body = await request.json()

    const { data, error } = await supabaseAdmin
      .from('visa_cases')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ case: data })
  } catch (error) {
    console.error('Error updating case:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Eliminar caso
export async function DELETE(request, { params }) {
  try {
    const { id } = params

    const { error } = await supabaseAdmin
      .from('visa_cases')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting case:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
