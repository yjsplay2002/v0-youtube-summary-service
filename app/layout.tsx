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

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "YouTube Video Summarizer",
  description: "Convert YouTube videos into summarized markdown content",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
