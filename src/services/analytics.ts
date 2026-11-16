import PostHog from 'posthog-react-native';

/**
 * Única porta de entrada para analytics no app.
 *
 * Nenhum outro arquivo deve importar `posthog-react-native` diretamente: assim
 * o catálogo de eventos fica tipado em um só lugar e o envio pode ser
 * desligado sem espalhar condicionais pelas telas.
 */

const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
const isDevTrackingEnabled = process.env.EXPO_PUBLIC_POSTHOG_DEV === '1';

/** Em dev, só envia se `EXPO_PUBLIC_POSTHOG_DEV=1`. Sem chave, nunca envia. */
export const isAnalyticsEnabled =
  Boolean(apiKey) && (!__DEV__ || isDevTrackingEnabled);

/**
 * Chave de projeto do PostHog (`phc_...`) é pública e write-only, feita para
 * ficar no bundle. Nunca use uma Personal API Key aqui.
 */
export const posthog = new PostHog(apiKey ?? 'phc_analytics_disabled', {
  host,
  disabled: !isAnalyticsEnabled,
  captureAppLifecycleEvents: true,
  // `enableSessionReplay` fica desligado de propósito: a gravação é controlada
  // por tela (start/stop) para nunca capturar o preview da câmera.
  sessionReplayConfig: {
    maskAllTextInputs: true,
    maskAllImages: true,
    screenshotScale: 0.5,
    screenshotColorMode: 'RGB_565',
    screenshotCompressionQuality: 30,
    throttleDelayMs: 1000,
  },
});

if (isAnalyticsEnabled) {
  posthog.register({
    environment: __DEV__ ? 'development' : 'production',
  });
}

type LookupSource = 'auto' | 'manual';

export type AnalyticsEventProps = Record<
  string,
  string | number | boolean | null
>;

export interface AnalyticsEvents {
  'scan session started': {
    mode: 'quick' | 'list';
    list_id: number | null;
  };
  'scan code detected': {
    set_code: string;
    collector_number: string;
    attempts_to_confirm: number;
    torch_on: boolean;
  };
  'scan lookup succeeded': {
    source: LookupSource;
    from_cache: boolean;
    latency_ms: number;
    set_code: string;
    collector_number: string;
    has_usd_price: boolean;
    finish_count: number;
  };
  'scan lookup failed': {
    source: LookupSource;
    error_kind: 'not_found' | 'rate_limited' | 'network' | 'http_error';
    http_status: number | null;
    latency_ms: number;
    set_code: string;
    collector_number: string;
  };
  'scan session ended': {
    mode: 'quick' | 'list';
    list_id: number | null;
    duration_ms: number;
    scan_attempts: number;
    empty_scans: number;
    ocr_errors: number;
    codes_detected: number;
    lookups_succeeded: number;
    lookups_failed: number;
    manual_entries: number;
    cards_added: number;
    cards_skipped: number;
    torch_used: boolean;
  };
  'manual entry opened': {
    source: 'banner' | 'button';
    reason: 'ocr_hint' | 'lookup_error';
  };
  'manual entry submitted': {
    valid: boolean;
  };
  'manual entry rejected': {
    error_kind: 'invalid_format';
  };
  'card sheet expanded': {
    source: LookupSource | 'peek';
    from_cache: boolean;
  };
  'card finish selected': {
    finish: 'normal' | 'foil' | 'etched';
    has_price: boolean;
  };
  'card added to list': {
    list_id: number;
    set_code: string;
    collector_number: string;
    finish: 'normal' | 'foil' | 'etched';
    quantity: number;
    was_already_in_list: boolean;
    has_entry_price: boolean;
  };
  'card add failed': {
    list_id: number;
    error_kind: 'list_not_found' | 'unknown';
  };
  'card skipped': {
    list_id: number;
    set_code: string;
  };
  'list created': Record<string, never>;
  'list renamed': {
    list_id: number;
  };
  'list deleted': {
    list_id: number;
    card_count: number;
    age_days: number;
  };
  'list opened': {
    list_id: number;
    source: 'home' | 'all_lists';
    card_count: number;
    estimated_value_usd_cents: number;
  };
  'scanner opened': {
    source: 'home_primary' | 'home_secondary' | 'list_detail';
    list_id: number | null;
  };
  'prices refreshed': {
    list_id: number;
    item_count: number;
    updated_count: number;
    no_price_count: number;
    not_found_count: number;
    failed_count: number;
    duration_ms: number;
  };
  'prices refresh failed': {
    list_id: number;
    item_count: number;
    error_kind: 'unknown';
  };
  'list item quantity changed': {
    direction: 'increment' | 'decrement';
    finish: 'normal' | 'foil' | 'etched';
    quantity_before: number;
  };
  'list item removed': {
    finish: 'normal' | 'foil' | 'etched';
    quantity: number;
  };
  'list item price overridden': {
    list_id: number;
    finish: 'normal' | 'foil' | 'etched';
    had_override: boolean;
    has_note: boolean;
    price_delta_cents: number | null;
  };
  'list item price override cleared': {
    list_id: number;
    finish: 'normal' | 'foil' | 'etched';
  };
}

/**
 * Envia um evento tipado. Nunca lança: analytics não pode interromper o fluxo
 * do usuário (câmera, SQLite ou navegação).
 */
export function track<K extends keyof AnalyticsEvents>(
  event: K,
  props?: AnalyticsEvents[K],
): void {
  try {
    posthog.capture(event, props ? (props as AnalyticsEventProps) : undefined);
  } catch {
    // Falha de analytics é silenciosa por design.
  }
}

/** Registra uma visualização de tela (`$screen`). */
export function screen(name: string, props?: AnalyticsEventProps): void {
  try {
    void posthog.screen(name, props).catch(() => undefined);
  } catch {
    // Falha de analytics é silenciosa por design.
  }
}

/** Fração de instalações que gravam session replay. */
const REPLAY_SAMPLE_RATE = 0.2;
/** Sorteado uma vez por launch para a amostragem ser estável na sessão. */
const isReplaySampledIn = Math.random() < REPLAY_SAMPLE_RATE;

/**
 * Inicia (ou retoma) o session replay nas telas seguras. O scanner chama
 * `stopSessionReplay` para manter a câmera fora das gravações.
 */
export function startSessionReplayIfSampled(): void {
  if (!isAnalyticsEnabled || !isReplaySampledIn) {
    return;
  }

  try {
    void posthog.startSessionRecording().catch(() => undefined);
  } catch {
    // Replay é opcional: falhar não pode afetar o app.
  }
}

export function stopSessionReplay(): void {
  if (!isAnalyticsEnabled) {
    return;
  }

  try {
    void posthog.stopSessionRecording().catch(() => undefined);
  } catch {
    // Replay é opcional: falhar não pode afetar o app.
  }
}
