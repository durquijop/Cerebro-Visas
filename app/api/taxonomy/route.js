import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// GET - Obtener toda la taxonomía
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const prong = searchParams.get('prong')
    const active = searchParams.get('active')

    let query = supabase
      .from('taxonomy')
      .select('*')
      .order('level1', { ascending: true })
      .order('level2', { ascending: true })
      .order('code', { ascending: true })

    if (prong) {
      query = query.eq('prong', prong)
    }

    if (active !== null && active !== undefined) {
      query = query.eq('active', active === 'true')
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching taxonomy:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Agrupar por level1
    const grouped = {}
    data.forEach(item => {
      if (!grouped[item.level1]) {
        grouped[item.level1] = []
      }
      grouped[item.level1].push(item)
    })

    return NextResponse.json({ 
      taxonomy: data,
      grouped,
      total: data.length 
    })
  } catch (error) {
    console.error('Error in GET /api/taxonomy:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Crear nuevo código de taxonomía
export async function POST(request) {
  try {
    const body = await request.json()
    
    const { code, level1, level2, level3, description, prong, severity_default } = body

    if (!code || !level1 || !level2) {
      return NextResponse.json({ 
        error: 'Campos requeridos: code, level1, level2' 
      }, { status: 400 })
    }

    // Verificar que el código no exista
    const { data: existing } = await supabase
      .from('taxonomy')
      .select('id')
      .eq('code', code)
      .single()

    if (existing) {
      return NextResponse.json({ 
        error: 'Ya existe un código de taxonomía con ese nombre' 
      }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('taxonomy')
      .insert({
        code,
        level1,
        level2,
        level3: level3 || null,
        description: description || null,
        prong: prong || null,
        severity_default: severity_default || 'medium',
        active: true
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating taxonomy:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ taxonomy: data }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/taxonomy:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
