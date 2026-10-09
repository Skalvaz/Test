/**
 * Tasarım hataları. Yaprak modül: graph.ts ve operability.ts birbirini
 * içe aktardığından hata sınıfı ayrı durur (döngüde modül düzeyinde
 * kullanım TDZ hatası verirdi).
 */

/** Grafik kuralı ihlali: öğretici mesaj + kural kimliği, modül ve ilgili düğmeler */
export class GraphError extends Error {
  readonly ruleId: string;
  readonly group: string;
  readonly knobs: string[];
  constructor(message: string, ruleId = '', group = 'engine', knobs: string[] = []) {
    super(message);
    this.name = 'GraphError';
    this.ruleId = ruleId;
    this.group = group;
    this.knobs = knobs;
  }
}
