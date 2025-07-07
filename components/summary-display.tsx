"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, Check, Share2 } from "lucide-react"
import { SummaryChat } from "@/components/summary-chat"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

export function SummaryDisplayClient({ summary, seekTo, videoId }: { summary: string; seekTo: (seconds: number) => void; videoId?: string }) {
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)

  // Handle timestamp button clicks
  const handleTimestampClick = (seconds: number) => {
    console.log(`[SummaryDisplayClient] 타임스탬프 클릭: ${seconds}초로 이동`);
    seekTo(seconds);
    
    // 사용자에게 시각적 피드백 제공
    const button = document.activeElement as HTMLElement;
    if (button && button.classList.contains('timestamp-btn')) {
      const originalBg = button.style.backgroundColor;
      button.style.backgroundColor = '#22c55e'; // green-500
      button.style.transform = 'scale(0.95)';
      setTimeout(() => {
        button.style.backgroundColor = originalBg;
        button.style.transform = 'scale(1)';
      }, 200);
    }
  };


  const handleCopy = () => {
    if (summary) {
      navigator.clipboard.writeText(summary)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleShare = async () => {
    if (!videoId) return

    const shareUrl = `${window.location.origin}/?videoId=${videoId}`
    const shareText = `YouTube 요약: ${summary.split('\n')[0] || '비디오 요약'}`

    try {
      // Web Share API 지원 확인
      if (navigator.share) {
        await navigator.share({
          title: 'YouTube 비디오 요약',
          text: shareText,
          url: shareUrl
        })
        console.log('[SummaryDisplayClient] Web Share API로 공유 완료')
      } else {
        // 폴백: URL을 클립보드에 복사
        await navigator.clipboard.writeText(shareUrl)
        setShared(true)
        setTimeout(() => setShared(false), 2000)
        console.log('[SummaryDisplayClient] URL 클립보드에 복사 완료')
      }
    } catch (error) {
      console.error('[SummaryDisplayClient] 공유 실패:', error)
      
      // 에러 발생 시 폴백: URL을 클립보드에 복사
      try {
        await navigator.clipboard.writeText(shareUrl)
        setShared(true)
        setTimeout(() => setShared(false), 2000)
        console.log('[SummaryDisplayClient] 폴백으로 URL 클립보드에 복사 완료')
      } catch (clipboardError) {
        console.error('[SummaryDisplayClient] 클립보드 복사도 실패:', clipboardError)
      }
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Video Summary</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} className="flex items-center gap-1">
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy
              </>
            )}
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onClick={handleShare} 
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white"
            disabled={!videoId}
          >
            {shared ? (
              <>
                <Check className="h-4 w-4" />
                Shared
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                Share it
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="preview">
          <TabsList className="mb-4">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="chat">Ask to AI</TabsTrigger>
          </TabsList>
          <TabsContent value="preview" className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-bold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:mb-4 prose-li:mb-1 prose-ul:my-4 prose-ol:my-4 prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-md prose-pre:overflow-auto prose-a:text-blue-600 hover:prose-a:text-blue-800 prose-strong:font-bold prose-em:italic">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              components={{
                // Custom link renderer for timestamps
                a: ({ href, children, ...props }) => {
                  // Check if this is a timestamp link
                  const timestampMatch = href?.match(/[&?]t=(\d+)s?$/);
                  if (timestampMatch) {
                    const seconds = parseInt(timestampMatch[1]);
                    return (
                      <span
                        className="text-sky-500 hover:text-sky-600 underline cursor-pointer timestamp-btn transition-colors font-medium"
                        onClick={(e) => {
                          e.preventDefault();
                          handleTimestampClick(seconds);
                        }}
                        {...props}
                      >
                        {children}
                      </span>
                    );
                  }
                  // Regular external link - let prose handle styling
                  return (
                    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                      {children}
                    </a>
                  );
                }
              }}
            >
              {summary?.replace(/^(#{1,6})\s+(.+?)\s+\1\s*$/gm, '$1 $2')}
            </ReactMarkdown>
          </TabsContent>
          <TabsContent value="chat">
            {videoId && (
              <SummaryChat summary={summary} videoId={videoId} />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

