export type SupportedLocale = 'ko' | 'en';

export const translations = {
  ko: {
    // Auth
    'auth.login': 'Google 로그인',
    'auth.logout': '로그아웃',
    'auth.loggingIn': '로그인 중...',
    'auth.loggingOut': '로그아웃 중...',
    
    // Sidebar
    'sidebar.myHistory': '내 요약 기록',
    'sidebar.recentSummaries': '최근 요약',
    'sidebar.refresh': '새로고침',
    'sidebar.newSummary': '새로운 영상 요약하기',
    'sidebar.personalHistory': '개인 요약 기록이 표시됩니다.',
    'sidebar.publicHistory': '모든 사용자의 요약 기록이 표시됩니다.',
    'sidebar.noVideos.personal': '아직 요약한 비디오가 없습니다. 새 비디오를 요약해보세요!',
    'sidebar.noVideos.public': '요약된 비디오가 없습니다.',
    'sidebar.loadingMore': '더 많은 요약을 불러오는 중...',
    'sidebar.allLoaded': '모든 요약을 불러왔습니다',
    'sidebar.error.fetch': '요약 데이터를 불러오는데 실패했습니다.',
    'sidebar.error.title': '오류 발생',
    'sidebar.retry': '다시 시도',
    'sidebar.changeTheme': '테마 변경',
    'sidebar.changeLanguage': '언어 변경',
    
    // Summary Form
    'form.enterUrl': 'YouTube URL을 입력해주세요.',
    'form.invalidUrl': '유효한 YouTube URL을 입력해주세요.',
    'form.summaryFailed': '요약 생성에 실패했습니다.',
    'form.summaryError': '요약 생성 중 오류가 발생했습니다.',
    'form.videoNotFound': '비디오 정보를 가져올 수 없습니다.',
    'form.addToMySummaries': '내 요약에 추가',
    'form.addFailed': '요약 추가에 실패했습니다.',
    'form.addError': '요약 추가 중 오류가 발생했습니다.',
    'form.resummaryFailed': '재요약에 실패했습니다.',
    'form.resummaryError': '재요약 중 오류가 발생했습니다.',
    'form.loginRequired': '로그인이 필요합니다.',
    'form.noVideoInfo': '비디오 정보가 없습니다.',
    
    // Summary Display
    'summary.mySummary': '내 요약',
    'summary.latestSummary': '최신 요약',
    'summary.guestSummary': '게스트 요약',
    'summary.otherUserSummary': '다른 사용자 요약',
    'summary.summarizing': '요약중...',
    'summary.loading': '로딩중...',
    'summary.generate': '생성',
    'summary.generating': '요약 중...',
    'summary.share.title': 'YouTube 비디오 요약',
    'summary.share.text': 'YouTube 요약',
    'summary.summary': '요약',
    
    // Language Selector
    'language.select': '언어를 선택하세요',
    'language.selectPlaceholder': '언어 선택',
    'language.summarize': '요약하기',
    'language.starting': '언어로 요약을 시작합니다...',
    
    // Chat
    'chat.title': 'AI와 대화하기',
    'chat.loginNotice': '💡 로그인하시면 대화 기록이 저장됩니다.',
    'chat.placeholder': '질문을 입력하세요...',
    'chat.initialMessage': '비디오 요약을 바탕으로 질문해 주세요.',
    'chat.errorMessage': '죄송합니다. 메시지 전송에 실패했습니다. 다시 시도해 주세요.',
    'chat.rag': 'RAG',
    'chat.chunks': '개 청크',
    'chat.summaryUsed': '요약 사용',
    'chat.generalResponse': '일반 응답',
    
    // Curation
    'curation.personalized': '맞춤 추천',
    'curation.personalizedDesc': '시청 기록 분석을 통해 발견된 관심 키워드 기반 추천',
    'curation.trending': '실시간 급등 영상',
    'curation.trendingDesc': '정보전달 위주의 인기 급상승 동영상들을 확인해보세요',
    'curation.related': '관련 영상 (관리자 전용)',
    'curation.relatedDesc': '현재 보고 있는 영상과 관련된 추천 동영상들입니다',
    'curation.curated': '큐레이션',
    'curation.curatedDesc': '추천 동영상',
    'curation.noTrending': '급등 영상을 찾을 수 없습니다.',
    'curation.noRelated': '관련 영상을 찾을 수 없습니다.',
    'curation.selectKeyword': '관심 있는 키워드를 선택해보세요!',
    'curation.dataError': '데이터를 불러오는 중 오류가 발생했습니다.',
    'curation.searchError': '키워드 검색 중 오류가 발생했습니다.',
    'curation.videoSet': '동영상이 설정되었습니다',
    'curation.videoSetDesc': '아래 요약 폼에서 요약을 시작하세요.',
    
    // Common
    'common.loading': '로딩중...',
    'common.error': '오류 발생',
    'common.retry': '다시 시도',
    'common.guest': '게스트',
    'common.otherUser': '다른 사용자',
    'common.daysAgo': '일 전',
    'common.exists': '존재',
    
    // Summary Container
    'container.preparing': '요약을 준비하고 있습니다...',
    'container.fetching': '요약을 불러오는 중...',
    'container.noSummary': '이 언어에 대한 요약이 없습니다.',
    'container.retrying': '요약을 불러오는 중...',
    
    // Form Labels and Status
    'form.languageSelect': '언어 선택',
    'form.mySummary': '내 요약',
    'form.summaryExists': '요약 존재',
    'form.noSummary': '요약 없음',
    'form.otherUserSummary': '다른 사용자',
    'form.guestSummary': '게스트',
    'form.processing': '처리중...',
    'form.adding': '추가 중...',
    'form.resummaryProgress': '재요약 중...',
    'form.loadingVideoInfo': '비디오 정보를 불러오는 중...',
    'form.createdAt': '생성일',
    'form.error': '오류',
    'form.mySummaryExists': '✓ 내 요약 존재',
    
    // Language Selector
    'language.korean': '한국어',
    'language.summaryLanguageLabel': '요약 언어 / Summary Language',
    'language.selectPlaceholder2': '언어를 선택하세요 / Select language',
    'language.completed': '완료',
    'language.startingSummary': '언어로 요약을 시작합니다...',
    'language.summaryCompleted': '언어 요약이 완료되었습니다.',
    'language.summaryFailed': '요약 생성 실패',
    
    // Summary Display
    'summary.available': '요약 생성 가능',
    'summary.noSummaryForLanguage': '선택한 언어에 대한 요약이 없습니다.',
    'summary.summarizingIn': '로 요약 중...',
    'summary.summarizeIn': '로 요약하기',
    'summary.completed': '완료',
    'summary.startingSummary': '언어로 요약을 시작합니다...',
    'summary.summaryCompleted': '언어 요약이 완료되었습니다!',
    'summary.summaryFailed': '요약 생성에 실패했습니다',
    'summary.errorOccurred': '요약 생성 중 오류가 발생했습니다.',
    
    // API Messages
    'api.videoNotFound': '해당 비디오의 요약을 찾을 수 없습니다.',
    'api.videoNotFoundLang': '해당 비디오의 {{language}} 언어 요약을 찾을 수 없습니다.',
    'api.alreadyInList': '이미 내 요약 리스트에 있습니다.',
    'api.addFailed': '요약 추가에 실패했습니다.',
    'api.addSuccess': '내 요약 리스트에 추가되었습니다.',
    'api.youtubeKeyMissing': 'YouTube API 키가 설정되지 않았습니다.',
    'api.videoIdNotFound': '지정된 ID의 비디오를 찾을 수 없습니다.',
    'api.user': '사용자',
    'api.ai': 'AI',
    'api.relatedParts': '다음은 YouTube 비디오의 관련 부분입니다:',
    'api.videoSummary': '다음은 YouTube 비디오 요약입니다:',
    'api.noVideoInfo': '비디오 정보를 찾을 수 없어 일반적인 답변을 제공합니다:',
    'api.noRelatedInfo': '관련 정보가 없습니다.',
    
    // Auth Error Page
    'authError.title': '인증 오류 발생',
    'authError.message': '로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    'authError.redirect': '5초 후 자동으로 홈으로 이동합니다...',
    
    // New Video Summary
    'home.newVideoSummary': '새로운 영상 요약하기',
  },
  en: {
    // Auth
    'auth.login': 'Google Login',
    'auth.logout': 'Logout',
    'auth.loggingIn': 'Logging in...',
    'auth.loggingOut': 'Logging out...',
    
    // Sidebar
    'sidebar.myHistory': 'My Summary History',
    'sidebar.recentSummaries': 'Recent Summaries',
    'sidebar.refresh': 'Refresh',
    'sidebar.newSummary': 'Summarize New Video',
    'sidebar.personalHistory': 'Personal summary history is displayed.',
    'sidebar.publicHistory': 'Summary history from all users is displayed.',
    'sidebar.noVideos.personal': 'No videos summarized yet. Try summarizing a new video!',
    'sidebar.noVideos.public': 'No summarized videos found.',
    'sidebar.loadingMore': 'Loading more summaries...',
    'sidebar.allLoaded': 'All summaries loaded',
    'sidebar.error.fetch': 'Failed to load summary data.',
    'sidebar.error.title': 'Error Occurred',
    'sidebar.retry': 'Try Again',
    'sidebar.changeTheme': 'Change Theme',
    'sidebar.changeLanguage': 'Change Language',
    
    // Summary Form
    'form.enterUrl': 'Please enter a YouTube URL.',
    'form.invalidUrl': 'Please enter a valid YouTube URL.',
    'form.summaryFailed': 'Failed to generate summary.',
    'form.summaryError': 'An error occurred while generating summary.',
    'form.videoNotFound': 'Unable to fetch video information.',
    'form.addToMySummaries': 'Add to My Summaries',
    'form.addFailed': 'Failed to add summary.',
    'form.addError': 'An error occurred while adding summary.',
    'form.resummaryFailed': 'Failed to regenerate summary.',
    'form.resummaryError': 'An error occurred while regenerating summary.',
    'form.loginRequired': 'Login required.',
    'form.noVideoInfo': 'No video information available.',
    
    // Summary Display
    'summary.mySummary': 'My Summary',
    'summary.latestSummary': 'Latest Summary',
    'summary.guestSummary': 'Guest Summary',
    'summary.otherUserSummary': 'Other User Summary',
    'summary.summarizing': 'Summarizing...',
    'summary.loading': 'Loading...',
    'summary.generate': 'Generate',
    'summary.generating': 'Generating...',
    'summary.share.title': 'YouTube Video Summary',
    'summary.share.text': 'YouTube Summary',
    'summary.summary': 'Summary',
    
    // Language Selector
    'language.select': 'Select language',
    'language.selectPlaceholder': 'Select language',
    'language.summarize': 'Summarize',
    'language.starting': 'Starting summary in language...',
    
    // Chat
    'chat.title': 'Chat with AI',
    'chat.loginNotice': '💡 Chat history will be saved if you log in.',
    'chat.placeholder': 'Enter your question...',
    'chat.initialMessage': 'Please ask questions based on the video summary.',
    'chat.errorMessage': 'Sorry, message sending failed. Please try again.',
    'chat.rag': 'RAG',
    'chat.chunks': 'chunks',
    'chat.summaryUsed': 'Summary Used',
    'chat.generalResponse': 'General Response',
    
    // Curation
    'curation.personalized': 'Personalized Recommendations',
    'curation.personalizedDesc': 'Recommendations based on interest keywords found through viewing history analysis',
    'curation.trending': 'Trending Videos',
    'curation.trendingDesc': 'Check out trending videos focused on information delivery',
    'curation.related': 'Related Videos (Admin Only)',
    'curation.relatedDesc': 'Recommended videos related to the current video',
    'curation.curated': 'Curation',
    'curation.curatedDesc': 'Recommended Videos',
    'curation.noTrending': 'No trending videos found.',
    'curation.noRelated': 'No related videos found.',
    'curation.selectKeyword': 'Please select a keyword of interest!',
    'curation.dataError': 'An error occurred while loading data.',
    'curation.searchError': 'An error occurred during keyword search.',
    'curation.videoSet': 'Video has been set',
    'curation.videoSetDesc': 'Start summarizing in the form below.',
    
    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error Occurred',
    'common.retry': 'Try Again',
    'common.guest': 'Guest',
    'common.otherUser': 'Other User',
    'common.daysAgo': 'days ago',
    'common.exists': 'exists',
    
    // Summary Container
    'container.preparing': 'Preparing summary...',
    'container.fetching': 'Loading summary...',
    'container.noSummary': 'No summary available for this language.',
    'container.retrying': 'Loading summary...',
    
    // Form Labels and Status
    'form.languageSelect': 'Language Selection',
    'form.mySummary': 'My Summary',
    'form.summaryExists': 'Summary Exists',
    'form.noSummary': 'No Summary',
    'form.otherUserSummary': 'Other User',
    'form.guestSummary': 'Guest',
    'form.processing': 'Processing...',
    'form.adding': 'Adding...',
    'form.resummaryProgress': 'Regenerating...',
    'form.loadingVideoInfo': 'Loading video information...',
    'form.createdAt': 'Created at',
    'form.error': 'Error',
    'form.mySummaryExists': '✓ My Summary Exists',
    
    // Language Selector
    'language.korean': 'Korean',
    'language.summaryLanguageLabel': 'Summary Language / 요약 언어',
    'language.selectPlaceholder2': 'Select language / 언어를 선택하세요',
    'language.completed': 'Completed',
    'language.startingSummary': 'Starting summary in language...',
    'language.summaryCompleted': 'Summary completed in language.',
    'language.summaryFailed': 'Summary generation failed',
    
    // Summary Display
    'summary.available': 'Summary generation available',
    'summary.noSummaryForLanguage': 'No summary available for selected language.',
    'summary.summarizingIn': ' summarizing...',
    'summary.summarizeIn': ' summarize in',
    'summary.completed': 'Completed',
    'summary.startingSummary': 'Starting summary in language...',
    'summary.summaryCompleted': 'Summary completed in language!',
    'summary.summaryFailed': 'Summary generation failed',
    'summary.errorOccurred': 'An error occurred while generating summary.',
    
    // API Messages
    'api.videoNotFound': 'Summary for this video not found.',
    'api.videoNotFoundLang': 'Summary for this video in {{language}} language not found.',
    'api.alreadyInList': 'Already in my summary list.',
    'api.addFailed': 'Failed to add summary.',
    'api.addSuccess': 'Added to my summary list.',
    'api.youtubeKeyMissing': 'YouTube API key is not configured.',
    'api.videoIdNotFound': 'Video with specified ID not found.',
    'api.user': 'User',
    'api.ai': 'AI',
    'api.relatedParts': 'Here are the related parts of the YouTube video:',
    'api.videoSummary': 'Here is the YouTube video summary:',
    'api.noVideoInfo': 'Video information not found, providing general response:',
    'api.noRelatedInfo': 'No related information available.',
    
    // Auth Error Page
    'authError.title': 'Authentication Error',
    'authError.message': 'An error occurred during login. Please try again later.',
    'authError.redirect': 'Redirecting to home in 5 seconds...',
    
    // New Video Summary
    'home.newVideoSummary': 'Summarize New Video',
  }
} as const;

export type TranslationKey = keyof typeof translations.ko;

export function getSystemLocale(): SupportedLocale {
  if (typeof window === 'undefined') return 'en';
  
  const browserLang = navigator.language || navigator.languages?.[0] || 'en';
  
  // Check if browser language starts with 'ko' (ko, ko-KR, etc.)
  if (browserLang.toLowerCase().startsWith('ko')) {
    return 'ko';
  }
  
  return 'en';
}