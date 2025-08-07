import HomeClient from "@/components/home-client"

interface HomeProps {
  searchParams: Promise<{ videoId?: string }>
}

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = await searchParams;
  const currentVideoId = resolvedSearchParams.videoId;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[Page] URL searchParams:', { resolvedSearchParams, currentVideoId });
  }

  return <HomeClient currentVideoId={currentVideoId} />
}
