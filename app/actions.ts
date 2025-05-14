"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

// Function to extract video ID from YouTube URL
function extractVideoId(url: string): string | null {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/
  const match = url.match(regExp)
  return match && match[7].length === 11 ? match[7] : null
}

// Function to fetch YouTube transcript
async function fetchTranscript(videoId: string): Promise<string> {
  try {
    // In a real application, you would use a proper YouTube transcript API
    // For this example, we'll simulate fetching a transcript

    // This would be replaced with actual API call like:
    // const response = await fetch(`https://api.example.com/youtube/transcript/${videoId}`);
    // const data = await response.json();
    // return data.transcript;

    // For demo purposes, return a placeholder transcript
    return `This is a simulated transcript for video ${videoId}. 
    In a real application, you would fetch the actual transcript from YouTube using an API.
    The transcript would contain all the spoken content from the video, which would then be processed and summarized.`
  } catch (error) {
    console.error("Error fetching transcript:", error)
    throw new Error("Failed to fetch video transcript")
  }
}

// Store summaries in memory (in a real app, use a database)
const summaries = new Map<string, string>()

// Process YouTube video and generate summary
export async function summarizeYoutubeVideo(youtubeUrl: string) {
  // Extract video ID from URL
  const videoId = extractVideoId(youtubeUrl)

  if (!videoId) {
    throw new Error("Invalid YouTube URL")
  }

  try {
    // Fetch transcript
    const transcript = await fetchTranscript(videoId)

    // Generate summary using AI
    const summary = await generateSummary(transcript)

    // Store the summary
    summaries.set(videoId, summary)

    // Revalidate the path and redirect to show results
    revalidatePath("/")
    redirect(`/?videoId=${videoId}`)
  } catch (error) {
    console.error("Error processing video:", error)
    throw error
  }
}

// Get stored summary
export async function getSummary(videoId: string): Promise<string | null> {
  return summaries.get(videoId) || null
}

// Generate summary using AI
async function generateSummary(transcript: string): Promise<string> {
  try {
    const prompt = `다음 유튜브 자막을 보고, 각 3분 단위로 챕터를 나눠서 요약해줘. 각 챕터별 핵심 문장 2~3줄로 정리하고, 마지막에 전체 요약도 추가해줘.

입력: ${transcript}`

    const { text } = await generateText({
      model: openai("gpt-4o"),
      prompt: prompt,
      temperature: 0.7,
      maxTokens: 1000,
    })

    // Format the summary as markdown
    return formatSummaryAsMarkdown(text)
  } catch (error) {
    console.error("Error generating summary:", error)
    throw new Error("Failed to generate summary")
  }
}

// Format the summary as markdown
function formatSummaryAsMarkdown(summary: string): string {
  // In a real application, you might need to do more processing here
  // For now, we'll assume the AI returns reasonably formatted text

  // Add markdown title
  return `# Video Summary\n\n${summary}`
}
