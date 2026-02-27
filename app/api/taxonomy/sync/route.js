import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { TAXONOMY } from '@/lib/taxonomy'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * POST /api/taxonomy/sync
 * Sincroniza todos los códigos de taxonomy.js con la tabla taxonomy de Supabase
 */
export async function POST() {
  try {
    const allCodes = []

    // Extraer todos los códigos de la taxonomía
    for (const [visaKey, visa] of Object.entries(TAXONOMY)) {
      const criteriaType = visa.criteria_type // 'prongs' o 'criteria'
      const criteriaObj = visa[criteriaType] || visa.prongs || visa.criteria

      if (!criteriaObj) continue

      for (const [criteriaKey, criteria] of Object.entries(criteriaObj)) {
        const issues = criteria.issues || {}

        for (const [issueKey, issue] of Object.entries(issues)) {
          allCodes.push({
            code: issue.code,
            level1: visaKey,
            level2: criteriaKey,
            level3: issueKey,
            description: issue.description || issue.label,
            prong: criteriaKey,
            severity_default: issue.severity || 'medium',
            active: true
          })
        }
      }
    }

    console.log(`📋 Sincronizando ${allCodes.length} códigos de taxonomía...`)

    let inserted = 0
    let updated = 0
    let errors = 0

    for (const taxCode of allCodes) {
      // Intentar upsert
      const { data: existing } = await supabase
        .from('taxonomy')
        .select('id')
        .eq('code', taxCode.code)
        .single()

      if (existing) {
        // Update
        const { error } = await supabase
          .from('taxonomy')
          .update(taxCode)
          .eq('code', taxCode.code)
        
        if (error) {
          console.error(`   ⚠️ Error actualizando ${taxCode.code}:`, error.message)
          errors++
        } else {
          updated++
        }
      } else {
        // Insert
        const { error } = await supabase
          .from('taxonomy')
          .insert(taxCode)
        
        if (error) {
          console.error(`   ⚠️ Error insertando ${taxCode.code}:`, error.message)
          errors++
        } else {
          inserted++
        }
      }
    }

    console.log(`✅ Sync completado: ${inserted} insertados, ${updated} actualizados, ${errors} errores`)

    return NextResponse.json({
      success: true,
      total: allCodes.length,
      inserted,
      updated,
      errors
    })
  } catch (error) {
    console.error('❌ Error en sync de taxonomía:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
