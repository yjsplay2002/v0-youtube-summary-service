"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Play, ArrowRight, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth-context";
import { extractYoutubeVideoId } from "@/components/youtube-form-utils";
import { useRouter } from "next/navigation";

export function HeroSection() {
  const [demoUrl, setDemoUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { user, signInWithGoogle } = useAuth();
  const router = useRouter();

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoUrl.trim()) return;

    const videoId = extractYoutubeVideoId(demoUrl);
    if (!videoId) {
      alert("Please enter a valid YouTube URL");
      return;
    }

    setIsLoading(true);
    
    // Navigate to the main page with the video ID
    router.push(`/?videoId=${videoId}`);
  };

  const handleGetStarted = async () => {
    if (!user) {
      await signInWithGoogle();
    } else {
      // Scroll to the main form or navigate to it
      const element = document.getElementById('youtube-form');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <section className="relative py-20 lg:py-32 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
      
      <div className="container mx-auto px-4 relative">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <Badge variant="secondary" className="mb-6 px-4 py-2">
            <Sparkles className="h-4 w-4 mr-2" />
            AI-Powered Video Summarization
          </Badge>

          {/* Main heading */}
          <h1 className="text-4xl lg:text-6xl font-bold mb-6 leading-tight">
            Transform <span className="text-primary">YouTube Videos</span> into 
            <span className="block">Actionable Summaries</span>
          </h1>

          {/* Subheading */}
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
            Save hours of watching time. Get comprehensive, structured summaries of any YouTube video 
            in seconds using advanced AI technology.
          </p>

          {/* Demo form */}
          <form onSubmit={handleDemoSubmit} className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto mb-8">
            <Input
              type="url"
              placeholder="Paste YouTube URL here to try..."
              value={demoUrl}
              onChange={(e) => setDemoUrl(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading} className="whitespace-nowrap">
              {isLoading ? (
                "Processing..."
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Try Demo
                </>
              )}
            </Button>
          </form>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button size="lg" onClick={handleGetStarted} className="text-lg px-8">
              Get Started Free
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => {
              document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
            }}>
              Learn More
            </Button>
          </div>

          {/* Social proof */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">10,000+</div>
              <div className="text-sm text-muted-foreground">Videos Summarized</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">5 Min</div>
              <div className="text-sm text-muted-foreground">Average Time Saved</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">99%</div>
              <div className="text-sm text-muted-foreground">Accuracy Rate</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}