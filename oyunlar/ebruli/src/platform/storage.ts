/**
 * Kayıt katmanı: oyuncunun ilerlemesi (tek bir JSON belge).
 *
 * Sıra:
 *  1. claude.ai sayfası içinde ve oturum açılmışsa `db` yeteneğinin kişiye
 *     özel `data/users/<id>/kayit` belgesi (cihazlar arası taşınır).
 *  2. Tarayıcı depolaması (localStorage) — her erişim try/catch içinde;
 *     gizli pencerede ya da engelli depolamada boş dönebilir.
 *  3. Bellek (sayfa kapanınca kaybolur).
 *
 * İki kaynakta da kayıt varsa `progressScore` değeri büyük olan (eşitse
 * daha yeni) kazanır; böylece önce dosyada oynayıp sonra giriş yapan
 * oyuncunun ilerlemesi kaybolmaz. Yazma birleştirilir: art arda gelen
 * kayıtlar tek yazmaya iner, aynı belgeye aynı anda iki yazma gitmez.
 */
import type { ClaudeDb, ClaudeDocRef } from './claude';

export interface SaveEnvelope<T> {
  v: number;
  savedAt: number;
  progressScore: number;
  data: T;
}

export type StorageBackend = 'bulut' | 'tarayici' | 'bellek';

export class SaveStore<T> {
  private key: string;
  private version: number;
  private score: (d: T) => number;
  private remote: ClaudeDocRef | null = null;
  private memory: SaveEnvelope<T> | null = null;
  private pending: SaveEnvelope<T> | null = null;
  private writing = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  backend: StorageBackend = 'bellek';

  constructor(opts: { key: string; version: number; progressScore: (d: T) => number }) {
    this.key = opts.key;
    this.version = opts.version;
    this.score = opts.progressScore;
    if (localGet(this.key) !== undefined) this.backend = 'tarayici';
    else if (localAvailable()) this.backend = 'tarayici';
  }

  /** Yerel kaydı eşzamanlı okur (ilk kare için). */
  loadLocal(): SaveEnvelope<T> | null {
    const raw = localGet(this.key);
    const env = parseEnvelope<T>(raw, this.version);
    return env ?? this.memory;
  }

  /**
   * Bulut kaydını dener (10 sn'ye kadar sürebilir). Yerelden daha ilerideyse
   * onu döndürür; değilse null. Yerel daha ilerideyse buluta da yazar.
   */
  async connectRemote(): Promise<SaveEnvelope<T> | null> {
    const claude = typeof window !== 'undefined' ? window.claude : undefined;
    if (!claude?.use) return null;
    try {
      const [db, user] = await Promise.all([
        claude.use('db') as Promise<ClaudeDb | null>,
        claude.use('user') as Promise<{ id(): Promise<string | null> } | null>,
      ]);
      if (!db || !user) return null;
      const uid = await user.id();
      if (!uid) return null;
      const ref = db.doc(`data/users/${uid}/kayit`);
      const snap = await ref.get();
      this.remote = ref;
      this.backend = 'bulut';
      const remoteEnv = snap.exists ? parseEnvelope<T>(JSON.stringify(snap.data()), this.version) : null;
      const localEnv = this.loadLocal();
      const better = pickBetter(localEnv, remoteEnv);
      if (better && better === localEnv && better !== remoteEnv) this.queue(better);
      return better && better === remoteEnv ? remoteEnv : null;
    } catch {
      this.remote = null;
      return null;
    }
  }

  save(data: T): void {
    const env: SaveEnvelope<T> = { v: this.version, savedAt: Date.now(), progressScore: this.score(data), data };
    this.memory = env;
    if (!localSet(this.key, JSON.stringify(env)) && this.backend === 'tarayici') this.backend = 'bellek';
    this.queue(env);
  }

  private queue(env: SaveEnvelope<T>): void {
    if (!this.remote) return;
    this.pending = env;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), 800);
  }

  private async flush(): Promise<void> {
    if (this.writing || !this.remote || !this.pending) return;
    const env = this.pending;
    this.pending = null;
    this.writing = true;
    try {
      await this.remote.set(JSON.parse(JSON.stringify(env)) as Record<string, unknown>);
    } catch (e) {
      const code = (e as { code?: string }).code;
      // Kalıcı ret: bu ziyaret için buluta yazmayı bırak.
      if (code === 'invalid_argument' || code === 'revoked' || code === 'not_granted') {
        this.remote = null;
        this.backend = localAvailable() ? 'tarayici' : 'bellek';
      } else if (!this.pending) {
        this.pending = env;
      }
    } finally {
      this.writing = false;
      if (this.pending) this.timer = setTimeout(() => void this.flush(), 1500);
    }
  }
}

export function pickBetter<T>(a: SaveEnvelope<T> | null, b: SaveEnvelope<T> | null): SaveEnvelope<T> | null {
  if (!a) return b;
  if (!b) return a;
  if (a.progressScore !== b.progressScore) return a.progressScore > b.progressScore ? a : b;
  return a.savedAt >= b.savedAt ? a : b;
}

function parseEnvelope<T>(raw: string | undefined | null, version: number): SaveEnvelope<T> | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as SaveEnvelope<T>;
    if (!o || typeof o !== 'object' || o.v !== version || typeof o.data !== 'object') return null;
    return o;
  } catch {
    return null;
  }
}

function localAvailable(): boolean {
  try {
    const k = '__deneme__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function localGet(key: string): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function localSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Küçük tercihler (ses açık mı vb.) için; kayıttan bağımsız, yalnız yerel. */
export function prefGet<T>(key: string, fallback: T): T {
  const raw = localGet(key);
  if (raw === undefined) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function prefSet(key: string, value: unknown): void {
  localSet(key, JSON.stringify(value));
}
