import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// GET - Obtener caso específico con documentos e issues
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

    // Obtener documentos del caso desde case_documents
    const { data: caseDocuments, error: caseDocsError } = await supabaseAdmin
      .from('case_documents')
      .select('*')
      .eq('case_id', id)
      .order('created_at', { ascending: false })

    // También buscar en tabla documents por si hay documentos ahí
    const { data: documents, error: docsError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('case_id', id)
      .order('created_at', { ascending: false })

    // Combinar documentos de ambas tablas
    const allDocuments = [
      ...(caseDocuments || []).map(d => ({ ...d, source: 'case_documents' })),
      ...(documents || []).map(d => ({ ...d, source: 'documents' }))
    ]

    // Obtener IDs de documentos para buscar issues
    const docIds = allDocuments.map(d => d.id)

    // Obtener issues de los documentos del caso
    let caseIssues = []
    if (docIds.length > 0) {
      const { data: issues } = await supabaseAdmin
        .from('document_issues')
        .select('*')
        .in('document_id', docIds)
        .order('severity', { ascending: true })
      
      caseIssues = issues || []
    }

    // Obtener requests de los documentos del caso
    let caseRequests = []
    if (docIds.length > 0) {
      const { data: requests } = await supabaseAdmin
        .from('document_requests')
        .select('*')
        .in('document_id', docIds)
        .order('priority', { ascending: true })
      
      caseRequests = requests || []
    }

    // Calcular estadísticas del caso
    const issuesBySeverity = {
      critical: caseIssues.filter(i => i.severity === 'critical').length,
      high: caseIssues.filter(i => i.severity === 'high').length,
      medium: caseIssues.filter(i => i.severity === 'medium').length,
      low: caseIssues.filter(i => i.severity === 'low').length
    }

    const issuesByProng = {
      P1: caseIssues.filter(i => i.prong_affected === 'P1').length,
      P2: caseIssues.filter(i => i.prong_affected === 'P2').length,
      P3: caseIssues.filter(i => i.prong_affected === 'P3').length,
      EVIDENCE: caseIssues.filter(i => i.prong_affected === 'EVIDENCE').length,
      COHERENCE: caseIssues.filter(i => i.prong_affected === 'COHERENCE').length,
      PROCEDURAL: caseIssues.filter(i => i.prong_affected === 'PROCEDURAL').length
    }

    return NextResponse.json({ 
      case: { 
        ...caseData, 
        documents: allDocuments,
        issues: caseIssues,
        requests: caseRequests,
        stats: {
          totalDocuments: allDocuments.length,
          totalIssues: caseIssues.length,
          totalRequests: caseRequests.length,
          issuesBySeverity,
          issuesByProng
        }
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

// DELETE - Eliminar caso y sus documentos
export async function DELETE(request, { params }) {
  try {
    const { id } = params

    // Eliminar issues relacionados (a través de documentos)
    const { data: docs } = await supabaseAdmin
      .from('documents')
      .select('id')
      .eq('case_id', id)

    if (docs && docs.length > 0) {
      const docIds = docs.map(d => d.id)
      await supabaseAdmin.from('document_issues').delete().in('document_id', docIds)
      await supabaseAdmin.from('document_requests').delete().in('document_id', docIds)
    }

    // Eliminar documentos de ambas tablas
    await supabaseAdmin.from('documents').delete().eq('case_id', id)
    await supabaseAdmin.from('case_documents').delete().eq('case_id', id)

    // Eliminar el caso
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
