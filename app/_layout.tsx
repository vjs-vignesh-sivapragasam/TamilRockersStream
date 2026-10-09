import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#141414' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="stream/player" options={{ orientation: 'landscape', presentation: 'fullScreenModal' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
