import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// GET - Obtener un código específico
export async function GET(request, { params }) {
  try {
    const { id } = params

    const { data, error } = await supabase
      .from('taxonomy')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Código no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ taxonomy: data })
  } catch (error) {
    console.error('Error in GET /api/taxonomy/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - Actualizar código de taxonomía
export async function PATCH(request, { params }) {
  try {
    const { id } = params
    const body = await request.json()
    
    const { code, level1, level2, level3, description, prong, severity_default, active } = body

    const updateData = {
      updated_at: new Date().toISOString()
    }

    if (code !== undefined) updateData.code = code
    if (level1 !== undefined) updateData.level1 = level1
    if (level2 !== undefined) updateData.level2 = level2
    if (level3 !== undefined) updateData.level3 = level3
    if (description !== undefined) updateData.description = description
    if (prong !== undefined) updateData.prong = prong
    if (severity_default !== undefined) updateData.severity_default = severity_default
    if (active !== undefined) updateData.active = active

    const { data, error } = await supabase
      .from('taxonomy')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating taxonomy:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ taxonomy: data })
  } catch (error) {
    console.error('Error in PATCH /api/taxonomy/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Eliminar código de taxonomía
export async function DELETE(request, { params }) {
  try {
    const { id } = params

    // Verificar si hay issues usando este código
    const { data: issues } = await supabase
      .from('document_issues')
      .select('id')
      .eq('taxonomy_code', id)
      .limit(1)

    // Obtener el código para verificar
    const { data: taxonomy } = await supabase
      .from('taxonomy')
      .select('code')
      .eq('id', id)
      .single()

    if (taxonomy) {
      const { data: issuesByCode } = await supabase
        .from('document_issues')
        .select('id')
        .eq('taxonomy_code', taxonomy.code)
        .limit(1)

      if (issuesByCode && issuesByCode.length > 0) {
        return NextResponse.json({ 
          error: 'No se puede eliminar: hay issues usando este código. Desactívalo en su lugar.' 
        }, { status: 400 })
      }
    }

    const { error } = await supabase
      .from('taxonomy')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting taxonomy:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/taxonomy/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
