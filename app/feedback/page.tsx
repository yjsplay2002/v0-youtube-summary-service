'use client'

import { useAuth } from '@/components/auth-context'
import CommunityFeedback from '@/components/community-feedback'
import { Button } from '@/components/ui/button'
import { Home } from 'lucide-react'
import Link from 'next/link'

export default function FeedbackPage() {
  const { user } = useAuth()
  
  const currentUser = user ? {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || user.user_metadata?.name
  } : null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="absolute top-4 left-4 z-10">
        <Link href="/">
          <Button 
            variant="outline" 
            size="sm"
            className="gap-2 bg-white/80 backdrop-blur-sm hover:bg-white"
          >
            <Home className="h-4 w-4" />
            Home
          </Button>
        </Link>
      </div>
      <CommunityFeedback 
        serviceName="YouTube Summary Service" 
        currentUser={currentUser}
      />
    </div>
  )
}