import React, { useState } from 'react'
import { View, StyleSheet, Dimensions, Alert } from 'react-native'
import { WebView } from 'react-native-webview'

interface VideoPlayerProps {
  videoId: string
  width?: number
  height?: number
}

export default function VideoPlayer({ videoId, width, height }: VideoPlayerProps) {
  const [loading, setLoading] = useState(true)
  const screenWidth = Dimensions.get('window').width
  
  const playerWidth = width || screenWidth - 32
  const playerHeight = height || (playerWidth * 9) / 16 // 16:9 aspect ratio

  const embedUrl = `https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0`

  const handleError = () => {
    setLoading(false)
    Alert.alert('Error', 'Failed to load video player')
  }

  const handleLoad = () => {
    setLoading(false)
  }

  return (
    <View style={[styles.container, { width: playerWidth, height: playerHeight }]}>
      <WebView
        source={{ uri: embedUrl }}
        style={styles.webview}
        onLoadEnd={handleLoad}
        onError={handleError}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
  },
})