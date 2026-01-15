import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    // Estadísticas generales
    const [casesResult, docsResult, issuesResult, profilesResult] = await Promise.all([
      supabaseAdmin.from('cases').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('documents').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('issues').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true })
    ])

    // Issues por severidad
    const { data: issuesBySeverity } = await supabaseAdmin
      .from('issues')
      .select('severity')
    
    const severityCounts = {
      critical: 0, high: 0, medium: 0, low: 0
    }
    issuesBySeverity?.forEach(i => {
      if (severityCounts[i.severity] !== undefined) {
        severityCounts[i.severity]++
      }
    })

    // Issues por taxonomía (top 5)
    const { data: issuesByTaxonomy } = await supabaseAdmin
      .from('issues')
      .select('taxonomy_code')
    
    const taxonomyCounts = {}
    issuesByTaxonomy?.forEach(i => {
      taxonomyCounts[i.taxonomy_code] = (taxonomyCounts[i.taxonomy_code] || 0) + 1
    })
    const topTaxonomy = Object.entries(taxonomyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => ({ code, count }))

    // Casos por outcome
    const { data: casesByOutcome } = await supabaseAdmin
      .from('cases')
      .select('outcome')
    
    const outcomeCounts = {}
    casesByOutcome?.forEach(c => {
      outcomeCounts[c.outcome] = (outcomeCounts[c.outcome] || 0) + 1
    })

    return NextResponse.json({
      totals: {
        cases: casesResult.count || 0,
        documents: docsResult.count || 0,
        issues: issuesResult.count || 0,
        users: profilesResult.count || 0
      },
      issuesBySeverity: severityCounts,
      topTaxonomy,
      casesByOutcome: outcomeCounts
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
