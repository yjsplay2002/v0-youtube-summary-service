"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, Check } from "lucide-react"

export function SummaryDisplayClient({ summary, seekTo }: { summary: string; seekTo: (seconds: number) => void }) {
  console.log("[SummaryDisplayClient] summary prop:", summary, "type:", typeof summary, "length:", summary?.length);
  const [copied, setCopied] = useState(false)

  // Convert summary to interview format with timestamp support
  const convertToInterview = (content: string): string => {
    // Split content into sections
    const sections = content.split('\n\n').filter(section => section.trim() !== '');
    
    let interview = '';
    let currentSpeaker = 'Q';
    
    for (const section of sections) {
      // Skip timestamps and section headers
      if (section.startsWith('🕒') || section.startsWith('📝') || section.startsWith('---')) {
        continue;
      }
      
      // Skip empty sections
      if (section.trim() === '') continue;
      
      // Process section content with timestamps
      const processedSection = renderMarkdownWithTimestamps(section);
      
      // Add speaker label
      interview += `<div class="mb-4">
        <div class="font-semibold text-blue-600">${currentSpeaker}.</div>
        <div class="ml-4">${processedSection}</div>
      </div>`;
      
      // Toggle between Q and A
      currentSpeaker = currentSpeaker === 'Q' ? 'A' : 'Q';
    }
    
    return interview || '<div class="text-muted-foreground">대화 형식으로 변환할 내용이 없습니다.</div>';
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

  // 마크다운 내 다양한 타임스탬프 형식을 버튼으로 변환
  function renderMarkdownWithTimestamps(markdown: string): string {
    // 1. [hh:mm:ss](링크) → simple link (시:분:초 형식)
    markdown = markdown.replace(/\[(\d{1,2}):(\d{2}):(\d{2})\]\([^\)]+\)/g, (_, h, m, s) => {
      const seconds = parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10);
      return `<span class='text-sky-500 hover:text-sky-600 underline cursor-pointer timestamp-btn transition-colors' data-seconds='${seconds}'>${h}:${m}:${s}</span>`;
    });
    
    // 2. [mm:ss](링크) → simple link (분:초 형식)
    markdown = markdown.replace(/\[(\d{1,2}):(\d{2})\]\([^\)]+\)/g, (_, m, s) => {
      const seconds = parseInt(m, 10) * 60 + parseInt(s, 10);
      return `<span class='text-sky-500 hover:text-sky-600 underline cursor-pointer timestamp-btn transition-colors' data-seconds='${seconds}'>${m}:${s}</span>`;
    });
    
    // 3. [hh:mm:ss] 단독 → simple link (시:분:초 형식)
    markdown = markdown.replace(/\[(\d{1,2}):(\d{2}):(\d{2})\]/g, (_, h, m, s) => {
      const seconds = parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10);
      return `<span class='text-sky-500 hover:text-sky-600 underline cursor-pointer timestamp-btn transition-colors' data-seconds='${seconds}'>[${h}:${m}:${s}]</span>`;
    });
    
    // 4. [mm:ss] 단독 → simple link (분:초 형식)
    markdown = markdown.replace(/\[(\d{1,2}):(\d{2})\]/g, (_, m, s) => {
      const seconds = parseInt(m, 10) * 60 + parseInt(s, 10);
      return `<span class='text-sky-500 hover:text-sky-600 underline cursor-pointer timestamp-btn transition-colors' data-seconds='${seconds}'>[${m}:${s}]</span>`;
    });
    
    // 5. 괄호 없는 타임스탬프도 지원 (hh:mm:ss, mm:ss)
    // 단어 경계를 사용하여 실제 시간 형식만 매칭
    markdown = markdown.replace(/\b(\d{1,2}):(\d{2}):(\d{2})\b/g, (_, h, m, s) => {
      const seconds = parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10);
      return `<span class='text-blue-500 hover:text-blue-600 underline cursor-pointer timestamp-btn transition-colors' data-seconds='${seconds}'>${h}:${m}:${s}</span>`;
    });
    
    markdown = markdown.replace(/\b(\d{1,2}):(\d{2})\b/g, (_, m, s) => {
      const minutes = parseInt(m, 10);
      const secs = parseInt(s, 10);
      // 유효한 시간 형식인지 확인 (분은 60미만, 초는 60미만)
      if (secs >= 60) return `${m}:${s}`;
      const totalSeconds = minutes * 60 + secs;
      return `<span class='text-blue-500 hover:text-blue-600 underline cursor-pointer timestamp-btn transition-colors' data-seconds='${totalSeconds}'>${m}:${s}</span>`;
    });
    
    return renderMarkdown(markdown);
  }

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
          <TabsContent value="preview" className="prose max-w-none dark:prose-invert">
            <div
              dangerouslySetInnerHTML={{ __html: renderMarkdownWithTimestamps(summary) }}
              onClick={e => {
                // 타임스탬프 버튼 클릭 시
                const target = e.target as HTMLElement;
                if (target.classList.contains('timestamp-btn')) {
                  e.preventDefault(); // 링크 이동 차단
                  const seconds = Number(target.getAttribute('data-seconds'));
                  if (!isNaN(seconds)) handleTimestampClick(seconds);
                }
              }}
            />
          </TabsContent>
          <TabsContent value="interview" className="prose max-w-none dark:prose-invert">
            <div
              dangerouslySetInnerHTML={{ __html: convertToInterview(summary) }}
              className="space-y-4"
              onClick={e => {
                // 타임스탬프 버튼 클릭 시 (Interview 탭)
                const target = e.target as HTMLElement;
                if (target.classList.contains('timestamp-btn')) {
                  e.preventDefault();
                  const seconds = Number(target.getAttribute('data-seconds'));
                  if (!isNaN(seconds)) handleTimestampClick(seconds);
                }
              }}
            />
          </TabsContent>
          <TabsContent value="markdown">
            <pre className="p-4 bg-muted rounded-md overflow-auto whitespace-pre-wrap">{summary}</pre>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// 기존 마크다운 렌더 함수 활용
function renderMarkdown(markdown: string): string {
  return markdown
    .replace(/^# (.*$)/gm, "<h1>$1</h1>")
    .replace(/^## (.*$)/gm, "<h2>$1</h2>")
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^- (.*$)/gm, "<li>$1</li>")
    .replace(/^🔹 (.*$)/gm, "<strong>🔹 $1</strong>")
    .replace(/^📍 (.*$)/gm, "<h3 class='text-blue-600'>📍 $1</h3>")
    .replace(/^🕒 (.*$)/gm, "<p class='text-gray-500'>🕒 $1</p>")
    .replace(/^📝 요약: (.*$)/gm, "<p class='bg-gray-100 p-2 rounded my-2'>📝 <strong>요약:</strong> $1</p>")
    .replace(/---/g, "<hr class='my-4'>")
    .replace(
      /(#\w+)/g,
      "<span class='inline-block bg-blue-100 text-blue-800 rounded-full px-2 py-1 text-xs font-semibold mr-1 mb-1'>$1</span>",
    )
    // 마크다운 링크 [텍스트](링크) → <a href="링크" target="_blank">텍스트</a>
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n/g, "<br />");
}
