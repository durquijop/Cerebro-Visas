import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY
  const keyPrefix = process.env.OPENAI_API_KEY?.substring(0, 10) || 'NOT_SET'
  
  return NextResponse.json({
    status: 'ok',
    environment: {
      hasOpenAIKey,
      keyPrefix: keyPrefix + '...',
      nodeEnv: process.env.NODE_ENV,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    ocrConfig: {
      model: 'gpt-4o',
      method: 'pdftoppm + vision',
      maxPagesPerRequest: 4,
      pageTimeout: 90000,
      maxRetries: 3,
    },
    version: 'v13',
    timestamp: new Date().toISOString()
  })
}
