import { sfx } from '../audio.ts';
import { ACCESSORIES, BOTTOMS, CLOTH_COLORS, FACES, HAIR_COLORS, HAIR_STYLES, HATS, OUTFIT_PRESETS, avatarEditResult, randomAvatar, SHOES, SKIN, type Avatar } from '../logic/avatar.ts';
import { CARS, FLOOR_COLORS, FOODS, FOOD_BY_ID, FURN_BY_ID, FURN_CATS, FURNITURE, HOUSES, PALETTE, PET_SHOP, POTIONS, TOYS, WALL_COLORS, type FurnCat } from '../logic/catalog.ts';
import { POINTS, ITEM_INFO, newGame, openDoor, useMagnifier, type DoorGame } from '../logic/doors.ts';
import { activeHouse, addBucks, buyAndHatch, buyCar, buyFood, buyFurniture, buyHouse, buyPetShopItem, buyToy, editHouse, placeFromInventory, renamePet, storeItem, toggleEquip, usePotion } from '../logic/economy.ts';
import { rotateItem, updateItem } from '../logic/house.ts';
import { joyNow, NEED_INFO, stageOf, stageProgress, STAGES, type PetState } from '../logic/needs.ts';
import { EGGS, RARITY_INFO, SPECIES_BY_ID, type EggType } from '../logic/pets.ts';
import type { Game } from '../game.ts';
import { buildAvatar } from '../three/avatarModel.ts';
import { buildAvatarPreviewRoot } from '../three/avatarGltf.ts';
import { buildFurniture } from '../three/furniture.ts';
import { buildPet } from '../three/petModel.ts';
import { buildToy } from '../three/toys.ts';
import { bucksText, button, el, sheet, toast, type Sheet } from './dom.ts';

const price = (n: number) => el('span', { class: 'price' }, el('span', { class: 'coin sm' }, 'B'), n === 0 ? 'Gratis' : bucksText(n));

export function petThumb(game: Game, speciesId: string): string {
  return game.thumbs.get(`pet-${speciesId}`, () => buildPet(SPECIES_BY_ID[speciesId]).root, { yaw: 0.5, pitch: 0.25 });
}
export function furnThumb(game: Game, id: string): string {
  const f = FURN_BY_ID[id];
  return game.thumbs.get(`f-${id}`, () => buildFurniture(f.model, f.color), { yaw: -0.5, pitch: f.wall ? 0.1 : 0.5 });
}

export function toyThumb(game: Game, id: string): string {
  return game.thumbs.get(`toy-${id}`, () => buildToy(id), { yaw: -0.5, pitch: 0.5 });
}

function failText(reason: string): string {
  return reason === 'too-expensive' ? 'Du har ikke nok bucks ennå. Stell dyrene for å tjene mer!' : reason === 'owned' ? 'Det har du allerede' : 'Det gikk ikke';
}

// ---------- Butikk (food) ----------
export function openShop(game: Game) {
  const s = sheet('Butikk 🛒', '#ff6f6f');
  const render = () => {
    s.body.replaceChildren(
      el('p', { class: 'lead' }, 'Mat og drikke til dyrene dine. Gi det til dem når de er sultne eller tørste!'),
      el('h3', {}, 'Trylledrikker'),
      el('p', { class: 'hint' }, 'Trylledrikker kjøpes ikke her. Fly med et flygedyr – noen ganger mister de en drikk! 🪽'),
      el(
        'div',
        { class: 'grid' },
        ...FOODS.map((f) =>
          el(
            'div',
            { class: 'card' },
            el('div', { class: 'big-emoji' }, f.emoji),
            el('b', {}, f.name),
            el('small', {}, f.fixes === 'mat' ? 'Mot sult' : 'Mot tørst'),
            el('small', { class: 'owned' }, `Du har ${game.save.bag[f.id] ?? 0}`),
            button(price(f.price), () => {
              const r = buyFood(game.save, f.id);
              if (!r.ok) {
                toast(failText(r.reason), 'bad');
                sfx.nope();
                return;
              }
              sfx.buy();
              game.commit(r.save);
              render();
            }, 'btn buy'),
          ),
        ),
      ),
      el('h3', {}, 'Leker 🧸'),
      el('p', { class: 'hint' }, 'Dyrene elsker å leke! Lekene ligger i ryggsekken, og du kan bruke dem så mye du vil.'),
      el(
        'div',
        { class: 'grid' },
        ...TOYS.map((t) => {
          const have = !!game.save.bag[t.id];
          return el(
            'div',
            { class: 'card' },
            el('img', { class: 'thumb', src: toyThumb(game, t.id), alt: '' }),
            el('b', {}, t.name),
            el('small', {}, t.text),
            have
              ? el('small', { class: 'owned' }, 'Du har den ✓')
              : button(price(t.price), () => {
                  const r = buyToy(game.save, t.id);
                  if (!r.ok) {
                    toast(failText(r.reason), 'bad');
                    sfx.nope();
                    return;
                  }
                  sfx.buy();
                  game.commit(r.save);
                  render();
                }, 'btn buy'),
          );
        }),
      ),
    );
  };
  render();
}

// ---------- Eggbutikk ----------
function eggArt(e: EggType, cls = '') {
  return el('div', { class: `egg ${cls}`, style: { '--egg': e.color, '--spot': e.spots } }, el('i'), el('i'), el('i'));
}

export function openEggs(game: Game) {
  const s = sheet('Eggbutikk 🥚', '#b05cff');
  const render = () => {
    const eggs = EGGS.filter((e) => e.price > 0 || !game.save.starterClaimed);
    s.body.replaceChildren(
      el('p', { class: 'lead' }, 'Kjøp et egg og se hvilket dyr som klekker! Sjeldne egg gir sjeldnere dyr.'),
      el(
        'div',
        { class: 'grid' },
        ...eggs.map((e) =>
          el(
            'div',
            { class: 'card' },
            eggArt(e),
            el('b', {}, e.name),
            el('div', { class: 'odds' }, ...(['vanlig', 'uvanlig', 'sjelden', 'ultra', 'legendarisk'] as const).filter((r) => e.weights[r] > 0).map((r) => el('span', { class: 'dot', style: { background: RARITY_INFO[r].color }, title: RARITY_INFO[r].label }))),
            button(price(e.price), () => {
              const r = buyAndHatch(game.save, e.id, game.rng);
              if (!r.ok) {
                toast(failText(r.reason), 'bad');
                sfx.nope();
                return;
              }
              s.close();
              game.commit(r.save, { pets: true });
              showHatch(game, r.pet, e);
            }, 'btn buy'),
          ),
        ),
      ),
    );
  };
  render();
}

export function showHatch(game: Game, pet: PetState, egg: EggType) {
  game.paused = true;
  const sp = SPECIES_BY_ID[pet.speciesId];
  const rar = RARITY_INFO[sp.rarity];
  const stage = el('div', { class: 'hatch-stage' }, eggArt(egg, 'wobble'));
  const wrap = el('div', { class: 'hatch' }, el('div', { class: 'rays' }), stage);
  document.getElementById('ui')!.append(wrap);
  sfx.wobble();
  setTimeout(() => sfx.wobble(), 500);
  setTimeout(() => sfx.wobble(), 1000);
  setTimeout(() => {
    sfx.hatch();
    const name = el('input', { class: 'name-input', value: pet.name, maxlength: '16', 'aria-label': 'Navn' }) as HTMLInputElement;
    stage.replaceChildren(
      el('img', { class: 'hatch-pet', src: petThumb(game, sp.id), alt: sp.name }),
      el('div', { class: 'rarity', style: { background: rar.color } }, rar.label),
      el('h2', {}, `Du fikk en ${sp.name}!`),
      el('div', { class: 'badges' }, pet.flyable ? el('span', { class: 'badge fly' }, '🪽 Kan fly') : null, pet.rideable ? el('span', { class: 'badge ride' }, '🐎 Kan ris') : null),
      el('label', { class: 'name-label' }, 'Gi dyret et navn:', name),
      button('Hurra! 🎉', () => {
        game.commit(renamePet(game.save, pet.uid, name.value), { pets: true });
        game.paused = false;
        wrap.remove();
      }, 'btn big green'),
    );
  }, 1700);
}

// ---------- Sekk ----------
export function openBag(game: Game) {
  const s = sheet('Ryggsekk 🎒', '#ffb84d');
  const render = () => {
    const bag = game.save.bag;
    const foods = FOODS.filter((f) => bag[f.id]);
    const furn = Object.entries(game.save.inventory);
    s.body.replaceChildren(
      el('h3', {}, 'Mat og drikke'),
      foods.length
        ? el('div', { class: 'grid small' }, ...foods.map((f) => el('div', { class: 'card mini' }, el('div', { class: 'big-emoji' }, f.emoji), el('b', {}, `${f.name} ×${bag[f.id]}`))))
        : el('p', { class: 'empty' }, 'Tomt! Kjøp mat i Butikken.'),
      el('h3', {}, 'Leker'),
      TOYS.some((t) => bag[t.id])
        ? el(
            'div',
            { class: 'grid small' },
            ...TOYS.filter((t) => bag[t.id]).map((t) =>
              el(
                'div',
                { class: 'card mini' },
                el('img', { class: 'thumb', src: toyThumb(game, t.id), alt: '' }),
                el('b', {}, t.name),
                button('Lek! 🎾', () => {
                  if (game.playWithToy(t.id)) s.close();
                }, 'btn small green'),
              ),
            ),
          )
        : el('p', { class: 'empty' }, 'Ingen leker ennå. Kjøp i Butikken!'),
      el('h3', {}, 'Trylledrikker'),
      POTIONS.some((p) => bag[p.id])
        ? el('div', { class: 'grid small' }, ...POTIONS.filter((p) => bag[p.id]).map((p) => el('div', { class: 'card mini' }, el('div', { class: 'big-emoji' }, p.emoji), el('b', {}, `${p.name} ×${bag[p.id]}`), el('small', {}, 'Brukes fra 🐾 Dyr'))))
        : el('p', { class: 'empty' }, 'Ingen drikker ennå.'),
      el('h3', {}, 'Møbler som ikke er plassert'),
      furn.length
        ? el('div', { class: 'grid small' }, ...furn.map(([id, n]) => el('div', { class: 'card mini' }, el('img', { class: 'thumb', src: furnThumb(game, id), alt: '' }), el('b', {}, `${FURN_BY_ID[id].name} ×${n}`))))
        : el('p', { class: 'empty' }, 'Alle møblene står i huset.'),
      el('p', { class: 'hint' }, 'Gå inn i huset og trykk 🔨 Bygg for å plassere møbler.'),
    );
  };
  render();
}

export function toyMenu(game: Game) {
  const s = sheet('Lek med dyret 🎾', '#5cc3f2', undefined, 'narrow');
  const pet = game.mainPet();
  const owned = TOYS.filter((t) => game.save.bag[t.id]);
  s.body.replaceChildren(
    el('p', { class: 'lead' }, pet ? `Hva skal ${pet.name} leke med?` : 'Hva skal dyret leke med?'),
    owned.length
      ? el(
          'div',
          { class: 'grid small' },
          ...owned.map((t) =>
            button(el('span', { class: 'food-btn' }, el('img', { class: 'thumb', src: toyThumb(game, t.id), alt: '' }), t.name), () => {
              s.close();
              game.playWithToy(t.id);
            }, 'card mini tap'),
          ),
        )
      : el('p', { class: 'empty' }, 'Du har ingen leker. Kjøp i Butikken 🛒'),
  );
}

export function feedMenu(game: Game, uid: string) {
  const pet = game.save.pets.find((p) => p.uid === uid);
  if (!pet) return;
  const s = sheet(`Gi ${pet.name} noe`, '#7ccf6a', undefined, 'narrow');
  const render = () => {
    const p = game.save.pets.find((x) => x.uid === uid)!;
    const want = p.need ? NEED_INFO[p.need.kind].where : null;
    const list = FOODS.filter((f) => game.save.bag[f.id] && (want === null || f.fixes === want));
    if (want !== 'mat' && want !== 'drikke') {
      s.body.replaceChildren(el('p', { class: 'lead' }, `${p.name} er ikke sulten eller tørst nå.`));
      return;
    }
    s.body.replaceChildren(
      el('p', { class: 'lead' }, want === 'mat' ? `${p.name} er sulten 🍎` : `${p.name} er tørst 🥤`),
      list.length
        ? el(
            'div',
            { class: 'grid small' },
            ...list.map((f) =>
              button(el('span', { class: 'food-btn' }, el('span', { class: 'big-emoji' }, f.emoji), `${f.name} ×${game.save.bag[f.id]}`), () => {
                if (game.feedPet(uid, f.id)) s.close();
              }, 'card mini tap'),
            ),
          )
        : el('div', {}, el('p', { class: 'empty' }, want === 'mat' ? 'Du har ikke mat.' : 'Du har ikke drikke.'), el('p', { class: 'hint' }, 'Gå inn i Butikken i byen og handle 🛒 (se Kart)'), button('Åpne kartet 🗺️', () => {
            s.close();
            game.panels.openMap();
          }, 'btn big')),
    );
  };
  render();
}

// ---------- Dyr ----------
export function openPets(game: Game) {
  const s = sheet('Mine dyr 🐾', '#ff8fb1');
  const unsub = game.subscribe(() => render());
  const origClose = s.close;
  s.close = () => {
    unsub();
    origClose();
  };
  const render = () => {
    const pets = game.save.pets;
    if (!pets.length) {
      s.body.replaceChildren(el('p', { class: 'lead' }, 'Du har ingen dyr ennå. Gå til Eggbutikken i byen!'), button('Vis på kartet 🗺️', () => {
        s.close();
        game.panels.openMap();
      }, 'btn big'));
      return;
    }
    s.body.replaceChildren(
      el('p', { class: 'lead' }, 'Bare ett dyr kan følge deg om gangen. Trykk «Følg meg» på et annet dyr, så går det forrige hjem og hviler.'),
      el(
        'div',
        { class: 'pet-list' },
        ...pets.map((p) => {
          const sp = SPECIES_BY_ID[p.speciesId];
          const rar = RARITY_INFO[sp.rarity];
          const eq = game.save.equipped.includes(p.uid);
          const st = stageOf(p.xp);
          return el(
            'div',
            { class: `pet-card ${eq ? 'eq' : ''}` },
            el('img', { class: 'thumb big', src: petThumb(game, sp.id), alt: '' }),
            el(
              'div',
              { class: 'pet-info' },
              el('b', {}, p.name),
              el('div', { class: 'row-l' }, el('span', { class: 'rarity sm', style: { background: rar.color } }, rar.label), el('span', { class: 'sp' }, sp.name)),
              el('div', { class: 'age' }, `${st.name}`, el('span', { class: 'bar' }, el('i', { style: { width: `${Math.round(stageProgress(p.xp) * 100)}%` } })), STAGES[STAGES.length - 1].name === st.name ? '⭐' : ''),
              el('div', { class: 'age joy' }, '💖 Glede', el('span', { class: 'bar' }, el('i', { style: { width: `${Math.round(joyNow(p, Date.now()) * 100)}%`, background: 'linear-gradient(90deg,#ffb3d1,#ff5fa2)' } }))),
              el('div', { class: 'badges' }, p.flyable ? el('span', { class: 'badge fly' }, '🪽 Fly') : null, p.rideable ? el('span', { class: 'badge ride' }, '🐎 Ri') : null, p.need && eq ? el('span', { class: 'badge need' }, `${NEED_INFO[p.need.kind].emoji} ${NEED_INFO[p.need.kind].label}`) : null),
            ),
            el(
              'div',
              { class: 'pet-btns' },
              button(eq ? 'Hvil' : 'Følg meg', () => {
                game.commit(toggleEquip(game.save, p.uid).save, { pets: true });
              }, `btn small ${eq ? 'grey' : 'green'}`),
              button('✏️', () => {
                const n = prompt('Nytt navn', p.name);
                if (n !== null) game.commit(renamePet(game.save, p.uid, n), { pets: true });
              }, 'btn small round'),
              !p.flyable && game.save.bag.flygedrikk
                ? button('🪽', () => {
                    game.commit(usePotion(game.save, 'flygedrikk', p.uid).save, { pets: true });
                    sfx.hatch();
                    toast(`${p.name} kan fly nå!`, 'gold');
                  }, 'btn small round purple')
                : null,
              !p.rideable && game.save.bag.ridedrikk
                ? button('🐎', () => {
                    game.commit(usePotion(game.save, 'ridedrikk', p.uid).save, { pets: true });
                    sfx.hatch();
                    toast(`${p.name} kan ris nå!`, 'gold');
                  }, 'btn small round purple')
                : null,
            ),
          );
        }),
      ),
    );
  };
  render();
}

// ---------- Kart ----------
export function openMap(game: Game) {
  const s = sheet('Kart 🗺️', '#3fa4ff');
  const pins: Record<string, { e: string; n: string }> = {
    home: { e: '🏠', n: 'Hjem' },
    shop: { e: '🛒', n: 'Butikk' },
    vet: { e: '🩺', n: 'Dyrlege' },
    play: { e: '⚽', n: 'Lekeplass' },
    eggs: { e: '🥚', n: 'Eggbutikk' },
    doors: { e: '🚪', n: 'Dørspillet' },
    cars: { e: '🚗', n: 'Bilbutikk' },
    pets: { e: '🐾', n: 'Dyrebutikk' },
  };
  /** Icon pins only (tap for name) — avoids overlapping Norwegian labels on small screens. */
  const minimap = (selected: { kind: string; name: string } | null, onSelect: (v: { kind: string; name: string } | null) => void) => {
    const size = 340;
    const c = el('canvas', { class: 'minimap', width: String(size * 2), height: String(size * 2), style: { width: `${size}px`, height: `${size}px` } }) as HTMLCanvasElement;
    const ctx = c.getContext('2d');
    if (!ctx) return c;
    const k = (size * 2) / (game.town.size * 0.9);
    const X = (x: number) => size + x * k;
    const Y = (z: number) => size + z * k;
    const hits: { kind: string; name: string; x: number; y: number; r: number }[] = [];
    ctx.fillStyle = '#9fe08a';
    ctx.fillRect(0, 0, size * 2, size * 2);
    ctx.strokeStyle = '#f2dfb8';
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    for (const z of game.town.zones) {
      ctx.beginPath();
      ctx.moveTo(X(0), Y(0));
      ctx.lineTo(X(z.x), Y(z.z));
      ctx.stroke();
    }
    ctx.fillStyle = '#7fd8ff';
    ctx.beginPath();
    ctx.arc(X(0), Y(0), 9 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const z of game.town.zones) {
      const pin = pins[z.kind];
      if (!pin) continue;
      const cx = X(z.x);
      const cy = Y(z.z);
      const active = selected?.kind === z.kind;
      ctx.fillStyle = active ? '#ffe066' : '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 40, 0, Math.PI * 2);
      ctx.fill();
      if (active) {
        ctx.strokeStyle = '#ff4fa8';
        ctx.lineWidth = 6;
        ctx.stroke();
      }
      ctx.fillStyle = '#4a3b5c';
      ctx.font = '42px "Apple Color Emoji","Noto Color Emoji",sans-serif';
      ctx.fillText(pin.e, cx, cy + 3);
      hits.push({ kind: z.kind, name: pin.n, x: cx, y: cy, r: 44 });
    }
    if (game.mode === 'town') {
      ctx.fillStyle = '#ff4f7f';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(X(game.player.pos.x), Y(game.player.pos.z), 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    c.style.touchAction = 'manipulation';
    c.onclick = (ev) => {
      const rect = c.getBoundingClientRect();
      const sx = ((ev.clientX - rect.left) / rect.width) * (size * 2);
      const sy = ((ev.clientY - rect.top) / rect.height) * (size * 2);
      let best: (typeof hits)[0] | null = null;
      let bestD = Infinity;
      for (const h of hits) {
        const d = Math.hypot(sx - h.x, sy - h.y);
        if (d < h.r && d < bestD) {
          best = h;
          bestD = d;
        }
      }
      onSelect(best ? { kind: best.kind, name: best.name } : null);
    };
    return c;
  };
  let selected: { kind: string; name: string } | null = null;
  const render = () => {
    s.body.replaceChildren(
      el('p', { class: 'lead' }, game.mode === 'town' ? 'Du er den rosa prikken. Trykk på et ikon for navnet – gå dit til fots.' : 'Gå ut døra for å utforske byen.'),
      el('div', { class: 'minimap-wrap' }, minimap(selected, (v) => { selected = v; render(); })),
      selected ? el('p', { class: 'map-pin-name' }, selected.name) : el('p', { class: 'map-pin-hint' }, 'Trykk et ikon 👆'),
      el('h3', {}, 'Hus'),
      el(
        'div',
        { class: 'grid' },
        ...HOUSES.map((h) => {
          const owned = game.save.houses.find((x) => x.style === h.style);
          const active = owned && owned.id === game.save.activeHouseId;
          return el(
            'div',
            { class: `card ${active ? 'eq' : ''}` },
            el('div', { class: 'house-art', style: { '--wall': h.wall, '--roof': h.roof } }, el('i'), el('b')),
            el('b', {}, h.name),
            el('small', {}, h.text),
            active
              ? el('span', { class: 'tag' }, 'Ditt hjem')
              : button(owned ? 'Flytt hit' : price(h.price), () => {
                  const r = buyHouse(game.save, h.style);
                  if (!r.ok) {
                    toast(failText(r.reason), 'bad');
                    sfx.nope();
                    return;
                  }
                  if (!owned) {
                    sfx.buy();
                    toast(`Gratulerer med ${h.name}! 🏡`, 'gold');
                  }
                  game.commit(r.save, { house: true });
                  render();
                }, 'btn buy'),
          );
        }),
      ),
    );
  };
  render();
}

// ---------- Dyrlege ----------
export function openVetInfo(game: Game) {
  const s = sheet('Dyrlegen 🩺', '#3fa4ff', undefined, 'narrow');
  const sick = game.equippedPets().filter((p) => p.need?.kind === 'syk');
  s.body.replaceChildren(
    sick.length
      ? el('p', { class: 'lead' }, `Stå på den grønne matten, så gjør dyrlegen ${sick.map((p) => p.name).join(' og ')} frisk igjen! 💚`)
      : el('p', { class: 'lead' }, 'Alle dyrene dine er friske! Kom hit hvis et dyr blir sykt 🤒'),
    button('OK', () => s.close(), 'btn big'),
  );
}


// ---------- Bilbutikk ----------
export function openCars(game: Game) {
  const s = sheet('Bilbutikk 🚗', '#3fa4ff');
  const render = () => {
    s.body.replaceChildren(
      el('p', { class: 'lead' }, 'Kjøp en fin bil! Den legges i sekken din.'),
      el(
        'div',
        { class: 'grid' },
        ...CARS.map((c) =>
          el(
            'div',
            { class: `card ${game.save.bag[c.id] ? 'eq' : ''}` },
            el('div', { class: 'big-emoji' }, c.emoji),
            el('b', {}, c.name),
            el('small', {}, c.text),
            game.save.bag[c.id]
              ? button('Kjør 🚗', () => { s.close(); game.toggleDrive(); }, 'btn buy')
              : button(price(c.price), () => {
                  const r = buyCar(game.save, c.id);
                  if (!r.ok) { toast(failText(r.reason), 'bad'); sfx.nope(); return; }
                  sfx.buy();
                  toast(`Du kjøpte ${c.name}! 🚗`, 'gold');
                  game.commit(r.save);
                  render();
                }, 'btn buy'),
          ),
        ),
      ),
    );
  };
  render();
}

// ---------- Dyrebutikk ----------
export function openPetShop(game: Game) {
  const s = sheet('Dyrebutikk 🐾', '#ff8fb1');
  const render = () => {
    s.body.replaceChildren(
      el('p', { class: 'lead' }, 'Vogner og leker til dyrene. Alt legges i sekken.'),
      el('h3', {}, 'Vogner'),
      el(
        'div',
        { class: 'grid' },
        ...PET_SHOP.filter((i) => i.kind === 'vogn').map((item) =>
          el(
            'div',
            { class: `card ${game.save.bag[item.id] ? 'eq' : ''}` },
            el('div', { class: 'big-emoji' }, item.emoji),
            el('b', {}, item.name),
            el('small', {}, item.text),
            game.save.bag[item.id]
              ? button('Bruk vogn 🍼', () => { s.close(); game.togglePram(); }, 'btn buy')
              : button(price(item.price), () => {
                  const r = buyPetShopItem(game.save, item.id);
                  if (!r.ok) { toast(failText(r.reason), 'bad'); sfx.nope(); return; }
                  sfx.buy();
                  toast(`Du kjøpte ${item.name}!`, 'gold');
                  game.commit(r.save);
                  render();
                }, 'btn buy'),
          ),
        ),
      ),
      el('h3', {}, 'Dyreleker'),
      el(
        'div',
        { class: 'grid' },
        ...PET_SHOP.filter((i) => i.kind === 'dyreleke').map((item) =>
          el(
            'div',
            { class: `card ${game.save.bag[item.id] ? 'eq' : ''}` },
            el('div', { class: 'big-emoji' }, item.emoji),
            el('b', {}, item.name),
            el('small', {}, item.text),
            game.save.bag[item.id]
              ? el('span', { class: 'tag' }, 'I sekken')
              : button(price(item.price), () => {
                  const r = buyPetShopItem(game.save, item.id);
                  if (!r.ok) { toast(failText(r.reason), 'bad'); sfx.nope(); return; }
                  sfx.buy();
                  toast(`Du kjøpte ${item.name}!`, 'gold');
                  game.commit(r.save);
                  render();
                }, 'btn buy'),
          ),
        ),
      ),
    );
  };
  render();
}

// ---------- Avatar (concept 3-figurer: glass panel right, Klær/Hår/Tilbehør, FERDIG) ----------
export function openAvatar(game: Game, first = false, onDone?: () => void) {
  game.editingAvatar = true;
  game.clearVehicle();
  game.updateHud();
  // Hide gameplay chrome — concept is studio + panel only
  document.querySelectorAll('.dock,.hud-top,.joy-base,.jump,.pet-bar,.prompt,.tasks,.speedo').forEach((el) => {
    (el as HTMLElement).style.visibility = 'hidden';
  });
  // Editor default: no huge backpack — accessory 'ingen' unless user picks one
  const savedAvatar = game.save.avatar;
  let accessoryTouched = false;
  let a: Avatar = { ...savedAvatar };
  const set = (patch: Partial<Avatar>) => {
    if (Object.prototype.hasOwnProperty.call(patch, 'accessory')) accessoryTouched = true;
    a = { ...a, ...patch };
    game.commit({ ...game.save, avatar: a }, { avatar: true });
    render();
  };
  type Tab = 'klaer' | 'har' | 'tilbehor';
  let tab: Tab = 'klaer';
  const finish = () => {
    game.editingAvatar = false;
    document.querySelectorAll('.dock,.hud-top,.joy-base,.jump,.pet-bar,.prompt,.tasks,.speedo').forEach((el) => {
      (el as HTMLElement).style.visibility = '';
    });
    game.commit({ ...game.save, avatar: avatarEditResult(savedAvatar, a, accessoryTouched), avatarDone: true });
    onDone?.();
  };
  const s = sheet(first ? 'Lag din figur!' : 'Avatar-tilpasning', '#3ecbff', finish, 'side avatar-edit');
  // Concept chrome: back + title top-left (over studio), FERDIG in panel head
  const titleBar = el(
    'div',
    { class: 'avatar-titlebar' },
    button('←', () => s.close(), 'btn avatar-back', { 'aria-label': 'Tilbake' }),
    el('h1', {}, first ? 'LAG DIN FIGUR' : 'AVATAR-TILPASNING'),
  );
  s.root.prepend(titleBar);
  const head = s.root.querySelector('.sheet-head');
  if (head) {
    head.replaceChildren(button('Ferdig ✓', () => s.close(), 'btn green ferdig'));
  }
  const activeOutfit = () =>
    OUTFIT_PRESETS.find((o) => Object.entries(o.patch).every(([k, v]) => (a as unknown as Record<string, unknown>)[k] === v)) ?? OUTFIT_PRESETS[0]!;
  const descCard = () => {
    const o = activeOutfit();
    return el(
      'div',
      { class: 'avatar-desc' },
      el('div', { class: 'avatar-desc-ico' }, '👕'),
      el('div', {}, el('b', {}, o.tagline), el('small', {}, o.blurb)),
    );
  };
  const swatches = (list: readonly string[], cur: string, on: (c: string) => void) =>
    el('div', { class: 'swatches' }, ...list.map((c) => button('', () => on(c), `swatch ${c === cur ? 'on' : ''}`, { style: `background:${c}`, 'aria-label': c })));
  type Field = 'hair' | 'face' | 'print' | 'bottom' | 'shoeStyle' | 'hat' | 'accessory';
  const optThumb = (field: Field, id: string): string => {
    const headish = field === 'hair' || field === 'face' || field === 'hat';
    const behind = field === 'accessory' && ['vinger', 'vinger-engel', 'vinger-regnbue', 'sommerfugl', 'sekk', 'sekk-stjerne', 'sekk-rosa', 'kappe', 'stjernekappe'].includes(id);
    const frame = headish
      ? field === 'hat' ? { y: 2.4, r: 1.05 } : { y: 2.22, r: 0.72 }
      : field === 'accessory'
        ? ['briller', 'solbriller', 'hodetelefoner', 'glorie'].includes(id) ? { y: 2.25, r: 0.75 } : { y: 1.35, r: 1.75 }
        : field === 'print' ? { y: 1.45, r: 0.95 }
          : field === 'bottom' ? { y: 0.55, r: 1.05 }
            : { y: 0.35, r: 0.95 };
    const sig = headish
      ? `${a.skin}|${a.hairColor}|${a.hair}|${a.hat}|${a.face}`
      : field === 'accessory' ? `${a.skin}|${a.shirt}` : field === 'print' ? `${a.shirt}|${a.skin}` : field === 'bottom' ? `${a.pants}|${a.skin}|${a.shoes}` : `${a.shoes}|${a.pants}|${a.skin}`;
    return game.thumbs.get(`av|${field}|${id}|${sig}`, () => buildAvatar({ ...a, [field]: id }).root, { yaw: behind ? 2.7 : 0.25, pitch: 0.08, focus: frame });
  };
  const chips = <T extends { id: string; name: string }>(field: Field, list: readonly T[], cur: string, on: (id: T['id']) => void) =>
    el('div', { class: 'opts' }, ...list.map((o) => button(el('span', { class: 'opt-in' }, el('img', { class: 'opt-img', src: optThumb(field, o.id), alt: '' }), el('b', {}, o.name)), () => on(o.id), `opt ${o.id === cur ? 'on' : ''}`)));
  /** Concept shows ~4 large Topp tiles — featured first four presets. */
  const FEATURED_OUTFITS = OUTFIT_PRESETS.slice(0, 4);
  const fillOutfitThumbs = (grid: HTMLElement) => {
    for (const o of FEATURED_OUTFITS) {
      const preview = { ...a, ...o.patch } as Avatar;
      const key = `outfit-gltf|hi|${o.id}|${JSON.stringify(o.patch)}`;
      const img = el('img', { class: 'opt-img', src: '', alt: '' }) as HTMLImageElement;
      img.src = game.thumbs.get(`outfit-ph|hi|${o.id}`, () => buildAvatar(preview).root, {
        yaw: 0.32,
        pitch: 0.05,
        focus: { y: 1.2, r: 1.25 },
        size: 256,
      });
      void game.thumbs
        .getAsync(key, () => buildAvatarPreviewRoot(preview), {
          yaw: 0.32,
          pitch: 0.05,
          focus: { y: 1.2, r: 1.25 },
          size: 256,
        })
        .then((url) => {
          img.src = url;
        })
        .catch(() => {});
      const on = Object.entries(o.patch).every(([k, v]) => (a as unknown as Record<string, unknown>)[k] === v);
      grid.append(
        button(el('span', { class: 'opt-in' }, img, el('b', {}, o.name)), () => set(o.patch), `opt outfit-opt ${on ? 'on' : ''}`),
      );
    }
  };
  const tabs: [Tab, string][] = [['klaer', 'Klær'], ['har', 'Hår'], ['tilbehor', 'Tilbehør']];
  const render = () => {
    let content: HTMLElement;
    switch (tab) {
      case 'klaer': {
        const grid = el('div', { class: 'opts outfit-grid' });
        fillOutfitThumbs(grid);
        const more = el(
          'details',
          { class: 'avatar-more' },
          el('summary', {}, 'Underdel & mer'),
          el('h4', {}, 'Underdel'),
          chips('bottom', BOTTOMS, a.bottom, (id) => set({ bottom: id })),
          swatches(CLOTH_COLORS, a.pants, (c) => set({ pants: c })),
          el('h4', {}, 'Sko'),
          chips('shoeStyle', SHOES, a.shoeStyle, (id) => set({ shoeStyle: id })),
          swatches(CLOTH_COLORS, a.shoes, (c) => set({ shoes: c })),
          el('h4', {}, 'Hud'),
          swatches(SKIN, a.skin, (c) => set({ skin: c })),
          el('h4', {}, 'Ansikt'),
          chips('face', FACES, a.face, (id) => set({ face: id })),
          el('h4', {}, 'Flere antrekk'),
          el(
            'div',
            { class: 'opts outfit-grid outfit-grid-more' },
            ...OUTFIT_PRESETS.slice(4).map((o) => {
              const on = Object.entries(o.patch).every(([k, v]) => (a as unknown as Record<string, unknown>)[k] === v);
              return button(o.name, () => set(o.patch), `opt ${on ? 'on' : ''}`);
            }),
          ),
        );
        content = el(
          'div',
          {},
          el('h4', {}, 'Topp'),
          grid,
          el('h4', {}, 'Farge'),
          swatches(CLOTH_COLORS, a.shirt, (c) => set({ shirt: c })),
          more,
        );
        break;
      }
      case 'har':
        content = el(
          'div',
          {},
          el('h4', {}, 'Frisyre'),
          chips('hair', HAIR_STYLES, a.hair, (id) => set({ hair: id })),
          el('h4', {}, 'Hårfarge'),
          swatches(HAIR_COLORS, a.hairColor, (c) => set({ hairColor: c })),
        );
        break;
      case 'tilbehor':
        content = el(
          'div',
          {},
          el('h4', {}, 'Tilbehør'),
          chips('accessory', ACCESSORIES, a.accessory, (id) => set({ accessory: id })),
          el('h4', {}, 'Hatt'),
          chips('hat', HATS, a.hat, (id) => set({ hat: id })),
        );
        break;
    }
    s.body.replaceChildren(
      el('div', { class: 'tabs avatar-tabs' }, ...tabs.map(([id, label]) => button(label, () => {
        tab = id;
        render();
      }, `tab ${tab === id ? 'on' : ''}`))),
      content,
      el('div', { class: 'row avatar-foot' }, button('🎲 Tilfeldig', () => set(randomAvatar(Math.random)), 'btn purple')),
      descCard(),
    );
  };
  render();
}

// ---------- Bygg ----------
export function openBuild(game: Game) {
  game.setBuilding(true);
  type Tab = FurnCat | 'mine' | 'rom';
  let tab: Tab = 'mine';
  const s = sheet('Bygg 🔨', '#ffb84d', () => {
    unsub();
    game.setBuilding(false);
  }, 'build');
  const unsub = game.subscribe(() => renderTools());
  const tools = el('div', { class: 'build-tools' });
  const list = el('div', { class: 'build-list' });
  const tabsEl = el('div', { class: 'tabs scroll' });
  s.body.replaceChildren(tools, tabsEl, list);

  const place = (id: string) => {
    let save = game.save;
    if (!save.inventory[id]) {
      const r = buyFurniture(save, id);
      if (!r.ok) {
        toast(failText(r.reason), 'bad');
        sfx.nope();
        return;
      }
      save = r.save;
      sfx.buy();
    }
    // right in front of the player, on the floor they are standing on (the house pushes it clear of walls and stairs)
    const spot = game.placeSpot();
    const r = placeFromInventory(save, id, spot.x, spot.z, spot.floor);
    if (!r.ok) {
      toast('Du kan ikke bygge her', 'bad');
      return;
    }
    game.commit(r.save);
    const house = activeHouse(r.save);
    game.selectItem(house.items[house.items.length - 1].uid);
    sfx.pop();
    renderList();
  };

  const renderTools = () => {
    const uid = game.selectedItem;
    const house = activeHouse(game.save);
    const it = uid ? house.items.find((i) => i.uid === uid) : null;
    if (!it) {
      tools.replaceChildren(el('p', { class: 'hint' }, 'Trykk på en ting i rommet for å flytte den (dra), snu, endre farge eller størrelse. Velg nye ting nedenfor.'));
      return;
    }
    const def = FURN_BY_ID[it.itemId];
    const upd = (patch: Parameters<typeof updateItem>[2]) => game.commit(editHouse(game.save, (h) => updateItem(h, it.uid, patch)));
    tools.replaceChildren(
      el('b', { class: 'sel-name' }, def.name),
      el(
        'div',
        { class: 'row tools-row' },
        def.wall ? null : button('↻ Snu', () => game.commit(editHouse(game.save, (h) => rotateItem(h, it.uid))), 'btn small'),
        button('➖', () => upd({ scale: it.scale - 0.15 }), 'btn small round'),
        button('➕', () => upd({ scale: it.scale + 0.15 }), 'btn small round'),
        button('📦 Legg bort', () => {
          const r = storeItem(game.save, it.uid);
          if (r.ok) {
            game.selectItem(null);
            game.commit(r.save);
            renderList();
          }
        }, 'btn small grey'),
      ),
      el('div', { class: 'swatches sm' }, ...PALETTE.map((c) => button('', () => upd({ color: c }), `swatch ${c === it.color ? 'on' : ''}`, { style: `background:${c}` }))),
    );
  };

  const renderList = () => {
    tabsEl.replaceChildren(
      ...([['mine', '📦 Mine'], ...FURN_CATS.map((c) => [c.id, `${c.emoji} ${c.label}`]), ['rom', '🎨 Rom']] as [Tab, string][]).map(([id, label]) =>
        button(label, () => {
          tab = id;
          renderList();
        }, `tab ${tab === id ? 'on' : ''}`),
      ),
    );
    if (tab === 'rom') {
      const house = activeHouse(game.save);
      list.replaceChildren(
        el('h4', {}, 'Veggfarge'),
        el('div', { class: 'swatches' }, ...WALL_COLORS.map((c) => button('', () => {
          game.commit(editHouse(game.save, (h) => ({ ...h, wallColor: c })), { house: true });
          renderList();
        }, `swatch ${c === house.wallColor ? 'on' : ''}`, { style: `background:${c}` }))),
        el('h4', {}, 'Gulv'),
        el('div', { class: 'swatches' }, ...FLOOR_COLORS.map((c) => button('', () => {
          game.commit(editHouse(game.save, (h) => ({ ...h, floorColor: c })), { house: true });
          renderList();
        }, `swatch ${c === house.floorColor ? 'on' : ''}`, { style: `background:${c}` }))),
      );
      return;
    }
    const items = tab === 'mine' ? FURNITURE.filter((f) => game.save.inventory[f.id]) : FURNITURE.filter((f) => f.cat === tab);
    if (!items.length) {
      list.replaceChildren(el('p', { class: 'empty' }, 'Ingen ting her ennå – velg en kategori og kjøp nye møbler!'));
      return;
    }
    list.replaceChildren(
      el(
        'div',
        { class: 'furn-row' },
        ...items.map((f) => {
          const have = game.save.inventory[f.id] ?? 0;
          return button(
            el('span', { class: 'furn' }, el('img', { class: 'thumb', src: furnThumb(game, f.id), alt: '' }), el('b', {}, f.name), have ? el('span', { class: 'have' }, `Har ${have}`) : price(f.price), f.care ? el('span', { class: 'care-tag' }, f.care === 'seng' ? '💤' : f.care === 'bad' ? '🫧' : '⚽') : null),
            () => place(f.id),
            'furn-btn',
          );
        }),
      ),
    );
  };
  renderTools();
  renderList();
}

// ---------- Dørspillet ----------
export function openDoors(game: Game) {
  game.paused = true;
  let g: DoorGame = newGame(game.rng);
  const s: Sheet = sheet('Dørspillet 🚪', '#ff4fa8', () => {
    game.paused = false;
  });
  const colors = ['#ff6f6f', '#ffe066', '#5cc3f2', '#7ccf6a'];
  const render = (opened = -1) => {
    const ev = g.lastEvent;
    const msg =
      g.status === 'won'
        ? `Du klarte alle ${g.totalLevels} nivåene! 🎉`
        : g.status === 'lost'
          ? 'Åh nei, tom for liv! Prøv igjen.'
          : ev?.type === 'trap'
            ? '👻 Spøkelse! Du mistet et liv.'
            : ev?.type === 'trap-blocked'
              ? '🗝️ Nøkkelen reddet deg!'
              : ev?.type === 'item'
                ? `${ITEM_INFO[ev.item].emoji} ${ITEM_INFO[ev.item].text}`
                : ev?.type === 'revealed'
                  ? '🔍 Lupen fant en skummel dør!'
                  : 'Velg en dør! Unngå spøkelsene.';
    s.body.replaceChildren(
      el('div', { class: 'door-stats' }, el('span', {}, `Nivå ${Math.min(g.level + 1, g.totalLevels)}/${g.totalLevels}`), el('span', {}, '💖'.repeat(g.lives) || '–'), el('span', {}, `🗝️${g.keys}`), el('span', {}, `🔍${g.magnifiers}`)),
      el('p', { class: 'lead' }, msg),
      g.status === 'playing'
        ? el(
            'div',
            { class: 'doors' },
            ...g.doors.map((d, i) =>
              button(el('span', { class: 'door-face' }, d.revealed ? '👻' : d.opened ? (d.content.type === 'trap' ? '👻' : '✨') : el('i', { class: 'knob' })), () => {
                const before = g.level;
                g = openDoor(g, i, game.rng);
                const e = g.lastEvent;
                if (e?.type === 'trap') sfx.trap();
                else if (e?.type === 'item') sfx.item();
                else sfx.safe();
                if (g.status === 'won') {
                  sfx.win();
                  const bucks = g.points * 2;
                  game.commit({ ...addBucks(game.save, bucks), stats: { ...game.save.stats, doorWins: game.save.stats.doorWins + 1 } });
                  toast(`+${bucks} bucks!`, 'gold');
                } else if (g.status === 'lost') {
                  sfx.lose();
                  game.commit(addBucks(game.save, POINTS.consolation));
                  toast(`+${POINTS.consolation} bucks for innsatsen`, 'gold');
                }
                render(g.level === before ? i : -1);
              }, `door ${d.opened ? 'open' : ''} ${d.revealed ? 'bad' : ''} ${opened === i ? 'shake' : ''}`, { style: `--door:${colors[i % 4]}`, disabled: d.opened || d.revealed ? 'true' : undefined }),
            ),
          )
        : el('div', { class: 'row' }, button('Spill igjen', () => {
            g = newGame(game.rng);
            render();
          }, 'btn big green'), button('Ferdig', () => s.close(), 'btn big grey')),
      g.status === 'playing' && g.magnifiers > 0 ? button('🔍 Bruk lupe', () => {
        g = useMagnifier(g, game.rng);
        render();
      }, 'btn purple') : '',
    );
  };
  render();
}

// ---------- Starter ----------
export function starterFlow(game: Game) {
  const next = () => {
    if (game.save.starterClaimed) return;
    const s = sheet('Velkommen til Thomas-verden!', '#3ecbff', undefined, 'narrow');
    const egg = EGGS[0];
    s.body.replaceChildren(
      eggArt(egg, 'wobble center'),
      el('p', { class: 'lead' }, 'Her er ditt første egg! Stell dyret ditt, tjen bucks, kjøp møbler og utforsk byen.'),
      button('Klekk egget! 🐣', () => {
        const r = buyAndHatch(game.save, egg.id, game.rng);
        s.close();
        if (r.ok) {
          game.commit(r.save, { pets: true });
          showHatch(game, r.pet, egg);
        }
      }, 'btn big green'),
    );
  };
  if (!game.save.avatarDone) openAvatar(game, true, next);
  else next();
}

export function foodName(id: string) {
  return FOOD_BY_ID[id]?.name ?? id;
}
