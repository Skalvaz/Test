/**
 * Artımlı model üretimi: bir parametre değişince motorun yalnız etkilenen
 * parçaları yeniden üretilir.
 *
 * Her model kurulumu yeni bir "nesil" açar (`beginBuild`). Bir parça
 * `reuse(anahtar, üret)` ile istenir: önceki nesilde aynı anahtarla
 * üretilmiş nesne varsa ondan alınır (taşınır), yoksa üretilir. Nesneler
 * sahnede tek yerde durabildiği için her nesne bir nesilde bir kez
 * kullanılır; aynı anahtar ikinci kez istenirse yenisi üretilir.
 *
 * Önceki nesilde kalıp yeni nesle taşınmayan nesneler eski modelle birlikte
 * atılır. Taşınan geometriler `isLive` ile işaretlidir: eski model atılırken
 * dispose edilmez (yeni model onları kullanıyor).
 *
 * Ayrıntı seviyesi başına ayrı nesil (M5a §6.7): atölyede sürüklerken düşük
 * ayrıntılı taslak, bırakınca seçili kalitede tam model üretilir. Tek nesil
 * zinciriyle taslak ↔ tam geçişinde önceki nesil hep öteki seviyenin olurdu
 * (anahtarlar seviye etiketi taşır) ve her geçiş sıfırdan üretilirdi. Her
 * seviye kendi son neslini tutar: tam model, araya giren taslaklardan sonra
 * da kendi son tam neslinden yararlanır. Öteki seviyenin son neslindeki
 * geometriler de canlı sayılır (o nesil yeniden kullanılmak üzere bekler);
 * bir seviyenin artık kullanılmayan eski nesli o seviyenin yeni üretimi
 * bitince (`endBuild`) atılır.
 *
 * Anahtar, üreticinin bütün girdilerini (sayılar, diziler) içermelidir;
 * malzemeler kütüphaneden gelir ve oturum boyunca değişmez.
 */

/** Ayrıntı seviyesi (kalite/taslak): anahtarlara eklenir, seviyeler karışmaz */
let detail = '';
/**
 * Seviye başına nesiller: `prev` önceki üretim (taşınabilir parçalar),
 * `cur` son üretim, `live` son üretimin geometrileri.
 * @type {Map<string, { prev: Map<string, unknown>, cur: Map<string, unknown>, live: WeakSet<object> }>}
 */
const gens = new Map();
/** Şu an üretilen seviyenin nesli (beginBuild açar) */
let gen = newGen();

function newGen() {
  return { prev: new Map(), cur: new Map(), live: new WeakSet() };
}

export function setDetailTag(tag) {
  detail = tag;
}

/** Yeni model kurulumunun başında çağrılır: geçerli ayrıntı seviyesinin yeni nesli */
export function beginBuild() {
  const g = gens.get(detail) ?? newGen();
  gens.set(detail, g);
  g.prev = g.cur;
  g.cur = new Map();
  g.live = new WeakSet();
  gen = g;
}

/**
 * Model kurulumu bittiğinde çağrılır: bu seviyenin önceki neslinden
 * taşınmayan parçaların geometrileri atılır (hiçbir seviyenin son neslinde
 * değilse ve paylaşılmıyorsa). Eski model zaten atıldıysa (taslak araya
 * girdiyse) bu geometrileri başka kimse atmazdı. Sahnedeki model (son
 * üretim) hep bir seviyenin son neslindedir: dokunulmaz.
 */
export function endBuild() {
  const left = gen.prev;
  gen.prev = new Map();
  for (const v of left.values()) forEachGeometry(v, (g) => {
    if (!g.userData?.shared && !isLive(g)) g.dispose();
  });
}

/**
 * Yalnız verilen seviyelerin nesillerini tut (kalite değişiminde: yeni tam
 * kalite + taslak). Bırakılan seviyelerin geometrileri, tutulan bir seviyede
 * canlı değilse ve paylaşılmıyorsa atılır. Yoksa bırakılan kalitenin son
 * nesli `isLive` sayesinde hiç atılmaz, bellekte kalırdı. Sahnedeki eski
 * model bu çağrıdan hemen sonra yenisiyle değişmeli (bir kez daha çizilirse
 * three tamponları yeniden yükler; eski modelin dispose'u onları da atar).
 * @param {string[]} keep
 */
export function retainDetails(keep) {
  const dropped = [];
  for (const [tag, g] of gens) if (!keep.includes(tag)) {
    dropped.push(g);
    gens.delete(tag);
  }
  for (const g of dropped) for (const m of [g.prev, g.cur]) for (const v of m.values()) forEachGeometry(v, (geo) => {
    if (!geo.userData?.shared && !isLive(geo)) geo.dispose();
  });
}

/** Bir parçayı önceki nesilden al ya da üret */
export function reuse(baseKey, build) {
  const key = `${detail}|${baseKey}`;
  const g = gen;
  if (g.cur.has(key)) return build();
  let v = g.prev.get(key);
  if (v === undefined) v = build();
  else g.prev.delete(key);
  g.cur.set(key, v);
  forEachGeometry(v, (geo) => g.live.add(geo));
  return v;
}

/** Nesnenin (ya da grubun, ya da nesne alanlarının) geometrileri */
function forEachGeometry(v, fn) {
  const visit = (o) => {
    if (!o) return;
    if (o.isBufferGeometry) fn(o);
    else if (o.isObject3D) o.traverse((c) => c.geometry && fn(c.geometry));
  };
  if (v?.isBufferGeometry || v?.isObject3D) visit(v);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) if (x?.isBufferGeometry || x?.isObject3D) visit(x);
}

/**
 * Geometri bir ayrıntı seviyesinin son neslinde mi (eski model atılırken
 * korunur: ya yeni model kullanıyor ya da öteki seviyenin sonraki üretimi
 * için bekliyor)
 */
export function isLive(geometry) {
  for (const g of gens.values()) if (g.live.has(geometry)) return true;
  return false;
}

/** Sayıları 6 haneye yuvarlayan kararlı anahtar */
export function keyOf(prefix, data) {
  return `${prefix}|${JSON.stringify(data, (_, v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v))}`;
}
