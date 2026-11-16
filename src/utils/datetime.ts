/**
 * Formata um timestamp como “Atualizado agora”, “Atualizado há 5 min” etc.
 */
export function formatRelativeUpdateTime(
  timestamp: number | null,
  now = Date.now(),
): string {
  if (timestamp == null) {
    return 'Nunca atualizado';
  }

  const diffMs = Math.max(0, now - timestamp);
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) {
    return 'Atualizado agora';
  }

  if (minutes < 60) {
    return `Atualizado há ${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `Atualizado há ${hours}h`;
  }

  const days = Math.floor(hours / 24);
  return `Atualizado há ${days}d`;
}

/**
 * Formata um timestamp como data curta no padrão brasileiro: "15/11/2026".
 */
export function formatShortDate(timestamp: number | null): string | null {
  if (timestamp == null) {
    return null;
  }

  const date = new Date(timestamp);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');

  return `${day}/${month}/${date.getFullYear()}`;
}
