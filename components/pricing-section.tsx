import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Check, X, Star, Zap, Crown } from "lucide-react"
import Link from "next/link"

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    description: "Perfect for trying out our service",
    icon: Zap,
    features: [
      "5 summaries per month",
      "Claude 3.5 Haiku model",
      "Basic markdown output",
      "Email support",
      "Community access"
    ],
    limitations: [
      "Video length up to 30 minutes",
      "No priority processing",
      "Standard quality summaries"
    ],
    cta: "Get Started",
    ctaVariant: "outline" as const,
    popular: false
  },
  {
    name: "Pro",
    price: "$9.99",
    period: "/month",
    description: "Best for regular users and content creators",
    icon: Star,
    features: [
      "100 summaries per month", 
      "Claude 3.5 Sonnet model",
      "Enhanced markdown with insights",
      "Priority email support",
      "Export to multiple formats",
      "Custom summary templates"
    ],
    limitations: [
      "Video length up to 2 hours"
    ],
    cta: "Start Pro",
    ctaVariant: "default" as const,
    popular: true
  },
  {
    name: "Pro+",
    price: "$19.99", 
    period: "/month",
    description: "For power users and businesses",
    icon: Crown,
    features: [
      "Unlimited summaries",
      "All AI models (Claude, GPT-4)",
      "Advanced insights & analytics",
      "Priority support & chat",
      "API access",
      "Team collaboration",
      "Custom integrations",
      "Bulk processing"
    ],
    limitations: [],
    cta: "Go Pro+",
    ctaVariant: "default" as const,
    popular: false
  }
]

const featureComparison = [
  { feature: "Monthly Summaries", free: "5", pro: "100", proPlus: "Unlimited" },
  { feature: "Video Length Limit", free: "30 min", pro: "2 hours", proPlus: "No limit" },
  { feature: "AI Models", free: "Haiku", pro: "Haiku + Sonnet", proPlus: "All models" },
  { feature: "Export Formats", free: "Markdown", pro: "MD, PDF, DOCX", proPlus: "All formats" },
  { feature: "Priority Processing", free: false, pro: true, proPlus: true },
  { feature: "Custom Templates", free: false, pro: true, proPlus: true },
  { feature: "Analytics", free: false, pro: "Basic", proPlus: "Advanced" },
  { feature: "API Access", free: false, pro: false, proPlus: true },
  { feature: "Team Features", free: false, pro: false, proPlus: true },
  { feature: "Support", free: "Email", pro: "Priority Email", proPlus: "Chat + Phone" }
]

export function PricingSection() {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Choose Your Plan
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start free and upgrade as you grow. All plans include our core summarization features.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {pricingPlans.map((plan) => {
            const IconComponent = plan.icon
            return (
              <Card key={plan.name} className={`relative ${plan.popular ? 'border-primary ring-2 ring-primary/20' : ''}`}>
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary">
                    Most Popular
                  </Badge>
                )}
                
                <CardHeader className="text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <IconComponent className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2 text-green-600">✓ Included</h4>
                    <ul className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {plan.limitations.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2 text-muted-foreground">Limitations</h4>
                      <ul className="space-y-2">
                        {plan.limitations.map((limitation, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <X className="w-4 h-4 flex-shrink-0" />
                            {limitation}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>

                <CardFooter>
                  <Link href="/app" className="w-full">
                    <Button variant={plan.ctaVariant} className="w-full">
                      {plan.cta}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            )
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="mt-16">
          <h3 className="text-2xl font-bold text-center mb-8">Feature Comparison</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/4">Feature</TableHead>
                  <TableHead className="text-center">Free</TableHead>
                  <TableHead className="text-center">Pro</TableHead>
                  <TableHead className="text-center">Pro+</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {featureComparison.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{row.feature}</TableCell>
                    <TableCell className="text-center">
                      {typeof row.free === 'boolean' ? (
                        row.free ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <X className="w-4 h-4 text-muted-foreground mx-auto" />
                      ) : (
                        row.free
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {typeof row.pro === 'boolean' ? (
                        row.pro ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <X className="w-4 h-4 text-muted-foreground mx-auto" />
                      ) : (
                        row.pro
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {typeof row.proPlus === 'boolean' ? (
                        row.proPlus ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <X className="w-4 h-4 text-muted-foreground mx-auto" />
                      ) : (
                        row.proPlus
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </section>
  )
}