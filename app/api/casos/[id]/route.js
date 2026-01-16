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

    // ESTRATEGIA HÍBRIDA: Extraer issues de múltiples fuentes
    let caseIssues = []
    let caseRequests = []

    // 1. Extraer issues/requests desde structured_data de case_documents
    if (caseDocuments && caseDocuments.length > 0) {
      caseDocuments.forEach(doc => {
        if (doc.structured_data) {
          const sd = typeof doc.structured_data === 'string' 
            ? JSON.parse(doc.structured_data) 
            : doc.structured_data
          
          // Agregar issues desde structured_data
          if (sd.issues && Array.isArray(sd.issues)) {
            sd.issues.forEach(issue => {
              caseIssues.push({
                ...issue,
                document_id: doc.id,
                document_name: doc.original_name,
                source: 'case_documents'
              })
            })
          }
          
          // Agregar requests desde structured_data
          if (sd.requests && Array.isArray(sd.requests)) {
            sd.requests.forEach(req => {
              caseRequests.push({
                ...req,
                document_id: doc.id,
                document_name: doc.original_name,
                source: 'case_documents'
              })
            })
          }
        }
      })
    }

    // 2. También buscar en document_issues/document_requests para documentos en tabla 'documents'
    const docsTableIds = (documents || []).map(d => d.id)
    if (docsTableIds.length > 0) {
      const { data: dbIssues } = await supabaseAdmin
        .from('document_issues')
        .select('*')
        .in('document_id', docsTableIds)
        .order('severity', { ascending: true })
      
      if (dbIssues && dbIssues.length > 0) {
        dbIssues.forEach(issue => {
          const doc = documents.find(d => d.id === issue.document_id)
          caseIssues.push({
            ...issue,
            document_name: doc?.name || 'Documento',
            source: 'documents'
          })
        })
      }

      const { data: dbRequests } = await supabaseAdmin
        .from('document_requests')
        .select('*')
        .in('document_id', docsTableIds)
        .order('priority', { ascending: true })
      
      if (dbRequests && dbRequests.length > 0) {
        dbRequests.forEach(req => {
          const doc = documents.find(d => d.id === req.document_id)
          caseRequests.push({
            ...req,
            document_name: doc?.name || 'Documento',
            source: 'documents'
          })
        })
      }
    }

    // 3. También extraer desde structured_data de documentos en tabla 'documents'
    if (documents && documents.length > 0) {
      documents.forEach(doc => {
        if (doc.structured_data) {
          const sd = typeof doc.structured_data === 'string' 
            ? JSON.parse(doc.structured_data) 
            : doc.structured_data
          
          // Solo agregar si no están ya en document_issues (evitar duplicados)
          if (sd.issues && Array.isArray(sd.issues)) {
            const existingCodes = caseIssues
              .filter(i => i.document_id === doc.id)
              .map(i => i.taxonomy_code)
            
            sd.issues.forEach(issue => {
              if (!existingCodes.includes(issue.taxonomy_code)) {
                caseIssues.push({
                  ...issue,
                  document_id: doc.id,
                  document_name: doc.name,
                  source: 'documents_structured'
                })
              }
            })
          }
        }
      })
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
