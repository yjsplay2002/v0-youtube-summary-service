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

      let voteAction: 'add' | 'remove' | 'change' = 'add'
      let oldVoteType: string | null = null

      if (existingVote) {
        oldVoteType = existingVote.vote_type
        if (existingVote.vote_type === voteType) {
          // Remove existing vote (user clicked same button)
          await feedbackSupabase
            .from('feedback_votes')
            .delete()
            .eq('id', existingVote.id)
          voteAction = 'remove'
        } else {
          // Change vote type (user clicked opposite button)
          await feedbackSupabase
            .from('feedback_votes')
            .update({ vote_type: voteType })
            .eq('id', existingVote.id)
          voteAction = 'change'
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
        voteAction = 'add'
      }

      // Recalculate vote counts from database
      const { data: upvoteCount } = await feedbackSupabase
        .from('feedback_votes')
        .select('*', { count: 'exact' })
        .eq('post_id', postId)
        .eq('vote_type', 'upvote')

      const { data: downvoteCount } = await feedbackSupabase
        .from('feedback_votes')
        .select('*', { count: 'exact' })
        .eq('post_id', postId)
        .eq('vote_type', 'downvote')

      // Update post with accurate counts
      await feedbackSupabase
        .from('feedback_posts')
        .update({
          upvotes: upvoteCount?.length || 0,
          downvotes: downvoteCount?.length || 0
        })
        .eq('id', postId)

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
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-950">
        <div className="text-slate-400 text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6 pt-20 space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Community Feedback</h1>
          <Badge variant="secondary" className="mt-2 bg-slate-800 text-slate-300 border-slate-700">{serviceName}</Badge>
        </div>
        {currentUser && (
          <Button 
            onClick={() => setShowNewPost(!showNewPost)} 
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 text-sm font-medium"
            size="default"
          >
            <Plus className="h-4 w-4" />
            New Post
          </Button>
        )}
      </div>

      {showNewPost && currentUser && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-4">
            <h3 className="text-xl font-semibold text-slate-100">Create New Post</h3>
          </CardHeader>
          <CardContent className="space-y-5">
            <Input
              placeholder="Post title..."
              value={newPostTitle}
              onChange={(e) => setNewPostTitle(e.target.value)}
              className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/20"
            />
            <Textarea
              placeholder="What's on your mind?"
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              rows={5}
              className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/20 resize-none"
            />
            <div className="flex gap-3 pt-2">
              <Button 
                onClick={submitPost} 
                disabled={submitting || !newPostTitle.trim() || !newPostContent.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 disabled:bg-slate-700 disabled:text-slate-400"
              >
                {submitting ? 'Posting...' : 'Post'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowNewPost(false)}
                className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100 px-6 py-2.5"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-5">
        {posts.map((post) => (
          <Card key={post.id} className="bg-slate-900 border-slate-800 hover:bg-slate-900/80 transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="flex flex-col items-center gap-2 min-w-[50px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleVote(post.id, 'upvote')}
                    disabled={!currentUser}
                    className="h-10 w-10 p-0 hover:bg-orange-500/10 text-slate-400 hover:text-orange-400 transition-colors"
                  >
                    <ArrowUp className="h-5 w-5" />
                  </Button>
                  <span className="text-sm font-bold text-slate-300 min-w-[24px] text-center">
                    {post.upvotes - post.downvotes}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleVote(post.id, 'downvote')}
                    disabled={!currentUser}
                    className="h-10 w-10 p-0 hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 transition-colors"
                  >
                    <ArrowDown className="h-5 w-5" />
                  </Button>
                </div>

                <div className="flex-1">
                  <h3 className="font-semibold text-xl mb-3 text-slate-100">{post.title}</h3>
                  <p className="text-slate-300 mb-4 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                  
                  <div className="flex items-center gap-6 text-sm text-slate-400">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span className="text-slate-300">{post.user_name || post.user_email || 'Anonymous'}</span>
                    </div>
                    <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleComments(post.id)}
                      className="gap-2 h-auto p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {comments[post.id]?.length || 0} comments
                    </Button>
                  </div>

                  {expandedPost === post.id && (
                    <div className="mt-6 space-y-4 border-t border-slate-800 pt-6">
                      {currentUser && (
                        <div className="flex gap-3">
                          <Textarea
                            placeholder="Add a comment..."
                            value={newComment[post.id] || ''}
                            onChange={(e) => setNewComment(prev => ({ ...prev, [post.id]: e.target.value }))}
                            rows={3}
                            className="flex-1 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/20 resize-none"
                          />
                          <Button
                            onClick={() => submitComment(post.id)}
                            disabled={!newComment[post.id]?.trim()}
                            className="self-end bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 disabled:bg-slate-700 disabled:text-slate-400"
                          >
                            Comment
                          </Button>
                        </div>
                      )}

                      {comments[post.id]?.map((comment) => (
                        <div key={comment.id} className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                          <p className="mb-3 whitespace-pre-wrap text-slate-200 leading-relaxed">{comment.content}</p>
                          <div className="flex items-center gap-3 text-sm text-slate-400">
                            <User className="h-4 w-4" />
                            <span className="text-slate-300">{comment.user_name || comment.user_email || 'Anonymous'}</span>
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
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="text-center py-16">
              <MessageCircle className="h-16 w-16 mx-auto mb-6 text-slate-600" />
              <h3 className="text-xl font-semibold mb-3 text-slate-200">No feedback yet</h3>
              <p className="text-slate-400 mb-6 text-lg">Be the first to share your thoughts about {serviceName}!</p>
              {currentUser && (
                <Button 
                  onClick={() => setShowNewPost(true)} 
                  className="gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 text-base"
                >
                  <Plus className="h-5 w-5" />
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