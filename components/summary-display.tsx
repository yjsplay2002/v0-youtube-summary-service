"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, Check } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { getSummary } from "@/app/actions"

export function SummaryDisplay() {
  const [summary, setSummary] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const searchParams = useSearchParams()
  const videoId = searchParams.get("videoId")

  useEffect(() => {
    const fetchSummary = async () => {
      if (videoId) {
        const result = await getSummary(videoId)
        if (result) {
          setSummary(result)
        }
      }
    }

    fetchSummary()
  }, [videoId])

  const handleCopy = () => {
    if (summary) {
      navigator.clipboard.writeText(summary)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!videoId || !summary) {
    return null
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
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(summary) }} />
          </TabsContent>
          <TabsContent value="markdown">
            <pre className="p-4 bg-muted rounded-md overflow-auto whitespace-pre-wrap">{summary}</pre>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

// Simple markdown renderer (in a real app, you'd use a proper markdown library)
function renderMarkdown(markdown: string): string {
  return markdown
    .replace(/^# (.*$)/gm, "<h1>$1</h1>")
    .replace(/^## (.*$)/gm, "<h2>$1</h2>")
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br />")
}
