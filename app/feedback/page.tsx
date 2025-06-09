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
    <div className="min-h-screen bg-slate-950">
      <div className="absolute top-6 left-6 z-10">
        <Link href="/">
          <Button 
            variant="outline" 
            size="default"
            className="gap-2 bg-slate-900/90 border-slate-700 text-slate-200 backdrop-blur-sm hover:bg-slate-800 hover:border-slate-600 hover:text-white transition-all duration-200"
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