import { LandingHero } from "@/components/landing-hero"
import { PricingSection } from "@/components/pricing-section"
import { LandingNavigation } from "@/components/landing-navigation"
import { LandingFooter } from "@/components/landing-footer"

export default function Home() {
  return (
    <div className="min-h-screen">
      <LandingNavigation />
      <LandingHero />
      <PricingSection />
      <LandingFooter />
    </div>
  )
}
