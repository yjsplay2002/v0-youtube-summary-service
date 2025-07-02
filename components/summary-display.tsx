"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, Check } from "lucide-react"
import { SummaryChat } from "@/components/summary-chat"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

export function SummaryDisplayClient({ summary, seekTo, videoId }: { summary: string; seekTo: (seconds: number) => void; videoId?: string }) {
  const [copied, setCopied] = useState(false)

  // Convert summary to interview format sections
  const convertToInterviewSections = (content: string): Array<{speaker: string, content: string}> => {
    // Split content into sections
    const sections = content.split('\n\n').filter(section => section.trim() !== '');
    
    const interviewSections = [];
    let currentSpeaker = 'Q';
    
    for (const section of sections) {
      // Skip timestamps and section headers
      if (section.startsWith('🕒') || section.startsWith('📝') || section.startsWith('---')) {
        continue;
      }
      
      // Skip empty sections
      if (section.trim() === '') continue;
      
      // Add section to interview
      interviewSections.push({
        speaker: currentSpeaker,
        content: section.trim()
      });
      
      // Toggle between Q and A
      currentSpeaker = currentSpeaker === 'Q' ? 'A' : 'Q';
    }
    
    return interviewSections.length > 0 ? interviewSections : [{
      speaker: 'Q',
      content: '대화 형식으로 변환할 내용이 없습니다.'
    }];
  };

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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Video Summary</CardTitle>
        <Button variant="outline" size="sm" onClick={handleCopy} className="flex items-center gap-1">
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy Markdown
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="preview">
          <TabsList className="mb-4">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="interview">Interview</TabsTrigger>
            <TabsTrigger value="markdown">Markdown</TabsTrigger>
          </TabsList>
          <TabsContent value="preview" className="prose prose-lg max-w-none dark:prose-invert prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:mb-4 prose-li:mb-1 prose-ul:my-4 prose-ol:my-4 prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-md prose-pre:overflow-auto prose-a:text-blue-600 hover:prose-a:text-blue-800 prose-strong:font-bold prose-em:italic">
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
              {summary}
            </ReactMarkdown>
          </TabsContent>
          <TabsContent value="interview" className="space-y-6">
            {convertToInterviewSections(summary).map((section, index) => (
              <div key={index} className="border-l-4 border-blue-200 pl-4 py-2">
                <div className="font-semibold text-blue-600 text-lg mb-2">{section.speaker}.</div>
                <div className="prose prose-sm max-w-none dark:prose-invert prose-p:mb-2 prose-ul:my-2 prose-ol:my-2 prose-li:mb-1">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={{
                      a: ({ href, children, ...props }) => {
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
                        return (
                          <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                            {children}
                          </a>
                        );
                      }
                    }}
                  >
                    {section.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="markdown">
            <div className="bg-muted p-4 rounded-md">
              <pre className="whitespace-pre-wrap text-sm font-mono overflow-auto max-h-96">
                {summary}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      {/* AI Chat Section */}
      {videoId && (
        <div className="mt-6">
          <SummaryChat summary={summary} videoId={videoId} />
        </div>
      )}
    </Card>
  );
}

