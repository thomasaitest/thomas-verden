import { sfx } from '../audio.ts';

type Child = Node | string | null | undefined | false;
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = String(v);
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v as Record<string, string>)) {
        if (sk.startsWith('--')) e.style.setProperty(sk, sv);
        else (e.style as unknown as Record<string, string>)[sk] = sv;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'html') e.innerHTML = String(v);
    else e.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

export function button(label: Child, onClick: () => void, cls = 'btn', extra: Record<string, unknown> = {}): HTMLButtonElement {
  return el('button', {
    class: cls,
    type: 'button',
    onclick: (e: Event) => {
      e.stopPropagation();
      sfx.tap();
      onClick();
    },
    ...extra,
  }, label);
}

let toastHost: HTMLElement | null = null;
export function toast(text: string, kind: 'ok' | 'bad' | 'gold' = 'ok'): void {
  if (!toastHost) {
    toastHost = el('div', { class: 'toasts' });
    document.body.append(toastHost);
  }
  const t = el('div', { class: `toast ${kind}` }, text);
  toastHost.append(t);
  setTimeout(() => t.classList.add('out'), 2200);
  setTimeout(() => t.remove(), 2700);
}

export interface Sheet {
  root: HTMLElement;
  body: HTMLElement;
  close(): void;
}

let openSheet: Sheet | null = null;
export function currentSheet(): Sheet | null {
  return openSheet;
}

/** A bubbly modal panel. */
export function sheet(title: string, color: string, onClose?: () => void, cls = ''): Sheet {
  openSheet?.close();
  const body = el('div', { class: 'sheet-body' });
  const root = el(
    'div',
    { class: `sheet-wrap ${cls}`, onpointerdown: (e: Event) => e.target === root && s.close() },
    el('div', { class: 'sheet', style: { '--accent': color } }, el('div', { class: 'sheet-head' }, el('h2', {}, title), button('✕', () => s.close(), 'btn close')), body),
  );
  const s: Sheet = {
    root,
    body,
    close() {
      if (openSheet === s) openSheet = null;
      root.remove();
      onClose?.();
    },
  };
  document.getElementById('ui')!.append(root);
  openSheet = s;
  return s;
}

export function bucksText(n: number): string {
  return n.toLocaleString('nb-NO');
}
