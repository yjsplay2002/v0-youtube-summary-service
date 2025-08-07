"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Zap, Crown } from "lucide-react";
import { useAuth } from "@/components/auth-context";
import { getUserSubscriptionTier, getSubscriptionLimits, type SubscriptionTier } from "@/app/lib/auth-utils";

interface PricingTier {
  id: SubscriptionTier;
  name: string;
  price: string;
  priceMonthly: number;
  description: string;
  features: string[];
  buttonText: string;
  popular?: boolean;
  icon: React.ReactNode;
}

const pricingTiers: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    price: 'Free',
    priceMonthly: 0,
    description: 'Perfect for trying out our service',
    features: [
      '3 summaries per day',
      'Basic summary format',
      'Videos up to 30 minutes',
      'Claude 3.5 Haiku model'
    ],
    buttonText: 'Get Started Free',
    icon: <Star className="h-6 w-6" />
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$9.99/mo',
    priceMonthly: 9.99,
    description: 'For regular users who need more summaries',
    features: [
      '25 summaries per day',
      'Multiple summary formats',
      'Videos up to 1 hour',
      'Claude 3.5 Haiku & Sonnet models',
      'Priority processing'
    ],
    buttonText: 'Upgrade to Pro',
    popular: true,
    icon: <Zap className="h-6 w-6" />
  },
  {
    id: 'pro_plus',
    name: 'Pro+',
    price: '$19.99/mo',
    priceMonthly: 19.99,
    description: 'For power users and professionals',
    features: [
      '100 summaries per day',
      'All summary formats',
      'Videos up to 3 hours',
      'Premium Claude Sonnet 4 model',
      'Detailed analysis mode',
      'Highest priority processing'
    ],
    buttonText: 'Upgrade to Pro+',
    icon: <Crown className="h-6 w-6" />
  }
];

export function PricingSection() {
  const { user, signInWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState<SubscriptionTier | null>(null);
  const currentTier = getUserSubscriptionTier(user);

  const handleSubscribe = async (tier: SubscriptionTier) => {
    if (!user) {
      await signInWithGoogle();
      return;
    }

    if (tier === 'free') {
      return; // Free tier doesn't need subscription
    }

    setIsLoading(tier);
    
    try {
      // Here you would integrate with a payment processor like Stripe
      // For now, we'll just show an alert
      alert(`Subscription to ${tier} plan would be handled by payment processor`);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error('Subscription error:', error);
    } finally {
      setIsLoading(null);
    }
  };

  const getButtonVariant = (tier: SubscriptionTier) => {
    if (currentTier === tier) return "outline";
    if (tier === 'pro') return "default";
    return "outline";
  };

  const getButtonText = (tier: SubscriptionTier) => {
    if (currentTier === tier) return "Current Plan";
    return pricingTiers.find(t => t.id === tier)?.buttonText || "Subscribe";
  };

  return (
    <section id="pricing" className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Choose Your Plan</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Start free and upgrade as your needs grow. All plans include our core summarization features.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {pricingTiers.map((tier) => {
            const limits = getSubscriptionLimits(tier.id);
            const isCurrentTier = currentTier === tier.id;
            
            return (
              <Card key={tier.id} className={`relative ${tier.popular ? 'border-primary shadow-lg scale-105' : ''} ${isCurrentTier ? 'ring-2 ring-primary' : ''}`}>
                {tier.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}
                
                <CardHeader className="text-center">
                  <div className="flex justify-center mb-2">
                    {tier.icon}
                  </div>
                  <CardTitle className="text-2xl">{tier.name}</CardTitle>
                  <div className="text-3xl font-bold">{tier.price}</div>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-3">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Button
                    className="w-full"
                    variant={getButtonVariant(tier.id)}
                    onClick={() => handleSubscribe(tier.id)}
                    disabled={isLoading === tier.id || isCurrentTier}
                  >
                    {isLoading === tier.id ? "Processing..." : getButtonText(tier.id)}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {user && currentTier !== 'free' && (
          <div className="text-center mt-8">
            <p className="text-sm text-muted-foreground">
              Current plan: <span className="font-semibold capitalize">{currentTier.replace('_', ' ')}</span>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}