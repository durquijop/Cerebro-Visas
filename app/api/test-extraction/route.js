import { NextResponse } from 'next/server'
import { extractText, normalizeText } from '@/lib/document-processor'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }

    console.log(`🧪 TEST: Procesando ${file.name}`)

    // Convertir archivo a buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Extraer texto
    const startTime = Date.now()
    const result = await extractText(buffer, file.name)
    const endTime = Date.now()

    // Normalizar
    const cleanText = normalizeText(result.text || '')
    const wordCount = cleanText.split(/\s+/).filter(w => w.length > 0).length

    return NextResponse.json({
      success: result.success,
      filename: file.name,
      fileSize: buffer.length,
      extraction: {
        method: result.method || 'unknown',
        success: result.success,
        error: result.error,
        suggestion: result.suggestion,
        numPages: result.numPages,
        processingTimeMs: endTime - startTime
      },
      text: {
        rawLength: (result.text || '').length,
        cleanLength: cleanText.length,
        wordCount: wordCount,
        preview: cleanText.substring(0, 1000) + (cleanText.length > 1000 ? '...' : '')
      }
    })
  } catch (error) {
    console.error('Test extraction error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
