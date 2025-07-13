import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { getUserSummaries } from '../api/video-service'
import YouTubeForm from '../components/YouTubeForm'
import type { VideoSummary } from '../types'

interface HomeScreenProps {
  onSummarySelect: (summary: VideoSummary) => void
}

export default function HomeScreen({ onSummarySelect }: HomeScreenProps) {
  const { user } = useAuth()
  const [summaries, setSummaries] = useState<VideoSummary[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      loadSummaries()
    }
  }, [user])

  const loadSummaries = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const userSummaries = await getUserSummaries(user.id)
      setSummaries(userSummaries)
    } catch (error) {
      console.error('Error loading summaries:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSummaryCreated = (videoId: string) => {
    // Refresh summaries list
    loadSummaries()
  }

  const renderSummaryItem = ({ item }: { item: VideoSummary }) => (
    <TouchableOpacity
      style={styles.summaryItem}
      onPress={() => onSummarySelect(item)}
    >
      <View style={styles.summaryContent}>
        <Text style={styles.summaryTitle} numberOfLines={2}>
          {item.video_info?.video_title || 'Untitled Video'}
        </Text>
        <Text style={styles.summaryChannel}>
          {item.video_info?.channel_title}
        </Text>
        <Text style={styles.summaryDate}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  )

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.centeredContent}>
          <Text style={styles.title}>Welcome to YouTube Summarizer</Text>
          <Text style={styles.subtitle}>
            Please sign in to start summarizing videos
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <YouTubeForm onSummaryCreated={handleSummaryCreated} />
      
      <View style={styles.summariesSection}>
        <Text style={styles.sectionTitle}>Your Summaries</Text>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading summaries...</Text>
          </View>
        ) : summaries.length === 0 ? (
          <View style={styles.emptySummaries}>
            <Text style={styles.emptyText}>
              No summaries yet. Create your first summary above!
            </Text>
          </View>
        ) : (
          <FlatList
            data={summaries}
            renderItem={renderSummaryItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.summariesList}
          />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    lineHeight: 22,
  },
  summariesSection: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptySummaries: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  summariesList: {
    paddingBottom: 20,
  },
  summaryItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryContent: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  summaryChannel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  summaryDate: {
    fontSize: 12,
    color: '#999',
  },
})