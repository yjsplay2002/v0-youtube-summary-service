import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { LayoutWrapper } from "@/components/layout-wrapper"
import { Suspense } from "react"
import { SummaryProvider } from "@/components/summary-context"
import { ResetProvider } from "@/components/reset-context"
import { AuthProvider } from "@/components/auth-context"
import { generateWebApplicationStructuredData } from "@/app/lib/structured-data"

const inter = Inter({ subsets: ["latin"] })

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
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <AuthProvider>
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
        </ThemeProvider>
      </body>
    </html>
  )
}
