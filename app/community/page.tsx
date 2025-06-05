import CommunityFeedback from '@/components/community-feedback'

export default function CommunityPage() {
  // Example usage - in a real app, you'd get the current user from your auth system
  const currentUser = {
    id: 'example-user-id',
    email: 'user@example.com',
    name: 'Example User'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CommunityFeedback 
        serviceName="YouTube Summary Service" 
        currentUser={currentUser}
      />
    </div>
  )
}