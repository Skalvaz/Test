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
 * oyuncunun ilerlemesi kaybolmaz. `merge` verilmişse kazanan kayda öbüründen
 * kaybolmaması gerekenler eklenir (FİTİL: mühürler ve kasaba işleri). Yazma birleştirilir: art arda gelen
 * kayıtlar tek yazmaya iner, aynı belgeye aynı anda iki yazma gitmez.
 *
 * İleri uyumluluk: `tooNew` verilmişse depoda (tarayıcıda ya da bulutta) bu
 * kodun bilmediği yeni bir şemayla yazılmış kayıt görülünce depo SALT
 * OKUNUR olur (`readOnly`): eski sürümün açık kalmış sekmesi yeni sürümün
 * alanlarını (ör. mühürler, kasaba) bilmeden ezmesin. Uygulama "sayfayı
 * yenile" bildirimi gösterir.
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

  /** İki kaynak birleşirken seçilen kayda öbüründen eklenecekler (isteğe bağlı; `pickMerged`). */
  private merge: ((better: T, other: T) => T) | undefined;
  /** Veri bu kodun bilmediği yeni bir şemadan mı (ileri uyumluluk). */
  private tooNew: ((d: unknown) => boolean) | undefined;
  /** Yeni şemalı kayıt görüldü: bu sayfa hiçbir yere yazmaz (bellekte sürer). */
  readOnly = false;
  /** `readOnly` ilk kez açılınca (uygulama bildirim gösterir). */
  onReadOnly: (() => void) | null = null;

  constructor(opts: { key: string; version: number; progressScore: (d: T) => number; merge?: (better: T, other: T) => T; tooNew?: (d: unknown) => boolean }) {
    this.key = opts.key;
    this.version = opts.version;
    this.score = opts.progressScore;
    this.merge = opts.merge;
    this.tooNew = opts.tooNew;
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
      // Bulutta yeni bir sürümün kaydı: birleştirme ve yazma yok (eski veriyle ezilmesin).
      if (remoteEnv && this.tooNew?.(remoteEnv.data)) {
        this.setReadOnly();
        return null;
      }
      if (this.readOnly) return null;
      const localEnv = this.loadLocal();
      const better = pickMerged(localEnv, remoteEnv, this.merge, (d) => ({ v: this.version, savedAt: Date.now(), progressScore: this.score(d), data: d }));
      if (better && better !== remoteEnv) this.queue(better);
      return better && better !== localEnv ? better : null;
    } catch {
      this.remote = null;
      return null;
    }
  }

  /**
   * Kaydeder. true: kayıt kalıcı bir yere gitti (tarayıcı depolaması ya da
   * bulut kuyruğu); false: yalnız bellekte (salt okunur, depolama dolu/kapalı).
   */
  save(data: T): boolean {
    const env: SaveEnvelope<T> = { v: this.version, savedAt: Date.now(), progressScore: this.score(data), data };
    this.memory = env;
    if (!this.writable()) return false;
    const yerel = localSet(this.key, JSON.stringify(env));
    if (!yerel && this.backend === 'tarayici') this.backend = 'bellek';
    this.queue(env);
    return yerel || !!this.remote;
  }

  /**
   * Yazmadan önce: tarayıcıdaki kayıt bu arada yeni bir sürümün sekmesince
   * yazıldıysa (ileri şema) depo salt okunur olur ve false döner.
   */
  writable(): boolean {
    if (this.readOnly) return false;
    if (this.tooNew) {
      const env = parseEnvelope<T>(localGet(this.key), this.version);
      if (env && this.tooNew(env.data)) {
        this.setReadOnly();
        return false;
      }
    }
    return true;
  }

  /** Salt okunur kip (bir kez; bekleyen bulut yazımı da düşer). */
  setReadOnly(): void {
    if (this.readOnly) return;
    this.readOnly = true;
    this.pending = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    try {
      this.onReadOnly?.();
    } catch {
      /* bildirim isteğe bağlı */
    }
  }

  private queue(env: SaveEnvelope<T>): void {
    if (!this.remote || this.readOnly) return;
    this.pending = env;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), 800);
  }

  private async flush(): Promise<void> {
    if (this.writing || !this.remote || !this.pending || this.readOnly) return;
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

/**
 * `pickBetter` + birleştirme: iki kaynakta da kayıt varsa seçilen kayda
 * öbüründen kaybolmaması gerekenler eklenir (`merge(seçilen, öbürü)`; FİTİL'de
 * mühür ve kasaba işleri). Birleşim seçilen veriden farklıysa yeni zarf
 * (`wrap`) döner; aynıysa ya da birleştirme hata verirse seçilen zarf aynen.
 */
export function pickMerged<T>(local: SaveEnvelope<T> | null, remote: SaveEnvelope<T> | null, merge: ((better: T, other: T) => T) | undefined, wrap: (d: T) => SaveEnvelope<T>): SaveEnvelope<T> | null {
  const better = pickBetter(local, remote);
  if (!better || !local || !remote || !merge) return better;
  const other = better === local ? remote : local;
  try {
    const data = merge(better.data, other.data);
    // Anlamsal eşitlik (anahtar sırası farkı yeni zarf, bildirim ve bulut yazımı doğurmasın).
    return data === better.data || kanonikJson(data) === kanonikJson(better.data) ? better : wrap(data);
  } catch {
    return better;
  }
}

/** Anahtarları sıralanmış JSON (nesne anahtar sırasından bağımsız karşılaştırma için). */
export function kanonikJson(x: unknown): string {
  return JSON.stringify(x, (_k, v: unknown) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return v;
    const o = v as Record<string, unknown>;
    const s: Record<string, unknown> = {};
    for (const a of Object.keys(o).sort()) s[a] = o[a];
    return s;
  });
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
