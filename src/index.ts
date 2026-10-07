const DEFAULT_ENDPOINT = 'https://serve.adviverse.com';
// SDK major line — same default as @adviverse/react: `${endpoint}/sdk/v1.js`.
const DEFAULT_VERSION = 'v1';

type AdviverseGlobal = {
  render?: (el: any, o: { tag: string; sizes?: string }) => Promise<unknown>;
  destroy?: (el: any) => void;
  ready?: (cb: () => void) => void;
  version?: string;
};
declare global {
  interface Window {
    adviverse?: AdviverseGlobal;
    ADVIVERSE_ENDPOINT?: string;
  }
}

let loading: Promise<void> | null = null;

/** Test hook: forget the cached loader promise. */
export function _resetSdkLoader(): void {
  loading = null;
}

const sdkReady = () => !!(window.adviverse && window.adviverse.render);

/** Idempotent SDK loader (mirrors @adviverse/react): resolves only once window.adviverse is ready. */
export function loadSdk(opts?: { endpoint?: string; version?: string }): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.resolve();
  if (sdkReady()) return Promise.resolve();
  if (loading) return loading;
  const ep = (opts?.endpoint || window.ADVIVERSE_ENDPOINT || DEFAULT_ENDPOINT).replace(/\/$/, '');
  const ver = opts?.version ?? DEFAULT_VERSION;
  const url = ver ? `${ep}/sdk/${ver}.js` : `${ep}/sdk.js`;
  const p = new Promise<void>((res, rej) => {
    const fail = (s: HTMLScriptElement) => () => {
      s.remove();
      loading = null;
      rej(new Error(`Failed to load ${url}`));
    };
    const existing = document.querySelector('script[data-adviverse-sdk]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => res());
      existing.addEventListener('error', fail(existing));
      return;
    }
    const s = document.createElement('script');
    s.async = true;
    s.setAttribute('src', url);
    s.setAttribute('data-adviverse-sdk', '1');
    s.addEventListener('load', () => res());
    s.addEventListener('error', fail(s));
    document.head.appendChild(s);
  });
  loading = p;
  return p;
}

const Base: typeof HTMLElement =
  typeof HTMLElement !== 'undefined' ? HTMLElement : (class {} as unknown as typeof HTMLElement);

export class AdviverseAdElement extends Base {
  private _gen = 0;

  static get observedAttributes() {
    return ['tag', 'sizes'];
  }

  connectedCallback() {
    void this._mount(++this._gen);
  }

  disconnectedCallback() {
    this._gen++;
    window.adviverse?.destroy?.(this);
  }

  attributeChangedCallback(_name: string, old: string | null, val: string | null) {
    if (old === val || !this.isConnected) return;
    window.adviverse?.destroy?.(this);
    void this._mount(++this._gen);
  }

  private async _mount(gen: number): Promise<void> {
    if (!this.getAttribute('tag')) return;
    try {
      await loadSdk();
    } catch {
      return;
    }
    const go = () => {
      if (gen !== this._gen || !this.isConnected) return;
      const tag = this.getAttribute('tag');
      if (!tag) return;
      void window.adviverse?.render?.(this, { tag, sizes: this.getAttribute('sizes') || undefined });
    };
    if (window.adviverse?.render) go();
    else window.adviverse?.ready?.(go);
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('adviverse-ad')) {
  customElements.define('adviverse-ad', AdviverseAdElement);
}
