"use client"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { SummaryDisplayClient } from "@/components/summary-display-client"
import { getSummary } from "@/app/actions"

export default function SummaryDisplay() {
  const searchParams = useSearchParams();
  const videoId = searchParams.get("videoId");
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSummary() {
      if (videoId) {
        const result = await getSummary(videoId);
        setSummary(result);
        console.log("[SummaryDisplay] Fetched summary:", result);
      } else {
        setSummary(null);
      }
    }
    fetchSummary();
  }, [videoId]);

  if (!videoId) return null;
  if (summary === null) return <div>Loading...</div>;
  if (summary.trim() === "") return <div className="text-center text-muted-foreground">요약이 없습니다.</div>;
  return <SummaryDisplayClient summary={summary} />;
}

