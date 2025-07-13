import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { summarizeYoutubeVideo } from '../api/video-service'
import { isValidYoutubeUrl } from '../lib/youtube-utils'
import type { AIModel, SupportedLanguage, PromptType } from '../types'

interface YouTubeFormProps {
  onSummaryCreated?: (videoId: string) => void
}

export default function YouTubeForm({ onSummaryCreated }: YouTubeFormProps) {
  const { user } = useAuth()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!url.trim()) {
      Alert.alert('Error', 'Please enter a YouTube URL')
      return
    }

    if (!isValidYoutubeUrl(url)) {
      Alert.alert('Error', 'Please enter a valid YouTube URL')
      return
    }

    if (!user) {
      Alert.alert('Error', 'Please sign in to summarize videos')
      return
    }

    setLoading(true)

    try {
      const result = await summarizeYoutubeVideo(
        url,
        'gemini-2.5-flash',
        'ko',
        'general_summary'
      )

      if (result.success && result.videoId) {
        setUrl('')
        onSummaryCreated?.(result.videoId)
        Alert.alert('Success', 'Video summarized successfully!')
      } else {
        Alert.alert('Error', result.error || 'Failed to summarize video')
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred')
      console.error('Summarization error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>YouTube Video Summarizer</Text>
      <Text style={styles.subtitle}>
        Enter a YouTube URL to get an AI-powered summary
      </Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="https://www.youtube.com/watch?v=..."
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.buttonText}>Summarize</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  inputContainer: {
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
})