"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth-context";
import { getUserSubscriptionTier, getSubscriptionLimits } from "@/app/lib/auth-utils";
import { Clock, Video, Zap } from "lucide-react";

export function UsageTracker() {
  const { user } = useAuth();
  const [dailyUsage, setDailyUsage] = useState(0);
  const userTier = getUserSubscriptionTier(user);
  const userLimits = getSubscriptionLimits(userTier);

  useEffect(() => {
    // In a real app, you would fetch this from your backend
    // For demonstration, we'll use a mock value
    const mockUsage = Math.floor(Math.random() * Math.min(10, userLimits.summariesPerDay));
    setDailyUsage(mockUsage);
  }, [userLimits.summariesPerDay]);

  if (!user || userLimits.summariesPerDay === -1) return null;

  const usagePercentage = (dailyUsage / userLimits.summariesPerDay) * 100;
  const remainingUsage = userLimits.summariesPerDay - dailyUsage;

  const getUsageColor = () => {
    if (usagePercentage >= 90) return "text-destructive";
    if (usagePercentage >= 70) return "text-yellow-600";
    return "text-green-600";
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Daily Usage
          <Badge variant="outline" className="text-xs">
            {userTier.replace('_', ' ').toUpperCase()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Summaries Today</span>
            <span className={getUsageColor()}>
              {dailyUsage} / {userLimits.summariesPerDay}
            </span>
          </div>
          <Progress 
            value={usagePercentage} 
            className="h-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="space-y-1">
            <div className="text-lg font-bold text-primary">{remainingUsage}</div>
            <div className="text-xs text-muted-foreground">Remaining</div>
          </div>
          <div className="space-y-1">
            <div className="text-lg font-bold text-primary">
              {Math.floor(userLimits.maxVideoLength / 60)}m
            </div>
            <div className="text-xs text-muted-foreground">Max Length</div>
          </div>
        </div>

        {usagePercentage >= 80 && (
          <div className="text-xs text-muted-foreground bg-muted p-2 rounded-md">
            <Video className="h-3 w-3 inline mr-1" />
            {usagePercentage >= 90 
              ? "You're almost at your daily limit. Consider upgrading for more summaries."
              : "You're using most of your daily allowance."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}