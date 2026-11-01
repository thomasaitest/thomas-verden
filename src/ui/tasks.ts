import { NEED_INFO, type PetState } from '../logic/needs.ts';
import { el } from './dom.ts';

/** Everything a task card shows. Plain data, so what needs redrawing can be tested without a DOM. */
export interface TaskView {
  uid: string;
  title: string;
  hint: string;
  emoji: string;
  reward: number;
  sick: boolean;
  /** 0–100 */
  pct: number;
}

export function taskViews(pets: readonly PetState[]): TaskView[] {
  return pets
    .filter((p) => p.need)
    .map((p) => {
      const info = NEED_INFO[p.need!.kind];
      return {
        uid: p.uid,
        title: `${p.name}: ${info.label}`,
        hint: info.hint,
        emoji: info.emoji,
        reward: info.reward,
        sick: p.need!.kind === 'syk',
        pct: Math.round(p.need!.progress * 100),
      };
    });
}

/**
 * Which cards must be created or removed. A card is only new when its pet gets a new task; a changing
 * progress bar or name just patches the existing card. (The panel used to be rebuilt every time the
 * progress moved, which restarted the card's pop-in animation every few percent: that was the flicker.)
 */
export function reconcileTasks(shown: readonly { uid: string; kind: string }[], next: readonly { uid: string; kind: string }[]): { add: string[]; remove: string[] } {
  const was = new Map(shown.map((s) => [s.uid, s.kind]));
  const want = new Map(next.map((s) => [s.uid, s.kind]));
  return {
    add: next.filter((n) => was.get(n.uid) !== n.kind).map((n) => n.uid),
    remove: shown.filter((s) => want.get(s.uid) !== s.kind).map((s) => s.uid),
  };
}

interface Card {
  kind: string;
  root: HTMLButtonElement;
  title: HTMLElement;
  hint: HTMLElement;
  bar: HTMLElement;
  pay: HTMLElement;
  emoji: HTMLElement;
  onTap: { fn: () => void };
  view: TaskView;
}

const setText = (e: HTMLElement, v: string) => {
  if (e.textContent !== v) e.textContent = v;
};

/** The "Oppgaver" panel in the corner. Cards are created once and patched in place. */
export class TasksPanel {
  root = el('div', { class: 'tasks' });
  private titleEl = el('div', { class: 'tasks-title' }, 'Oppgaver');
  private cards = new Map<string, Card>();
  /** How many cards have been built (a test hook: this must not grow while progress changes). */
  built = 0;

  update(pets: readonly PetState[], onTap: (uid: string) => void): void {
    const views = taskViews(pets);
    const kindOf = (uid: string) => pets.find((p) => p.uid === uid)!.need!.kind;
    const next = views.map((v) => ({ uid: v.uid, kind: kindOf(v.uid) }));
    const shown = [...this.cards].map(([uid, c]) => ({ uid, kind: c.kind }));
    const { add, remove } = reconcileTasks(shown, next);
    for (const uid of remove) {
      this.cards.get(uid)?.root.remove();
      this.cards.delete(uid);
    }
    for (const uid of add) {
      const v = views.find((x) => x.uid === uid)!;
      const emoji = el('span', { class: 'task-emoji' }, v.emoji);
      const title = el('b', {}, v.title);
      const hint = el('small', {}, v.hint);
      const bar = el('i', { style: { width: `${v.pct}%` } });
      const pay = el('span', { class: 'task-pay' }, `+${v.reward}`);
      const tap = { fn: () => onTap(uid) };
      const root = el(
        'button',
        { class: `task ${v.sick ? 'sick' : ''}`, type: 'button', onclick: () => tap.fn() },
        emoji,
        el('span', { class: 'task-text' }, title, hint, el('span', { class: 'bar' }, bar)),
        pay,
      );
      this.cards.set(uid, { kind: kindOf(uid), root, title, hint, bar, pay, emoji, onTap: tap, view: v });
      this.built++;
    }
    for (const v of views) {
      const c = this.cards.get(v.uid)!;
      c.onTap.fn = () => onTap(v.uid);
      if (c.view.title !== v.title) setText(c.title, v.title);
      if (c.view.pct !== v.pct) c.bar.style.width = `${v.pct}%`;
      if (c.view.hint !== v.hint) setText(c.hint, v.hint);
      if (c.view.reward !== v.reward) setText(c.pay, `+${v.reward}`);
      c.view = v;
    }
    // keep the cards in pet order, without touching the ones already in the right place
    const wantOrder = views.map((v) => this.cards.get(v.uid)!.root);
    const order = views.length ? [this.titleEl, ...wantOrder] : [];
    if (order.length !== this.root.children.length || order.some((n, i) => this.root.children[i] !== n)) this.root.replaceChildren(...order);
  }
}
