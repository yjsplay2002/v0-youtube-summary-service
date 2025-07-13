import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { LayoutWrapper } from "@/components/layout-wrapper"
import { Suspense } from "react"
import { SummaryProvider } from "@/components/summary-context"
import { ResetProvider } from "@/components/reset-context"
import { AuthProvider } from "@/components/auth-context"
import { AuthErrorHandler } from "@/components/auth-error-handler"
import { generateWebApplicationStructuredData } from "@/app/lib/structured-data"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { I18nProvider } from "@/hooks/use-i18n"

export const metadata: Metadata = {
  title: "YouTube Video Summarizer - AI-Powered Video Summary Tool",
  description: "Transform YouTube videos into concise, structured markdown summaries using AI. Save time by getting key insights from any video in seconds.",
  keywords: "YouTube summarizer, video summary, AI video analysis, markdown conversion, video transcript, content analysis",
  authors: [{ name: "YouTube Summarizer Team" }],
  creator: "YouTube Summarizer",
  publisher: "YouTube Summarizer",
  robots: "index, follow",
  openGraph: {
    title: "YouTube Video Summarizer - AI-Powered Video Summary Tool",
    description: "Transform YouTube videos into concise, structured markdown summaries using AI. Save time by getting key insights from any video in seconds.",
    type: "website",
    siteName: "YouTube Video Summarizer",
    images: [
      {
        url: "/placeholder.jpg",
        width: 1200,
        height: 630,
        alt: "YouTube Video Summarizer - Transform videos into summaries"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "YouTube Video Summarizer - AI-Powered Video Summary Tool",
    description: "Transform YouTube videos into concise, structured markdown summaries using AI.",
    images: ["/placeholder.jpg"]
  },
  alternates: {
    canonical: "/"
  },
  generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const webAppStructuredData = generateWebApplicationStructuredData();
  
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(webAppStructuredData),
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // YouTube iframe CORS 에러 무시
              window.addEventListener('error', function(e) {
                if (e.message && e.message.includes('postMessage') && e.message.includes('youtube.com')) {
                  e.preventDefault();
                  return false;
                }
              }, true);
              
              // unhandledrejection 이벤트로 Promise 에러도 처리
              window.addEventListener('unhandledrejection', function(e) {
                if (e.reason && e.reason.message && e.reason.message.includes('postMessage') && e.reason.message.includes('youtube.com')) {
                  e.preventDefault();
                  return false;
                }
              });
            `,
          }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem={true}
          disableTransitionOnChange
        >
          <I18nProvider>
            <AuthProvider>
              <AuthErrorHandler />
              <SummaryProvider>
                <ResetProvider>
                  <Suspense fallback={<div>Loading...</div>}>
                    <LayoutWrapper>
                      {children}
                    </LayoutWrapper>
                  </Suspense>
                </ResetProvider>
              </SummaryProvider>
            </AuthProvider>
            <Toaster />
            <SonnerToaster />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
