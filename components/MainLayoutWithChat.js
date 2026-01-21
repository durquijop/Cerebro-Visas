'use client'

import { useState } from 'react'
import ChatPanel from './ChatPanel'
import { Button } from '@/components/ui/button'
import { MessageSquare, PanelRightClose, PanelRight } from 'lucide-react'

export default function MainLayoutWithChat({ children }) {
  const [chatOpen, setChatOpen] = useState(true)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Main Content - 50% o 100% si chat está cerrado */}
      <div className={`transition-all duration-300 overflow-auto ${
        chatOpen ? 'w-1/2' : 'w-full'
      }`}>
        {children}
        
        {/* Botón flotante cuando chat está cerrado */}
        {!chatOpen && (
          <Button
            onClick={() => setChatOpen(true)}
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-purple-600 hover:bg-purple-700 shadow-lg z-50"
          >
            <MessageSquare className="h-6 w-6" />
          </Button>
        )}
      </div>

      {/* Chat Panel - 50% */}
      {chatOpen && (
        <div className="w-1/2 h-full border-l border-navy-light">
          <ChatPanel 
            isExpanded={true} 
            onToggle={() => setChatOpen(false)} 
          />
        </div>
      )}
    </div>
  )
}
