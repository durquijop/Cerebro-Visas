'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { 
  Brain, Send, Loader2, FileText, MessageSquare, 
  Sparkles, X, Minimize2, Maximize2, RefreshCw,
  ChevronRight, AlertCircle, BookOpen
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function ChatPanel({ isExpanded = true, onToggle }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [embeddingsStatus, setEmbeddingsStatus] = useState(null)
  const [generatingEmbeddings, setGeneratingEmbeddings] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    checkEmbeddingsStatus()
  }, [])

  useEffect(() => {
    // Auto-scroll al último mensaje
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const checkEmbeddingsStatus = async () => {
    try {
      const res = await fetch('/api/embeddings/generate-all')
      const data = await res.json()
      setEmbeddingsStatus(data)
    } catch (err) {
      console.error('Error checking embeddings:', err)
    }
  }

  const generateAllEmbeddings = async () => {
    if (!confirm('¿Generar embeddings para todos los documentos? Esto puede tomar varios minutos.')) return
    
    setGeneratingEmbeddings(true)
    try {
      const res = await fetch('/api/embeddings/generate-all', { method: 'POST' })
      const data = await res.json()
      
      if (data.success) {
        toast.success(`Embeddings generados: ${data.results.documents.success + data.results.caseDocuments.success} documentos`)
        checkEmbeddingsStatus()
      } else {
        toast.error('Error generando embeddings')
      }
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setGeneratingEmbeddings(false)
    }
  }

  const sendMessage = async (e) => {
    e?.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    
    // Agregar mensaje del usuario
    const newUserMessage = { role: 'user', content: userMessage }
    setMessages(prev => [...prev, newUserMessage])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: messages
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error en el chat')
      }

      // Agregar respuesta del asistente
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        sources: data.sources,
        documentsFound: data.documentsFound
      }])

    } catch (err) {
      toast.error(err.message)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu pregunta. Por favor intenta de nuevo.',
        isError: true
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  if (!isExpanded) {
    return (
      <Button
        onClick={onToggle}
        className="fixed bottom-4 right-4 h-14 w-14 rounded-full bg-purple-600 hover:bg-purple-700 shadow-lg z-50"
      >
        <MessageSquare className="h-6 w-6" />
      </Button>
    )
  }

  return (
    <div className="h-full flex flex-col bg-navy-secondary border-l border-navy-light">
      {/* Header */}
      <div className="p-4 border-b border-navy-light flex items-center justify-between bg-navy-primary">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-purple-400" />
          <h2 className="font-semibold text-gold-subtle">Chat RAG</h2>
          {embeddingsStatus && (
            <Badge variant="outline" className="text-xs text-gold-muted border-navy-light">
              {embeddingsStatus.embeddings_count} embeddings
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearChat} className="text-gold-muted hover:text-gold-subtle">
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          {onToggle && (
            <Button variant="ghost" size="sm" onClick={onToggle} className="text-gold-muted hover:text-gold-subtle">
              <Minimize2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Status Bar - si no hay embeddings */}
      {embeddingsStatus && embeddingsStatus.embeddings_count === 0 && embeddingsStatus.total_documents > 0 && (
        <div className="p-3 bg-yellow-500/10 border-b border-yellow-500/30">
          <div className="flex items-center gap-2 text-sm text-yellow-400">
            <AlertCircle className="h-4 w-4" />
            <span>Hay {embeddingsStatus.total_documents} documentos sin embeddings</span>
          </div>
          <Button
            size="sm"
            onClick={generateAllEmbeddings}
            disabled={generatingEmbeddings}
            className="mt-2 bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            {generatingEmbeddings ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generando...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-1" /> Generar Embeddings</>
            )}
          </Button>
        </div>
      )}

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <Brain className="h-16 w-16 text-purple-400/30 mb-4" />
            <h3 className="text-lg font-medium text-gold-subtle mb-2">Chat de Consulta RAG</h3>
            <p className="text-sm text-gold-muted mb-4 max-w-sm">
              Pregunta sobre tus casos, documentos RFE/NOID, tendencias de issues, o estrategias de respuesta.
            </p>
            <div className="space-y-2 text-xs text-gold-muted">
              <p className="font-medium text-gold-subtle">Ejemplos de preguntas:</p>
              <button 
                onClick={() => setInput('¿Cuáles son los issues más comunes en Prong 1?')}
                className="block w-full text-left p-2 rounded bg-navy-primary hover:bg-navy-light transition-colors"
              >
                → ¿Cuáles son los issues más comunes en Prong 1?
              </button>
              <button 
                onClick={() => setInput('¿Qué evidencia pide USCIS para national interest?')}
                className="block w-full text-left p-2 rounded bg-navy-primary hover:bg-navy-light transition-colors"
              >
                → ¿Qué evidencia pide USCIS para national interest?
              </button>
              <button 
                onClick={() => setInput('Dame ejemplos de RFEs sobre bien posicionado')}
                className="block w-full text-left p-2 rounded bg-navy-primary hover:bg-navy-light transition-colors"
              >
                → Dame ejemplos de RFEs sobre bien posicionado
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white'
                      : msg.isError
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : 'bg-navy-primary text-gold-subtle border border-navy-light'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  
                  {/* Fuentes */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-navy-light">
                      <p className="text-xs text-gold-muted mb-2 flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        Fuentes ({msg.sources.length}):
                      </p>
                      <div className="space-y-1">
                        {msg.sources.map((source, sIdx) => (
                          <div 
                            key={sIdx}
                            className="text-xs flex items-center gap-2 p-1.5 rounded bg-navy-secondary"
                          >
                            <FileText className="h-3 w-3 text-gold-muted" />
                            <span className="truncate flex-1">{source.name}</span>
                            <Badge className="text-[10px] bg-purple-500/20 text-purple-300">
                              {(source.similarity * 100).toFixed(0)}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-navy-primary text-gold-subtle border border-navy-light rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                    <span className="text-sm">Buscando en documentos...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <form onSubmit={sendMessage} className="p-4 border-t border-navy-light bg-navy-primary">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta sobre tus casos..."
            disabled={loading}
            className="flex-1 bg-navy-secondary border-navy-light text-gold-subtle placeholder:text-gold-muted/50"
          />
          <Button 
            type="submit" 
            disabled={loading || !input.trim()}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
