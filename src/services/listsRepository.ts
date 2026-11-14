import { getDatabase } from '../db/database';
import type {
  AddCardToListInput,
  CardFinish,
  CardList,
  CardListItem,
  CardListSnapshot,
  ListDetail,
  ListSummary,
} from '../types/list';
import { buildCardSnapshot, getAvailableFinishes } from '../utils/cardSnapshot';
import { normalizeListName } from '../utils/listName';

export {
  InvalidListNameError,
  MAX_LIST_NAME_LENGTH,
  normalizeListName,
} from '../utils/listName';

export class ListNotFoundError extends Error {
  constructor(listId: number) {
    super(`Lista ${listId} não encontrada.`);
    this.name = 'ListNotFoundError';
  }
}

export class ListItemNotFoundError extends Error {
  constructor(itemId: number) {
    super(`Item ${itemId} não encontrado na lista.`);
    this.name = 'ListItemNotFoundError';
  }
}

interface ListRow {
  id: number;
  name: string;
  created_at: number;
  last_accessed_at: number;
  last_refreshed_at: number | null;
}

interface ListSummaryRow extends ListRow {
  card_count: number;
  estimated_value_usd_cents: number;
}

interface ListItemRow {
  id: number;
  list_id: number;
  card_id: string;
  set_code: string;
  collector_number: string;
  finish: CardFinish;
  quantity: number;
  card_snapshot_json: string;
  entry_price_usd_cents: number | null;
  last_added_at: number;
  current_price_usd_cents: number | null;
  price_updated_at: number | null;
  created_at: number;
}

const LIST_SUMMARY_SELECT = `
  SELECT
    l.id,
    l.name,
    l.created_at,
    l.last_accessed_at,
    l.last_refreshed_at,
    CAST(COALESCE(SUM(li.quantity), 0) AS INTEGER) AS card_count,
    CAST(
      COALESCE(
        SUM(
          li.quantity * COALESCE(
            li.current_price_usd_cents,
            li.entry_price_usd_cents
          )
        ),
        0
      ) AS INTEGER
    ) AS estimated_value_usd_cents
  FROM lists l
  LEFT JOIN list_items li ON li.list_id = l.id
  GROUP BY l.id
`;

function mapListRow(row: ListRow): CardList {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    lastAccessedAt: row.last_accessed_at,
    lastRefreshedAt: row.last_refreshed_at,
  };
}

function mapListSummaryRow(row: ListSummaryRow): ListSummary {
  return {
    id: row.id,
    name: row.name,
    cardCount: Number(row.card_count),
    estimatedValueUsdCents: Number(row.estimated_value_usd_cents),
    lastAccessedAt: row.last_accessed_at,
    lastRefreshedAt: row.last_refreshed_at,
  };
}

function parseCardSnapshot(raw: string): CardListSnapshot {
  try {
    return JSON.parse(raw) as CardListSnapshot;
  } catch {
    // Um snapshot corrompido não deve impedir a lista inteira de abrir.
    return {
      id: '',
      name: 'Carta sem dados',
      setCode: '',
      setName: '',
      collectorNumber: '',
      rarity: 'common',
      typeLine: '',
      imageUriNormal: null,
      finishes: [],
    };
  }
}

function mapListItemRow(row: ListItemRow): CardListItem {
  return {
    id: row.id,
    listId: row.list_id,
    cardId: row.card_id,
    setCode: row.set_code,
    collectorNumber: row.collector_number,
    finish: row.finish,
    quantity: row.quantity,
    snapshot: parseCardSnapshot(row.card_snapshot_json),
    entryPriceUsdCents: row.entry_price_usd_cents,
    lastAddedAt: row.last_added_at,
    currentPriceUsdCents: row.current_price_usd_cents,
    priceUpdatedAt: row.price_updated_at,
    createdAt: row.created_at,
  };
}

function calculateListTotals(items: CardListItem[]): {
  cardCount: number;
  estimatedValueUsdCents: number;
} {
  return items.reduce(
    (totals, item) => {
      const unitPrice = item.currentPriceUsdCents ?? item.entryPriceUsdCents;
      const value = unitPrice == null ? 0 : unitPrice * item.quantity;

      return {
        cardCount: totals.cardCount + item.quantity,
        estimatedValueUsdCents: totals.estimatedValueUsdCents + value,
      };
    },
    { cardCount: 0, estimatedValueUsdCents: 0 },
  );
}

async function getListSummaries(limit?: number): Promise<ListSummary[]> {
  const db = await getDatabase();

  if (limit != null) {
    const safeLimit = Math.max(0, Math.floor(limit));
    const rows = await db.getAllAsync<ListSummaryRow>(
      `${LIST_SUMMARY_SELECT}
       ORDER BY l.last_accessed_at DESC, l.id DESC
       LIMIT ?`,
      safeLimit,
    );

    return rows.map(mapListSummaryRow);
  }

  const rows = await db.getAllAsync<ListSummaryRow>(
    `${LIST_SUMMARY_SELECT}
     ORDER BY l.last_accessed_at DESC, l.id DESC`,
  );

  return rows.map(mapListSummaryRow);
}

export async function createList(rawName: string): Promise<CardList> {
  const name = normalizeListName(rawName);
  const now = Date.now();
  const db = await getDatabase();

  const result = await db.runAsync(
    `INSERT INTO lists (name, created_at, last_accessed_at)
     VALUES (?, ?, ?)`,
    name,
    now,
    now,
  );

  return {
    id: result.lastInsertRowId,
    name,
    createdAt: now,
    lastAccessedAt: now,
    lastRefreshedAt: null,
  };
}

export async function renameList(
  listId: number,
  rawName: string,
): Promise<void> {
  const name = normalizeListName(rawName);
  const db = await getDatabase();

  const result = await db.runAsync(
    `UPDATE lists
     SET name = ?, last_accessed_at = ?
     WHERE id = ?`,
    name,
    Date.now(),
    listId,
  );

  if (result.changes === 0) {
    throw new ListNotFoundError(listId);
  }
}

export async function deleteList(listId: number): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM list_items WHERE list_id = ?', listId);
    await db.runAsync('DELETE FROM lists WHERE id = ?', listId);
  });
}

export async function touchListAccess(listId: number): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    'UPDATE lists SET last_accessed_at = ? WHERE id = ?',
    Date.now(),
    listId,
  );
}

export function getRecentListSummaries(limit = 3): Promise<ListSummary[]> {
  return getListSummaries(limit);
}

export function getAllListSummaries(): Promise<ListSummary[]> {
  return getListSummaries();
}

export async function getListById(listId: number): Promise<CardList | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<ListRow>(
    'SELECT * FROM lists WHERE id = ?',
    listId,
  );

  return row ? mapListRow(row) : null;
}

export async function getListDetail(
  listId: number,
): Promise<ListDetail | null> {
  const db = await getDatabase();

  const listRow = await db.getFirstAsync<ListRow>(
    'SELECT * FROM lists WHERE id = ?',
    listId,
  );

  if (!listRow) {
    return null;
  }

  const itemRows = await db.getAllAsync<ListItemRow>(
    `SELECT *
     FROM list_items
     WHERE list_id = ?
     ORDER BY last_added_at DESC, id DESC`,
    listId,
  );

  const items = itemRows.map(mapListItemRow);
  const totals = calculateListTotals(items);

  return {
    ...mapListRow(listRow),
    items,
    ...totals,
  };
}

export async function getListItemForCard(
  listId: number,
  cardId: string,
  finish: CardFinish,
): Promise<CardListItem | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<ListItemRow>(
    `SELECT *
     FROM list_items
     WHERE list_id = ? AND card_id = ? AND finish = ?`,
    listId,
    cardId,
    finish,
  );

  return row ? mapListItemRow(row) : null;
}

export async function getListItemsForCard(
  listId: number,
  cardId: string,
): Promise<CardListItem[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<ListItemRow>(
    `SELECT *
     FROM list_items
     WHERE list_id = ? AND card_id = ?
     ORDER BY finish`,
    listId,
    cardId,
  );

  return rows.map(mapListItemRow);
}

export async function addCardToList(input: AddCardToListInput): Promise<void> {
  const quantity = Math.floor(input.quantity);

  if (!Number.isFinite(quantity) || quantity < 1) {
    throw new Error('A quantidade deve ser pelo menos 1.');
  }

  const availableFinishes = getAvailableFinishes(input.card);

  if (
    availableFinishes.length > 0 &&
    !availableFinishes.includes(input.finish)
  ) {
    throw new Error(
      `O acabamento "${input.finish}" não está disponível para ${input.card.name}.`,
    );
  }

  const snapshotJson = JSON.stringify(buildCardSnapshot(input.card));
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    const list = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM lists WHERE id = ?',
      input.listId,
    );

    if (!list) {
      throw new ListNotFoundError(input.listId);
    }

    await db.runAsync(
      `INSERT INTO list_items (
         list_id,
         card_id,
         set_code,
         collector_number,
         finish,
         quantity,
         card_snapshot_json,
         entry_price_usd_cents,
         last_added_at,
         current_price_usd_cents,
         price_updated_at,
         created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
       ON CONFLICT (list_id, card_id, finish) DO UPDATE SET
         quantity = list_items.quantity + excluded.quantity,
         card_snapshot_json = excluded.card_snapshot_json,
         entry_price_usd_cents = excluded.entry_price_usd_cents,
         last_added_at = excluded.last_added_at`,
      input.listId,
      input.card.id,
      input.card.set,
      input.card.collector_number,
      input.finish,
      quantity,
      snapshotJson,
      input.entryPriceUsdCents,
      input.now,
      input.now,
    );

    await db.runAsync(
      'UPDATE lists SET last_accessed_at = ? WHERE id = ?',
      input.now,
      input.listId,
    );
  });
}

export async function incrementItemQuantity(itemId: number): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    const item = await db.getFirstAsync<{ list_id: number }>(
      'SELECT list_id FROM list_items WHERE id = ?',
      itemId,
    );

    if (!item) {
      throw new ListItemNotFoundError(itemId);
    }

    const now = Date.now();

    await db.runAsync(
      'UPDATE list_items SET quantity = quantity + 1 WHERE id = ?',
      itemId,
    );

    await db.runAsync(
      'UPDATE lists SET last_accessed_at = ? WHERE id = ?',
      now,
      item.list_id,
    );
  });
}

export async function decrementItemQuantity(itemId: number): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    const item = await db.getFirstAsync<{
      list_id: number;
      quantity: number;
    }>('SELECT list_id, quantity FROM list_items WHERE id = ?', itemId);

    if (!item) {
      throw new ListItemNotFoundError(itemId);
    }

    // A remoção da última cópia é feita pela lixeira, com confirmação.
    if (item.quantity <= 1) {
      return;
    }

    const now = Date.now();

    await db.runAsync(
      'UPDATE list_items SET quantity = quantity - 1 WHERE id = ?',
      itemId,
    );

    await db.runAsync(
      'UPDATE lists SET last_accessed_at = ? WHERE id = ?',
      now,
      item.list_id,
    );
  });
}

export async function removeListItem(itemId: number): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    const item = await db.getFirstAsync<{ list_id: number }>(
      'SELECT list_id FROM list_items WHERE id = ?',
      itemId,
    );

    if (!item) {
      throw new ListItemNotFoundError(itemId);
    }

    const now = Date.now();

    await db.runAsync('DELETE FROM list_items WHERE id = ?', itemId);
    await db.runAsync(
      'UPDATE lists SET last_accessed_at = ? WHERE id = ?',
      now,
      item.list_id,
    );
  });
}
