// 유튜브 링크에서 videoId 추출 (다양한 플랫폼 URL 지원)
export function extractYoutubeVideoId(url: string): string | null {
  if (!url) return null;
  
  // 1. 일반적인 URL에서 videoId 파라미터 추출 (localhost:3000/?videoId=xxx 형태 포함)
  try {
    const urlObj = new URL(url);
    const videoIdFromParam = urlObj.searchParams.get('videoId');
    if (videoIdFromParam && videoIdFromParam.length === 11) {
      return videoIdFromParam;
    }
  } catch (e) {
    // URL 파싱이 실패해도 계속 진행
  }
  
  // 2. 기존 YouTube URL 패턴 매칭
  const youtubeRegex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|\S*?[?&]v=)|youtu\.be\/)([\w-]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch) {
    return youtubeMatch[1];
  }
  
  // 3. 다른 플랫폼에서 YouTube 비디오 ID 추출 시도
  // X/Twitter 임베드 링크에서 YouTube ID 추출
  const twitterRegex = /(?:twitter\.com|x\.com)\/\w+\/status\/\d+.*(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/;
  const twitterMatch = url.match(twitterRegex);
  if (twitterMatch) {
    return twitterMatch[1];
  }
  
  // Reddit 링크에서 YouTube ID 추출
  const redditRegex = /reddit\.com\/.*(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/;
  const redditMatch = url.match(redditRegex);
  if (redditMatch) {
    return redditMatch[1];
  }
  
  // 일반적인 URL에서 YouTube 링크 패턴 찾기 (링크가 포함된 페이지 등)
  const embeddedYoutubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/;
  const embeddedMatch = url.match(embeddedYoutubeRegex);
  if (embeddedMatch) {
    return embeddedMatch[1];
  }
  
  return null;
}

// 비디오 ID에서 YouTube URL 생성
export function generateYoutubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
