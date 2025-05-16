/**
 * puppeteer를 활용한 YouTube 자막 추출 기능
 */

import puppeteer from 'puppeteer';

/**
 * Puppeteer를 사용하여 YouTube 영상의 자막을 추출하는 함수
 * @param videoId YouTube 비디오 ID
 * @returns 자막 텍스트 또는 null
 */
export async function fetchTranscriptWithPuppeteer(videoId: string): Promise<string | null> {
  console.log(`[fetchTranscriptWithPuppeteer] 시작: ${videoId}`);
  
  let browser;
  
  try {
    // 브라우저 실행
    browser = await puppeteer.launch({
      headless: true, // 헤드리스 모드 사용
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // 타임아웃 설정
    page.setDefaultNavigationTimeout(60000);
    
    // YouTube 자막 페이지로 이동
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`[fetchTranscriptWithPuppeteer] 페이지 로딩 중: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    // 자막 버튼 클릭
    console.log('[fetchTranscriptWithPuppeteer] 자막 버튼 찾는 중...');
    
    // 자막 버튼이 로드될 때까지 대기
    await page.waitForSelector('.ytp-subtitles-button', { timeout: 10000 })
      .catch(() => console.log('[fetchTranscriptWithPuppeteer] 자막 버튼을 찾을 수 없음'));
    
    // 자막 버튼 상태 확인
    const subtitleButtonEnabled = await page.evaluate(() => {
      const button = document.querySelector('.ytp-subtitles-button') as HTMLButtonElement;
      return button ? !button.disabled : false;
    });
    
    if (!subtitleButtonEnabled) {
      console.log('[fetchTranscriptWithPuppeteer] 이 영상에는 자막이 없습니다.');
      await browser.close();
      return null;
    }
    
    // 자막 활성화
    await page.click('.ytp-subtitles-button');
    console.log('[fetchTranscriptWithPuppeteer] 자막 활성화됨');
    
    // 영상 재생
    await page.click('.ytp-play-button');
    
    // 자막 수집 시작
    console.log('[fetchTranscriptWithPuppeteer] 자막 수집 시작...');
    const captionsText: string[] = [];
    
    // 영상 길이 확인
    const videoDuration = await page.evaluate(() => {
      const durationElement = document.querySelector('.ytp-time-duration');
      return durationElement ? durationElement.textContent : '0:00';
    }) || '0:00';
    
    console.log(`[fetchTranscriptWithPuppeteer] 영상 길이: ${videoDuration}`);
    
    // 영상 길이에 따라 수집 시간 결정 (최대 5분)
    const durationParts = videoDuration.split(':').map(Number);
    const durationInSeconds = durationParts.length === 3 
      ? durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2]
      : durationParts[0] * 60 + durationParts[1];
    
    const collectionTimeInMs = Math.min(durationInSeconds, 300) * 1000;
    
    // 일정 시간 동안 자막 수집
    const startTime = Date.now();
    
    while (Date.now() - startTime < collectionTimeInMs) {
      // 현재 표시된 자막 가져오기
      const currentCaption = await page.evaluate(() => {
        const captionElement = document.querySelector('.ytp-caption-segment');
        return captionElement ? captionElement.textContent : '';
      });
      
      if (currentCaption && !captionsText.includes(currentCaption)) {
        captionsText.push(currentCaption);
      }
      
      // 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 영상 정지
    await page.click('.ytp-play-button');
    
    // 수집된 자막 결합
    const fullTranscript = captionsText.join(' ');
    console.log(`[fetchTranscriptWithPuppeteer] 자막 수집 완료: ${captionsText.length}개 문장, ${fullTranscript.length}자`);
    
    return fullTranscript.length > 0 ? fullTranscript : null;
  } catch (error) {
    console.error('[fetchTranscriptWithPuppeteer] 오류:', error);
    return null;
  } finally {
    // 브라우저 종료
    if (browser) {
      await browser.close();
      console.log('[fetchTranscriptWithPuppeteer] 브라우저 종료됨');
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
    // 브라우저 실행
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);
    
    // 트랜스크립트 페이지로 직접 이동 (더 많은 자막을 얻을 수 있음)
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    await page.goto(url, { waitUntil: 'networkidle2' });
    
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
