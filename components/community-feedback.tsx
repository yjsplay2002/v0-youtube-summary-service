'use client'

import { useState, useEffect } from 'react'
import { feedbackSupabase, type FeedbackPost, type FeedbackComment } from '@/lib/feedback-supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ArrowUp, ArrowDown, MessageCircle, Plus, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface CommunityFeedbackProps {
  serviceName: string
  currentUser?: {
    id: string
    email?: string
    name?: string
  } | null
}

export default function CommunityFeedback({ serviceName, currentUser }: CommunityFeedbackProps) {
  const [posts, setPosts] = useState<FeedbackPost[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewPost, setShowNewPost] = useState(false)
  const [newPostTitle, setNewPostTitle] = useState('')
  const [newPostContent, setNewPostContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expandedPost, setExpandedPost] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, FeedbackComment[]>>({})
  const [newComment, setNewComment] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchPosts()
  }, [serviceName])

  const fetchPosts = async () => {
    try {
      const { data, error } = await feedbackSupabase
        .from('feedback_posts')
        .select('*')
        .eq('service_name', serviceName)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPosts(data || [])
    } catch (error) {
      console.error('Error fetching posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchComments = async (postId: string) => {
    try {
      const { data, error } = await feedbackSupabase
        .from('feedback_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setComments(prev => ({ ...prev, [postId]: data || [] }))
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
  }

  const submitPost = async () => {
    if (!currentUser || !newPostTitle.trim() || !newPostContent.trim()) return

    setSubmitting(true)
    try {
      const { data, error } = await feedbackSupabase
        .from('feedback_posts')
        .insert([{
          user_id: currentUser.id,
          service_name: serviceName,
          title: newPostTitle.trim(),
          content: newPostContent.trim(),
          user_email: currentUser.email,
          user_name: currentUser.name
        }])
        .select()

      if (error) throw error

      setNewPostTitle('')
      setNewPostContent('')
      setShowNewPost(false)
      fetchPosts()
    } catch (error) {
      console.error('Error submitting post:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const submitComment = async (postId: string) => {
    if (!currentUser || !newComment[postId]?.trim()) return

    try {
      const { data, error } = await feedbackSupabase
        .from('feedback_comments')
        .insert([{
          post_id: postId,
          user_id: currentUser.id,
          content: newComment[postId].trim(),
          user_email: currentUser.email,
          user_name: currentUser.name
        }])
        .select()

      if (error) throw error

      setNewComment(prev => ({ ...prev, [postId]: '' }))
      fetchComments(postId)
    } catch (error) {
      console.error('Error submitting comment:', error)
    }
  }

  const handleVote = async (postId: string, voteType: 'upvote' | 'downvote') => {
    if (!currentUser) return

    try {
      // Check if user already voted
      const { data: existingVote } = await feedbackSupabase
        .from('feedback_votes')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('post_id', postId)
        .single()

      if (existingVote) {
        // Update existing vote or remove if same type
        if (existingVote.vote_type === voteType) {
          await feedbackSupabase
            .from('feedback_votes')
            .delete()
            .eq('id', existingVote.id)
        } else {
          await feedbackSupabase
            .from('feedback_votes')
            .update({ vote_type: voteType })
            .eq('id', existingVote.id)
        }
      } else {
        // Insert new vote
        await feedbackSupabase
          .from('feedback_votes')
          .insert([{
            user_id: currentUser.id,
            post_id: postId,
            vote_type: voteType
          }])
      }

      // Update post vote counts
      const post = posts.find(p => p.id === postId)
      if (post) {
        const increment = voteType === 'upvote' ? 1 : -1
        const field = voteType === 'upvote' ? 'upvotes' : 'downvotes'
        
        await feedbackSupabase
          .from('feedback_posts')
          .update({ [field]: post[field] + increment })
          .eq('id', postId)
      }

      fetchPosts()
    } catch (error) {
      console.error('Error voting:', error)
    }
  }

  const toggleComments = (postId: string) => {
    if (expandedPost === postId) {
      setExpandedPost(null)
    } else {
      setExpandedPost(postId)
      if (!comments[postId]) {
        fetchComments(postId)
      }
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Community Feedback</h1>
          <Badge variant="secondary" className="mt-1">{serviceName}</Badge>
        </div>
        {currentUser && (
          <Button onClick={() => setShowNewPost(!showNewPost)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Post
          </Button>
        )}
      </div>

      {showNewPost && currentUser && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Create New Post</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Post title..."
              value={newPostTitle}
              onChange={(e) => setNewPostTitle(e.target.value)}
            />
            <Textarea
              placeholder="What's on your mind?"
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              rows={4}
            />
            <div className="flex gap-2">
              <Button 
                onClick={submitPost} 
                disabled={submitting || !newPostTitle.trim() || !newPostContent.trim()}
              >
                {submitting ? 'Posting...' : 'Post'}
              </Button>
              <Button variant="outline" onClick={() => setShowNewPost(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {posts.map((post) => (
          <Card key={post.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className="flex flex-col items-center gap-1 min-w-[40px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleVote(post.id, 'upvote')}
                    disabled={!currentUser}
                    className="h-8 w-8 p-0 hover:bg-orange-100"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium">
                    {post.upvotes - post.downvotes}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleVote(post.id, 'downvote')}
                    disabled={!currentUser}
                    className="h-8 w-8 p-0 hover:bg-blue-100"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">{post.title}</h3>
                  <p className="text-gray-700 mb-3 whitespace-pre-wrap">{post.content}</p>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {post.user_name || post.user_email || 'Anonymous'}
                    </div>
                    <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleComments(post.id)}
                      className="gap-1 h-auto p-1"
                    >
                      <MessageCircle className="h-3 w-3" />
                      {comments[post.id]?.length || 0} comments
                    </Button>
                  </div>

                  {expandedPost === post.id && (
                    <div className="mt-4 space-y-3 border-t pt-4">
                      {currentUser && (
                        <div className="flex gap-2">
                          <Textarea
                            placeholder="Add a comment..."
                            value={newComment[post.id] || ''}
                            onChange={(e) => setNewComment(prev => ({ ...prev, [post.id]: e.target.value }))}
                            rows={2}
                            className="flex-1"
                          />
                          <Button
                            onClick={() => submitComment(post.id)}
                            disabled={!newComment[post.id]?.trim()}
                            size="sm"
                          >
                            Comment
                          </Button>
                        </div>
                      )}

                      {comments[post.id]?.map((comment) => (
                        <div key={comment.id} className="bg-gray-50 p-3 rounded-lg">
                          <p className="mb-2 whitespace-pre-wrap">{comment.content}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <User className="h-3 w-3" />
                            {comment.user_name || comment.user_email || 'Anonymous'}
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {posts.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">No feedback yet</h3>
              <p className="text-gray-600 mb-4">Be the first to share your thoughts about {serviceName}!</p>
              {currentUser && (
                <Button onClick={() => setShowNewPost(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create First Post
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}