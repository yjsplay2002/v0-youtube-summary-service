import React from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native'
import VideoPlayer from './VideoPlayer'
import type { VideoSummary } from '../types'

interface SummaryDisplayProps {
  summary: VideoSummary
  onClose?: () => void
}

export default function SummaryDisplay({ summary, onClose }: SummaryDisplayProps) {
  const handleOpenVideo = () => {
    if (summary.video_info?.video_id) {
      const url = `https://www.youtube.com/watch?v=${summary.video_info.video_id}`
      Linking.openURL(url)
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        {onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        )}
        
        {summary.video_info?.video_id && (
          <View style={styles.videoPlayerContainer}>
            <VideoPlayer videoId={summary.video_info.video_id} />
          </View>
        )}
        
        <Text style={styles.title}>{summary.video_info?.video_title}</Text>
        
        {summary.video_info?.channel_title && (
          <Text style={styles.channel}>{summary.video_info.channel_title}</Text>
        )}
        
        <TouchableOpacity style={styles.watchButton} onPress={handleOpenVideo}>
          <Text style={styles.watchButtonText}>Open in YouTube</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.summarySection}>
        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryText}>{summary.summary}</Text>
        </View>
      </View>
      
      <View style={styles.metadata}>
        <Text style={styles.metadataText}>
          Language: {summary.language.toUpperCase()}
        </Text>
        <Text style={styles.metadataText}>
          Model: {summary.model}
        </Text>
        <Text style={styles.metadataText}>
          Created: {new Date(summary.created_at).toLocaleDateString()}
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#666',
  },
  videoPlayerContainer: {
    width: '100%',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
    lineHeight: 26,
  },
  channel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  watchButton: {
    backgroundColor: '#FF0000',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  watchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  summarySection: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  summaryContainer: {
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  summaryText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  metadata: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
  },
  metadataText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
})