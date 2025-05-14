"use server"

import { revalidatePath } from "next/cache"

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
export async function summarizeYoutubeVideo(
  youtubeUrl: string,
): Promise<{ success: boolean; videoId?: string; error?: string }> {
  // Extract video ID from URL
  const videoId = extractVideoId(youtubeUrl)

  if (!videoId) {
    return { success: false, error: "Invalid YouTube URL" }
  }

  try {
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      return { success: false, error: "OPENAI_API_KEY is missing. Please add it to your environment variables." }
    }

    // Fetch transcript
    const transcript = await fetchTranscript(videoId)

    // Generate summary using AI
    const summary = await generateSummary(transcript)

    // Store the summary
    summaries.set(videoId, summary)

    // Revalidate the path
    revalidatePath("/")

    // Return success with videoId instead of redirecting
    return { success: true, videoId }
  } catch (error) {
    console.error("Error processing video:", error)
    return { success: false, error: error.message || "Failed to process video" }
  }
}

// Get stored summary
export async function getSummary(videoId: string): Promise<string | null> {
  return summaries.get(videoId) || null
}

// Generate summary using AI
async function generateSummary(transcript: string): Promise<string> {
  try {
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is missing. Please add it to your environment variables.")
    }

    // In a real application, you would use the OpenAI API here
    // For this example, we'll simulate the AI response

    // Simulate AI processing time
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Return a simulated summary
    return `# Video Summary

#AI #Summarization #YouTube

## 전체 요약
이 영상은 YouTube 비디오 요약 서비스의 시뮬레이션 예시입니다. 실제 구현에서는 OpenAI API를 사용하여 비디오 자막을 분석하고 요약할 것입니다.

## 핵심 용어
- **자막 추출**: YouTube 비디오에서 텍스트 자막을 가져오는 과정
- **AI 요약**: 인공지능을 활용하여 긴 텍스트를 핵심 내용으로 압축하는 기술

---
📍 [1. 서비스 소개]
🕒 [00:00]  
📝 요약: 이 서비스는 YouTube 비디오 링크를 입력하면 자동으로 자막을 추출하고 요약해주는 도구입니다.  
🔹 핵심 요점:  
- YouTube 링크 입력만으로 간편하게 사용 가능
- 3분 단위로 챕터를 나누어 요약
- 마크다운 형식으로 결과 제공
---

📍 [2. 기술적 구현]
🕒 [03:00]  
📝 요약: 이 서비스는 Next.js와 OpenAI API를 활용하여 구현되었으며, 서버 액션을 통해 처리됩니다.  
🔹 핵심 요점:  
- Next.js App Router 사용
- OpenAI GPT-4o 모델 활용
- 서버 사이드 처리로 보안 강화
---

📍 [3. 활용 방안]
🕒 [06:00]  
📝 요약: 이 서비스는 학습, 연구, 콘텐츠 분석 등 다양한 분야에서 활용될 수 있습니다.  
🔹 핵심 요점:  
- 긴 강의나 세미나 내용을 빠르게 파악
- 중요 정보만 추출하여 시간 절약
- 여러 비디오의 내용을 효율적으로 비교 분석
---`

    // In a real implementation, you would use the OpenAI API like this:
    /*
    const { text } = await generateText({
      model: openai("gpt-4o"),
      prompt: prompt,
      temperature: 0.7,
      maxTokens: 2000,
    })
    */

    // Format the summary as markdown
    return formatSummaryAsMarkdown(transcript)
  } catch (error) {
    console.error("Error generating summary:", error)
    throw new Error(`Failed to generate summary: ${error.message}`)
  }
}

// Format the summary as markdown
function formatSummaryAsMarkdown(summary: string): string {
  // In a real application, you might need to do more processing here
  // For now, we'll return a simulated summary

  return `# Video Summary

#AI #Summarization #YouTube

## 전체 요약
이 영상은 YouTube 비디오 요약 서비스의 시뮬레이션 예시입니다. 실제 구현에서는 OpenAI API를 사용하여 비디오 자막을 분석하고 요약할 것입니다.

## 핵심 용어
- **자막 추출**: YouTube 비디오에서 텍스트 자막을 가져오는 과정
- **AI 요약**: 인공지능을 활용하여 긴 텍스트를 핵심 내용으로 압축하는 기술

---
📍 [1. 서비스 소개]
🕒 [00:00]  
📝 요약: 이 서비스는 YouTube 비디오 링크를 입력하면 자동으로 자막을 추출하고 요약해주는 도구입니다.  
🔹 핵심 요점:  
- YouTube 링크 입력만으로 간편하게 사용 가능
- 3분 단위로 챕터를 나누어 요약
- 마크다운 형식으로 결과 제공
---

📍 [2. 기술적 구현]
🕒 [03:00]  
📝 요약: 이 서비스는 Next.js와 OpenAI API를 활용하여 구현되었으며, 서버 액션을 통해 처리됩니다.  
🔹 핵심 요점:  
- Next.js App Router 사용
- OpenAI GPT-4o 모델 활용
- 서버 사이드 처리로 보안 강화
---

📍 [3. 활용 방안]
🕒 [06:00]  
📝 요약: 이 서비스는 학습, 연구, 콘텐츠 분석 등 다양한 분야에서 활용될 수 있습니다.  
🔹 핵심 요점:  
- 긴 강의나 세미나 내용을 빠르게 파악
- 중요 정보만 추출하여 시간 절약
- 여러 비디오의 내용을 효율적으로 비교 분석
---`
}
