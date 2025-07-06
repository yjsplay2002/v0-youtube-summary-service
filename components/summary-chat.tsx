"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Send, MessageCircle, Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-context"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

interface ChatMessage {
  id: string
  type: 'user' | 'ai' | 'system'
  content: string
  timestamp: Date
  suggested_questions?: string[]
  metadata?: {
    source?: 'rag' | 'summary' | 'none'
    contextUsed?: boolean
    ragEnabled?: boolean
    chunksUsed?: number
    maxSimilarity?: number
    avgSimilarity?: number
    processingTime?: number
  }
}

interface SummaryChatProps {
  summary: string
  videoId: string
}

export function SummaryChat({ summary, videoId }: SummaryChatProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages])

  // Load existing chat history first, then initialize if no history exists
  useEffect(() => {
    if (summary && !isInitialized) {
      if (user) {
        loadChatHistory()
      } else {
        // For non-logged users, just initialize without loading history
        initializeChat()
      }
    }
  }, [summary, user, isInitialized])

  const loadChatHistory = async () => {
    if (!user?.id || !videoId) return
    
    setIsLoading(true)
    try {
      // First, try to load existing chat history
      const historyResponse = await fetch(`/api/chat/history?videoId=${videoId}&userId=${user.id}`)
      
      if (historyResponse.ok) {
        const { messages: existingMessages } = await historyResponse.json()
        
        if (existingMessages && existingMessages.length > 0) {
          // Convert timestamp strings back to Date objects
          const formattedMessages = existingMessages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
          
          setMessages(formattedMessages)
          
          // Extract suggested questions from the last AI message (stored in message data)
          
          setIsInitialized(true)
          setIsLoading(false)
          return
        }
      }
      
      // If no existing history, initialize new chat
      await initializeChat()
      
    } catch (error) {
      console.error('Error loading chat history:', error)
      // Fallback to initialization if loading fails
      await initializeChat()
    }
  }

  const initializeChat = async () => {
    if (!summary.trim()) return
    
    setIsLoading(true)
    try {
      const response = await fetch('/api/chat/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          summary,
          videoId,
          userId: user?.id 
        })
      })

      if (response.ok) {
        const data = await response.json()
        
        // Add system welcome message
        const welcomeMessage: ChatMessage = {
          id: `system-${Date.now()}`,
          type: 'system',
          content: '비디오 요약을 바탕으로 질문해 주세요.',
          timestamp: new Date(),
          suggested_questions: data.questions
        }
        setMessages([welcomeMessage])
      }
    } catch (error) {
      console.error('Failed to initialize chat:', error)
    } finally {
      setIsLoading(false)
      setIsInitialized(true)
    }
  }

  const sendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: message,
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, userMessage])
    setInputMessage("")
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          summary,
          videoId,
          userId: user?.id,
          conversationHistory: messages
        })
      })

      if (response.ok) {
        const data = await response.json()
        
        // Add AI response
        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          type: 'ai',
          content: data.response,
          timestamp: new Date(),
          suggested_questions: data.followUpQuestions,
          metadata: data.metadata
        }
        
        setMessages(prev => [...prev, aiMessage])
        
        // Log RAG usage for debugging
        if (data.metadata) {
          console.log('[SummaryChat] RAG Debug Info:', {
            source: data.metadata.source,
            ragEnabled: data.metadata.ragEnabled,
            contextUsed: data.metadata.contextUsed,
            chunksUsed: data.metadata.chunksUsed,
            similarity: {
              max: data.metadata.maxSimilarity,
              avg: data.metadata.avgSimilarity
            },
            processingTime: data.metadata.processingTime
          });
        }
      } else {
        throw new Error('Failed to send message')
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      // Add error message
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        type: 'system',
        content: '죄송합니다. 메시지 전송에 실패했습니다. 다시 시도해 주세요.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuggestedQuestion = (question: string) => {
    sendMessage(question)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(inputMessage)
  }

  // Allow non-logged users to chat, but show a notice about saving
  const showSaveNotice = !user

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="h-5 w-5" />
        <h3 className="text-lg font-semibold">AI와 대화하기</h3>
      </div>
      {showSaveNotice && (
        <div className="text-sm text-muted-foreground bg-muted p-2 rounded-md mb-4">
          💡 로그인하시면 대화 기록이 저장됩니다.
        </div>
      )}
        {/* Chat Messages */}
        <ScrollArea ref={scrollAreaRef} className="h-96 w-full border rounded-md p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="space-y-2">
                <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 ${
                    message.type === 'user' 
                      ? 'bg-primary text-primary-foreground ml-12'
                      : message.type === 'ai'
                      ? 'bg-muted mr-12'
                      : 'bg-blue-50 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  }`}>
                    {message.type === 'ai' ? (
                      <div className="text-sm prose prose-sm max-w-none dark:prose-invert prose-p:mb-2 prose-ul:my-2 prose-ol:my-2 prose-li:mb-1 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-gray-100 prose-pre:p-2 prose-pre:rounded-md prose-pre:text-xs prose-a:text-blue-600 hover:prose-a:text-blue-800">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkBreaks]}
                          components={{
                            // External links
                            a: ({ href, children, ...props }) => (
                              <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                                {children}
                              </a>
                            )
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                    )}
                    <div className="text-xs opacity-70 mt-1 flex items-center gap-2">
                      <span>{message.timestamp.toLocaleTimeString()}</span>
                      {message.type === 'ai' && message.metadata && (
                        <span className="flex items-center gap-1">
                          {message.metadata.source === 'rag' && (
                            <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs font-medium dark:bg-green-900 dark:text-green-200">
                              RAG ({message.metadata.chunksUsed}개 청크)
                            </span>
                          )}
                          {message.metadata.source === 'summary' && (
                            <span className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded text-xs font-medium dark:bg-yellow-900 dark:text-yellow-200">
                              요약 사용
                            </span>
                          )}
                          {message.metadata.source === 'none' && (
                            <span className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs font-medium dark:bg-gray-900 dark:text-gray-200">
                              일반 응답
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Suggested Questions */}
                {message.suggested_questions && message.suggested_questions.length > 0 && (
                  <div className="flex flex-wrap gap-2 ml-4">
                    {message.suggested_questions.map((question, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSuggestedQuestion(question)}
                        disabled={isLoading}
                        className="text-xs h-8"
                      >
                        {question}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3 mr-12">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator />


        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="질문을 입력하세요..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !inputMessage.trim()}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
    </div>
  )
}