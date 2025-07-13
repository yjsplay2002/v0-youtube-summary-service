import React, { useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View, ActivityIndicator } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from './src/contexts/AuthContext'
import AuthScreen from './src/screens/AuthScreen'
import HomeScreen from './src/screens/HomeScreen'
import SummaryDisplay from './src/components/SummaryDisplay'
import type { VideoSummary } from './src/types'

function AppContent() {
  const { user, loading } = useAuth()
  const [selectedSummary, setSelectedSummary] = useState<VideoSummary | null>(null)

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    )
  }

  if (!user) {
    return <AuthScreen />
  }

  if (selectedSummary) {
    return (
      <SummaryDisplay
        summary={selectedSummary}
        onClose={() => setSelectedSummary(null)}
      />
    )
  }

  return (
    <HomeScreen onSummarySelect={setSelectedSummary} />
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <View style={styles.container}>
          <AppContent />
          <StatusBar style="auto" />
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
})
