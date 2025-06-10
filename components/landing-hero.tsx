import { Button } from "@/components/ui/button"
import { ArrowRight, Play, Zap, Shield, Star } from "lucide-react"
import Link from "next/link"

export function LandingHero() {
  return (
    <section className="py-20 px-4 text-center">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-sm text-primary mb-6">
            <Zap className="w-4 h-4" />
            AI-Powered Video Summarization
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Transform YouTube Videos into Powerful Summaries
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Save hours of watching time by getting AI-powered summaries of any YouTube video. 
            Perfect for research, learning, and content creation.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link href="/app">
            <Button size="lg" className="text-lg px-8 py-3">
              Get Started Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
          <Button variant="outline" size="lg" className="text-lg px-8 py-3">
            <Play className="mr-2 w-5 h-5" />
            Watch Demo
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Lightning Fast</h3>
            <p className="text-muted-foreground">Get summaries in seconds with our advanced AI models</p>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Secure & Private</h3>
            <p className="text-muted-foreground">Your data is protected with enterprise-grade security</p>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Star className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Premium Quality</h3>
            <p className="text-muted-foreground">Structured markdown summaries with key insights</p>
          </div>
        </div>
      </div>
    </section>
  )
}