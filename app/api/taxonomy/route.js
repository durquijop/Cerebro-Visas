import { NextResponse } from 'next/server'
import { TAXONOMY, getAllTaxonomyCodes, getTaxonomyDetails } from '@/lib/taxonomy'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  // Si se solicita un código específico
  if (code) {
    const details = getTaxonomyDetails(code)
    if (!details) {
      return NextResponse.json(
        { error: 'Código de taxonomía no encontrado' },
        { status: 404 }
      )
    }
    return NextResponse.json({ code, details })
  }

  // Retornar toda la taxonomía
  return NextResponse.json({
    taxonomy: TAXONOMY,
    codes: getAllTaxonomyCodes()
  })
}
