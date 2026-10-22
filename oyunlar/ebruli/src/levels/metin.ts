/**
 * Bölüm metinlerinin İngilizcesi (`metin.en.json`, kimliğe göre): ad,
 * `sonrakiTanitim` ve ipuçlarının metni (sırayla). Türkçe JSON'lar olduğu
 * gibi kalır; dil İngilizceyse bölüm yüklenirken bu metinler üstüne yazılır.
 * Eksik alan Türkçe kalır (dil taraması yakalar).
 */
import type { BolumVerisi } from '../core/types';
import { DIL } from '../platform/dil';
import EN from './metin.en.json';

export interface BolumMetni {
  ad?: string;
  sonrakiTanitim?: string;
  /** `ipuclari[i].metin` (aynı sırada). */
  ipuclari?: string[];
}

const TABLO = EN as Record<string, BolumMetni>;

/** Bölümü sayfanın diline çevirir (Türkçede aynısı döner). */
export function bolumMetniUygula(v: BolumVerisi, tablo: Record<string, BolumMetni> = DIL === 'en' ? TABLO : {}): BolumVerisi {
  const e = tablo[String(v.id)];
  if (!e) return v;
  return {
    ...v,
    ad: e.ad ?? v.ad,
    sonrakiTanitim: e.sonrakiTanitim ?? v.sonrakiTanitim,
    ipuclari: v.ipuclari?.map((x, i) => ({ ...x, metin: e.ipuclari?.[i] ?? x.metin })),
  };
}
