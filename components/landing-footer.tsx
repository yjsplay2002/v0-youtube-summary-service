import Link from "next/link"
import { Play } from "lucide-react"

export function LandingFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Play className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">YouTube Summarizer</span>
            </Link>
            <p className="text-muted-foreground mb-4 max-w-md">
              Transform YouTube videos into powerful summaries using AI. 
              Save time and get key insights from any video content.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4">Product</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/app" className="hover:text-foreground">Try App</Link></li>
              <li><Link href="/#pricing" className="hover:text-foreground">Pricing</Link></li>
              <li><Link href="/community" className="hover:text-foreground">Community</Link></li>
              <li><Link href="/feedback" className="hover:text-foreground">Feedback</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4">Support</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="mailto:support@example.com" className="hover:text-foreground">Contact</a></li>
              <li><Link href="/community" className="hover:text-foreground">Help Center</Link></li>
              <li><a href="#" className="hover:text-foreground">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-foreground">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; 2024 YouTube Summarizer. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}