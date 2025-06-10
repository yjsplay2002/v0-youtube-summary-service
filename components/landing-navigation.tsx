import { Button } from "@/components/ui/button"
import { AuthButton } from "@/components/auth-button"
import Link from "next/link"
import { Play } from "lucide-react"

export function LandingNavigation() {
  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Play className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">YouTube Summarizer</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <Link href="/app">
            <Button variant="ghost">Try App</Button>
          </Link>
          <Link href="/community">
            <Button variant="ghost">Community</Button>
          </Link>
          <AuthButton />
        </div>
      </div>
    </nav>
  )
}