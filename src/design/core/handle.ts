/**
 * Ortak çekirdek: 3B tutamaç tanımı. Tutamaç modelin bir noktasını (dünya
 * biriminde) sürüklenebilir yapar ve hedef konumu bağlı düğmenin değerine
 * çevirir (ters eşleme). Motor bilgisi yok.
 */

export interface HandleDef<TModel, TBuilt, TCtx = unknown> {
  id: string;
  group: string;
  axis: 'radial' | 'axial';
  label: string;
  available(ctx: TCtx): boolean;
  blockedReason?(m: TModel, b: TBuilt): string | null;
  /** Dünya: +Z akış, r XY'de (x=0, y=+r) */
  anchor(b: TBuilt): { z: number; r: number } | null;
  /** Sürükleme sınırı (dünya biriminde) ve neden metinleri */
  range(m: TModel, b: TBuilt): { lo: number; hi: number; loReason?: string; hiReason?: string };
  /** Bağlı düğme kimliği */
  coupled: string;
  solve(m: TModel, b: TBuilt, target: number): { model: TModel; snapped: number };
  /** Kademe çentikleri */
  snaps?(m: TModel, b: TBuilt): number[];
}
