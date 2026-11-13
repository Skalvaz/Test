/**
 * Dekor: açılışta bir kez boyanan arka plan katmanları ve yıkılabilir
 * binaların "derisi" (piksel piksel boyanmış cephe). Hepsinde 0 = saydam,
 * 1 = mürekkep; öteki değerler açıklık tonu.
 *
 * Kullanıcı çıtası: "evler daha kaliteli ve uğraşılmış olsun, bu bütün
 * tasarımlar için geçerli." Düz kutu + rastgele nokta YOK: her yapının
 * çatısı, saçağı, doğraması, denizliği, kapısı, tabelası ayrı düşünülür.
 */
import { Tuval } from './tuval';

const kes = (a: number, b: number): number => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const M = 1; // mürekkep (0 saydam olduğu için 1)

// ---------------------------------------------------------------------------
// Uzak katman: soluk şehir silueti
// ---------------------------------------------------------------------------

export function uzakKatman(W: number, H: number): Uint8Array {
  const t = new Tuval(W, H);
  t.g.fill(0);
  const sirt = (x: number): number => H - 46 - 18 * Math.sin(x * 0.011 + 0.6) - 9 * Math.sin(x * 0.029 + 2);
  for (let x = 0; x < W; x++) for (let y = Math.round(sirt(x)); y < H; y++) t.g[y * W + x] = 238;

  // İki sıra yapı: arkadaki daha soluk ve yüksek
  for (const [sira, ton, enAz, enCok, taban] of [[0, 229, 54, 196, 30], [1, 214, 28, 122, 20]] as const) {
    let x = sira * 9 - 4;
    let no = sira * 100;
    while (x < W - 4) {
      no++;
      const w = 13 + Math.round(kes(no, 2) * 19);
      const h = enAz + Math.round(kes(no, 3) * kes(no, 7) * (enCok - enAz));
      let y = H - taban - h;
      const pen = ton - 13;
      const gol = ton - 8;
      t.kutu(x, y, w, h + 44, ton);
      t.kutu(x + w - 2, y, 2, h + 44, gol);
      const tur = kes(no, 4);
      // Geri çekilmiş üst katlar
      if (tur < 0.28 && w > 17) {
        t.kutu(x + 3, y - 12, w - 8, 12, ton);
        t.kutu(x + w - 7, y - 12, 2, 12, gol);
        t.kutu(x + 3, y - 1, w - 8, 1, gol);
        y -= 12;
      }
      // Düzenli pencere ızgarası; katlar arasında ince silme
      const ust = y;
      for (let wy = ust + 4, kat = 0; wy < H - taban - 4; wy += 6, kat++) {
        for (let wx = x + 2; wx <= x + w - 5; wx += 4) {
          if (wy < y + 12 && tur < 0.28 && (wx < x + 4 || wx > x + w - 8)) continue;
          if (kes(wx * 3 + no, wy) < 0.1) continue; // kapalı / karanlık pencere
          t.kutu(wx, wy, 2, 3, pen);
        }
        if (kat % 5 === 4) t.kutu(x, wy + 4, w - 2, 1, gol);
      }
      // Çatı ayrıntısı
      const cx = x + Math.round(w / 2);
      if (tur >= 0.28 && tur < 0.46) {
        t.cizgi(cx, y, cx, y - 16, ton);
        t.cizgi(cx - 3, y - 10, cx + 3, y - 10, ton);
        t.cizgi(cx - 2, y - 13, cx + 2, y - 13, ton);
      } else if (tur < 0.6) {
        t.kutu(x + 3, y - 7, 8, 6, ton);
        t.kutu(x + 3, y - 8, 8, 1, gol);
        t.kutu(x + 4, y - 1, 1, 1, gol);
        t.kutu(x + 9, y - 1, 1, 1, gol);
      } else if (tur < 0.72) {
        t.kutu(x + 3, y - 32, 4, 32, ton);
        t.kutu(x + 6, y - 32, 1, 32, gol);
        for (let k = 0; k < 7; k++) t.daire(x + 7 + k * 7, y - 36 - k * 4, 3.5 + k * 1.5, 242);
      } else if (tur < 0.82) {
        t.kutu(x + 1, y - 3, w - 3, 3, ton); // korkuluk
        t.kutu(x + 1, y - 3, w - 3, 1, gol);
      }
      // Bombardıman hasarı: üst köşeden basamaklı kopukluk
      if (kes(no, 8) < 0.24 && h > 40) {
        const soldan = kes(no, 9) < 0.5;
        for (let k = 0; k < 6; k++) {
          const gen = (6 - k) * 2 + Math.round(kes(no, 10 + k) * 2);
          t.kutu(soldan ? x : x + w - gen, y - 14 + k * 4, gen, 4, 0);
        }
      }
      x += w + (kes(no, 5) < 0.35 ? 3 + Math.round(kes(no, 6) * 16) : 1);
    }
  }
  // Yakın sırt: şehrin eteğini örter
  for (let x = 0; x < W; x++) {
    const b = H - 20 - 9 * Math.sin(x * 0.019 + 3) - 5 * Math.sin(x * 0.051);
    for (let y = Math.round(b); y < H; y++) t.g[y * W + x] = 224;
  }
  return t.g;
}

// ---------------------------------------------------------------------------
// Orta katman: bombalanmış şehir. Üç cephe tarzı: apartman, iş hanı, eski taş bina.
// ---------------------------------------------------------------------------

export function ortaKatman(W: number, H: number): Uint8Array {
  const t = new Tuval(W, H);
  t.g.fill(0);
  const DUVAR = 170;
  const GOLGE = 128;
  const taban = (x: number): number => H - 13 - 7 * Math.sin(x * 0.02 + 1) - 4 * Math.sin(x * 0.055 + 2);
  const al = (x: number, y: number): number => (x < 0 || y < 0 || x >= W || y >= H ? 0 : t.g[y * W + x]);
  const koy = (x: number, y: number, d: number): void => {
    if (x >= 0 && y >= 0 && x < W && y < H) t.g[y * W + x] = d;
  };
  /** Yalnız sağlam duvarın olduğu yere boyar (yıkık kısma taşmaz). */
  const duvara = (x: number, y: number, d: number): void => {
    if (al(x, y) === DUVAR) koy(x, y, d);
  };
  const duvarKutu = (x: number, y: number, w: number, h: number, d: number): void => {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) duvara(x + xx, y + yy, d);
  };

  let bx = 30;
  let no = 0;
  while (bx < W - 70) {
    no++;
    const stil = no % 3; // 0 apartman, 1 iş hanı, 2 eski taş bina
    const w = 56 + Math.round(kes(no, 1) * 60);
    const h = 104 + Math.round(kes(no, 2) * 262);
    const by = Math.round(taban(bx + w / 2)) + 5;
    const sol = kes(no, 3) < 0.5;
    const yikik = 0.15 + kes(no, 4) * 0.6;
    const ustler: number[] = [];
    for (let c = 0; c < w; c++) {
      // Kırık üst kenar: bir köşeden basamak basamak çökmüş
      const u = sol ? c / w : 1 - c / w;
      const cok = Math.max(0, yikik - u) / yikik;
      const basamak = Math.floor(cok * 8) / 8;
      const ust = by - h + Math.round(basamak * h * 0.72 + (cok > 0 ? (kes(Math.floor(c / 4) + no * 9, 5) - 0.5) * 7 : 0));
      ustler.push(ust);
      for (let y = Math.max(0, ust); y < by; y++) koy(bx + c, y, c >= w - 5 ? GOLGE : DUVAR);
    }
    const saglam = ustler.findIndex((u) => u === by - h);
    let saglamSon = saglam;
    while (saglam >= 0 && saglamSon < w && ustler[saglamSon] === by - h) saglamSon++;
    const tepe = by - h;

    // ---- Cephe ----
    const KAT = stil === 1 ? 22 : stil === 2 ? 30 : 26;
    const zeminKat = 26;
    if (stil === 1) {
      // İş hanı: kat boyunca kesintisiz cam şeritler
      for (let ky = by - zeminKat - 4; ky > tepe + 14; ky -= KAT) {
        for (let c = 4; c < w - 9; c++) {
          const cam = Math.floor(c / 7);
          const tur = kes(cam + no * 5, ky);
          if (c % 7 === 0) continue; // kayıt
          for (let yy = 1; yy <= 11; yy++) duvara(bx + c, ky - yy, tur < 0.1 ? 0 : tur < 0.26 ? 213 : tur < 0.34 ? 128 : 85);
          if (tur >= 0.34 && tur < 0.5) duvara(bx + c, ky - 4 - (c % 7), 128); // parlama
        }
        duvarKutu(bx + 3, ky, w - 11, 1, GOLGE);
        duvarKutu(bx + 3, ky - 12, w - 11, 1, GOLGE);
        duvarKutu(bx + 3, ky + 5, w - 11, 1, GOLGE); // parapet bandı
      }
      // Zemin: sütunlu geçit
      for (let c = 4; c < w - 14; c += 14) {
        duvarKutu(bx + c, by - 22, 10, 21, 85);
        duvarKutu(bx + c, by - 22, 10, 1, 64);
        duvarKutu(bx + c + 2, by - 14, 3, 6, 128); // içerideki vitrin
      }
      duvarKutu(bx + 2, by - 25, w - 9, 2, GOLGE);
    } else {
      const pw = stil === 2 ? 7 : 9;
      const ph = stil === 2 ? 15 : 13;
      const aralik = stil === 2 ? 15 : 17;
      for (let ky = by - zeminKat - 6; ky > tepe + ph + 4; ky -= KAT) {
        duvarKutu(bx, ky + 8, w - 5, 1, 150); // kat silmesi
        if (stil === 2) duvarKutu(bx, ky + 9, w - 5, 1, 190);
        const balkon = stil === 0 && kes(no * 3, ky) < 0.32;
        for (let c = 8, sira = 0; c < w - pw - 8; c += aralik, sira++) {
          const px = bx + c;
          const tur = kes(c + no * 3, ky);
          if (al(px, ky) !== DUVAR || al(px + pw, ky - ph) !== DUVAR) continue;
          if (tur < 0.09) {
            // Top yemiş duvar: düzensiz delik; çoğu karanlık oda, bazısından gök görünür
            const acik = kes(c, ky + 7) < 0.35;
            const gen = 7 + kes(c, ky + 8) * 5;
            const boy = 9 + kes(c, ky + 9) * 5;
            for (let yy = -20; yy <= 6; yy++) {
              for (let xx = -8; xx <= 16; xx++) {
                const uz = Math.max(Math.abs(xx - 4) / gen, Math.abs(yy + 7) / boy) + (kes(Math.floor((xx + c) / 2), Math.floor((yy + ky) / 2)) - 0.5) * 0.5;
                if (uz < 0.8) duvara(px + xx, ky + yy, acik ? 0 : 85);
                else if (uz < 1) duvara(px + xx, ky + yy, GOLGE);
              }
            }
            if (!acik) for (let xx = -2; xx < 11; xx++) if (al(px + xx, ky + 1) === 85) koy(px + xx, ky + 1, 150);
            continue;
          }
          // Doğrama: cam + çerçeve (+ eski binada kemer)
          const camTon = tur < 0.3 ? 213 : 85;
          for (let yy = 0; yy < ph; yy++) {
            for (let xx = 0; xx < pw; xx++) {
              if (stil === 2 && yy === ph - 1 && (xx === 0 || xx === pw - 1)) continue; // kemerin yuvarlak köşeleri
              duvara(px + xx, ky - yy, camTon);
            }
          }
          duvarKutu(px - 1, ky + 1, pw + 2, 1, GOLGE); // denizlik
          if (stil === 2) {
            duvarKutu(px - 1, ky - ph, pw + 2, 1, GOLGE);
            duvara(px + 3, ky - ph - 1, GOLGE); // kilit taşı
            duvara(px + 3, ky - ph - 2, GOLGE);
            if (sira % 2 === 0) for (let yy = -2; yy < KAT - 6; yy++) duvara(px - 4, ky + 6 - yy, 150); // pilastr
          } else duvarKutu(px - 1, ky - ph, pw + 2, 1, GOLGE); // lento
          if (camTon === 85) {
            if (tur < 0.44) {
              for (let k = 0; k < 3; k++) for (let xx = 0; xx < pw; xx++) koy(px + xx, ky - 2 - k * 4, GOLGE); // tahtayla kapatılmış
              koy(px + 2, ky - 3, 100);
              koy(px + pw - 3, ky - 7, 100);
            } else if (tur < 0.78) {
              for (let yy = 0; yy < ph - 1; yy++) koy(px + Math.floor(pw / 2), ky - yy, 128); // kayıt
              for (let xx = 0; xx < pw; xx++) koy(px + xx, ky - Math.floor(ph / 2), 128);
              koy(px + 1, ky - ph + 3, 128); // parlama
              koy(px + 2, ky - ph + 2, 128);
            } else {
              for (let k = 0; k < 5; k++) for (let xx = 0; xx < 5 - k; xx++) koy(px + xx, ky - ph + 1 + k, 128); // kırık cam
            }
            if (kes(c, ky + no) < 0.18) {
              // Yangın izi: pencerenin üstünde yukarı doğru seyrelen is
              for (let yy = ph + 1; yy < ph + 17; yy++) {
                for (let xx = 0; xx < pw; xx++) if (kes(px + xx, ky - yy) < 1 - (yy - ph) / 17) duvara(px + xx, ky - yy, 150);
              }
            }
          } else {
            koy(px + 1, ky - ph + 2, 240); // aydınlık camda parlama
            koy(px + 2, ky - ph + 3, 240);
          }
          if (stil === 0 && kes(c + 5, ky + no) < 0.1) {
            duvarKutu(px + 1, ky + 4, 7, 4, GOLGE); // klima
            duvarKutu(px + 2, ky + 5, 5, 1, 100);
          }
          if (balkon) {
            for (let xx = -3; xx < pw + 3; xx++) koy(px + xx, ky + 3, GOLGE);
            for (let xx = -3; xx < pw + 3; xx += 2) for (let yy = 0; yy < 5; yy++) duvara(px + xx, ky + 2 - yy, GOLGE);
            for (let xx = -3; xx < pw + 3; xx++) duvara(px + xx, ky - 3, GOLGE);
          }
        }
      }
      // Zemin kat
      if (stil === 0) {
        // Dükkânlar: çizgili tente, vitrin, kapı
        for (let c = 5; c < w - 30; c += 30) {
          for (let xx = 0; xx < 24; xx++) {
            for (let yy = 0; yy < 4; yy++) duvara(bx + c + xx, by - 22 + yy, Math.floor(xx / 3) % 2 ? 200 : 128);
            if (xx % 3 !== 2) duvara(bx + c + xx, by - 18, Math.floor(xx / 3) % 2 ? 200 : 128);
          }
          duvarKutu(bx + c + 1, by - 16, 14, 11, 85);
          duvarKutu(bx + c + 1, by - 16, 14, 1, 64);
          duvarKutu(bx + c + 8, by - 16, 1, 11, 128);
          duvarKutu(bx + c + 3, by - 9, 2, 3, 128);
          duvarKutu(bx + c + 17, by - 16, 6, 15, 85);
          duvarKutu(bx + c + 17, by - 16, 1, 15, 128);
        }
      } else {
        // Kesme taş zemin kat ve kemerli kapı
        for (let yy = 4; yy < zeminKat; yy += 4) duvarKutu(bx, by - yy, w - 5, 1, 150);
        const kx = bx + Math.round(w * 0.45);
        for (let yy = 0; yy < 21; yy++) {
          for (let xx = 0; xx < 12; xx++) {
            if (yy > 17 && (xx < yy - 17 || xx > 11 - (yy - 17))) continue;
            duvara(kx + xx, by - 1 - yy, 85);
          }
        }
        duvarKutu(kx + 5, by - 20, 2, 19, 128);
      }
    }

    // ---- Çatı (sağlam kısım) ----
    if (saglam >= 0) {
      const gen = saglamSon - saglam;
      if (stil === 2) {
        // Dişli korniş
        for (let c = saglam; c < saglamSon; c++) {
          koy(bx + c, tepe - 1, GOLGE);
          koy(bx + c, tepe - 2, 190);
          koy(bx + c, tepe - 3, 190);
          koy(bx + c, tepe - 4, GOLGE);
          if (c % 3 === 0) koy(bx + c, tepe + 1, GOLGE);
        }
      } else {
        for (let c = saglam; c < saglamSon; c++) {
          koy(bx + c, tepe - 1, GOLGE);
          koy(bx + c, tepe - 2, c % 6 < 4 ? DUVAR : 0);
        }
      }
      if (gen > 26) {
        const tx = bx + saglam + 6 + Math.round(kes(no, 30) * (gen - 24));
        const ty = tepe - (stil === 2 ? 4 : 2);
        if (stil === 1 && gen > 50) {
          // Çatı panosu: kafes ayaklar, yırtık pano
          const px = bx + saglam + 6;
          t.cizgi(px + 4, ty, px + 4, ty - 26, 100);
          t.cizgi(px + 36, ty, px + 36, ty - 26, 100);
          t.cizgi(px + 4, ty, px + 36, ty - 12, 100);
          t.cizgi(px + 36, ty, px + 4, ty - 12, 100);
          t.kutu(px, ty - 40, 42, 16, 150);
          t.kutu(px + 1, ty - 39, 40, 14, 200);
          for (let k = 0; k < 5; k++) t.kutu(px + 4 + k * 7, ty - 35, 5, 6, 128);
          for (let k = 0; k < 8; k++) t.kutu(px + 34 + k, ty - 40, 8 - k, 2 + k, 0); // yırtık köşe
        } else if (kes(no, 31) < 0.55) {
          t.kutu(tx, ty - 14, 12, 9, GOLGE); // su deposu
          t.kutu(tx + 1, ty - 13, 10, 2, 150);
          t.cizgi(tx + 1, ty - 5, tx + 1, ty, GOLGE);
          t.cizgi(tx + 10, ty - 5, tx + 10, ty, GOLGE);
          t.cizgi(tx + 1, ty - 3, tx + 10, ty - 3, GOLGE);
        } else {
          t.cizgi(tx, ty, tx, ty - 24, GOLGE); // anten
          t.cizgi(tx - 5, ty - 17, tx + 5, ty - 17, GOLGE);
          t.cizgi(tx - 3, ty - 21, tx + 3, ty - 21, GOLGE);
          t.kutu(tx + 9, ty - 9, 9, 9, DUVAR); // merdiven çıkışı
          t.kutu(tx + 9, ty - 9, 9, 1, GOLGE);
          t.kutu(tx + 12, ty - 6, 3, 6, 85);
        }
      }
    }

    // ---- Yangın merdiveni (apartman) ----
    if (stil === 0 && w > 76 && kes(no, 70) < 0.5) {
      const fx = bx + w - 34;
      for (let ky = by - zeminKat - 2; ky > tepe + 30; ky -= KAT) {
        for (let xx = -2; xx < 16; xx++) duvara(fx + xx, ky, 100); // sahanlık
        for (let xx = -2; xx < 16; xx += 3) for (let yy = 1; yy < 6; yy++) duvara(fx + xx, ky - yy, 100);
        for (let xx = -2; xx < 16; xx++) duvara(fx + xx, ky - 6, 100);
        for (let k = 0; k < KAT; k++) duvara(fx + 13 - Math.round((k * 13) / KAT), ky - k, 100); // merdiven
      }
    }

    // ---- Kırık kenar: açıkta kalan döşemeler ve demirler ----
    for (let c = 1; c < w - 1; c++) {
      const u = ustler[c];
      if (u <= tepe) continue;
      if (al(bx + c, u) === DUVAR) koy(bx + c, u, GOLGE);
      const basamakKenari = Math.abs(ustler[c - 1] - u) > 6 || Math.abs(ustler[c + 1] - u) > 6;
      if (basamakKenari) {
        // Kat döşemesi boşluğa uzanır
        const yon = ustler[c - 1] > u ? -1 : 1;
        for (let k = 1; k < 5; k++) koy(bx + c + yon * k, u + 2, GOLGE);
        t.cizgi(bx + c + yon * 4, u + 2, bx + c + yon * 6, u + 8, 100);
      }
      if (kes(c + no * 5, 40) < 0.13) {
        const uz = 4 + Math.round(kes(c, no + 41) * 8);
        const yat = Math.round((kes(c, no + 42) - 0.5) * 6);
        t.cizgi(bx + c, u - 1, bx + c + yat, u - uz, 100); // demir
      }
    }
    // Çatlaklar
    for (let k = 0; k < 3; k++) {
      let cx = bx + 6 + Math.round(kes(no, 50 + k) * (w - 16));
      let cy = by - 20 - Math.round(kes(no, 53 + k) * (h - 50));
      for (let n = 0; n < 16; n++) {
        duvara(cx, cy, GOLGE);
        cy += 1;
        duvara(cx, cy, GOLGE);
        cx += kes(n + k, no) < 0.5 ? 1 : -1;
        cy += 1;
      }
    }
    // Yağmur borusu
    if (stil !== 1 && kes(no, 60) < 0.7) for (let y = tepe + 4; y < by; y++) duvara(bx + 3, y, y % 14 === 0 ? 100 : GOLGE);
    // Dipte enkaz yığını
    for (let k = 0; k < 16; k++) {
      const rx = bx + Math.round((sol ? 0 : w) + (kes(no, k + 20) - 0.5) * 44);
      const rw = 4 + Math.round(kes(k, no) * 9);
      const rh = 3 + Math.round(kes(k, no + 2) * 5);
      const ry = by - Math.round(kes(k, no + 1) * 10) - rh + 4;
      t.kutu(rx, ry, rw, rh, kes(k, 7) < 0.5 ? 150 : GOLGE);
      t.kutu(rx, ry, rw, 1, kes(k, 7) < 0.5 ? DUVAR : 150);
    }
    bx += w + 16 + Math.round(kes(no, 6) * 70);
  }

  // Zemin şeridi
  for (let x = 0; x < W; x++) {
    const ty = Math.round(taban(x));
    for (let y = ty; y < H; y++) koy(x, y, y === ty ? GOLGE : 150);
  }
  // Direkler ve teller
  let once = -1;
  let onceY = 0;
  for (let x = 20; x < W; x += 110 + Math.round(kes(x, 8) * 44)) {
    const by = Math.round(taban(x));
    const egik = Math.round((kes(x, 9) - 0.5) * 10);
    t.kalin(x, by, x + egik, by - 72, 100);
    t.cizgi(x + egik - 8, by - 65, x + egik + 8, by - 66, 100);
    t.cizgi(x + egik - 6, by - 58, x + egik + 6, by - 59, 100);
    t.nokta(x + egik - 8, by - 67, 100);
    t.nokta(x + egik + 8, by - 68, 100);
    if (once >= 0 && kes(x, 10) < 0.8) {
      for (let k = 0; k <= 60; k++) {
        const u = k / 60;
        t.nokta(once + (x + egik - once) * u, onceY + (by - 66 - onceY) * u + Math.sin(u * Math.PI) * 14, 128);
      }
    } else if (once >= 0) {
      for (let k = 0; k < 26; k++) t.nokta(once + k * 0.5 + Math.sin(k * 0.3) * 2, onceY + k * 1.6, 128); // kopmuş tel
    }
    once = x + egik + 8;
    onceY = by - 67;
  }
  // Kuru ağaçlar
  const dal = (x: number, y: number, aci: number, uz: number, d: number): void => {
    const x1 = x + Math.cos(aci) * uz;
    const y1 = y + Math.sin(aci) * uz;
    t.cizgi(x, y, x1, y1, 112);
    if (d > 2) t.cizgi(x + 1, y, x1 + 1, y1, 112);
    if (d <= 0) return;
    dal(x1, y1, aci - 0.33 - kes(x, d) * 0.4, uz * 0.73, d - 1);
    dal(x1, y1, aci + 0.3 + kes(y, d) * 0.4, uz * 0.71, d - 1);
  };
  for (let x = 70; x < W; x += 140 + Math.round(kes(x, 11) * 90)) dal(x, Math.round(taban(x)) + 2, -Math.PI / 2 + (kes(x, 12) - 0.5) * 0.3, 19, 5);
  return t.g;
}

// ---------------------------------------------------------------------------
// Yıkılabilir binaların derisi
// ---------------------------------------------------------------------------

export interface Deri {
  w: number;
  h: number;
  g: Uint8Array;
}

/** Kenar: saydam pikselle ya da tuvalin sol/sağ/üst kenarıyla komşu olan dolu pikseller mürekkep olur. */
function silueteKenar(t: Tuval): void {
  const { w, h, g } = t;
  const isaret: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!g[y * w + x]) continue;
      const bos = x === 0 || x === w - 1 || y === 0 || !g[y * w + x - 1] || !g[y * w + x + 1] || !g[(y - 1) * w + x] || (y < h - 1 && !g[(y + 1) * w + x]);
      if (bos) isaret.push(y * w + x);
    }
  }
  for (const i of isaret) g[i] = M;
}

/** Çerçeveli pencere: doğrama, kayıt, parlama, lento, denizlik. */
function pencere(t: Tuval, x: number, y: number, w: number, h: number, panjur: boolean): void {
  t.kutu(x - 1, y - 2, w + 2, 2, 170); // lento
  t.kutu(x - 1, y - 2, w + 2, 1, 128);
  t.kutu(x, y, w, h, M);
  t.kutu(x + 1, y + 1, w - 2, h - 2, 64);
  t.kutu(x + Math.floor(w / 2), y + 1, 1, h - 2, 150); // düşey kayıt
  t.kutu(x + 1, y + Math.floor(h / 2), w - 2, 1, 150); // yatay kayıt
  t.cizgi(x + 2, y + 4, x + 4, y + 2, 150); // parlama
  t.nokta(x + w - 3, y + h - 3, 100);
  t.kutu(x - 2, y + h, w + 4, 1, 240); // denizlik
  t.kutu(x - 2, y + h + 1, w + 4, 1, 128);
  if (panjur) {
    for (const px of [x - 4, x + w + 1]) {
      t.kutu(px, y, 3, h, 128);
      for (let k = 1; k < h; k += 2) t.kutu(px, y + k, 3, 1, 100);
      t.kutu(px, y, 3, 1, M);
      t.kutu(px, y + h - 1, 3, 1, M);
    }
  }
}

/** Tuğla dokusu: şaşırtmalı derzler. */
function tugla(t: Tuval, x: number, y: number, w: number, h: number, ton: number, derz: number): void {
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const sira = Math.floor((y + yy) / 3);
      const yatay = (y + yy) % 3 === 2;
      const dusey = (x + xx + (sira % 2) * 3) % 6 === 0;
      t.nokta(x + xx, y + yy, yatay || dusey ? derz : ton);
    }
  }
}

/** Ev: kiremit çatı, baca, panjurlu pencereler, ahşap kapı, taş temel. 72×60. */
function evDerisi(): Tuval {
  const W = 72;
  const H = 60;
  const t = new Tuval(W, H);
  t.g.fill(0);
  // Duvar: sıva
  t.kutu(1, 18, 70, 42, 222);
  // Sıvası dökülmüş köşe: altından tuğla görünür
  for (let y = 30; y < 50; y++) {
    for (let x = 33; x < 47; x++) {
      const uz = Math.hypot((x - 40) / 7, (y - 40) / 10) + (kes(x, y) - 0.5) * 0.45;
      if (uz < 0.9) {
        const sira = Math.floor(y / 3);
        t.nokta(x, y, y % 3 === 2 || (x + (sira % 2) * 3) % 6 === 0 ? 128 : 170);
      } else if (uz < 1.05) t.nokta(x, y, 190);
    }
  }
  // Köşe taşları
  for (let y = 20; y < 52; y += 6) {
    t.kutu(1, y, 5, 3, 190);
    t.kutu(1, y + 3, 3, 3, 190);
    t.kutu(66, y, 5, 3, 190);
    t.kutu(68, y + 3, 3, 3, 190);
  }
  // Taş temel
  t.kutu(1, 52, 70, 8, 150);
  t.kutu(1, 52, 70, 1, 190);
  for (let y = 53; y < 60; y += 4) for (let x = 2 + ((y % 8) ? 5 : 0); x < 70; x += 10) t.kutu(x, y, 1, 4, 112);
  t.kutu(1, 56, 70, 1, 112);
  // Saçak gölgesi
  t.kutu(1, 18, 70, 2, 170);
  // Çatı: kiremit, üstten aşağı genişleyen trapez
  for (let y = 0; y < 18; y++) {
    const sol = y < 13 ? Math.round(15 - (y * 15) / 13) : 0;
    for (let x = sol; x < W - sol; x++) {
      const sira = Math.floor(y / 3);
      const k = (x + (sira % 2) * 2) % 5;
      t.nokta(x, y, y % 3 === 0 ? 150 : k === 0 ? 64 : 100);
    }
  }
  t.kutu(15, 0, 42, 1, 64); // mahya
  t.kutu(0, 16, 72, 1, 170); // saçak alnı
  t.kutu(0, 17, 72, 1, 64);
  // Baca: tuğla, şapkalı
  tugla(t, 43, 2, 6, 9, 170, 112);
  t.kutu(42, 0, 8, 2, 42);
  t.kutu(42, 2, 1, 9, M);
  t.kutu(49, 2, 1, 9, M);
  // Pencereler
  pencere(t, 13, 24, 10, 11, true);
  pencere(t, 49, 24, 10, 11, true);
  pencere(t, 49, 41, 10, 9, false);
  // Çiçeklik
  t.kutu(48, 52, 12, 3, 100);
  t.kutu(48, 52, 12, 1, M);
  for (const x of [49, 52, 55, 58]) {
    t.nokta(x, 51, M);
    t.nokta(x + 1, 50, M);
  }
  // Kapı: tahta, üstünde küçük cam, sövesi ve basamağı
  t.kutu(17, 37, 14, 2, 170); // söve
  t.kutu(17, 37, 14, 1, 128);
  t.kutu(18, 39, 12, 21, M);
  t.kutu(19, 40, 10, 20, 112);
  for (const x of [22, 25]) t.kutu(x, 40, 1, 20, 85);
  t.kutu(21, 42, 6, 4, 64); // kapı camı
  t.kutu(21, 42, 6, 1, M);
  t.nokta(23, 44, 150);
  t.kutu(27, 50, 1, 2, 240); // kol
  t.kutu(16, 58, 16, 2, 190); // basamak
  t.kutu(16, 58, 16, 1, 240);
  // Kapı lambası, numara levhası
  t.kutu(33, 39, 1, 3, M);
  t.kutu(33, 42, 2, 2, 240);
  t.kutu(33, 47, 5, 4, 240);
  t.cerceve(33, 47, 5, 4, M);
  t.nokta(35, 48, M);
  t.nokta(35, 49, M);
  // Yağmur borusu
  t.kutu(63, 18, 2, 40, 150);
  t.kutu(64, 18, 1, 40, 112);
  for (const y of [24, 36, 48]) t.kutu(62, y, 4, 1, 85);
  // Çatlak ve kurşun izleri
  let cx = 27;
  for (let y = 21; y < 34; y++) {
    t.nokta(cx, y, 150);
    if (kes(y, 3) < 0.45) cx += kes(y, 4) < 0.5 ? 1 : -1;
  }
  for (const [x, y] of [[9, 38], [11, 44], [8, 47], [43, 22], [62, 40], [38, 26], [36, 54]]) {
    t.nokta(x, y, 128);
    t.nokta(x + 1, y, 170);
  }
  return t;
}

/** Dükkân: korkuluklu düz çatı, tabela, çizgili tente, vitrin, camlı kapı. 72×42. */
function dukkanDerisi(): Tuval {
  const W = 72;
  const H = 42;
  const t = new Tuval(W, H);
  t.g.fill(0);
  t.kutu(0, 0, W, H, 222);
  // Korkuluk ve harpuşta
  t.kutu(0, 0, W, 4, 190);
  t.kutu(0, 0, W, 1, 128);
  t.kutu(0, 4, W, 1, 150);
  // Tabela: yazı yerine bloklar (dil yok), köşesi kurşun yemiş
  t.kutu(7, 2, 58, 9, M);
  t.kutu(8, 3, 56, 7, 245);
  for (const [x, w] of [[12, 4], [18, 3], [23, 5], [30, 2], [34, 4], [40, 4], [46, 3], [51, 5]]) t.kutu(x, 5, w, 3, M);
  t.nokta(59, 4, M);
  t.nokta(60, 8, M);
  t.nokta(10, 8, 128);
  // Tente: çizgili, etek ucu dalgalı, altında gölge
  for (let x = 2; x < 70; x++) {
    const acik = Math.floor((x - 2) / 4) % 2 === 0;
    for (let y = 12; y < 19; y++) t.nokta(x, y, acik ? 245 : 128);
    if ((x - 2) % 4 !== 3) t.nokta(x, 19, acik ? 245 : 128);
  }
  t.kutu(2, 12, 68, 1, M);
  t.kutu(3, 20, 66, 1, 170);
  // Vitrin: cam, kayıt, içeride raflar ve şişeler
  t.kutu(5, 22, 34, 15, M);
  t.kutu(6, 23, 32, 13, 64);
  t.kutu(21, 23, 1, 13, 150);
  t.kutu(6, 30, 32, 1, 100); // raf
  for (const x of [8, 11, 14, 24, 28, 33]) {
    t.kutu(x, 26, 2, 4, 150);
    t.nokta(x, 25, 128);
  }
  for (const x of [9, 16, 25, 31]) t.kutu(x, 32, 4, 3, 128);
  t.cizgi(7, 28, 11, 24, 190); // camda parlama
  t.cizgi(24, 29, 29, 24, 190);
  // Vitrin altı: karo
  t.kutu(5, 37, 34, 5, 150);
  for (let x = 5; x < 39; x += 4) t.kutu(x, 37, 1, 5, 112);
  t.kutu(5, 37, 34, 1, 190);
  // Camlı kapı
  t.kutu(43, 22, 13, 20, M);
  t.kutu(44, 23, 11, 12, 64);
  t.kutu(44, 36, 11, 6, 128);
  t.kutu(44, 35, 11, 1, 190);
  t.cizgi(45, 30, 49, 25, 190);
  t.kutu(53, 30, 1, 4, 245); // kol
  t.kutu(46, 26, 6, 3, 245); // "açık" levhası
  t.kutu(47, 27, 4, 1, M);
  // Yan duvar: afiş, klima, sayaç kutusu
  t.kutu(60, 23, 9, 11, 245);
  t.cerceve(60, 23, 9, 11, M);
  t.kutu(62, 25, 5, 3, 128);
  t.kutu(62, 29, 5, 1, M);
  t.kutu(62, 31, 3, 1, M);
  t.kutu(59, 37, 13, 5, 150);
  t.kutu(59, 37, 13, 1, 190);
  for (let x = 59; x < 72; x += 4) t.kutu(x, 37, 1, 5, 112);
  // Kepenk kutusu
  t.kutu(4, 21, 36, 1, 128);
  return t;
}

/** Atölye: oluklu sac çatı ve cephe, yarı açık kepenk, yüksek pencereler, lastik yığını. 84×48. */
function atolyeDerisi(): Tuval {
  const W = 84;
  const H = 48;
  const t = new Tuval(W, H);
  t.g.fill(0);
  // Çatı: alçak beşik, oluklu sac
  for (let y = 0; y < 6; y++) {
    const sol = 12 + Math.round(((5 - y) * 30) / 5);
    for (let x = sol; x < W - sol; x++) t.nokta(x, y, x % 3 === 0 ? 100 : 150);
  }
  for (let y = 6; y < 12; y++) for (let x = 0; x < W; x++) t.nokta(x, y, x % 3 === 0 ? 100 : y === 6 ? 190 : 150);
  t.kutu(0, 11, W, 1, 64);
  t.kutu(38, 0, 8, 3, 100); // havalandırma
  t.kutu(38, 0, 8, 1, M);
  // Cephe: oluklu sac
  for (let y = 12; y < 38; y++) for (let x = 1; x < W - 1; x++) t.nokta(x, y, x % 4 === 0 ? 170 : 205);
  // Pas lekeleri
  for (const [x, y, n] of [[9, 12, 9], [51, 12, 6], [78, 12, 12]]) for (let k = 0; k < n; k++) t.nokta(x, y + k, 128);
  // Tuğla etek
  tugla(t, 1, 38, 82, 10, 170, 128);
  t.kutu(1, 38, 82, 1, 100);
  // Kepenk: lamalı, yarı açık; altından karanlık atölye
  t.kutu(11, 16, 38, 32, M);
  for (let y = 17; y < 40; y++) t.kutu(12, y, 36, 1, y % 3 === 0 ? 100 : 160);
  t.kutu(12, 40, 36, 8, 42);
  t.kutu(12, 39, 36, 1, M);
  t.kutu(28, 37, 5, 2, 240); // tutamak
  t.kutu(16, 43, 8, 5, 85); // içeride tezgâh
  t.kutu(16, 43, 8, 1, 128);
  t.kutu(34, 41, 6, 7, 85); // içeride varil
  t.kutu(34, 43, 6, 1, 128);
  // Tabela
  t.kutu(52, 13, 28, 5, M);
  t.kutu(53, 14, 26, 3, 245);
  for (const [x, w] of [[55, 3], [59, 5], [65, 2], [68, 4], [73, 4]]) t.kutu(x, 15, w, 1, M);
  // Yüksek pencereler: ikişer camlı
  for (const x of [54, 66]) {
    t.kutu(x, 20, 12, 6, M);
    t.kutu(x + 1, 21, 10, 4, 64);
    t.kutu(x + 5, 21, 1, 4, 150);
    t.nokta(x + 2, 22, 150);
    t.kutu(x - 1, 26, 14, 1, 128);
  }
  // Yan kapı
  t.kutu(55, 29, 9, 19, M);
  t.kutu(56, 30, 7, 18, 112);
  t.kutu(57, 32, 5, 4, 64);
  t.kutu(61, 40, 1, 2, 240);
  // Lastik yığını
  for (const [x, y] of [[73, 44], [78, 44], [75, 40]]) {
    t.daire(x, y, 3.2, 42);
    t.daire(x, y, 1.4, 128);
  }
  // Yağ lekesi ve boru
  t.kutu(2, 12, 2, 36, 150);
  t.kutu(3, 12, 1, 36, 112);
  return t;
}

/**
 * Deri tonlarını tuvalin düz görünen 7 kademesine oturtur. Ara değerler
 * taranır; küçük bir cephede tarama karıncalanma gibi görünür (ilk denemede
 * sıva ve kiremit kumlu çıktı).
 */
function duzle(g: Uint8Array): void {
  const KADEME = [42, 85, 128, 170, 213, 255];
  for (let i = 0; i < g.length; i++) {
    const v = g[i];
    if (v < 2) continue;
    if (v === 64) {
      g[i] = 42;
      continue;
    }
    let en = 42;
    for (const k of KADEME) if (Math.abs(k - v) < Math.abs(en - v)) en = k;
    g[i] = en;
  }
}

const deriler = new Map<number, Deri>();

/** 0 ev, 1 dükkân, 2 atölye. */
export function binaDerisi(tur: number): Deri {
  let d = deriler.get(tur);
  if (!d) {
    const t = tur === 0 ? evDerisi() : tur === 1 ? dukkanDerisi() : atolyeDerisi();
    silueteKenar(t);
    duzle(t.g);
    d = { w: t.w, h: t.h, g: t.g };
    deriler.set(tur, d);
  }
  return d;
}
