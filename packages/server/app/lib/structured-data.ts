interface VideoSummaryStructuredData {
  "@context": "https://schema.org";
  "@type": "VideoObject";
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  duration?: string;
  embedUrl: string;
  interactionStatistic?: {
    "@type": "InteractionCounter";
    interactionType: "https://schema.org/WatchAction";
    userInteractionCount: number;
  };
  author?: {
    "@type": "Person" | "Organization";
    name: string;
  };
  publisher?: {
    "@type": "Organization";
    name: string;
    logo?: {
      "@type": "ImageObject";
      url: string;
    };
  };
  potentialAction?: {
    "@type": "SeekToAction";
    target: string;
    "startOffset-input": "required name=t";
  };
}

interface WebApplicationStructuredData {
  "@context": "https://schema.org";
  "@type": "WebApplication";
  name: string;
  description: string;
  url: string;
  applicationCategory: "MultimediaApplication";
  operatingSystem: "Web Browser";
  offers: {
    "@type": "Offer";
    price: "0";
    priceCurrency: "USD";
  };
  featureList: string[];
}

export function generateVideoSummaryStructuredData(videoInfo: any): VideoSummaryStructuredData {
  const baseData: VideoSummaryStructuredData = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: videoInfo.snippet.title,
    description: videoInfo.snippet.description || `AI-generated summary of ${videoInfo.snippet.title}`,
    thumbnailUrl: videoInfo.snippet.thumbnails?.maxres?.url || videoInfo.snippet.thumbnails?.high?.url || videoInfo.snippet.thumbnails?.default?.url || "",
    uploadDate: videoInfo.snippet.publishedAt,
    embedUrl: `https://www.youtube.com/embed/${videoInfo.id}`,
  };

  if (videoInfo.contentDetails?.duration) {
    baseData.duration = videoInfo.contentDetails.duration;
  }

  if (videoInfo.statistics?.viewCount) {
    baseData.interactionStatistic = {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/WatchAction",
      userInteractionCount: parseInt(videoInfo.statistics.viewCount, 10),
    };
  }

  if (videoInfo.snippet.channelTitle) {
    baseData.author = {
      "@type": "Person",
      name: videoInfo.snippet.channelTitle,
    };
  }

  baseData.publisher = {
    "@type": "Organization",
    name: "YouTube Video Summarizer",
    logo: {
      "@type": "ImageObject",
      url: "/placeholder-logo.png",
    },
  };

  baseData.potentialAction = {
    "@type": "SeekToAction",
    target: `https://www.youtube.com/watch?v=${videoInfo.id}&t={t}`,
    "startOffset-input": "required name=t",
  };

  return baseData;
}

export function generateWebApplicationStructuredData(): WebApplicationStructuredData {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "YouTube Video Summarizer",
    description: "AI-powered tool that transforms YouTube videos into concise, structured markdown summaries",
    url: typeof window !== 'undefined' ? window.location.origin : '',
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web Browser",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "AI-powered video summarization",
      "Markdown format output",
      "Video timestamp navigation",
      "Community feedback system",
      "User authentication",
      "Video content analysis"
    ],
  };
}

export function injectStructuredData(data: VideoSummaryStructuredData | WebApplicationStructuredData): void {
  if (typeof window !== 'undefined') {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }
}