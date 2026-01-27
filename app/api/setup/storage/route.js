import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * POST /api/setup/storage
 * Crea el bucket de Storage para imports si no existe
 */
export async function POST() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Verificar si el bucket existe
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error('Error listing buckets:', listError)
      throw listError
    }

    const importsBucket = buckets?.find(b => b.name === 'imports')

    if (!importsBucket) {
      // Crear el bucket (sin límite personalizado, usa el default de Supabase)
      const { data, error: createError } = await supabase.storage.createBucket('imports', {
        public: false
      })

      if (createError) {
        console.error('Error creating bucket:', createError)
        throw createError
      }

      console.log('✅ Bucket "imports" creado')
      return NextResponse.json({ success: true, message: 'Bucket creado', created: true })
    }

    return NextResponse.json({ success: true, message: 'Bucket ya existe', created: false })
  } catch (error) {
    console.error('Error en setup storage:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: buckets, error } = await supabase.storage.listBuckets()
    
    if (error) throw error

    return NextResponse.json({ 
      buckets: buckets?.map(b => ({ name: b.name, public: b.public })) 
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
