import React from 'react';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { ScannerScreen } from './src/screens/ScannerScreen';

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ScannerScreen />
    </SafeAreaProvider>
  );
}
