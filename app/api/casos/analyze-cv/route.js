import { NextResponse } from 'next/server'
import { extractText, normalizeText } from '@/lib/document-processor'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const visaCategory = formData.get('visa_category') || 'EB2-NIW'
    const beneficiaryName = formData.get('beneficiary_name') || 'Candidato'

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó el CV' }, { status: 400 })
    }

    console.log(`📄 Analizando CV de ${beneficiaryName} para ${visaCategory}`)

    // Extraer texto del CV
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    const extraction = await extractText(buffer, file.name)
    
    if (!extraction.success || !extraction.text || extraction.text.length < 100) {
      return NextResponse.json({ 
        error: 'No se pudo extraer texto del CV. Asegúrate de que el archivo sea legible.' 
      }, { status: 400 })
    }

    const cvText = normalizeText(extraction.text)
    console.log(`📊 CV extraído: ${cvText.length} caracteres`)

    // Preparar el prompt para análisis de aptitud
    const prompt = buildAnalysisPrompt(visaCategory, beneficiaryName, cvText)

    // Llamar a OpenRouter para análisis
    const analysis = await analyzeWithAI(prompt)

    console.log(`✅ Análisis completado para ${beneficiaryName}`)

    return NextResponse.json({
      success: true,
      analysis,
      extraction: {
        wordCount: cvText.split(/\s+/).length,
        charCount: cvText.length
      }
    })

  } catch (error) {
    console.error('Error analyzing CV:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function buildAnalysisPrompt(visaCategory, beneficiaryName, cvText) {
  const visaRequirements = {
    'EB2-NIW': {
      name: 'EB-2 National Interest Waiver (NIW)',
      requirements: `
        1. PRONG 1 - Mérito Sustancial e Importancia Nacional:
           - El trabajo propuesto debe tener mérito sustancial
           - Debe ser de importancia nacional para EE.UU.
           
        2. PRONG 2 - Bien Posicionado para Avanzar:
           - Educación, habilidades y conocimientos relevantes
           - Historial de éxito en el campo
           - Plan de trabajo futuro en EE.UU.
           - Progreso demostrable
           
        3. PRONG 3 - Balance de Factores:
           - Beneficio para EE.UU. supera la protección laboral
           - Urgencia o naturaleza única del trabajo
           - Evidencia de que otros beneficiarios no pueden hacer el mismo trabajo
      `,
      keyFactors: [
        'Grado avanzado (Maestría, Doctorado, o equivalente)',
        'Publicaciones en revistas científicas peer-reviewed',
        'Citas de su trabajo por otros investigadores',
        'Patentes o propiedad intelectual',
        'Premios y reconocimientos en su campo',
        'Membresía en organizaciones profesionales selectivas',
        'Experiencia laboral significativa (10+ años)',
        'Cartas de recomendación de expertos',
        'Impacto demostrable en su campo',
        'Plan de trabajo claro en EE.UU.'
      ]
    },
    'EB1-A': {
      name: 'EB-1A Extraordinary Ability',
      requirements: `
        Debe cumplir al menos 3 de 10 criterios:
        1. Premios nacionales/internacionales de excelencia
        2. Membresía en asociaciones que requieren logros sobresalientes
        3. Material publicado sobre el solicitante en medios importantes
        4. Juez del trabajo de otros en el campo
        5. Contribuciones originales de gran importancia
        6. Autoría de artículos académicos
        7. Exhibición de trabajo en exposiciones artísticas
        8. Rol principal en organizaciones distinguidas
        9. Salario alto en comparación con otros en el campo
        10. Éxito comercial en las artes escénicas
      `,
      keyFactors: [
        'Premios internacionales prestigiosos',
        'Reconocimiento extraordinario en el campo',
        'Publicaciones de alto impacto',
        'Rol de liderazgo en organizaciones top',
        'Salario significativamente superior al promedio',
        'Cobertura mediática significativa',
        'Contribuciones que han cambiado el campo'
      ]
    },
    'EB1-B': {
      name: 'EB-1B Outstanding Professor/Researcher',
      requirements: `
        Debe demostrar reconocimiento internacional y al menos 2 de 6 criterios:
        1. Premios por logros sobresalientes
        2. Membresía en asociaciones que requieren logros
        3. Material publicado por otros sobre su trabajo
        4. Participación como juez del trabajo de otros
        5. Contribuciones científicas originales
        6. Autoría de libros o artículos académicos
      `,
      keyFactors: [
        'Mínimo 3 años de experiencia en investigación/docencia',
        'Oferta de trabajo permanente en universidad o institución',
        'Publicaciones académicas significativas',
        'Reconocimiento internacional en su especialidad'
      ]
    },
    'O-1': {
      name: 'O-1 Visa (Extraordinary Ability)',
      requirements: `
        Similar a EB-1A pero para visa temporal.
        Debe demostrar habilidad extraordinaria mediante premios importantes
        o al menos 3 de los criterios de evidencia.
      `,
      keyFactors: [
        'Premios o nominaciones significativas',
        'Membresía en organizaciones selectivas',
        'Publicaciones sobre el beneficiario',
        'Contribuciones originales importantes',
        'Compensación alta'
      ]
    }
  }

  const visa = visaRequirements[visaCategory] || visaRequirements['EB2-NIW']

  return `Eres un experto analista de inmigración de EE.UU. especializado en visas de empleo.

TAREA: Analizar el CV/perfil de ${beneficiaryName} y evaluar su aptitud para la visa ${visa.name}.

REQUISITOS DE LA VISA ${visaCategory}:
${visa.requirements}

FACTORES CLAVE A EVALUAR:
${visa.keyFactors.map((f, i) => `${i + 1}. ${f}`).join('\n')}

CV DEL CANDIDATO:
${cvText.substring(0, 15000)}

INSTRUCCIONES:
Analiza el CV y proporciona un análisis detallado en formato JSON con la siguiente estructura:

{
  "aptitude_score": <número del 0 al 100>,
  "recommendation": "<ALTAMENTE RECOMENDADO | RECOMENDADO | POSIBLE CON MEJORAS | NO RECOMENDADO>",
  "summary": "<Resumen ejecutivo de 2-3 oraciones sobre la aptitud del candidato>",
  "strengths": [
    {"factor": "<nombre del factor>", "evidence": "<evidencia encontrada en el CV>", "score": <0-100>}
  ],
  "weaknesses": [
    {"factor": "<factor débil o ausente>", "suggestion": "<sugerencia para mejorar>"}
  ],
  "prong_analysis": {
    "prong1": {"score": <0-100>, "analysis": "<análisis del mérito e importancia nacional>"},
    "prong2": {"score": <0-100>, "analysis": "<análisis de posicionamiento>"},
    "prong3": {"score": <0-100>, "analysis": "<análisis del balance de factores>"}
  },
  "key_qualifications": ["<lista de las calificaciones más fuertes>"],
  "missing_evidence": ["<evidencia que falta o sería útil obtener>"],
  "next_steps": ["<pasos recomendados para fortalecer el caso>"],
  "estimated_approval_chance": "<ALTA | MEDIA-ALTA | MEDIA | MEDIA-BAJA | BAJA>",
  "reasoning": "<Explicación detallada de por qué se asignó este puntaje y recomendación>"
}

IMPORTANTE:
- Sé objetivo y basado en evidencia del CV
- Si falta información importante, indícalo
- El puntaje debe reflejar realísticamente las probabilidades de aprobación
- Proporciona sugerencias accionables`
}

async function analyzeWithAI(prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY no configurada')
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      'X-Title': 'Cerebro Visas - CV Analysis'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4000
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Error en API de IA')
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content

  if (!content) {
    throw new Error('No se recibió respuesta de la IA')
  }

  // Parsear JSON de la respuesta
  try {
    // Buscar el JSON en la respuesta
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    throw new Error('No se encontró JSON válido en la respuesta')
  } catch (parseError) {
    console.error('Error parsing AI response:', parseError)
    // Retornar un análisis básico si falla el parsing
    return {
      aptitude_score: 50,
      recommendation: 'REQUIERE REVISIÓN MANUAL',
      summary: content.substring(0, 500),
      strengths: [],
      weaknesses: [],
      reasoning: 'El análisis automático no pudo completarse correctamente. Por favor revise manualmente.',
      raw_response: content
    }
  }
}
