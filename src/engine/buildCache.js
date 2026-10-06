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
 * Anahtar, üreticinin bütün girdilerini (sayılar, diziler) içermelidir;
 * malzemeler kütüphaneden gelir ve oturum boyunca değişmez.
 */

let prev = new Map();
let cur = new Map();
let live = new WeakSet();
/** Ayrıntı seviyesi (kalite/taslak): anahtarlara eklenir, seviyeler karışmaz */
let detail = '';

export function setDetailTag(tag) {
  detail = tag;
}

/** Yeni model kurulumunun başında çağrılır */
export function beginBuild() {
  prev = cur;
  cur = new Map();
  live = new WeakSet();
}

/** Bir parçayı önceki nesilden al ya da üret */
export function reuse(baseKey, build) {
  const key = `${detail}|${baseKey}`;
  if (cur.has(key)) return build();
  let v = prev.get(key);
  if (v === undefined) v = build();
  else prev.delete(key);
  cur.set(key, v);
  markLive(v);
  return v;
}

/** Nesnenin (ya da grubun) geometrilerini bu nesle ait say */
function markLive(v) {
  const visit = (o) => {
    if (!o) return;
    if (o.isBufferGeometry) live.add(o);
    else if (o.isObject3D) o.traverse((c) => c.geometry && live.add(c.geometry));
  };
  if (v?.isBufferGeometry || v?.isObject3D) visit(v);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) if (x?.isBufferGeometry || x?.isObject3D) visit(x);
}

/** Geometri şu anki modelde kullanılıyor mu (eski model atılırken korunur) */
export function isLive(geometry) {
  return live.has(geometry);
}

/** Sayıları 6 haneye yuvarlayan kararlı anahtar */
export function keyOf(prefix, data) {
  return `${prefix}|${JSON.stringify(data, (_, v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v))}`;
}
