"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Zap, Crown, Settings } from "lucide-react";
import { useAuth } from "@/components/auth-context";
import { getUserSubscriptionTier, getSubscriptionLimits, type SubscriptionTier } from "@/app/lib/auth-utils";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";

export function SubscriptionManager() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState<SubscriptionTier | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const currentTier = getUserSubscriptionTier(user);
  const currentLimits = getSubscriptionLimits(currentTier);

  const handleUpgrade = async (tier: SubscriptionTier) => {
    if (!user || tier === currentTier) return;

    setIsLoading(tier);
    
    try {
      // Here you would integrate with a payment processor like Stripe
      // For demonstration, we'll simulate the upgrade process
      console.log(`Upgrading to ${tier} plan...`);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In a real app, you would:
      // 1. Create a Stripe checkout session
      // 2. Redirect to payment
      // 3. Handle webhook to update user subscription
      // 4. Update user metadata in Supabase
      
      alert(`Upgrade to ${tier} plan initiated. In a real app, this would redirect to payment.`);
      setIsOpen(false);
      
    } catch (error) {
      console.error('Upgrade error:', error);
      alert('Upgrade failed. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  const handleDowngrade = async () => {
    if (!user || currentTier === 'free') return;

    try {
      console.log('Downgrading to free plan...');
      // In a real app, you would cancel the subscription
      alert('Downgrade to free plan initiated. Changes will take effect at the end of your billing period.');
      setIsOpen(false);
    } catch (error) {
      console.error('Downgrade error:', error);
      alert('Downgrade failed. Please try again.');
    }
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Manage Plan
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Subscription Management</DialogTitle>
          <DialogDescription>
            Manage your subscription plan and billing preferences
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Plan */}
          <Card className="border-primary">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {currentTier === 'free' && <Star className="h-5 w-5" />}
                    {currentTier === 'pro' && <Zap className="h-5 w-5" />}
                    {currentTier === 'pro_plus' && <Crown className="h-5 w-5" />}
                    {currentTier === 'admin' && <Settings className="h-5 w-5" />}
                    Current Plan: {currentTier.replace('_', ' ').toUpperCase()}
                  </CardTitle>
                  <CardDescription>
                    Your current subscription tier and usage limits
                  </CardDescription>
                </div>
                <Badge variant="secondary">Active</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {currentLimits.summariesPerDay === -1 ? '∞' : currentLimits.summariesPerDay}
                  </div>
                  <div className="text-sm text-muted-foreground">Daily Summaries</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {currentLimits.promptTypes.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Summary Types</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {currentLimits.maxVideoLength === -1 
                      ? '∞' 
                      : `${Math.floor(currentLimits.maxVideoLength / 60)}m`
                    }
                  </div>
                  <div className="text-sm text-muted-foreground">Max Video Length</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary capitalize">
                    {currentLimits.priority}
                  </div>
                  <div className="text-sm text-muted-foreground">Priority</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upgrade Options */}
          {currentTier !== 'admin' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Upgrade Options</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {currentTier === 'free' && (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Zap className="h-5 w-5" />
                          Pro Plan
                        </CardTitle>
                        <CardDescription>$9.99/month</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 text-sm">
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            25 summaries per day
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            Multiple summary formats
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            Videos up to 1 hour
                          </li>
                        </ul>
                        <Button 
                          className="w-full mt-4" 
                          onClick={() => handleUpgrade('pro')}
                          disabled={isLoading === 'pro'}
                        >
                          {isLoading === 'pro' ? 'Processing...' : 'Upgrade to Pro'}
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Crown className="h-5 w-5" />
                          Pro+ Plan
                        </CardTitle>
                        <CardDescription>$19.99/month</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 text-sm">
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            100 summaries per day
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            All summary formats
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            Videos up to 3 hours
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            Premium AI models
                          </li>
                        </ul>
                        <Button 
                          className="w-full mt-4" 
                          onClick={() => handleUpgrade('pro_plus')}
                          disabled={isLoading === 'pro_plus'}
                        >
                          {isLoading === 'pro_plus' ? 'Processing...' : 'Upgrade to Pro+'}
                        </Button>
                      </CardContent>
                    </Card>
                  </>
                )}

                {currentTier === 'pro' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Crown className="h-5 w-5" />
                        Pro+ Plan
                      </CardTitle>
                      <CardDescription>$19.99/month</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          100 summaries per day
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          Premium AI models
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          Detailed analysis mode
                        </li>
                      </ul>
                      <Button 
                        className="w-full mt-4" 
                        onClick={() => handleUpgrade('pro_plus')}
                        disabled={isLoading === 'pro_plus'}
                      >
                        {isLoading === 'pro_plus' ? 'Processing...' : 'Upgrade to Pro+'}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* Downgrade Option */}
          {currentTier !== 'free' && currentTier !== 'admin' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Downgrade Options</h3>
              <Card className="border-destructive">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">Cancel Subscription</h4>
                      <p className="text-sm text-muted-foreground">
                        Downgrade to free plan at the end of your billing period
                      </p>
                    </div>
                    <Button variant="destructive" onClick={handleDowngrade}>
                      Cancel Subscription
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}