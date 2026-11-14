export const MAX_LIST_NAME_LENGTH = 40;

export class InvalidListNameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidListNameError';
  }
}

export function normalizeListName(rawName: string): string {
  const name = rawName.trim();

  if (!name) {
    throw new InvalidListNameError('O nome da lista não pode ficar vazio.');
  }

  if (name.length > MAX_LIST_NAME_LENGTH) {
    throw new InvalidListNameError(
      `O nome da lista deve ter no máximo ${MAX_LIST_NAME_LENGTH} caracteres.`,
    );
  }

  return name;
}
