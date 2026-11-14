import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ListDetailScreen } from '../../screens/ListDetailScreen';

export default function ListDetailRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const parsedId = id == null ? Number.NaN : Number(id);
  const listId = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;

  return <ListDetailScreen listId={listId} />;
}
