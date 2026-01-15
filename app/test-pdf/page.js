'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react'

export default function TestPDFPage() {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
      setError(null)
    }
  }

  const handleTest = async () => {
    if (!file) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/test-extraction', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Error en la extracción')
      }

      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">Test de Extracción de PDF</h1>
          <p className="text-muted-foreground mt-2">
            Página de diagnóstico para probar la extracción de texto de PDFs
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Subir Archivo
            </CardTitle>
            <CardDescription>
              Selecciona un PDF para probar la extracción de texto
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileChange}
              className="block w-full text-sm text-foreground
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-primary file:text-primary-foreground
                hover:file:bg-primary/90
                cursor-pointer"
            />
            
            {file && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
            )}

            <Button 
              onClick={handleTest} 
              disabled={!file || loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extrayendo texto...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Probar Extracción
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Error</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <div className="space-y-4">
            <Card className={result.success ? 'border-green-500' : 'border-yellow-500'}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-yellow-500" />
                  )}
                  Resultado de Extracción
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">Método</p>
                    <p className="font-bold">{result.extraction?.method || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">Palabras</p>
                    <p className="font-bold">{result.text?.wordCount || 0}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">Caracteres</p>
                    <p className="font-bold">{result.text?.cleanLength || 0}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">Páginas</p>
                    <p className="font-bold">{result.extraction?.numPages || 'N/A'}</p>
                  </div>
                </div>

                {result.extraction?.error && (
                  <div className="p-3 bg-destructive/10 rounded-md mb-4">
                    <p className="text-sm font-medium text-destructive">Error: {result.extraction.error}</p>
                    {result.extraction.suggestion && (
                      <p className="text-sm text-muted-foreground mt-1">{result.extraction.suggestion}</p>
                    )}
                  </div>
                )}

                <div className="p-3 bg-muted rounded-md text-sm">
                  <p className="text-sm text-muted-foreground mb-1">Tiempo de procesamiento</p>
                  <p className="font-mono">{result.extraction?.processingTimeMs || 0}ms</p>
                </div>
              </CardContent>
            </Card>

            {result.text?.preview && (
              <Card>
                <CardHeader>
                  <CardTitle>Vista Previa del Texto Extraído</CardTitle>
                  <CardDescription>
                    Primeros 1000 caracteres del texto extraído
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="p-4 bg-muted rounded-md text-sm whitespace-pre-wrap overflow-auto max-h-96 font-mono">
                    {result.text.preview || '(Sin texto extraído)'}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
