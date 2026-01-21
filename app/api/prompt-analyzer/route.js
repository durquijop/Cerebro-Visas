import { createClient as createAdminClient } from '@supabase/supabase-js'
import { generateEmbedding } from '@/lib/embeddings'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

// Cliente admin para búsqueda de embeddings
function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

/**
 * Analiza un prompt y encuentra debilidades basándose en issues de RFEs/NOIDs/Denials
 */
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { prompt, documentType, action } = await request.json()

    if (action === 'analyze') {
      return await analyzePrompt(prompt, documentType)
    } else if (action === 'improve') {
      const { selectedIssues } = await request.json()
      return await improvePrompt(prompt, documentType, selectedIssues)
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  } catch (error) {
    console.error('Prompt analyzer error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function analyzePrompt(prompt, documentType) {
  const supabaseAdmin = getSupabaseAdmin()
  
  // 1. Buscar documentos relevantes (RFEs, NOIDs, Denials)
  console.log('🔍 Buscando issues conocidos en la base de datos...')
  
  // Generar embedding del prompt para buscar documentos relacionados
  const promptEmbedding = await generateEmbedding(prompt)
  
  const { data: relevantDocs, error: searchError } = await supabaseAdmin
    .rpc('search_similar_documents', {
      query_embedding: JSON.stringify(promptEmbedding),
      match_threshold: 0.2,
      match_count: 15
    })

  if (searchError) {
    console.error('Error buscando documentos:', searchError)
  }

  // Procesar documentos para obtener información detallada
  const documentsUsed = []
  const docTypeCount = { RFE: 0, NOID: 0, Denial: 0, Otro: 0 }
  const uniqueDocs = new Set()

  if (relevantDocs && relevantDocs.length > 0) {
    for (const doc of relevantDocs) {
      const meta = doc.metadata || {}
      const docName = meta.original_name || 'Documento sin nombre'
      const docType = meta.doc_type || 'Otro'
      
      // Contar por tipo
      if (docType.toLowerCase().includes('rfe')) {
        docTypeCount.RFE++
      } else if (docType.toLowerCase().includes('noid')) {
        docTypeCount.NOID++
      } else if (docType.toLowerCase().includes('denial')) {
        docTypeCount.Denial++
      } else {
        docTypeCount.Otro++
      }

      // Agregar documento único
      if (!uniqueDocs.has(docName)) {
        uniqueDocs.add(docName)
        documentsUsed.push({
          name: docName,
          type: docType,
          similarity: Math.round(doc.similarity * 100)
        })
      }
    }
  }

  // 2. Obtener issues de la taxonomía
  const { data: taxonomy } = await supabaseAdmin
    .from('taxonomy')
    .select('code, description, prong, category')
    .order('prong')

  // 3. Construir contexto de issues conocidos
  let issuesContext = ''
  if (relevantDocs && relevantDocs.length > 0) {
    issuesContext = '### FRAGMENTOS DE RFEs/NOIDs/DENIALS RELEVANTES:\n\n'
    for (const doc of relevantDocs.slice(0, 10)) {
      const meta = doc.metadata || {}
      issuesContext += `--- ${meta.doc_type || 'Documento'}: ${meta.original_name || 'N/A'} ---\n`
      issuesContext += `${doc.content_chunk}\n\n`
    }
  }

  let taxonomyContext = ''
  if (taxonomy && taxonomy.length > 0) {
    taxonomyContext = '### TAXONOMÍA DE ISSUES CONOCIDOS DE USCIS:\n\n'
    const byProng = {}
    for (const t of taxonomy) {
      if (!byProng[t.prong]) byProng[t.prong] = []
      byProng[t.prong].push(`- ${t.code}: ${t.description}`)
    }
    for (const [prong, issues] of Object.entries(byProng)) {
      taxonomyContext += `**${prong}:**\n${issues.join('\n')}\n\n`
    }
  }

  // 4. Analizar el prompt con LLM
  const analysisPrompt = `Eres un experto en peticiones de inmigración EB-2 NIW de Estados Unidos.

Tu tarea es analizar un PROMPT que se usa para generar documentos de inmigración y encontrar debilidades o áreas de mejora basándote en los issues comunes que USCIS señala en RFEs, NOIDs y Denials.

${issuesContext}

${taxonomyContext}

---

TIPO DE DOCUMENTO A GENERAR: ${documentType || 'Carta de petición EB-2 NIW'}

PROMPT A ANALIZAR:
""" 
${prompt}
"""

---

Analiza el prompt y devuelve un JSON con la siguiente estructura:
{
  "overallScore": number (1-10, qué tan completo es el prompt),
  "summary": "string con resumen breve del análisis",
  "issues": [
    {
      "id": "issue_1",
      "category": "Prong 1|Prong 2|Prong 3|General|Evidencia|Estructura",
      "severity": "alta|media|baja",
      "title": "Título corto del issue",
      "description": "Descripción detallada del problema",
      "suggestion": "Sugerencia específica de cómo mejorar",
      "relatedUSCISIssue": "Código de taxonomía relacionado si aplica"
    }
  ],
  "strengths": ["Lista de puntos fuertes del prompt"]
}

IMPORTANTE:
- Basa tu análisis en los issues reales de USCIS mostrados arriba
- Sé específico en las sugerencias
- Identifica qué falta para cada Prong del test Dhanasar
- Considera evidencia que USCIS típicamente solicita
- Responde SOLO con el JSON, sin texto adicional`

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-001',
      messages: [{ role: 'user', content: analysisPrompt }],
      temperature: 0.3,
      max_tokens: 3000
    })
  })

  if (!response.ok) {
    throw new Error('Error en análisis LLM')
  }

  const data = await response.json()
  let analysisResult = data.choices[0]?.message?.content || '{}'
  
  // Limpiar respuesta de markdown si es necesario
  analysisResult = analysisResult.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  
  try {
    const parsed = JSON.parse(analysisResult)
    return NextResponse.json({
      success: true,
      analysis: parsed,
      documentsAnalyzed: relevantDocs?.length || 0,
      documentsUsed: documentsUsed.slice(0, 10), // Máximo 10 documentos únicos
      docTypeCount,
      taxonomyItemsUsed: taxonomy?.length || 0
    })
  } catch (parseError) {
    console.error('Error parsing analysis:', parseError)
    return NextResponse.json({
      success: true,
      analysis: { raw: analysisResult },
      documentsAnalyzed: relevantDocs?.length || 0,
      documentsUsed,
      docTypeCount
    })
  }
}

async function improvePrompt(prompt, documentType, selectedIssues) {
  if (!selectedIssues || selectedIssues.length === 0) {
    return NextResponse.json({ error: 'No se seleccionaron issues para mejorar' }, { status: 400 })
  }

  const issuesList = selectedIssues.map((issue, idx) => 
    `${idx + 1}. **${issue.title}** (${issue.category}):\n   - Problema: ${issue.description}\n   - Sugerencia: ${issue.suggestion}`
  ).join('\n\n')

  const improvePromptText = `Eres un experto en peticiones de inmigración EB-2 NIW.

Tu tarea es MEJORAR el siguiente prompt incorporando las sugerencias específicas para abordar los issues identificados.

PROMPT ORIGINAL:
"""
${prompt}
"""

TIPO DE DOCUMENTO: ${documentType || 'Carta de petición EB-2 NIW'}

ISSUES A ABORDAR:
${issuesList}

---

Genera un NUEVO PROMPT MEJORADO que:
1. Mantenga la intención original del prompt
2. Incorpore instrucciones específicas para abordar cada issue seleccionado
3. Sea claro y estructurado
4. Incluya placeholders [VARIABLE] donde se necesite información específica del caso

Devuelve un JSON con esta estructura:
{
  "improvedPrompt": "El nuevo prompt mejorado completo",
  "changesExplained": [
    {
      "issueAddressed": "Título del issue",
      "changeDescription": "Qué se cambió o agregó para abordarlo"
    }
  ],
  "additionalTips": ["Tips adicionales para usar el prompt"]
}

Responde SOLO con el JSON, sin texto adicional.`

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-001',
      messages: [{ role: 'user', content: improvePromptText }],
      temperature: 0.4,
      max_tokens: 4000
    })
  })

  if (!response.ok) {
    throw new Error('Error generando prompt mejorado')
  }

  const data = await response.json()
  let result = data.choices[0]?.message?.content || '{}'
  result = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    const parsed = JSON.parse(result)
    return NextResponse.json({
      success: true,
      result: parsed
    })
  } catch (parseError) {
    return NextResponse.json({
      success: true,
      result: { improvedPrompt: result }
    })
  }
}
