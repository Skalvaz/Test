import { LIMITS } from '../../sim';
import { coldEngine, pct } from './helpers';
import type { Lesson } from './types';

const START_SWITCHES = ['apuBleed', 'starter', 'ignition', 'fuelRun'] as const;

export const start: Lesson = {
  id: 'start',
  title: 'Motoru çalıştırmak',
  summary: 'APU havası, marş motoru, ateşleme ve doğru anda yakıt: gerçek prosedürle soğuk motoru rölantiye getir.',
  minutes: 7,
  level: 'Başlangıç',
  setup: coldEngine,
  steps: [
    {
      title: 'Bir jet motoru kendi kendine çalışamaz',
      body: `<p>Duran bir motorun kompresörü hava basmaz; hava olmadan yakıt yanmaz, yanma olmadan türbin dönmez. Bu kısır döngüyü bir <b>marş motoru</b> kırar.</p>
<p>Geniş gövdeli jetlerde marş motoru bir <b>hava türbinidir</b>: yardımcı güç ünitesinden (APU) gelen basınçlı hava onu döndürür, o da dişli kutusu üzerinden HP milini (N2) çevirir.</p>
<p>Prosedür:</p>
<ul>
<li><b>APU BLEED</b> aç — marş için basınçlı hava</li>
<li><b>ATEŞLEME</b> aç — ateşleme bujileri</li>
<li><b>MARŞ</b> → GRD — motor dönmeye başlar</li>
<li>N2 en az <b>%${LIMITS.fuelOnMinN2 * 100}</b> olunca <b>YAKIT KONTROL</b> → RUN</li>
<li>Light-off, EGT izle (çalıştırma limiti <b>${LIMITS.egtStart} °C</b>)</li>
<li>Marş motoru %${LIMITS.starterCutout * 100} N2'de kendiliğinden ayrılır, motor rölantiye oturur</li>
</ul>
<p>Alttaki konsol senin kokpitin: solda çalıştırma paneli, ortada motor göstergeleri (EICAS), sağda gaz kolu.</p>`,
      ui: { view: 'front', cockpit: true, switches: [...START_SWITCHES], throttleLocked: true },
    },
    {
      title: 'Adım 1 — Marş havası',
      body: `<p>Marş motoru hava ile döner. Önce APU'nun basınçlı havasını motora aç.</p>
<p>EICAS'ın sağındaki <b>CAS mesajları</b> listesinde "APU BLEED" belirecek.</p>`,
      ui: { cockpit: true, switches: [...START_SWITCHES], flash: ['apuBleed'], throttleLocked: true },
      objectives: [{ text: 'APU BLEED anahtarını AÇIK konuma getir', check: (c) => c.snap.controls.apuBleed }],
      auto: true,
    },
    {
      title: 'Adım 2 — Ateşleme',
      body: `<p>Ateşleme bujileri yanma odasında kıvılcım üretir. Açtığında kokpitte bujilerin tıkırtısını duyarsın (sesi açıksa).</p>
<p>Gerçek uçaklarda iki bağımsız ateşleme sistemi vardır ve her çalıştırmada dönüşümlü seçilir.</p>`,
      ui: { cockpit: true, switches: [...START_SWITCHES], flash: ['ignition'], throttleLocked: true },
      objectives: [{ text: 'ATEŞLEME anahtarını AÇIK konuma getir', check: (c) => c.snap.controls.ignition }],
      auto: true,
    },
    {
      title: 'Adım 3 — Motoru döndür',
      body: `<p>Marş anahtarını <b>GRD</b> konumuna al. Marş valfi açılır ve HP mili dönmeye başlar.</p>
<p>EICAS'ta <b>N2</b>'yi izle. <b>N1 henüz dönmüyor</b>: marş motoru yalnızca HP milini çevirir; fan, çekirdekten geçen hava ve ardından yanma başlayınca LP türbin tarafından döndürülecek.</p>
<div class="callout warn">Yakıta dokunma! N2 %${LIMITS.fuelOnMinN2 * 100}'nin altındayken kompresör yanmayı soğutacak kadar hava basmaz.</div>`,
      enter(sim) {
        if (sim.N2 > 0.05 || sim.controls.fuelRun) {
          sim.reset();
        }
        Object.assign(sim.controls, { apuBleed: true, ignition: true, starter: false, fuelRun: false });
      },
      ui: {
        cockpit: true,
        switches: [...START_SWITCHES],
        flash: (c) => (c.snap.controls.starter ? null : ['starter']),
        throttleLocked: true,
      },
      objectives: [
        { text: 'MARŞ anahtarını GRD konumuna al', check: (c) => c.snap.controls.starter || c.snap.starterEngaged },
        {
          text: (c) => `N2 %${LIMITS.fuelOnMinN2 * 100}'yi geçsin (şu an ${pct(c.snap.N2)})`,
          check: (c) => c.snap.N2 >= LIMITS.fuelOnMinN2,
        },
      ],
      fail: (c) =>
        c.snap.controls.fuelRun && c.snap.N2 < LIMITS.fuelOnMinN2 - 0.02
          ? `Yakıt ${pct(c.snap.N2)} N2'de verildi — çok erken. Az hava + yakıt = çok yüksek sıcaklık (sıcak çalıştırma).`
          : null,
    },
    {
      title: 'Adım 4 — Yakıt ver',
      body: `<p>N2 yeterli. Şimdi <b>YAKIT KONTROL</b> anahtarını <b>RUN</b> konumuna al.</p>
<p>FADEC yakıtı çalıştırma programına göre verir. Birkaç saniye içinde <b>light-off</b> olmalı: yanma odasında alev oluşur ve <b>EGT hızla yükselir</b>.</p>
<p>EGT kadranındaki kesikli kırmızı çizgi <b>${LIMITS.egtStart} °C</b> çalıştırma limitidir.</p>`,
      ui: {
        cockpit: true,
        switches: [...START_SWITCHES],
        flash: (c) => (c.snap.controls.fuelRun ? null : ['fuelRun']),
        throttleLocked: true,
      },
      objectives: [
        { text: 'YAKIT KONTROL → RUN', check: (c) => c.snap.controls.fuelRun },
        { text: 'Light-off: alev oluşsun, EGT yükselsin', check: (c) => c.snap.lit },
      ],
      fail: (c) => {
        if (c.had('hotStart')) return `EGT ${LIMITS.egtStart} °C çalıştırma limitini aştı (sıcak çalıştırma).`;
        if (!c.snap.controls.starter && !c.snap.lit && c.snap.N2 < 0.3) {
          return 'Marş motoru light-off olmadan kapatıldı; motor yavaşladı.';
        }
        return null;
      },
    },
    {
      title: 'Adım 5 — Rölantiye ivmelenme',
      body: `<p>Alev oluştu. Şimdi türbin de güç üretiyor ve marş motoruna yardım ediyor; <b>N1 dönmeye başladı</b>.</p>
<p>İzlemen gerekenler:</p>
<ul>
<li><b>EGT</b> önce bir tepe yapar, sonra hava akışı arttıkça düşer</li>
<li><b>N2</b> %${LIMITS.starterCutout * 100}'ya ulaşınca marş valfi kapanır</li>
<li>Motor <b>~%62 N2 / ~%22 N1</b> civarında rölantiye oturur</li>
</ul>
<p>Bir sorun olursa (EGT limite koşuyorsa ya da N2 takılıp kalırsa) prosedür yakıtı <b>CUTOFF</b>'a almaktır.</p>`,
      ui: { cockpit: true, switches: [...START_SWITCHES], throttleLocked: true },
      objectives: [
        { text: `Marş motoru %${LIMITS.starterCutout * 100} N2'de ayrılsın`, check: (c) => c.had('starterCutout') || (!c.snap.controls.starter && c.snap.N2 > 0.55) },
        { text: (c) => `Rölanti: N2 ≥ %60 (şu an ${pct(c.snap.N2)})`, check: (c) => c.snap.phase === 'running' && c.snap.N2 >= 0.6, hold: 1.5 },
      ],
      fail: (c) => {
        if (c.had('hotStart')) return `EGT ${LIMITS.egtStart} °C çalıştırma limitini aştı.`;
        if (c.had('hungStart')) return 'Takılı çalıştırma: N2 rölantiye çıkamadı.';
        if (!c.snap.controls.fuelRun) return 'Yakıt çalıştırma tamamlanmadan kesildi.';
        return null;
      },
      done: (c) =>
        `Motor rölantide: N1 <b>${pct(c.snap.N1)}</b>, N2 <b>${pct(c.snap.N2)}</b>, EGT <b>${c.snap.egt.toFixed(0)} °C</b>, yakıt akışı <b>${(c.snap.wf * 3600).toFixed(0)} kg/h</b>. Artık APU havasına ihtiyaç yok.`,
    },
    {
      title: 'Soru: erken yakıt',
      body: `<p>Az önce yakıtı N2 %${LIMITS.fuelOnMinN2 * 100}'yi geçince verdin. Peki daha erken verseydin?</p>`,
      ui: { cockpit: true, switches: [...START_SWITCHES], throttleLocked: true },
      quiz: {
        question: 'Yakıt N2 %8\'de verilirse ne olur?',
        options: [
          'Motor daha hızlı çalışır, sorun yok',
          'Hava akışı çok az olduğu için yakıt/hava oranı yükselir, EGT limiti aşar: sıcak çalıştırma',
          'Yakıt tutuşmaz, motor soğuk kalır',
          'Marş motoru aşırı devir yapar',
        ],
        answer: 1,
        explain:
          'Aynı yakıtı çok daha az havayla yakmak sıcaklığı fırlatır. Test hücresinde deneyebilirsin: sıcak çalıştırma türbin kanatlarına zarar verebilir.',
      },
    },
    {
      title: 'Soru: ateşlemeyi unutmak',
      body: `<p>Bir de ateşlemeyi açmayı unuttuğunu düşün.</p>`,
      ui: { cockpit: true, switches: [...START_SWITCHES], throttleLocked: true },
      quiz: {
        question: 'Ateşleme kapalıyken yakıt verilirse ne olur?',
        options: [
          'Hiçbir şey; yakıt pompası çalışmaz',
          'Yakıt kompresörün ısısıyla kendiliğinden tutuşur',
          'Yakıt yanmadan motorda birikir (ıslak çalıştırma); sonradan tutuşursa egzozdan alev fışkırır',
          'EGT düşer ve motor normal çalışır',
        ],
        answer: 2,
        explain:
          'Buna ıslak çalıştırma denir. Prosedür yakıtı kesip motoru bir süre kuru çevirerek birikmiş yakıtı dışarı atmaktır. Birikmiş yakıt tutuşursa "torching" denen uzun egzoz alevi oluşur.',
      },
    },
    {
      title: 'Motor çalışıyor',
      body: `<p>Soğuk bir motoru gerçek prosedürle çalıştırdın. Modern motorlarda FADEC bu sırayı çoğunlukla otomatik yapar (auto-start) ve sıcak çalıştırmayı kendisi keser; ama pilotun her adımı izlemesi ve gerekirse müdahale etmesi beklenir.</p>
<p>Sıradaki derste motorun içinde neler olduğunu — Brayton çevrimini — göreceksin.</p>`,
      ui: { cockpit: true, switches: [...START_SWITCHES], throttleLocked: false },
    },
  ],
};
