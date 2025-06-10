import { LandingHero } from "@/components/landing-hero"
import { PricingSection } from "@/components/pricing-section"

export default function Home() {
  return (
    <div className="min-h-screen">
      <LandingHero />
      <PricingSection />
    </div>
  )
}
