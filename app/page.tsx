import HomeClient from "@/components/home-client"

interface HomeProps {
  searchParams: Promise<{ videoId?: string }>
}

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = await searchParams;
  const currentVideoId = resolvedSearchParams.videoId;

  return <HomeClient currentVideoId={currentVideoId} />
}
