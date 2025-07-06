// 유튜브 링크에서 videoId 추출
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
  const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|\S*?[?&]v=)|youtu\.be\/)([\w-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}
