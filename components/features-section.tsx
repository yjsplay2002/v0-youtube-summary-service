"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Video, 
  Zap, 
  Brain, 
  FileText, 
  Clock, 
  Shield,
  Users,
  Sparkles,
  Globe
} from "lucide-react";

const features = [
  {
    icon: <Video className="h-8 w-8" />,
    title: "YouTube Integration",
    description: "Paste any YouTube URL and get instant summaries. Supports videos of all lengths and formats.",
    badge: "Core Feature"
  },
  {
    icon: <Brain className="h-8 w-8" />,
    title: "AI-Powered Analysis",
    description: "Multiple AI models including Claude 3.5 Haiku, Sonnet, and premium Claude Sonnet 4 for best results.",
    badge: "AI Technology"
  },
  {
    icon: <FileText className="h-8 w-8" />,
    title: "Multiple Formats",
    description: "Choose from general summaries, discussion formats, or detailed analysis based on your needs.",
    badge: "Flexible Output"
  },
  {
    icon: <Zap className="h-8 w-8" />,
    title: "Lightning Fast",
    description: "Get comprehensive summaries in seconds, not minutes. Our optimized processing saves you time.",
    badge: "Speed"
  },
  {
    icon: <Clock className="h-8 w-8" />,
    title: "Time Savings",
    description: "Transform hours of video content into digestible summaries. Perfect for research and learning.",
    badge: "Productivity"
  },
  {
    icon: <Shield className="h-8 w-8" />,
    title: "Secure & Private",
    description: "Your data is protected with enterprise-grade security. No video content is stored permanently.",
    badge: "Security"
  },
  {
    icon: <Users className="h-8 w-8" />,
    title: "Team Collaboration",
    description: "Share summaries with your team and build a knowledge base from video content.",
    badge: "Collaboration"
  },
  {
    icon: <Sparkles className="h-8 w-8" />,
    title: "Smart Formatting",
    description: "Automatically formatted markdown output with headers, bullet points, and key insights highlighted.",
    badge: "Intelligence"
  },
  {
    icon: <Globe className="h-8 w-8" />,
    title: "Multi-Language",
    description: "Supports videos in multiple languages with accurate transcription and translation capabilities.",
    badge: "Global"
  }
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Powerful Features</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Everything you need to transform video content into actionable insights
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      {feature.icon}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{feature.title}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {feature.badge}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}