import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PostHogProvider } from 'posthog-react-native';
import React, { useEffect } from 'react';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import {
  posthog,
  screen,
  startSessionReplayIfSampled,
  stopSessionReplay,
} from '../services/analytics';

const STATIC_SCREEN_NAMES: Record<string, string> = {
  '/': 'Home',
  '/scan': 'Scanner',
  '/lists': 'All lists',
};

/** `/lists/42` e `/lists/7` são a mesma tela para analytics. */
const LIST_DETAIL_PATTERN = /^\/lists\/[^/]+$/;

function screenNameForPath(pathname: string): string {
  if (LIST_DETAIL_PATTERN.test(pathname)) {
    return 'List detail';
  }

  return STATIC_SCREEN_NAMES[pathname] ?? pathname;
}

function AnalyticsScreens() {
  const pathname = usePathname();

  useEffect(() => {
    screen(screenNameForPath(pathname));

    // A câmera nunca deve aparecer nos replays.
    if (pathname === '/scan') {
      stopSessionReplay();
      return;
    }

    startSessionReplayIfSampled();
  }, [pathname]);

  return null;
}

export default function RootLayout() {
  return (
    <PostHogProvider
      client={posthog}
      autocapture={{ captureScreens: false, captureTouches: false }}
    >
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <StatusBar style="light" />
        <AnalyticsScreens />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0F172A' },
          }}
        />
      </SafeAreaProvider>
    </PostHogProvider>
  );
}
