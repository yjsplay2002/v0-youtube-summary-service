"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, Check } from "lucide-react"
import { useVideoPlayer } from "@/components/VideoPlayerContext"

export function SummaryDisplayClient({ summary }: { summary: string }) {
  console.log("[SummaryDisplayClient] summary prop:", summary, "type:", typeof summary, "length:", summary?.length);
  const [copied, setCopied] = useState(false)
  const { seekTo } = useVideoPlayer();

  // 타임스탬프 버튼 클릭 시 호출
  const handleTimestampClick = (seconds: number) => {
    seekTo(seconds);
  };

  // 마크다운 내 타임스탬프 [mm:ss]를 버튼으로 변환
  function renderMarkdownWithTimestamps(markdown: string): string {
    // 1. [mm:ss](링크) → button (a 변환보다 먼저!)
    markdown = markdown.replace(/\[(\d{1,2}):(\d{2})\]\([^\)]+\)/g, (match, m, s) => {
      const seconds = parseInt(m, 10) * 60 + parseInt(s, 10);
      return `<button class='inline underline text-sky-400 cursor-pointer timestamp-btn' data-seconds='${seconds}'>[${m}:${s}]</button>`;
    });
    // 2. [mm:ss] 단독 → button
    markdown = markdown.replace(/\[(\d{1,2}):(\d{2})\]/g, (match, m, s) => {
      const seconds = parseInt(m, 10) * 60 + parseInt(s, 10);
      return `<button class='inline underline text-sky-400 cursor-pointer timestamp-btn' data-seconds='${seconds}'>${match}</button>`;
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
