/**
 * claude.ai sayfa çalışma zamanının bu oyunun kullandığı küçük alt kümesi
 * (sözleşme 0.2.78). Bağımsız HTML dosyasında `window.claude` yoktur; her
 * erişim isteğe bağlı zincirle yapılır.
 */
export interface ClaudeDocSnapshot {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
export interface ClaudeDocRef {
  get(): Promise<ClaudeDocSnapshot>;
  set(data: Record<string, unknown>): Promise<void>;
}
export interface ClaudeDb {
  doc(path: string): ClaudeDocRef;
}
export interface ClaudeUser {
  id(): Promise<string | null>;
}
export interface ClaudeHot {
  data?: unknown;
  snapshot?(fn: () => unknown): void;
  ready?(start: (data: unknown) => void): void;
}
export interface ClaudeRuntime {
  use?(name: 'db'): Promise<ClaudeDb | null>;
  use?(name: 'user'): Promise<ClaudeUser | null>;
  use?(name: string): Promise<unknown>;
  hot?: ClaudeHot;
}

declare global {
  interface Window {
    claude?: ClaudeRuntime;
  }
}
