import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { extractVideoId, isValidYouTubeUrl } from '@youtube-summary/shared';
import { ApiClient } from '../../services/api-client';

const apiClient = new ApiClient({
  baseUrl: 'http://localhost:3000', // Update this to your server URL
});

export default function HomeScreen() {
  const [url, setUrl] = useState('');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!url.trim()) {
      Alert.alert('Error', 'Please enter a YouTube URL');
      return;
    }

    if (!isValidYouTubeUrl(url)) {
      Alert.alert('Error', 'Please enter a valid YouTube URL');
      return;
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      Alert.alert('Error', 'Could not extract video ID from URL');
      return;
    }

    setLoading(true);
    setSummary(null);

    try {
      const response = await apiClient.getVideoSummaryByLanguage(videoId, language);
      
      if (response.success && response.data) {
        setSummary(response.data.summary);
      } else {
        Alert.alert('Error', response.error || 'Failed to get summary');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>YouTube Summary</Text>
        <Text style={styles.subtitle}>Get AI-powered summaries of YouTube videos</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>YouTube URL</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://youtube.com/watch?v=..."
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Language</Text>
          <View style={styles.languageContainer}>
            {['en', 'ko', 'ja', 'zh'].map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[
                  styles.languageButton,
                  language === lang && styles.languageButtonActive,
                ]}
                onPress={() => setLanguage(lang)}
              >
                <Text
                  style={[
                    styles.languageButtonText,
                    language === lang && styles.languageButtonTextActive,
                  ]}
                >
                  {lang.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Get Summary</Text>
          )}
        </TouchableOpacity>

        {summary && (
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>Summary</Text>
            <Text style={styles.summaryText}>{summary}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666666',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  languageContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  languageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e5e7',
    backgroundColor: '#ffffff',
  },
  languageButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  languageButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  languageButtonTextActive: {
    color: '#ffffff',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#cccccc',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e5e7',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1a1a1a',
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333333',
  },
});