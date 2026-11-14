import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScannerScreen } from '../screens/ScannerScreen';

export default function ScanRoute() {
  const { listId } = useLocalSearchParams<{ listId?: string }>();
  const parsedListId = listId == null ? Number.NaN : Number(listId);
  const activeListId =
    Number.isInteger(parsedListId) && parsedListId > 0
      ? parsedListId
      : null;

  return <ScannerScreen activeListId={activeListId} />;
}
