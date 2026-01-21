import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

/**
 * GET /api/claims
 * Obtiene claims de un caso con su evidencia asociada
 */
export async function GET(request) {
  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const caseId = searchParams.get('case_id')

    if (!caseId) {
      return NextResponse.json({ error: 'case_id requerido' }, { status: 400 })
    }

    // Obtener claims del caso
    const { data: claims, error } = await supabase
      .from('claims')
      .select(`
        *,
        claim_evidence (
          id,
          exhibit_ref,
          evidence_type,
          strength_score,
          rationale,
          gaps_identified
        )
      `)
      .eq('case_id', caseId)
      .order('criticality', { ascending: false })

    if (error) {
      console.error('Error fetching claims:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calcular score general del caso
    const totalClaims = claims?.length || 0
    const avgStrength = claims?.reduce((sum, c) => sum + (c.evidence_strength_score || 0), 0) / (totalClaims || 1)
    const weakClaims = claims?.filter(c => (c.evidence_strength_score || 0) < 0.5).length || 0
    const criticalClaims = claims?.filter(c => c.criticality === 'critical').length || 0

    return NextResponse.json({
      success: true,
      case_id: caseId,
      claims: claims || [],
      summary: {
        total_claims: totalClaims,
        average_strength: Math.round(avgStrength * 100) / 100,
        weak_claims: weakClaims,
        critical_claims: criticalClaims,
        robustness_score: Math.round((1 - (weakClaims / (totalClaims || 1))) * 100)
      }
    })

  } catch (error) {
    console.error('Claims GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/claims
 * Extrae claims de un caso usando LLM
 */
export async function POST(request) {
  try {
    const supabase = getSupabaseAdmin()
    const body = await request.json()
    const { case_id, action } = body

    if (action === 'extract') {
      // Obtener documentos del caso
      const { data: caseData } = await supabase
        .from('visa_cases')
        .select('*, case_documents(*)')
        .eq('id', case_id)
        .single()

      if (!caseData) {
        return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
      }

      // Concatenar texto de todos los documentos
      let fullText = ''
      for (const doc of caseData.case_documents || []) {
        if (doc.text_content) {
          fullText += `\n\n--- ${doc.doc_type}: ${doc.original_name} ---\n${doc.text_content}`
        }
      }

      if (fullText.length < 200) {
        return NextResponse.json({ 
          error: 'No hay suficiente texto en los documentos para extraer claims' 
        }, { status: 400 })
      }

      // Usar LLM para extraer claims
      const extractedClaims = await extractClaimsWithLLM(fullText.substring(0, 40000))

      if (!extractedClaims.success) {
        return NextResponse.json({ error: extractedClaims.error }, { status: 500 })
      }

      // Eliminar claims anteriores del caso
      await supabase.from('claims').delete().eq('case_id', case_id)

      // Insertar nuevos claims
      const claimsToInsert = extractedClaims.claims.map(c => ({
        case_id: case_id,
        claim_text: c.claim_text,
        claim_type: c.claim_type,
        prong_mapping: c.prong_mapping,
        criticality: c.criticality,
        evidence_strength_score: c.initial_strength || 0.5,
        status: 'pending'
      }))

      const { data: insertedClaims, error: insertError } = await supabase
        .from('claims')
        .insert(claimsToInsert)
        .select()

      if (insertError) {
        console.error('Error inserting claims:', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `${insertedClaims?.length || 0} claims extraídos`,
        claims: insertedClaims
      })
    }

    if (action === 'add_evidence') {
      const { claim_id, evidence } = body
      
      const { data, error } = await supabase
        .from('claim_evidence')
        .insert({
          claim_id,
          evidence_doc_id: evidence.document_id,
          case_document_id: evidence.case_document_id,
          exhibit_ref: evidence.exhibit_ref,
          evidence_type: evidence.evidence_type,
          strength_score: evidence.strength_score || 0.5,
          rationale: evidence.rationale,
          gaps_identified: evidence.gaps || []
        })
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Recalcular strength del claim
      await recalculateClaimStrength(supabase, claim_id)

      return NextResponse.json({ success: true, evidence: data })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  } catch (error) {
    console.error('Claims POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Extrae claims usando LLM
 */
async function extractClaimsWithLLM(text) {
  if (!OPENROUTER_API_KEY) {
    return { success: false, error: 'OPENROUTER_API_KEY no configurada' }
  }

  const prompt = `Analiza este expediente de visa NIW y extrae TODOS los claims (afirmaciones) que hace el peticionario.

TEXTO DEL EXPEDIENTE:
${text}

Para cada claim identificado, proporciona:
1. claim_text: El texto exacto o resumen del claim
2. claim_type: "main" (argumento principal), "supporting" (soporte), o "counter" (contra posible objeción)
3. prong_mapping: "P1" (mérito/importancia), "P2" (bien posicionado), "P3" (balance), o "GENERAL"
4. criticality: "critical" (esencial para aprobación), "high", "medium", "low"
5. initial_strength: 0.0-1.0 estimación inicial de qué tan bien soportado parece estar

Responde SOLO con JSON válido en este formato:
{
  "claims": [
    {
      "claim_text": "...",
      "claim_type": "main|supporting|counter",
      "prong_mapping": "P1|P2|P3|GENERAL",
      "criticality": "critical|high|medium|low",
      "initial_strength": 0.7
    }
  ]
}

IMPORTANTE: 
- Identifica TODOS los claims, no solo los principales
- Los claims de P1 deben ser sobre mérito sustancial e importancia nacional
- Los claims de P2 deben ser sobre por qué el beneficiario está bien posicionado
- Los claims de P3 deben ser sobre por qué debe eximirse del proceso PERM`

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        'X-Title': 'Cerebro Visas - Claim Extractor'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        temperature: 0.1
      })
    })

    if (!response.ok) {
      const error = await response.text()
      return { success: false, error: `LLM error: ${response.status}` }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { success: false, error: 'No se pudo parsear respuesta del LLM' }
    }

    const parsed = JSON.parse(jsonMatch[0])
    return { success: true, claims: parsed.claims || [] }

  } catch (error) {
    console.error('LLM extraction error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Recalcula el strength score de un claim basado en su evidencia
 */
async function recalculateClaimStrength(supabase, claimId) {
  const { data: evidence } = await supabase
    .from('claim_evidence')
    .select('strength_score')
    .eq('claim_id', claimId)

  if (!evidence || evidence.length === 0) {
    await supabase
      .from('claims')
      .update({ evidence_strength_score: 0, status: 'missing_evidence' })
      .eq('id', claimId)
    return
  }

  const avgStrength = evidence.reduce((sum, e) => sum + (e.strength_score || 0), 0) / evidence.length
  const status = avgStrength >= 0.7 ? 'validated' : avgStrength >= 0.4 ? 'pending' : 'weak'

  await supabase
    .from('claims')
    .update({ 
      evidence_strength_score: Math.round(avgStrength * 100) / 100,
      status 
    })
    .eq('id', claimId)
}
