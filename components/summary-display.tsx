"use client"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { SummaryDisplayClient } from "@/components/summary-display-client"
import { getSummary } from "@/app/actions"

import { useContext } from "react";
import { LoadingContext } from "@/components/youtube-form";

export default function SummaryDisplay() {
  const searchParams = useSearchParams();
  const videoId = searchParams.get("videoId");
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    let retryCount = 0;
    let timeout: NodeJS.Timeout;

    async function fetchSummaryWithRetry() {
      if (videoId) {
        const result = await getSummary(videoId);
        setSummary(result);
        console.log("[SummaryDisplay] Fetched summary:", result);
        console.log("[SummaryDisplay] summary type:", typeof result, "length:", result?.length, "value:", result);
        if ((!result || result.trim() === "") && retryCount < 2) {
          retryCount++;
          timeout = setTimeout(fetchSummaryWithRetry, 500);
        }
      } else {
        setSummary(null);
      }
    }
    fetchSummaryWithRetry();
    return () => clearTimeout(timeout);
  }, [videoId]);

  const loading = useContext(LoadingContext);

  if (!videoId) return null;
  if (loading) return <div>Loading...</div>;
  if (summary === null) return null;
  if (typeof summary === "string" && summary.trim() === "") return <div className="text-center text-muted-foreground">요약이 없습니다.</div>;
  return <SummaryDisplayClient summary={summary} />;
}
