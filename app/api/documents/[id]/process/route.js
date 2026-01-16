import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { extractStructuredData, saveStructuredData } from '@/lib/case-miner'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// POST - Procesar documento con IA (Case Miner)
export async function POST(request, { params }) {
  try {
    const { id } = params

    // 1. Obtener el documento
    let document = null
    let tableName = 'documents'

    // Buscar en tabla documents
    const { data: doc1, error: err1 } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single()

    if (doc1) {
      document = doc1
      tableName = 'documents'
    } else {
      // Buscar en case_documents
      const { data: doc2, error: err2 } = await supabase
        .from('case_documents')
        .select('*')
        .eq('id', id)
        .single()

      if (doc2) {
        document = doc2
        tableName = 'case_documents'
      }
    }

    if (!document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    // 2. Verificar que tenga texto
    const textContent = document.text_content || ''
    if (textContent.length < 100) {
      return NextResponse.json({ 
        error: 'El documento no tiene suficiente texto para procesar. Se necesitan al menos 100 caracteres.' 
      }, { status: 400 })
    }

    // 3. Determinar el tipo de documento
    const docType = document.doc_type || document.outcome_type || 'RFE'
    const outcomeType = docType.toUpperCase().includes('RFE') ? 'RFE' :
                       docType.toUpperCase().includes('NOID') ? 'NOID' :
                       docType.toUpperCase().includes('DENIAL') ? 'Denial' : 'RFE'

    console.log(`🔬 Procesando documento ${id} como ${outcomeType}...`)

    // 4. Ejecutar extracción estructurada
    const extractionResult = await extractStructuredData(textContent, outcomeType)

    if (!extractionResult.success) {
      return NextResponse.json({ 
        error: extractionResult.error || 'Error en la extracción estructurada' 
      }, { status: 500 })
    }

    const structuredData = extractionResult.data

    // 5. Actualizar el documento con los datos estructurados
    const updateData = {
      structured_data: structuredData,
      analyzed_at: new Date().toISOString()
    }

    // Solo agregar campos que existen en la tabla
    if (tableName === 'documents') {
      updateData.outcome_type = structuredData.document_info?.outcome_type || outcomeType
      updateData.visa_category = structuredData.document_info?.visa_category
      updateData.document_date = structuredData.document_info?.document_date
      updateData.receipt_number = structuredData.document_info?.receipt_number
      updateData.service_center = structuredData.document_info?.service_center
      updateData.beneficiary_name = structuredData.document_info?.beneficiary_name
      updateData.extraction_status = 'completed'
    } else {
      // Para case_documents, guardar en analysis_summary
      updateData.analysis_summary = JSON.stringify(structuredData.summary)
    }

    await supabase
      .from(tableName)
      .update(updateData)
      .eq('id', id)

    // 6. Guardar issues en document_issues
    if (structuredData.issues && structuredData.issues.length > 0) {
      // Eliminar issues anteriores
      await supabase
        .from('document_issues')
        .delete()
        .eq('document_id', id)

      // Insertar nuevos issues
      const issuesToInsert = structuredData.issues.map(issue => ({
        document_id: id,
        taxonomy_code: issue.taxonomy_code,
        severity: issue.severity,
        extracted_quote: issue.extracted_quote,
        page_ref: issue.page_ref,
        prong_affected: issue.prong_affected,
        officer_reasoning: issue.officer_reasoning
      }))

      const { error: issuesError } = await supabase
        .from('document_issues')
        .insert(issuesToInsert)

      if (issuesError) {
        console.error('Error guardando issues:', issuesError)
      }
    }

    // 7. Guardar requests en document_requests
    if (structuredData.requests && structuredData.requests.length > 0) {
      // Eliminar requests anteriores
      await supabase
        .from('document_requests')
        .delete()
        .eq('document_id', id)

      // Insertar nuevos requests
      const requestsToInsert = structuredData.requests.map(req => ({
        document_id: id,
        request_text: req.request_text,
        evidence_type: req.evidence_type,
        prong_mapping: req.prong_mapping,
        priority: req.priority
      }))

      const { error: reqError } = await supabase
        .from('document_requests')
        .insert(requestsToInsert)

      if (reqError) {
        console.error('Error guardando requests:', reqError)
      }
    }

    console.log(`✅ Documento procesado: ${structuredData.issues?.length || 0} issues, ${structuredData.requests?.length || 0} requests`)

    return NextResponse.json({
      success: true,
      issues_count: structuredData.issues?.length || 0,
      requests_count: structuredData.requests?.length || 0,
      prongs_affected: structuredData.summary?.prongs_affected,
      executive_summary: structuredData.summary?.executive_summary,
      overall_severity: structuredData.summary?.overall_severity
    })

  } catch (error) {
    console.error('Error processing document:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
