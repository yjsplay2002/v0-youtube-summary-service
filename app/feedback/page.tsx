'use client'

import { useAuth } from '@/components/auth-context'
import CommunityFeedback from '@/components/community-feedback'

export default function FeedbackPage() {
  const { user } = useAuth()
  
  const currentUser = user ? {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || user.user_metadata?.name
  } : null

  return (
    <div className="min-h-screen bg-gray-50">
      <CommunityFeedback 
        serviceName="YouTube Summary Service" 
        currentUser={currentUser}
      />
    </div>
  )
}