import type { PetState } from '../logic/needs.ts';
import { TasksPanel } from './tasks.ts';
import { bucksText, button, el } from './dom.ts';

const put = (e: HTMLElement, v: string) => {
  if (e.textContent !== v) e.textContent = v;
};

export interface HudActions {
  bag(): void;
  pets(): void;
  avatar(): void;
  map(): void;
  build(): void;
  sound(): void;
  interact(): void;
  hold(): void;
  ride(): void;
  fly(): void;
  feed(): void;
  play(): void;
  drive(): void;
  pram(): void;
  activity(): void;
  mp(): void;
  emote(): void;
  quality?(): void;
}

export interface PetActionState {
  any: boolean;
  holding: boolean;
  riding: boolean;
  flying: boolean;
  canRide: boolean;
  canFly: boolean;
  hungry: boolean;
  canPlay: boolean;
  canDrive: boolean;
  driving: boolean;
  canPram: boolean;
  pramming: boolean;
  canActivity: boolean;
}

export class Hud {
  root: HTMLElement;
  bucks: HTMLElement;
  energyBar: HTMLElement;
  energyFill: HTMLElement;
  tasks: HTMLElement;
  private tasksPanel = new TasksPanel();
  prompt: HTMLButtonElement;
  buildBtn: HTMLButtonElement;
  soundBtn: HTMLButtonElement;
  qualityBtn: HTMLButtonElement;
  where: HTMLElement;
  joyZone: HTMLElement;
  joyBase: HTMLElement;
  joyKnob: HTMLElement;
  jump: HTMLButtonElement;
  petBar: HTMLElement;
  miniMap: HTMLCanvasElement;
  speedo: HTMLElement;
  speedVal: HTMLElement;
  private petBtns: Record<'hold' | 'ride' | 'fly' | 'feed' | 'play' | 'drive' | 'pram' | 'activity', HTMLButtonElement>;

  constructor(host: HTMLElement, a: HudActions) {
    this.bucks = el('span', { class: 'bucks-n' }, '0');
    this.energyFill = el('div', { class: 'energy-fill' });
    this.energyBar = el('div', { class: 'energy', title: 'Energi' }, el('span', {}, '⚡'), this.energyFill);
    this.soundBtn = button('🔊', a.sound, 'btn round small');
    this.qualityBtn = button('HQ', () => a.quality?.(), 'btn round small quality-btn');
    this.where = el('div', { class: 'where' }, 'Byen');
    this.miniMap = document.createElement('canvas');
    this.miniMap.width = 176;
    this.miniMap.height = 176;
    this.miniMap.className = 'minimap-hud';
    const top = el(
      'div',
      { class: 'hud-top' },
      el('div', { class: 'bucks' }, el('span', { class: 'coin' }, 'B'), this.bucks),
      this.energyBar,
      this.where,
      el('div', { class: 'hud-top-right' }, this.qualityBtn, this.soundBtn, this.miniMap),
    );
    this.tasks = this.tasksPanel.root;
    this.prompt = button('', a.interact, 'btn prompt hidden');
    this.buildBtn = button(el('span', {}, '▣', el('b', {}, 'Bygg')), a.build, 'btn dock-btn build hidden');
    const dock = el(
      'div',
      { class: 'dock' },
      button(el('span', {}, '☰', el('b', {}, 'Sekk')), a.bag, 'btn dock-btn bag'),
      button(el('span', {}, '◎', el('b', {}, 'Dyr')), a.pets, 'btn dock-btn pets'),
      button(el('span', {}, '◌', el('b', {}, 'Avatar')), a.avatar, 'btn dock-btn avatar'),
      button(el('span', {}, '◈', el('b', {}, 'Kart')), a.map, 'btn dock-btn map'),
      this.buildBtn,
      button(el('span', {}, '⇄', el('b', {}, 'Sammen')), a.mp, 'btn dock-btn mp'),
      button(el('span', {}, '☺', el('b', {}, 'Hei')), a.emote, 'btn dock-btn emote'),
    );
    this.joyKnob = el('div', { class: 'joy-knob' });
    this.joyBase = el('div', { class: 'joy-base' }, this.joyKnob);
    this.joyZone = el('div', { class: 'joy-zone' }, this.joyBase);
    this.jump = el('button', { class: 'btn jump', type: 'button' }, '↑');
    this.petBtns = {
      hold: button('Hold', a.hold, 'btn pet-act'),
      ride: button('Ri', a.ride, 'btn pet-act'),
      fly: button('Fly', a.fly, 'btn pet-act'),
      feed: button('Mat', a.feed, 'btn pet-act'),
      play: button('Lek', a.play, 'btn pet-act'),
      drive: button('Kjør', a.drive, 'btn pet-act'),
      pram: button('Vogn', a.pram, 'btn pet-act'),
      activity: button('Fest', a.activity, 'btn pet-act'),
    };
    this.petBar = el('div', { class: 'pet-bar' }, this.petBtns.feed, this.petBtns.play, this.petBtns.hold, this.petBtns.ride, this.petBtns.fly, this.petBtns.drive, this.petBtns.pram, this.petBtns.activity);
    this.speedVal = el('div', { class: 'spd' }, '0');
    this.speedo = el('div', { class: 'speedo hidden' }, el('div', { class: 'ring' }), this.speedVal, el('div', { class: 'unit' }, 'KM/T'));
    this.root = el('div', { class: 'hud' }, top, this.tasks, this.prompt, dock, this.petBar, this.joyZone, this.jump, this.speedo);
    host.append(this.root);
  }

  setBucks(n: number) {
    put(this.bucks, bucksText(n));
  }
  setEnergy(n: number) {
    const pct = Math.round(Math.max(0, Math.min(1, n)) * 100);
    this.energyFill.style.width = `${pct}%`;
  }
  bumpBucks() {
    this.bucks.parentElement!.classList.remove('bump');
    void this.bucks.offsetWidth;
    this.bucks.parentElement!.classList.add('bump');
  }

  setTasks(pets: PetState[], onTap: (uid: string) => void) {
    this.tasksPanel.update(pets, onTap);
  }

  setPrompt(label: string | null) {
    if (!label) {
      this.prompt.classList.add('hidden');
      return;
    }
    if (this.prompt.textContent !== label) this.prompt.textContent = label;
    this.prompt.classList.remove('hidden');
  }

  setPetActions(s: PetActionState) {
    const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches;
    this.petBar.classList.toggle('hidden', !s.any && !s.canDrive && !s.canPram && !s.canActivity && !s.driving && !s.pramming);
    this.petBar.classList.toggle('pet-bar-compact', narrow);
    put(this.petBtns.hold, s.holding ? 'Slipp' : 'Hold');
    this.petBtns.hold.classList.toggle('hidden', s.riding || s.driving || s.pramming || !s.any);
    this.petBtns.ride.classList.toggle('hidden', !s.canRide || s.holding || s.driving || s.pramming || (narrow && !s.riding));
    put(this.petBtns.ride, s.riding ? 'Gå av' : 'Ri');
    this.petBtns.fly.classList.toggle('hidden', !s.canFly || s.holding || s.driving || s.pramming || (narrow && !s.flying));
    put(this.petBtns.fly, s.flying ? 'Land' : 'Fly');
    this.petBtns.feed.classList.toggle('hidden', !s.hungry || s.driving);
    this.petBtns.play.classList.toggle('hidden', !s.canPlay || s.driving || s.pramming);
    this.petBtns.drive.classList.toggle('hidden', !(s.canDrive || s.driving));
    put(this.petBtns.drive, s.driving ? 'Parkér' : 'Kjør');
    this.petBtns.pram.classList.toggle('hidden', (!(s.canPram || s.pramming)) || (narrow && !s.pramming));
    put(this.petBtns.pram, s.pramming ? 'Sett vogn' : 'Vogn');
    this.petBtns.activity.classList.toggle('hidden', !s.canActivity);
    this.speedo.classList.toggle('hidden', !s.driving);
  }

  setSpeed(kmh: number) {
    put(this.speedVal, String(Math.round(Math.max(0, kmh))));
  }

  setQualityLabel(high: boolean) {
    put(this.qualityBtn, high ? 'HQ' : 'LQ');
  }

  setWhere(label: string) {
    put(this.where, label);
  }

  setMode(mode: 'town' | 'house', label: string, canBuild: boolean) {
    put(this.where, label);
    this.buildBtn.classList.toggle('hidden', !(mode === 'house' && canBuild));
  }

  /** Draw a simple circular minimap of roads + player. */
  drawMiniMap(opts: { roads: { x1: number; z1: number; x2: number; z2: number }[]; px: number; pz: number; yaw: number; size: number }) {
    const c = this.miniMap;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const W = c.width;
    const H = c.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(8,14,22,0.92)';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    const scale = (W * 0.42) / Math.max(40, opts.size * 0.35);
    const to = (x: number, z: number) => {
      const dx = x - opts.px;
      const dz = z - opts.pz;
      return [W / 2 + dx * scale, H / 2 + dz * scale] as const;
    };
    ctx.strokeStyle = 'rgba(62,203,255,0.55)';
    ctx.lineWidth = 2;
    for (const r of opts.roads) {
      const [ax, ay] = to(r.x1, r.z1);
      const [bx, by] = to(r.x2, r.z2);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
    // player arrow
    ctx.translate(W / 2, H / 2);
    ctx.rotate(opts.yaw);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(120,200,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }
}
