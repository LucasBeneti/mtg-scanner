export interface ParsedCollectorInfo {
  /** Código da edição em minúsculo para a API da Scryfall (ex: "blb", "fdn", "mh3") */
  setCode: string;
  /** Número do colecionador normalizado sem zeros à esquerda (ex: "64", "125a", "125★") */
  collectorNumber: string;
  /** Representação legível extraída do OCR (ex: "BLB • 0064") */
  rawMatch: string;
}

export interface CardPrices {
  usd: string | null;
  usd_foil: string | null;
  usd_etched: string | null;
  eur: string | null;
  eur_foil: string | null;
  eur_etched?: string | null;
  tix: string | null;
}

export interface CardImageUris {
  small?: string;
  normal?: string;
  large?: string;
  png?: string;
  art_crop?: string;
  border_crop?: string;
}

export interface CardFace {
  name: string;
  printed_name?: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  image_uris?: CardImageUris;
}

export interface ScryfallCard {
  id: string;
  oracle_id?: string;
  name: string;
  printed_name?: string;
  lang: string;
  released_at: string;
  uri: string;
  scryfall_uri: string;
  layout: string;
  image_uris?: CardImageUris;
  card_faces?: CardFace[];
  mana_cost?: string;
  cmc?: number;
  type_line: string;
  oracle_text?: string;
  colors?: string[];
  set: string;
  set_name: string;
  collector_number: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'mythic' | 'special' | 'bonus';
  artist?: string;
  finishes?: Array<'nonfoil' | 'foil' | 'etched'>;
  prices: CardPrices;
}
