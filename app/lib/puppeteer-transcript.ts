/**
 * puppeteer-core를 활용한 YouTube 자막 추출 기능
 * @sparticuz/chromium을 외부 Chromium으로 사용
 */

import puppeteer, { Browser, Page, executablePath } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import type { LaunchOptions } from 'puppeteer-core';

// HTML 요소 타입 선언
declare global {
  interface HTMLElementTagNameMap {
    'button': HTMLButtonElement;
  }
}

// 커스텀 에러 클래스들
class TranscriptError extends Error {
  constructor(
    message: string,
    public videoId: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'TranscriptError';
  }
}

class PageLoadError extends TranscriptError {
  constructor(videoId: string, originalError: unknown) {
    super(`페이지 로드 중 오류가 발생했습니다: ${videoId}`, videoId, originalError);
    this.name = 'PageLoadError';
  }
}

class TranscriptExtractionError extends TranscriptError {
  constructor(message: string, videoId: string) {
    super(message, videoId);
    this.name = 'TranscriptExtractionError';
  }
}

// 환경에 따른 설정 최적화
const isDev = process.env.NODE_ENV === 'development';
const isWin = process.platform === 'win32';

// 크로미움 실행 경로 캐싱
let executablePathCache: string | null = null;

// 타임아웃 설정 (서버리스 환경에서 중요)
const BROWSER_TIMEOUT = 30000; // 30초
const PAGE_LOAD_TIMEOUT = 60000; // 60초
const NAVIGATION_TIMEOUT = 60000; // 60초
const CAPTION_CHECK_INTERVAL = 1000; // 1초마다 자막 확인

/**
 * 자막 버튼을 찾아 활성화하는 헬퍼 함수
 */
async function enableSubtitles(page: Page, videoId: string): Promise<boolean> {
  try {
    console.log('[enableSubtitles] 자막 버튼 찾는 중...');
    
    // 자막 버튼이 로드될 때까지 대기 (최대 10초)
    try {
      await page.waitForSelector('.ytp-subtitles-button', { timeout: 10000 });
    } catch (error) {
      console.log('[enableSubtitles] 자막 버튼을 찾을 수 없음');
      return false;
    }
    
    // 자막 버튼 상태 확인
    const subtitleButtonEnabled = await page.evaluate(() => {
      const button = document.querySelector('.ytp-subtitles-button') as HTMLButtonElement;
      // 버튼이 없거나 비활성화된 경우
      if (!button || button.disabled) {
        return false;
      }
      
      // 버튼이 이미 활성화되어 있는지 확인 (aria-pressed 속성)
      const isAlreadyActive = button.getAttribute('aria-pressed') === 'true';
      if (isAlreadyActive) {
        return true;
      }
      
      // 자막 활성화
      button.click();
      return true;
    });
    
    if (!subtitleButtonEnabled) {
      console.log('[enableSubtitles] 자막을 활성화할 수 없음 - 버튼이 비활성화되어 있음');
      return false;
    }
    
    console.log('[enableSubtitles] 자막이 활성화됨');
    return true;
  } catch (error) {
    console.error('[enableSubtitles] 오류:', error);
    return false;
  }
}

/**
 * 영상 재생을 시작하는 헬퍼 함수
 */
async function startVideoPlayback(page: Page): Promise<void> {
  try {
    // 재생 버튼 상태 확인
    const isPlaying = await page.evaluate(() => {
      const playButton = document.querySelector('.ytp-play-button') as HTMLButtonElement;
      if (!playButton) return false;
      
      // 재생 중이 아니면 클릭
      const isPaused = playButton.getAttribute('aria-label')?.toLowerCase().includes('play');
      if (isPaused) {
        playButton.click();
      }
      return !isPaused;
    });
    
    if (!isPlaying) {
      console.log('[startVideoPlayback] 영상 재생 시작');
    }
  } catch (error) {
    console.error('[startVideoPlayback] 오류:', error);
  }
}

/**
 * 영상 길이를 초 단위로 변환하는 헬퍼 함수
 */
function parseVideoDuration(durationStr: string): number {
  if (!durationStr) return 0;
  
  const parts = durationStr.split(':');
  
  try {
    if (parts.length === 3) {
      // HH:MM:SS 형식
      return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    } else if (parts.length === 2) {
      // MM:SS 형식
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else if (parts.length === 1) {
      // SS 형식
      return parseInt(parts[0]);
    }
  } catch (error) {
    console.error('[parseVideoDuration] 오류:', error);
  }
  
  return 0;
}

/**
 * 타임아웃이 있는 작업을 실행하는 헬퍼 함수
 * @param promise 실행할 프로미스
 * @param timeoutMs 타임아웃 시간(밀리초)
 * @param errorMessage 타임아웃 시 오류 메시지
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result as T;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * 브라우저 인스턴스를 가져오는 헬퍼 함수
 * @returns 브라우저 인스턴스
 */
async function getBrowser() {
  try {
    // 실행 경로 캐싱을 통한 성능 최적화
    if (!executablePathCache) {
      executablePathCache = await withTimeout(
        chromium.executablePath(),
        BROWSER_TIMEOUT,
        '크로미움 실행 경로 가져오기 타임아웃'
      );
    }
    
    const launchOptions: LaunchOptions = {
      headless: true,
      args: [
        ...chromium.args,
        '--disable-dev-shm-usage', // Docker 및 서버리스 환경에서 메모리 이슈 방지
        '--disable-gpu',
        '--disable-setuid-sandbox',
        '--no-sandbox',
        '--no-zygote',
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: executablePathCache
    };
    
    // 타임아웃이 있는 브라우저 시작
    return await withTimeout(
      puppeteer.launch(launchOptions),
      BROWSER_TIMEOUT,
      '브라우저 시작 타임아웃'
    );
  } catch (error) {
    console.error('[getBrowser] 브라우저 시작 오류:', error);
    throw error;
  }
}

/**
 * Puppeteer를 사용하여 YouTube 영상의 자막을 추출하는 함수
 * @param videoId YouTube 비디오 ID
 * @returns 자막 텍스트 또는 null
 */
/**
 * Puppeteer를 사용하여 YouTube 영상의 자막을 추출하는 함수
 * @param videoId YouTube 비디오 ID
 * @returns 자막 텍스트 또는 null (자막이 없는 경우)
 * @throws {TranscriptError} 자막 추출 중 오류가 발생한 경우
 */
export async function fetchTranscriptWithPuppeteer(videoId: string): Promise<string | null> {
  console.log(`[fetchTranscriptWithPuppeteer] 시작: ${videoId}`);
  
  let browser;
  
  try {
    // 브라우저 실행 (getBrowser 헬퍼 함수 사용)
    browser = await withTimeout(
      getBrowser(),
      BROWSER_TIMEOUT,
      '브라우저 시작 시간 초과'
    );
    
    const page = await browser.newPage();
    
    // 타임아웃 설정
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);
    
    // YouTube 자막 페이지로 이동
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`[fetchTranscriptWithPuppeteer] 페이지 로딩 중: ${url}`);
    
    try {
      // 타임아웃이 있는 페이지 로딩
      await withTimeout(
        page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: PAGE_LOAD_TIMEOUT 
        }),
        PAGE_LOAD_TIMEOUT,
        `YouTube 페이지 로딩 타임아웃: ${videoId}`
      );
    } catch (error) {
      throw new PageLoadError(videoId, error);
    }
    
    // 자막 활성화 시도
    const subtitlesEnabled = await enableSubtitles(page, videoId);
    if (!subtitlesEnabled) {
      console.log('[fetchTranscriptWithPuppeteer] 이 영상에는 자막이 없습니다.');
      return null;
    }
    
    // 영상 재생 시작
    await startVideoPlayback(page);
    
    // 자막 수집 시작
    console.log('[fetchTranscriptWithPuppeteer] 자막 수집 시작...');
    const captionsText: string[] = [];
    
    // 영상 길이 확인
    const videoDuration = await page.evaluate(() => {
      const durationElement = document.querySelector('.ytp-time-duration');
      return durationElement?.textContent || '0:00';
    });
    
    console.log(`[fetchTranscriptWithPuppeteer] 영상 길이: ${videoDuration}`);
    
    // 영상 길이에 따라 수집 시간 결정 (최대 5분)
    const durationInSeconds = parseVideoDuration(videoDuration);
    const collectionTimeInMs = Math.min(durationInSeconds, 300) * 1000;
    
    if (collectionTimeInMs <= 0) {
      throw new TranscriptExtractionError(
        '유효하지 않은 영상 길이입니다.',
        videoId
      );
    }
    
    // 일정 시간 동안 자막 수집
    const startTime = Date.now();
    
    while (Date.now() - startTime < collectionTimeInMs) {
      try {
        // 현재 표시된 자막 가져오기
        const currentCaption = await page.evaluate(() => {
          const captionElement = document.querySelector('.ytp-caption-segment');
          return captionElement?.textContent?.trim() || '';
        });
        
        if (currentCaption && !captionsText.includes(currentCaption)) {
          captionsText.push(currentCaption);
          console.log(`[fetchTranscriptWithPuppeteer] 수집된 자막 (${captionsText.length}): ${currentCaption.substring(0, 50)}...`);
        }
      } catch (error) {
        console.error('[fetchTranscriptWithPuppeteer] 자막 수집 중 오류:', error);
      }
      
      // 잠시 대기
      await new Promise(resolve => setTimeout(resolve, CAPTION_CHECK_INTERVAL));
    }
    
    // 수집된 자막이 없는 경우
    if (captionsText.length === 0) {
      throw new TranscriptExtractionError(
        '자막을 찾을 수 없습니다. 이 영상에는 자막이 없거나 자동 생성된 자막이 비활성화되어 있을 수 있습니다.',
        videoId
      );
    }
    
    // 수집된 자막 결합
    const fullTranscript = captionsText.join(' ');
    console.log(`[fetchTranscriptWithPuppeteer] 자막 수집 완료: ${captionsText.length}개 문장, ${fullTranscript.length}자`);
    
    return fullTranscript;
  } catch (error) {
    if (error instanceof TranscriptError) {
      throw error; // 이미 처리된 오류는 그대로 전파
    }
    
    console.error('[fetchTranscriptWithPuppeteer] 오류:', error);
    throw new TranscriptError(
      '자막 추출 중 오류가 발생했습니다.',
      videoId,
      error
    );
  } finally {
    // 브라우저 종료
    if (browser) {
      try {
        await browser.close();
        console.log('[fetchTranscriptWithPuppeteer] 브라우저 종료됨');
      } catch (error) {
        console.error('[fetchTranscriptWithPuppeteer] 브라우저 종료 중 오류:', error);
      }
    }
  }
}

/**
 * 더 많은 자막을 수집하기 위한 고급 방법
 * @param videoId YouTube 비디오 ID
 * @returns 자막 텍스트 또는 null
 */
export async function fetchFullTranscriptWithPuppeteer(videoId: string): Promise<string | null> {
  console.log(`[fetchFullTranscriptWithPuppeteer] 시작: ${videoId}`);
  
  let browser;
  
  try {
    // 브라우저 실행 (getBrowser 헬퍼 함수 사용)
    browser = await getBrowser();
    
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);
    
    // 트랜스크립트 페이지로 직접 이동 (더 많은 자막을 얻을 수 있음)
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    
    // 타임아웃이 있는 페이지 로딩
    await withTimeout(
      page.goto(url, { waitUntil: 'networkidle2' }),
      PAGE_LOAD_TIMEOUT,
      `YouTube 페이지 로딩 타임아웃: ${videoId}`
    );
    
    // 더보기 버튼 클릭
    try {
      await page.waitForSelector('#expand', { timeout: 5000 });
      await page.click('#expand');
      console.log('[fetchFullTranscriptWithPuppeteer] 더보기 버튼 클릭됨');
    } catch (e) {
      console.log('[fetchFullTranscriptWithPuppeteer] 더보기 버튼을 찾을 수 없음');
    }
    
    // 트랜스크립트 버튼 찾기 및 클릭
    try {
      // 여러 선택자 시도
      const transcriptSelectors = [
        '[aria-label="자막 보기"]',
        '[aria-label="Open transcript"]',
        '[aria-label="View transcript"]',
        '.ytd-watch-metadata #button-shape button'
      ];
      
      let transcriptButtonFound = false;
      
      for (const selector of transcriptSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.click(selector);
          transcriptButtonFound = true;
          console.log(`[fetchFullTranscriptWithPuppeteer] 트랜스크립트 버튼 클릭됨 (${selector})`);
          break;
        } catch (e) {
          console.log(`[fetchFullTranscriptWithPuppeteer] 선택자 ${selector}에서 트랜스크립트 버튼을 찾을 수 없음`);
        }
      }
      
      if (!transcriptButtonFound) {
        console.log('[fetchFullTranscriptWithPuppeteer] 트랜스크립트 버튼을 찾을 수 없음');
        return null;
      }
      
      // 트랜스크립트 패널이 열릴 때까지 대기
      await page.waitForSelector('#segments-container', { timeout: 5000 });
      
      // 트랜스크립트 텍스트 수집
      const transcriptText = await page.evaluate(() => {
        const segments = document.querySelectorAll('#segments-container ytd-transcript-segment-renderer');
        return Array.from(segments).map(segment => {
          const textElement = segment.querySelector('#text');
          return textElement ? textElement.textContent : '';
        }).join(' ');
      });
      
      console.log(`[fetchFullTranscriptWithPuppeteer] 트랜스크립트 수집 완료: ${transcriptText.length}자`);
      
      return transcriptText.length > 0 ? transcriptText : null;
    } catch (e) {
      console.log('[fetchFullTranscriptWithPuppeteer] 트랜스크립트를 가져오는 중 오류 발생:', e);
      return null;
    }
  } catch (error) {
    console.error('[fetchFullTranscriptWithPuppeteer] 오류:', error);
    return null;
  } finally {
    // 브라우저 종료
    if (browser) {
      await browser.close();
      console.log('[fetchFullTranscriptWithPuppeteer] 브라우저 종료됨');
    }
  }
}
