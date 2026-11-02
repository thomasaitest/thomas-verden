import * as THREE from 'three';
import type { Avatar } from '../logic/avatar.ts';
import { box, cone, cyl, G, part, rbox, sph } from './kit.ts';

export interface AvatarRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  arms: THREE.Object3D[];
  legs: THREE.Object3D[];
  extra: THREE.Object3D[];
}

const texCache = new Map<string, THREE.CanvasTexture>();
function canvasTex(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

function faceTexture(face: Avatar['face']): THREE.CanvasTexture {
  return canvasTex(`face-${face}`, 256, 256, (ctx) => {
    // Soft skin underpaint so decals don't look cut-out on Quaternius heads
    const skinG = ctx.createRadialGradient(128, 140, 20, 128, 140, 140);
    skinG.addColorStop(0, 'rgba(255,220,190,0.0)');
    skinG.addColorStop(1, 'rgba(240,180,150,0.08)');
    ctx.fillStyle = skinG;
    ctx.fillRect(0, 0, 256, 256);
    const ink = '#2a2438';
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    ctx.lineCap = 'round';
    ctx.lineWidth = 10;
    const eye = (x: number, y: number) => {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.ellipse(x, y, 16, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + 5, y - 8, 6, 0, Math.PI * 2);
      ctx.fill();
    };
    const blush = () => {
      ctx.fillStyle = 'rgba(255,120,150,0.5)';
      for (const x of [62, 194]) {
        ctx.beginPath();
        ctx.ellipse(x, 150, 22, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    const smile = (w = 40, y = 160) => {
      ctx.beginPath();
      ctx.arc(128, y - w * 0.6, w, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
    };
    switch (face) {
      case 'smil':
        eye(90, 112);
        eye(166, 112);
        smile();
        break;
      case 'glad':
        ctx.beginPath();
        ctx.arc(90, 118, 18, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(166, 118, 18, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.arc(128, 150, 34, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = '#ff6f8f';
        ctx.beginPath();
        ctx.arc(128, 168, 16, 0, Math.PI);
        ctx.fill();
        blush();
        break;
      case 'blunk':
        eye(90, 112);
        ctx.beginPath();
        ctx.moveTo(146, 112);
        ctx.lineTo(186, 112);
        ctx.stroke();
        smile();
        break;
      case 'katt':
        eye(90, 112);
        eye(166, 112);
        ctx.beginPath();
        ctx.arc(112, 150, 16, 0, Math.PI);
        ctx.arc(144, 150, 16, 0, Math.PI);
        ctx.stroke();
        blush();
        break;
      case 'rodme':
        eye(90, 115);
        eye(166, 115);
        blush();
        smile(26, 165);
        break;
      case 'kul':
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.roundRect(52, 92, 66, 40, 14);
        ctx.roundRect(138, 92, 66, 40, 14);
        ctx.fill();
        ctx.fillRect(110, 100, 36, 10);
        ctx.beginPath();
        ctx.moveTo(100, 168);
        ctx.quadraticCurveTo(140, 180, 162, 156);
        ctx.stroke();
        break;
      case 'wow':
        eye(90, 108);
        eye(166, 108);
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.ellipse(128, 165, 16, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'tunge':
        ctx.beginPath();
        ctx.moveTo(72, 104);
        ctx.lineTo(104, 116);
        ctx.lineTo(72, 128);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(184, 104);
        ctx.lineTo(152, 116);
        ctx.lineTo(184, 128);
        ctx.stroke();
        smile(36, 158);
        ctx.fillStyle = '#ff6f8f';
        ctx.beginPath();
        ctx.ellipse(140, 168, 14, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'sovnig':
        for (const x of [90, 166]) {
          ctx.beginPath();
          ctx.arc(x, 108, 18, Math.PI * 0.1, Math.PI * 0.9);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.ellipse(128, 168, 14, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '700 40px sans-serif';
        ctx.fillText('z', 200, 70);
        ctx.font = '700 28px sans-serif';
        ctx.fillText('z', 222, 48);
        break;
      case 'stjerneoyne':
        for (const x of [90, 166]) {
          ctx.fillStyle = '#ffd23f';
          ctx.strokeStyle = '#e0a000';
          ctx.lineWidth = 5;
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const r = i % 2 ? 9 : 24;
            const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
            ctx.lineTo(x + Math.cos(a) * r, 112 + Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.strokeStyle = ink;
        ctx.lineWidth = 12;
        smile();
        break;
      case 'hjerteoyne':
        for (const x of [90, 166]) {
          ctx.fillStyle = '#ff3f7a';
          ctx.beginPath();
          ctx.moveTo(x, 134);
          ctx.bezierCurveTo(x - 32, 108, x - 20, 84, x, 100);
          ctx.bezierCurveTo(x + 20, 84, x + 32, 108, x, 134);
          ctx.fill();
        }
        ctx.fillStyle = ink;
        smile();
        blush();
        break;
      case 'fregner':
        eye(90, 112);
        eye(166, 112);
        ctx.fillStyle = '#b5703f';
        for (const [x, y] of [[60, 146], [76, 156], [92, 146], [164, 146], [180, 156], [196, 146]]) {
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = ink;
        smile();
        break;
      case 'sur':
        eye(90, 118);
        eye(166, 118);
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(62, 78);
        ctx.lineTo(112, 94);
        ctx.moveTo(194, 78);
        ctx.lineTo(144, 94);
        ctx.stroke();
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.arc(128, 182, 28, Math.PI * 1.2, Math.PI * 1.8);
        ctx.stroke();
        break;
    }
  });
}

function printTexture(print: Avatar['print']): THREE.CanvasTexture | null {
  if (print === 'ingen') return null;
  return canvasTex(`print-${print}`, 128, 128, (ctx) => {
    ctx.fillStyle = '#ffffff';
    if (print === 'striper') {
      ctx.globalAlpha = 0.55;
      for (let y = 8; y < 128; y += 32) ctx.fillRect(0, y, 128, 14);
      return;
    }
    if (print === 'hjerte') {
      ctx.fillStyle = '#ff4f7f';
      ctx.beginPath();
      ctx.moveTo(64, 100);
      ctx.bezierCurveTo(10, 60, 30, 18, 64, 44);
      ctx.bezierCurveTo(98, 18, 118, 60, 64, 100);
      ctx.fill();
      return;
    }
    if (print === 'stjerne') {
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 18 : 42;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(64 + Math.cos(a) * r, 66 + Math.sin(a) * r);
      }
      ctx.fill();
      return;
    }
    if (print === 'regnbue') {
      ctx.lineWidth = 9;
      ['#ff4f4f', '#ffb84d', '#ffe066', '#54c45e', '#3fa4ff', '#b05cff'].forEach((c, i) => {
        ctx.strokeStyle = c;
        ctx.beginPath();
        ctx.arc(64, 100, 52 - i * 8, Math.PI, 0);
        ctx.stroke();
      });
      return;
    }
    if (print === 'blomst') {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.fillStyle = '#ff8fc7';
        ctx.beginPath();
        ctx.ellipse(64 + Math.cos(a) * 24, 64 + Math.sin(a) * 24, 16, 16, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(64, 64, 16, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (print === 'smiley') {
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(64, 64, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b2340';
      ctx.beginPath();
      ctx.arc(48, 52, 6, 0, Math.PI * 2);
      ctx.arc(80, 52, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2b2340';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(64, 68, 22, 0.2, Math.PI - 0.2);
      ctx.stroke();
      return;
    }
    if (print === 'lyn') {
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.moveTo(74, 10);
      ctx.lineTo(34, 70);
      ctx.lineTo(62, 70);
      ctx.lineTo(48, 118);
      ctx.lineTo(96, 52);
      ctx.lineTo(68, 52);
      ctx.closePath();
      ctx.fill();
      return;
    }
    if (print === 'enhjorn') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(64, 78, 30, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff8fb1';
      ctx.beginPath();
      ctx.moveTo(64, 20);
      ctx.lineTo(50, 60);
      ctx.lineTo(78, 60);
      ctx.fill();
      ctx.fillStyle = '#c88bff';
      for (const [a, b] of [[38, 55], [90, 55], [48, 42], [80, 42]]) {
        ctx.beginPath();
        ctx.arc(a, b, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    if (print === 'hjerter') {
      ctx.fillStyle = '#ff4f7f';
      for (const [cx, cy] of [[32, 32], [96, 32], [32, 96], [96, 96], [64, 64]]) {
        ctx.beginPath();
        ctx.moveTo(cx, cy + 10);
        ctx.bezierCurveTo(cx - 14, cy - 2, cx - 12, cy - 14, cx, cy - 6);
        ctx.bezierCurveTo(cx + 12, cy - 14, cx + 14, cy - 2, cx, cy + 10);
        ctx.fill();
      }
      return;
    }
    if (print === 'prikker') {
      ctx.fillStyle = '#5cc3f2';
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        ctx.beginPath();
        ctx.arc(16 + c * 32, 16 + r * 32, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    if (print === 'katt') {
      ctx.fillStyle = '#ffb84d';
      ctx.beginPath();
      ctx.arc(64, 72, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(38, 52);
      ctx.lineTo(48, 18);
      ctx.lineTo(58, 52);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(70, 52);
      ctx.lineTo(80, 18);
      ctx.lineTo(90, 52);
      ctx.fill();
      ctx.fillStyle = '#2b2b38';
      ctx.beginPath();
      ctx.arc(52, 70, 4, 0, Math.PI * 2);
      ctx.arc(76, 70, 4, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(64, 78, 24, 20, 0, 0, Math.PI * 2);
    for (const [x, y] of [[36, 46], [54, 34], [74, 34], [92, 46]]) {
      ctx.moveTo(x + 10, y);
      ctx.ellipse(x, y, 10, 13, 0, 0, Math.PI * 2);
    }
    ctx.fill();
  });
}

function decal(parent: THREE.Object3D, tex: THREE.Texture, pos: [number, number, number], w: number, h: number) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, metalness: 0.05, roughness: 0.65 }));
  m.position.set(...pos);
  parent.add(m);
  return m;
}

function hair(head: THREE.Group, a: Avatar) {
  const c = a.hairColor;
  if (a.hair === 'ingen') return;
  // Volume under-cap so styles read fuller in studio
  rbox(head, c, [0, 0.32, -0.02], [0.88, 0.26, 0.88]);
  rbox(head, c, [0, 0.12, -0.34], [0.86, 0.58, 0.22]);
  sph(head, c, [0, 0.38, -0.05], [0.72, 0.4, 0.72]);
  switch (a.hair) {
    case 'kort':
      rbox(head, c, [0, 0.27, 0.28], [0.8, 0.14, 0.22]);
      break;
    case 'lang':
      rbox(head, c, [0, -0.15, -0.34], [0.82, 0.9, 0.18]);
      for (const s of [-1, 1]) rbox(head, c, [s * 0.38, -0.05, 0.02], [0.1, 0.7, 0.6]);
      rbox(head, c, [0, 0.27, 0.3], [0.8, 0.14, 0.2]);
      break;
    case 'hestehale':
      rbox(head, c, [0, 0.27, 0.3], [0.8, 0.14, 0.2]);
      sph(head, c, [0, 0.15, -0.5], [0.3, 0.3, 0.3]);
      sph(head, c, [0, -0.15, -0.55], [0.24, 0.5, 0.24]);
      sph(head, '#ff6f8f', [0, 0.2, -0.43], [0.16, 0.16, 0.1]);
      break;
    case 'fletter':
      rbox(head, c, [0, 0.27, 0.3], [0.8, 0.14, 0.2]);
      for (const s of [-1, 1]) {
        sph(head, c, [s * 0.45, 0.05, -0.1], [0.26, 0.26, 0.26]);
        sph(head, c, [s * 0.48, -0.25, -0.1], [0.2, 0.42, 0.2]);
      }
      break;
    case 'bob':
      for (const s of [-1, 1]) rbox(head, c, [s * 0.39, -0.02, 0.02], [0.12, 0.55, 0.7]);
      rbox(head, c, [0, 0.25, 0.3], [0.82, 0.2, 0.2]);
      break;
    case 'krus':
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * Math.PI * 2;
        sph(head, c, [Math.cos(ang) * 0.36, 0.32 + Math.sin(i) * 0.05, Math.sin(ang) * 0.36 - 0.05], [0.32, 0.32, 0.32]);
      }
      sph(head, c, [0, 0.45, 0], [0.5, 0.3, 0.5]);
      break;
    case 'afro':
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * Math.PI * 2;
        const z = Math.sin(ang) * 0.42 - 0.08;
        if (z > 0.2) continue; // keep the face free
        sph(head, c, [Math.cos(ang) * 0.42, 0.26 + (i % 3) * 0.06, z], [0.42, 0.42, 0.42]);
      }
      for (let i = 0; i < 6; i++) sph(head, c, [Math.cos(i) * 0.2, 0.55, Math.sin(i) * 0.2 - 0.08], [0.46, 0.4, 0.46]);
      sph(head, c, [0, 0.42, 0.12], [0.6, 0.3, 0.3]);
      break;
    case 'totter':
      rbox(head, c, [0, 0.27, 0.3], [0.8, 0.14, 0.2]);
      for (const s of [-1, 1]) {
        sph(head, c, [s * 0.34, 0.5, -0.05], [0.34, 0.34, 0.34]);
        sph(head, '#ff6f8f', [s * 0.3, 0.38, -0.05], [0.14, 0.1, 0.14]);
      }
      break;
    case 'sidefletter':
      rbox(head, c, [0, 0.27, 0.3], [0.8, 0.14, 0.2]);
      for (let i = 0; i < 5; i++) sph(head, c, [0.43 + i * 0.01, 0.1 - i * 0.2, 0.05], [0.22 - i * 0.015, 0.24, 0.22 - i * 0.015]);
      sph(head, '#ff6f8f', [0.44, -0.92, 0.05], [0.16, 0.16, 0.16]);
      break;
    case 'lugg':
      rbox(head, c, [0, 0.19, 0.33], [0.8, 0.22, 0.1]);
      for (const s of [-1, 1]) rbox(head, c, [s * 0.39, 0.0, 0.1], [0.1, 0.4, 0.5]);
      break;
    case 'topknott':
      rbox(head, c, [0, 0.27, 0.3], [0.8, 0.14, 0.2]);
      sph(head, c, [0, 0.58, -0.05], [0.36, 0.36, 0.36]);
      cyl(head, '#ff6f8f', [0, 0.42, -0.05], [0.3, 0.06, 0.3]);
      break;
    case 'hanekam':
      for (let i = 0; i < 6; i++) rbox(head, c, [0, 0.42 + (i === 0 || i === 5 ? 0 : 0.08), 0.28 - i * 0.12], [0.1, 0.22 + (i % 2) * 0.1, 0.12]);
      break;
    case 'piggete':
      for (let i = 0; i < 6; i++) cone(head, c, [-0.28 + i * 0.11, 0.45, 0.1 - (i % 2) * 0.2], [0.18, 0.34, 0.18], [-0.3, 0, (i - 2.5) * 0.15]);
      break;
  }
}

function hat(head: THREE.Group, a: Avatar) {
  switch (a.hat) {
    case 'caps':
      cyl(head, '#ff6f6f', [0, 0.42, 0], [0.82, 0.22, 0.82]);
      box(head, '#ff6f6f', [0, 0.33, 0.5], [0.6, 0.05, 0.4]);
      break;
    case 'krone':
      cyl(head, '#ffd23f', [0, 0.5, 0], [0.62, 0.18, 0.62], undefined, 0.15);
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        cone(head, '#ffd23f', [Math.cos(ang) * 0.26, 0.68, Math.sin(ang) * 0.26], [0.14, 0.22, 0.14], undefined, 0.15);
      }
      sph(head, '#ff4f7f', [0, 0.52, 0.31], [0.1, 0.1, 0.06]);
      break;
    case 'lue':
      sph(head, '#5cc3f2', [0, 0.38, 0], [0.86, 0.6, 0.86]);
      cyl(head, '#ffffff', [0, 0.28, 0], [0.88, 0.14, 0.88]);
      sph(head, '#ffffff', [0, 0.72, 0], [0.22, 0.22, 0.22]);
      break;
    case 'katteorer':
      for (const s of [-1, 1]) {
        cone(head, a.hairColor, [s * 0.26, 0.55, 0], [0.24, 0.3, 0.12], [0, 0, s * -0.2]);
        cone(head, '#ffb3c7', [s * 0.26, 0.53, 0.04], [0.12, 0.18, 0.05], [0, 0, s * -0.2]);
      }
      break;
    case 'kaninorer':
      for (const s of [-1, 1]) {
        sph(head, '#ffffff', [s * 0.18, 0.75, 0], [0.18, 0.62, 0.1], [0, 0, s * -0.12]);
        sph(head, '#ffb3c7', [s * 0.18, 0.75, 0.04], [0.09, 0.45, 0.05], [0, 0, s * -0.12]);
      }
      break;
    case 'cowboy':
      cyl(head, '#a0632f', [0, 0.38, 0], [1.3, 0.05, 1.3]);
      cyl(head, '#a0632f', [0, 0.55, 0], [0.7, 0.34, 0.7]);
      cyl(head, '#5b3a29', [0, 0.43, 0], [0.72, 0.07, 0.72]);
      break;
    case 'blomster':
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        sph(head, ['#ff8fb1', '#ffe066', '#c88bff', '#ffffff'][i % 4], [Math.cos(ang) * 0.42, 0.38, Math.sin(ang) * 0.42], [0.16, 0.16, 0.16]);
      }
      break;
    case 'pirat':
      rbox(head, '#2b2340', [0, 0.45, 0], [0.98, 0.2, 0.62]);
      rbox(head, '#2b2340', [0, 0.58, 0], [0.7, 0.2, 0.5]);
      sph(head, '#ffffff', [0, 0.55, 0.3], [0.16, 0.16, 0.06]);
      box(head, '#ffffff', [0, 0.55, 0.3], [0.2, 0.04, 0.07], [0, 0, 0.7]);
      box(head, '#ffffff', [0, 0.55, 0.3], [0.2, 0.04, 0.07], [0, 0, -0.7]);
      break;
    case 'prinsesse':
      cone(head, '#ff9ccf', [0, 0.85, -0.05], [0.5, 0.95, 0.5], [-0.15, 0, 0]);
      sph(head, '#ffe066', [0, 1.33, -0.12], [0.14, 0.14, 0.14], undefined, 0.3);
      cyl(head, '#ffe066', [0, 0.4, -0.02], [0.52, 0.06, 0.52], undefined, 0.2);
      box(head, '#ffd6ec', [0, 0.35, -0.5], [0.4, 0.8, 0.04], [0.15, 0, 0]).userData.noCast = true;
      break;
    case 'festhatt':
      cone(head, '#ffe066', [0, 0.7, 0], [0.5, 0.75, 0.5]);
      for (let i = 0; i < 4; i++) sph(head, ['#ff6f6f', '#5cc3f2', '#7ccf6a', '#c88bff'][i], [Math.cos(i * 1.6) * 0.15, 0.5 + i * 0.1, Math.sin(i * 1.6) * 0.15], [0.1, 0.1, 0.1]);
      sph(head, '#ff4f7f', [0, 1.1, 0], [0.18, 0.18, 0.18]);
      break;
    case 'hodeband':
      cyl(head, '#ff4f7f', [0, 0.3, -0.02], [0.8, 0.1, 0.8]);
      sph(head, '#ff4f7f', [0.3, 0.38, 0.3], [0.2, 0.16, 0.1], [0, 0, 0.5]);
      sph(head, '#ff4f7f', [0.42, 0.34, 0.26], [0.2, 0.16, 0.1], [0, 0, -0.5]);
      break;
    case 'hjelm':
      sph(head, '#3fa4ff', [0, 0.25, 0], [0.94, 0.78, 0.94]);
      box(head, '#ffffff', [0, 0.45, 0], [0.16, 0.1, 0.9]);
      box(head, '#3fa4ff', [0, 0.18, 0.46], [0.6, 0.05, 0.3]);
      break;
    case 'kokkelue':
      cyl(head, '#ffffff', [0, 0.45, 0], [0.74, 0.2, 0.74]);
      sph(head, '#ffffff', [0, 0.78, 0], [0.98, 0.62, 0.98]);
      break;
    case 'trollmann':
      cyl(head, '#6a4cff', [0, 0.38, 0], [1.1, 0.05, 1.1]);
      cone(head, '#6a4cff', [0, 0.8, 0], [0.7, 0.85, 0.7], [0.12, 0, 0]);
      part(head, G.star(), '#ffe066', [0.12, 0.75, 0.3], [0.18, 0.18, 0.18], [0, 0, 0], 0.3);
      break;
    case 'nisse':
      cone(head, '#ff4f7f', [0, 0.85, 0], [0.55, 0.95, 0.55], [0.2, 0, 0]);
      sph(head, '#ffffff', [0, 1.3, -0.15], [0.2, 0.2, 0.2]);
      cyl(head, '#ffffff', [0, 0.38, 0], [0.78, 0.14, 0.78]);
      break;
    case 'beret':
      cyl(head, '#3f6fd8', [0.08, 0.42, 0], [0.9, 0.18, 0.9]);
      sph(head, '#3f6fd8', [0.08, 0.5, 0], [0.95, 0.4, 0.95]);
      break;
    case 'enhjorn':
      cone(head, '#ffe066', [0, 0.85, 0.1], [0.18, 0.55, 0.18], [-0.25, 0, 0], 0.2);
      for (const s of [-1, 1]) {
        sph(head, '#ff8fb1', [s * 0.28, 0.55, -0.05], [0.22, 0.28, 0.12]);
        sph(head, '#ffffff', [s * 0.28, 0.55, 0.02], [0.1, 0.16, 0.05]);
      }
      break;
    case 'bandeau':
      cyl(head, '#ff8fb1', [0, 0.28, 0], [0.82, 0.12, 0.82]);
      part(head, G.heart(), '#ff4f7f', [0, 0.32, 0.4], [0.2, 0.2, 0.08], [-Math.PI / 2, 0, 0]);
      break;
    case 'frosk':
      sph(head, '#7ccf6a', [0, 0.35, 0], [0.95, 0.7, 0.95]);
      for (const s of [-1, 1]) {
        sph(head, '#7ccf6a', [s * 0.28, 0.55, 0.15], [0.28, 0.28, 0.28]);
        sph(head, '#ffffff', [s * 0.28, 0.55, 0.22], [0.16, 0.16, 0.1]);
        sph(head, '#2b2b38', [s * 0.28, 0.55, 0.28], [0.08, 0.08, 0.05]);
      }
      break;
  }
}

function accessory(body: THREE.Group, head: THREE.Group, a: Avatar) {
  switch (a.accessory) {
    case 'briller':
      for (const s of [-1, 1]) part(head, G.torus(), '#2b2340', [s * 0.15, 0.06, 0.37], [0.22, 0.22, 0.22]);
      box(head, '#2b2340', [0, 0.06, 0.37], [0.1, 0.03, 0.03]);
      break;
    case 'vinger':
      for (const s of [-1, 1]) {
        sph(body, '#e9d2ff', [s * 0.35, 1.55, -0.35], [0.55, 0.7, 0.06], [0.2, s * 0.4, s * 0.5], 0.1);
        sph(body, '#ffd2ec', [s * 0.3, 1.15, -0.33], [0.35, 0.45, 0.05], [0.2, s * 0.4, s * -0.4], 0.1);
      }
      break;
    case 'solbriller':
      for (const s of [-1, 1]) box(head, '#1b1630', [s * 0.17, 0.06, 0.375], [0.28, 0.18, 0.03]);
      box(head, '#1b1630', [0, 0.1, 0.375], [0.1, 0.03, 0.03]);
      box(head, '#1b1630', [0, 0.1, 0.0], [0.8, 0.03, 0.03]);
      break;
    case 'hodetelefoner':
      part(head, G.torus(), '#3a3a52', [0, 0.1, 0], [0.86, 0.86, 0.3], [0, 0, 0]);
      for (const s of [-1, 1]) cyl(head, '#ff4f7f', [s * 0.43, -0.02, 0], [0.28, 0.14, 0.28], [0, 0, Math.PI / 2]);
      break;
    case 'halskjede':
      for (let i = 0; i < 9; i++) {
        const t = (i / 8) * Math.PI;
        sph(body, i === 4 ? '#ff4f7f' : '#ffe066', [Math.cos(t) * 0.34, 1.78 - Math.sin(t) * 0.32, 0.27], [0.1, 0.1, 0.1], undefined, 0.2);
      }
      break;
    case 'sommerfugl':
      for (const s of [-1, 1]) {
        sph(body, '#ff8fc7', [s * 0.55, 1.65, -0.35], [0.75, 0.62, 0.05], [0.1, s * 0.5, s * 0.4], 0.12);
        sph(body, '#7ce0ff', [s * 0.45, 1.15, -0.34], [0.5, 0.45, 0.05], [0.1, s * 0.5, s * -0.3], 0.12);
        sph(body, '#ffffff', [s * 0.6, 1.68, -0.33], [0.16, 0.14, 0.03], undefined, 0.2);
      }
      break;
    case 'sekk':
      rbox(body, '#ff8fb1', [0, 1.35, -0.38], [0.7, 0.75, 0.3]);
      rbox(body, '#ffb3c7', [0, 1.2, -0.55], [0.5, 0.3, 0.1]);
      break;
    case 'skjerf':
      cyl(body, '#ff6f6f', [0, 1.83, 0], [0.8, 0.16, 0.6]);
      box(body, '#ff6f6f', [0.25, 1.55, 0.28], [0.18, 0.5, 0.06]);
      break;
    case 'kappe':
      box(body, '#c0304f', [0, 1.1, -0.3], [1.0, 1.4, 0.05], [0.1, 0, 0]);
      break;
    case 'glorie':
      part(head, G.torus(), '#ffe066', [0, 0.7, 0], [0.55, 0.55, 0.55], [Math.PI / 2, 0, 0], 0.6);
      break;
    case 'maske':
      rbox(head, '#c88bff', [0, 0.02, 0.38], [0.7, 0.28, 0.08]);
      for (const s of [-1, 1]) box(head, '#2b2b38', [s * 0.16, 0.04, 0.43], [0.18, 0.12, 0.04]);
      break;
    case 'ballong':
      sph(body, '#ff6f6f', [0.7, 2.4, 0], [0.45, 0.55, 0.45]);
      box(body, '#ffffff', [0.55, 1.9, 0], [0.04, 0.9, 0.04]);
      break;
    case 'veske':
      rbox(body, '#ffb84d', [0.55, 1.15, 0.15], [0.35, 0.4, 0.2]);
      box(body, '#d9a066', [0.55, 1.35, 0.15], [0.08, 0.2, 0.08]);
      break;
    case 'veske-hjerte':
      rbox(body, '#ff6f6f', [0.55, 1.15, 0.15], [0.38, 0.36, 0.22]);
      part(body, G.heart(), '#ff4f7f', [0.55, 1.15, 0.28], [0.22, 0.22, 0.06], [-Math.PI / 2, 0, 0]);
      box(body, '#ff8fb1', [0.55, 1.38, 0.15], [0.08, 0.22, 0.08]);
      break;
    case 'veske-gul':
      rbox(body, '#ffe066', [0.58, 1.12, 0.12], [0.4, 0.42, 0.24]);
      box(body, '#ffffff', [0.58, 1.35, 0.12], [0.1, 0.18, 0.1]);
      sph(body, '#ff8fb1', [0.58, 1.0, 0.24], [0.1, 0.1, 0.1]);
      break;
    case 'vinger-engel':
      for (const s of [-1, 1]) {
        sph(body, '#ffffff', [s * 0.4, 1.6, -0.38], [0.7, 0.85, 0.08], [0.15, s * 0.35, s * 0.45], 0.05);
        sph(body, '#fff8e8', [s * 0.55, 1.85, -0.4], [0.45, 0.55, 0.06], [0.1, s * 0.4, s * 0.3], 0.08);
      }
      break;
    case 'vinger-regnbue':
      for (const s of [-1, 1]) {
        const cols = ['#ff6f6f', '#ffe066', '#7ccf6a', '#5cc3f2', '#c88bff'];
        cols.forEach((c, i) => sph(body, c, [s * (0.35 + i * 0.04), 1.7 - i * 0.08, -0.36 - i * 0.01], [0.5 - i * 0.05, 0.65 - i * 0.06, 0.05], [0.15, s * 0.35, s * 0.4], 0.1));
      }
      break;
    case 'sekk-stjerne':
      rbox(body, '#3f6fd8', [0, 1.35, -0.4], [0.75, 0.8, 0.32]);
      part(body, G.star(), '#ffe066', [0, 1.4, -0.58], [0.35, 0.35, 0.08], [0, 0, 0], 0.3);
      box(body, '#5cc3f2', [0, 1.75, -0.4], [0.55, 0.12, 0.28]);
      break;
    case 'sekk-rosa':
      rbox(body, '#ff8fb1', [0, 1.32, -0.42], [0.72, 0.78, 0.34]);
      part(body, G.heart(), '#ff4f7f', [0, 1.35, -0.6], [0.28, 0.28, 0.08], [-Math.PI / 2, 0, 0]);
      for (const s of [-1, 1]) box(body, '#ffb3c7', [s * 0.28, 1.7, -0.2], [0.1, 0.35, 0.08]);
      break;
    case 'perlekjede':
      for (let i = 0; i < 11; i++) {
        const t = (i / 10) * Math.PI;
        sph(body, i % 2 ? '#ffe066' : '#ff8fb1', [Math.cos(t) * 0.36, 1.8 - Math.sin(t) * 0.35, 0.28], [0.09, 0.09, 0.09], undefined, 0.15);
      }
      break;
    case 'oreringer':
      for (const s of [-1, 1]) {
        cyl(head, '#ffe066', [s * 0.38, -0.15, 0.05], [0.06, 0.18, 0.06]);
        sph(head, '#ff4f7f', [s * 0.38, -0.28, 0.05], [0.12, 0.12, 0.12], undefined, 0.2);
      }
      break;
    case 'armband':
      for (const s of [-1, 1]) cyl(body, '#ffe066', [s * 0.72, 1.25, 0], [0.48, 0.1, 0.48]);
      break;
    case 'klokke':
      cyl(body, '#555a75', [0.72, 1.22, 0.05], [0.22, 0.08, 0.22]);
      box(body, '#ffffff', [0.72, 1.22, 0.16], [0.16, 0.16, 0.04]);
      break;
    case 'stjernekappe':
      box(body, '#6a4cff', [0, 1.1, -0.32], [1.1, 1.5, 0.06], [0.12, 0, 0]);
      for (let i = 0; i < 5; i++) part(body, G.star(), '#ffe066', [-0.35 + i * 0.18, 1.5 - (i % 2) * 0.25, -0.36], [0.16, 0.16, 0.06], [0, 0, 0], 0.3);
      break;
    case 'skjerfstripete':
      cyl(body, '#5cc3f2', [0, 1.83, 0], [0.8, 0.16, 0.6]);
      box(body, '#ffe066', [0.25, 1.55, 0.28], [0.18, 0.5, 0.06]);
      box(body, '#ff6f6f', [0.25, 1.45, 0.28], [0.18, 0.12, 0.07]);
      break;
  }
}

export function buildAvatar(a: Avatar): AvatarRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  // Taller, slimmer human proportions
  body.scale.set(0.88, 1.18, 0.88);
  root.add(body);
  const legs = [-1, 1].map((s) => {
    const pivot = new THREE.Object3D();
    pivot.position.set(s * 0.18, 0.95, 0);
    body.add(pivot);
    const skirtLike = a.bottom === 'skjort' || a.bottom === 'miniskjort' || a.bottom === 'langtskort' || a.bottom === 'tutu' || a.bottom === 'plissert' || a.bottom === 'kjole' || a.bottom === 'ballkjole';
    if (a.bottom === 'shorts') {
      cyl(pivot, a.pants, [0, -0.18, 0], [0.28, 0.36, 0.28]);
      cyl(pivot, a.skin, [0, -0.55, 0], [0.22, 0.4, 0.22]);
    } else if (skirtLike) cyl(pivot, a.skin, [0, -0.42, 0], [0.22, 0.84, 0.22]);
    else cyl(pivot, a.pants, [0, -0.42, 0], [0.26, 0.84, 0.26]);
    if (a.shoeStyle === 'stovler') {
      cyl(pivot, a.shoes, [0, -0.78, 0.02], [0.28, 0.28, 0.3]);
      rbox(pivot, a.shoes, [0, -0.92, 0.08], [0.32, 0.1, 0.42]);
    } else if (a.shoeStyle === 'sneakers') {
      rbox(pivot, a.shoes, [0, -0.88, 0.06], [0.3, 0.14, 0.42]);
      box(pivot, '#ffffff', [0, -0.95, 0.06], [0.32, 0.04, 0.44]);
      box(pivot, '#3ecbff', [0, -0.88, 0.22], [0.22, 0.04, 0.06], undefined, 0.4);
    } else rbox(pivot, a.shoes, [0, -0.9, 0.05], [0.28, 0.12, 0.4]);
    return pivot;
  });
  if (a.bottom === 'skjort') { cyl(body, a.pants, [0, 0.78, 0], [1.15, 0.5, 0.78]); cyl(body, a.pants, [0, 0.55, 0], [1.25, 0.08, 0.9], undefined, 0.45); }
  if (a.bottom === 'miniskjort') { cyl(body, a.pants, [0, 0.88, 0], [1.05, 0.32, 0.72]); cyl(body, a.pants, [0, 0.72, 0], [1.15, 0.06, 0.82], undefined, 0.5); }
  if (a.bottom === 'langtskort') {
    cyl(body, a.pants, [0, 0.55, 0], [1.25, 1.0, 0.9]);
    cyl(body, a.pants, [0, 0.95, 0], [1.05, 0.3, 0.7]);
  }
  if (a.bottom === 'tutu') {
    for (let i = 0; i < 6; i++) {
      const a0 = (i / 6) * Math.PI * 2;
      sph(body, a.pants, [Math.cos(a0) * 0.35, 0.85, Math.sin(a0) * 0.25], [0.55, 0.35, 0.45]);
    }
    cyl(body, '#ffffff', [0, 0.95, 0], [0.9, 0.12, 0.6]);
  }
  if (a.bottom === 'plissert') {
    cyl(body, a.pants, [0, 0.78, 0], [1.05, 0.55, 0.72], undefined, 0.55);
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2;
      box(body, a.pants, [Math.cos(a0) * 0.5, 0.75, Math.sin(a0) * 0.35], [0.08, 0.5, 0.2]);
    }
  }
  if (a.bottom === 'kjole') {
    cyl(body, a.pants, [0, 0.7, 0], [1.4, 0.85, 1.0]);
    cyl(body, a.shirt, [0, 1.15, 0], [1.05, 0.35, 0.7]);
  }
  if (a.bottom === 'ballkjole') {
    cyl(body, a.pants, [0, 0.55, 0], [1.7, 1.1, 1.3]);
    cyl(body, a.shirt, [0, 1.2, 0], [1.0, 0.4, 0.65]);
    for (let i = 0; i < 5; i++) part(body, G.star(), '#ffe066', [-0.5 + i * 0.25, 0.9, 0.55], [0.14, 0.14, 0.05], [0, 0, 0], 0.25);
  }
  if (a.bottom === 'overall') {
    box(body, a.pants, [0, 1.35, 0], [0.98, 0.55, 0.5]);
    for (const s of [-1, 1]) box(body, a.pants, [s * 0.28, 1.65, 0], [0.14, 0.35, 0.1]);
  }
  if (a.bottom === 'jeans') {
    box(body, a.pants, [0, 0.98, 0], [0.96, 0.18, 0.5]);
    box(body, '#ffe066', [0.15, 1.0, 0.26], [0.12, 0.08, 0.04]);
  }
  if (a.bottom === 'joggebukse') {
    box(body, a.pants, [0, 0.98, 0], [0.96, 0.18, 0.5]);
    for (const s of [-1, 1]) box(body, '#ffffff', [s * 0.24, 0.55, 0.22], [0.12, 0.5, 0.04]);
  }
  box(body, a.pants, [0, 1.02, 0], [0.72, 0.14, 0.38]);
  rbox(body, a.shirt, [0, 1.48, 0], [0.72, 0.85, 0.38]);
  const pt = printTexture(a.print);
  if (pt) decal(body, pt, [0, 1.48, 0.2], a.print === 'striper' ? 0.7 : 0.42, a.print === 'striper' ? 0.7 : 0.42);
  const arms = [-1, 1].map((s) => {
    const pivot = new THREE.Object3D();
    pivot.position.set(s * 0.48, 1.85, 0);
    body.add(pivot);
    cyl(pivot, a.shirt, [0, -0.18, 0], [0.2, 0.36, 0.2]);
    cyl(pivot, a.skin, [0, -0.58, 0], [0.16, 0.48, 0.16]);
    // hand
    sph(pivot, a.skin, [0, -0.86, 0], [0.14, 0.12, 0.14]);
    return pivot;
  });
  const head = new THREE.Group();
  head.position.set(0, 2.15, 0);
  body.add(head);
  // Smaller, rounder head (human ratio)
  part(head, G.sph(), a.skin, [0, 0.05, 0], [0.52, 0.58, 0.5]);
  cyl(body, a.skin, [0, 1.92, 0], [0.16, 0.14, 0.16]);
  decal(head, faceTexture(a.face), [0, 0.02, 0.26], 0.48, 0.48);
  hair(head, a);
  hat(head, a);
  accessory(body, head, a);
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return { root, body, head, arms, legs, extra: [] };
}

export type AvatarPose = 'idle' | 'walk' | 'jump' | 'sit' | 'sleep' | 'hold' | 'wave' | 'fly' | 'swing' | 'slide' | 'seesaw' | 'spin' | 'dance' | 'drive';

export function animateAvatar(rig: AvatarRig, t: number, pose: AvatarPose, speed = 0, holding = false): void {
  if ((rig as { gltf?: boolean }).gltf || !rig.legs?.length || !rig.arms?.length) return;
  const s = pose === 'walk' ? Math.sin(t * 11) * 0.8 * Math.min(1, speed) : 0;
  const [l, r] = rig.legs;
  const [la, ra] = rig.arms;
  rig.body.rotation.set(0, 0, 0);
  rig.body.position.set(0, pose === 'walk' ? Math.abs(Math.sin(t * 11)) * 0.06 : pose === 'idle' ? Math.sin(t * 2) * 0.012 : 0, 0);
  rig.head.rotation.set(pose === 'idle' ? Math.sin(t * 0.8) * 0.04 : 0, pose === 'idle' ? Math.sin(t * 0.5) * 0.2 : 0, 0);
  l.rotation.set(s, 0, 0);
  r.rotation.set(-s, 0, 0);
  la.rotation.set(-s, 0, 0);
  ra.rotation.set(s, 0, 0);
  if (pose === 'jump') {
    l.rotation.x = 0.4;
    r.rotation.x = -0.3;
    la.rotation.set(0, 0, -2.6);
    ra.rotation.set(0, 0, 2.6);
  } else if (pose === 'sit' || pose === 'fly') {
    // Bench sit: thighs nearly horizontal, lower legs hang down (single-bone approx).
    // Fly keeps the old tucked pose.
    if (pose === 'fly') {
      l.rotation.set(-1.5, 0, 0.35);
      r.rotation.set(-1.5, 0, -0.35);
      la.rotation.set(-0.9, 0, -0.6);
      ra.rotation.set(-0.9, 0, 0.6);
      rig.body.position.set(0, 0, 0);
    } else {
      // Thighs nearly horizontal; lower legs hang over the seat front.
      // Hip pivot body-local y=0.9; seat ~0.78 → drop body so butt meets seat.
      l.rotation.set(-1.48, 0.04, 0.02);
      r.rotation.set(-1.48, -0.04, -0.02);
      la.rotation.set(-0.25, 0, -0.1);
      ra.rotation.set(-0.25, 0, 0.1);
      rig.body.rotation.x = -0.05;
      // Drop onto seat (with resting holder y≈0.18); lean slightly into backrest
      rig.body.position.set(0, -0.22, -0.08);
    }
  } else if (pose === 'wave') {
    ra.rotation.set(0, 0, 2.6 + Math.sin(t * 10) * 0.35);
  } else if (pose === 'swing') {
    // holding the ropes, legs pumping
    const k = Math.sin(t * 4.2);
    l.rotation.set(-1.0 - k * 0.5, 0, 0.1);
    r.rotation.set(-1.0 - k * 0.5, 0, -0.1);
    la.rotation.set(-1.6, 0, -0.15);
    ra.rotation.set(-1.6, 0, 0.15);
    rig.body.position.y = 0;
  } else if (pose === 'slide') {
    // legs straight out, arms up in the air
    l.rotation.set(-1.45, 0, 0.1);
    r.rotation.set(-1.45, 0, -0.1);
    la.rotation.set(0, 0, -2.5 - Math.sin(t * 9) * 0.15);
    ra.rotation.set(0, 0, 2.5 + Math.sin(t * 9) * 0.15);
    rig.body.position.y = 0;
  } else if (pose === 'seesaw') {
    // holding the handle, feet pushing off
    const k = Math.sin(t * 3.4);
    l.rotation.set(-1.1 - k * 0.3, 0, 0.2);
    r.rotation.set(-1.1 + k * 0.3, 0, -0.2);
    la.rotation.set(-1.4, 0, -0.1);
    ra.rotation.set(-1.4, 0, 0.1);
    rig.body.position.y = 0;
  } else if (pose === 'spin') {
    // one arm out, whee
    l.rotation.set(-1.5, 0, 0.35);
    r.rotation.set(-1.5, 0, -0.35);
    la.rotation.set(0, 0, -1.4);
    ra.rotation.set(-1.3, 0, 0.2);
    rig.body.position.y = 0;
  } else if (pose === 'dance') {
    const k = Math.sin(t * 8);
    l.rotation.set(-0.2 + k * 0.6, 0, 0.15);
    r.rotation.set(-0.2 - k * 0.6, 0, -0.15);
    la.rotation.set(0, 0, -2.2 - k * 0.4);
    ra.rotation.set(0, 0, 2.2 + k * 0.4);
    rig.body.position.y = Math.abs(k) * 0.12;
    rig.body.rotation.y = k * 0.15;
  } else if (pose === 'sleep') {
    // Lie on the back: flat on the mattress, soft breathing.
    l.rotation.set(-0.15, 0, 0.12);
    r.rotation.set(-0.15, 0, -0.12);
    la.rotation.set(-0.25, 0, -0.55);
    ra.rotation.set(-0.25, 0, 0.55);
    rig.body.rotation.x = -Math.PI / 2;
    rig.body.position.set(0, 0.4 + Math.sin(t * 1.6) * 0.02, 0.15);
    rig.head.rotation.set(0.15, Math.sin(t * 0.7) * 0.05, 0);
  } else if (pose === 'drive') {
    // Crouched in seat – hips drop so head clears canopy
    l.rotation.set(-1.45, 0, 0.28);
    r.rotation.set(-1.45, 0, -0.28);
    la.rotation.set(-1.05, 0, 0.15);
    ra.rotation.set(-1.05, 0, -0.15);
    rig.body.position.set(0, -0.55, 0.12);
    rig.body.rotation.x = 0.12;
    rig.head.rotation.set(-0.05, 0, 0);
  }
  if (holding) {
    la.rotation.set(-1.3, 0, 0.25);
    ra.rotation.set(-1.3, 0, -0.25);
  }
}

