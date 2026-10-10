/**
 * Testler için en küçük DOM taklidi (vitest node ortamında çalışır; jsdom
 * bağımlılığı yok). Atölye panellerinin kullandığı kadarı: öğe kurma,
 * sınıf/öznitelik, metin, çocuklar, kabarcıklanan olaylar (preventDefault,
 * stopPropagation, target/currentTarget), basit seçiciler ('.a', 'tag',
 * '[k="v"]', 'tag.a' ve bunların birleşimi). Yalnız testlerden içe aktarılır.
 */

type Listener = (e: FakeEvent) => void;

export class FakeEvent {
  target: FakeNode | null = null;
  currentTarget: FakeNode | null = null;
  defaultPrevented = false;
  propagationStopped = false;
  key?: string;
  constructor(
    readonly type: string,
    init: { bubbles?: boolean; key?: string } = {},
  ) {
    this.bubbles = init.bubbles ?? true;
    this.key = init.key;
  }
  bubbles: boolean;
  preventDefault(): void {
    this.defaultPrevented = true;
  }
  stopPropagation(): void {
    this.propagationStopped = true;
  }
}

export class FakeNode {
  parentNode: FakeEl | null = null;
  private listeners = new Map<string, Listener[]>();
  addEventListener(t: string, fn: Listener): void {
    if (!this.listeners.has(t)) this.listeners.set(t, []);
    this.listeners.get(t)!.push(fn);
  }
  removeEventListener(t: string, fn: Listener): void {
    const l = this.listeners.get(t);
    if (l) this.listeners.set(t, l.filter((x) => x !== fn));
  }
  dispatchEvent(e: FakeEvent): boolean {
    e.target = this;
    let n: FakeNode | null = this;
    while (n) {
      e.currentTarget = n;
      for (const fn of [...(n.listeners.get(e.type) ?? [])]) fn(e);
      if (e.propagationStopped || !e.bubbles) break;
      n = n.parentNode;
    }
    e.currentTarget = null;
    return !e.defaultPrevented;
  }
  get textContent(): string {
    return '';
  }
}

export class FakeText extends FakeNode {
  constructor(public data: string) {
    super();
  }
  override get textContent(): string {
    return this.data;
  }
}

class ClassList {
  constructor(private el: FakeEl) {}
  private get set(): Set<string> {
    return new Set(this.el.className.split(/\s+/).filter(Boolean));
  }
  private write(s: Set<string>): void {
    this.el.className = [...s].join(' ');
  }
  contains(c: string): boolean {
    return this.set.has(c);
  }
  add(...cs: string[]): void {
    const s = this.set;
    for (const c of cs) s.add(c);
    this.write(s);
  }
  remove(...cs: string[]): void {
    const s = this.set;
    for (const c of cs) s.delete(c);
    this.write(s);
  }
  toggle(c: string, force?: boolean): boolean {
    const on = force ?? !this.contains(c);
    if (on) this.add(c);
    else this.remove(c);
    return on;
  }
}

export class FakeEl extends FakeNode {
  className = '';
  readonly classList = new ClassList(this);
  readonly childNodes: FakeNode[] = [];
  readonly attributes = new Map<string, string>();
  readonly style: Record<string, string> & { setProperty(k: string, v: string): void } = Object.assign(Object.create(null), {
    setProperty(this: Record<string, string>, k: string, v: string) {
      this[k] = v;
    },
  });
  title = '';
  value = '';
  disabled = false;
  open = false;
  innerHTML = '';
  scrollTop = 0;
  scrollHeight = 0;
  clientHeight = 0;
  offsetWidth = 0;
  constructor(readonly tagName: string) {
    super();
  }
  get children(): FakeEl[] {
    return this.childNodes.filter((n): n is FakeEl => n instanceof FakeEl);
  }
  override get textContent(): string {
    return this.childNodes.map((n) => n.textContent).join('');
  }
  set textContent(t: string) {
    this.replaceChildren(new FakeText(String(t)));
  }
  setAttribute(k: string, v: string): void {
    this.attributes.set(k, String(v));
  }
  getAttribute(k: string): string | null {
    return this.attributes.get(k) ?? null;
  }
  hasAttribute(k: string): boolean {
    return this.attributes.has(k);
  }
  removeAttribute(k: string): void {
    this.attributes.delete(k);
  }
  append(...ns: (FakeNode | string)[]): void {
    for (const n of ns) {
      const node = typeof n === 'string' ? new FakeText(n) : n;
      node.parentNode?.removeChild(node);
      node.parentNode = this;
      this.childNodes.push(node);
    }
  }
  appendChild(n: FakeNode): FakeNode {
    this.append(n);
    return n;
  }
  removeChild(n: FakeNode): FakeNode {
    const i = this.childNodes.indexOf(n);
    if (i >= 0) this.childNodes.splice(i, 1);
    n.parentNode = null;
    return n;
  }
  get firstChild(): FakeNode | null {
    return this.childNodes[0] ?? null;
  }
  replaceChildren(...ns: (FakeNode | string)[]): void {
    for (const c of [...this.childNodes]) this.removeChild(c);
    this.append(...ns);
  }
  /** Öğe ağacın içinde mi (kendisi dahil) */
  contains(n: FakeNode | null): boolean {
    for (let x = n; x; x = x.parentNode) if (x === this) return true;
    return false;
  }
  focus(): void {
    fakeDocument.activeElement = this;
  }
  blur(): void {
    if (fakeDocument.activeElement === this) fakeDocument.activeElement = fakeDocument.body;
  }
  click(): void {
    this.dispatchEvent(new FakeEvent('click'));
  }
  scrollIntoView(): void {}
  getBoundingClientRect() {
    return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }
  private all(): FakeEl[] {
    const out: FakeEl[] = [];
    const walk = (e: FakeEl) => {
      for (const c of e.children) {
        out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
  querySelectorAll(sel: string): FakeEl[] {
    const m = matcher(sel);
    return this.all().filter(m);
  }
  querySelector(sel: string): FakeEl | null {
    return this.querySelectorAll(sel)[0] ?? null;
  }
}

/** 'tag.a.b[k="v"]' biçiminde tek bileşik seçici */
function matcher(sel: string): (e: FakeEl) => boolean {
  const tag = /^[a-z]+/i.exec(sel)?.[0]?.toUpperCase();
  const classes = [...sel.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
  const attrs = [...sel.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)].map((m) => [m[1], m[2]] as const);
  return (e) =>
    (!tag || e.tagName === tag) &&
    classes.every((c) => e.classList.contains(c)) &&
    attrs.every(([k, v]) => (v === undefined ? e.hasAttribute(k) : e.getAttribute(k) === v));
}

export const fakeDocument = {
  body: new FakeEl('BODY'),
  activeElement: null as FakeEl | null,
  createElement: (tag: string) => new FakeEl(tag.toUpperCase()),
  createTextNode: (t: string) => new FakeText(t),
  createElementNS: (_ns: string, tag: string) => new FakeEl(tag.toUpperCase()),
};

/** Küresel `document`/`window`'u taklitle değiştirir; dönen işlev geri alır */
export function installFakeDom(): () => void {
  const g = globalThis as unknown as Record<string, unknown>;
  const prev = { document: g.document, window: g.window };
  fakeDocument.body = new FakeEl('BODY');
  fakeDocument.activeElement = fakeDocument.body;
  g.document = fakeDocument;
  g.window = globalThis;
  return () => {
    g.document = prev.document;
    g.window = prev.window;
  };
}

/** Test kolaylığı: DOM tipine çevir */
export const asEl = (x: unknown) => x as FakeEl;
