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
    // First, try to get the video title and description using YouTube Data API
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new Error('YOUTUBE_API_KEY is not set in environment variables');
    }

    // Get video details to include in the transcript
    const videoUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`;
    const videoResponse = await fetch(videoUrl);
    const videoData = await videoResponse.json();
    
    if (!videoResponse.ok || !videoData.items || videoData.items.length === 0) {
      throw new Error('Failed to fetch video details from YouTube API');
    }

    const videoSnippet = videoData.items[0].snippet;
    const videoTitle = videoSnippet.title;
    const videoDescription = videoSnippet.description;
    const channelTitle = videoSnippet.channelTitle;
    const publishedAt = new Date(videoSnippet.publishedAt).toLocaleDateString();

    // For the actual transcript, we'll use a third-party service
    // Note: This requires a server-side proxy to avoid CORS issues
    const transcriptUrl = `https://youtube-transcript-api.vercel.app/api/transcript?videoId=${videoId}`;
    const transcriptResponse = await fetch(transcriptUrl);
    
    if (!transcriptResponse.ok) {
      throw new Error('Failed to fetch transcript from YouTube');
    }
    
    const transcriptData = await transcriptResponse.json();
    
    // Combine all transcript text
    let fullTranscript = `Title: ${videoTitle}\n`;
    fullTranscript += `Channel: ${channelTitle}\n`;
    fullTranscript += `Published: ${publishedAt}\n\n`;
    fullTranscript += `Description:\n${videoDescription}\n\n`;
    fullTranscript += `Transcript:\n`;
    
    transcriptData.transcript.forEach((entry: any) => {
      fullTranscript += `${entry.text} `;
    });

    return fullTranscript;
  } catch (error) {
    console.error("Error fetching transcript:", error);
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unknown error occurred while fetching the transcript';
    throw new Error(`Failed to fetch video transcript: ${errorMessage}`);
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
  } catch (error: unknown) {
    console.error("Error processing video:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to process video"
    return { success: false, error: errorMessage }
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

    // Prepare the prompt for the AI
    const prompt = `다음 YouTube 동영상 트랜스크립트를 분석하여 한국어로 요약해주세요. 

요구사항:
1. 주요 내용을 3-5개의 핵심 포인트로 요약
2. 각 포인트는 간결하고 명확한 문장으로 작성
3. 전문 용어는 쉽게 설명
4. 마크다운 형식으로 작성
5. 마지막에 해시태그 3-5개 추가

트랜스크립트:
${transcript}`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: '당신은 유용한 AI 어시스턴트입니다. 한국어로 대답해주세요.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error generating summary:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    throw new Error(`Failed to generate summary: ${errorMessage}`);
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
