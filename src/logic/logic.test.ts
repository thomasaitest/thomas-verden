import { describe, expect, it } from 'vitest';
import { seeded } from './rng.ts';
import { POINTS, START_LIVES, levelShape, makeDoors, newGame, openDoor, useMagnifier, type DoorGame } from './doors.ts';
import { EGGS, RARITY_ORDER, SPECIES, SPECIES_BY_ID, hatch, rollRarity, speciesOfRarity, cleanPetName } from './pets.ts';
import { FURNITURE, FURN_BY_ID, FURN_CATS, FOODS, HOUSES } from './catalog.ts';
import { addCare, completeNeed, newPetState, rollNeed, SICK_AFTER, stageIndex, stageOf, STAGES, tickPet, NEED_INFO, CARE_AMOUNT, GROW_BONUS } from './needs.ts';
import { canEdit, clampToRoom, deserializeHouse, grantEdit, newHouse, placeItem, requestEdit, revokeEdit, rotateItem, roomSize, serializeHouse, snapToWall, updateItem, MAX_SCALE, MIN_SCALE } from './house.ts';
import { cleanAvatar, DEFAULT_AVATAR, randomAvatar } from './avatar.ts';
import { freshSave, parseSave, MAX_EQUIPPED, START_BUCKS } from './save.ts';
import { activeHouse, buyAndHatch, buyFood, buyFurniture, buyHouse, buyPotion, careAt, feed, maybeDropPotionFromFlight, placeFromInventory, storeItem, tickSave, toggleEquip, usePotion } from './economy.ts';

describe('catalog', () => {
  it('has 60+ furniture items with unique ids in known categories', () => {
    expect(FURNITURE.length).toBeGreaterThanOrEqual(60);
    expect(new Set(FURNITURE.map((f) => f.id)).size).toBe(FURNITURE.length);
    const cats = new Set(FURN_CATS.map((c) => c.id));
    for (const f of FURNITURE) {
      expect(cats.has(f.cat)).toBe(true);
      expect(f.price).toBeGreaterThan(0);
    }
  });
  it('has beds, baths and toys for pet care, and food and drink', () => {
    expect(FURNITURE.some((f) => f.care === 'seng')).toBe(true);
    expect(FURNITURE.some((f) => f.care === 'bad')).toBe(true);
    expect(FURNITURE.some((f) => f.care === 'lek')).toBe(true);
    expect(FOODS.some((f) => f.fixes === 'mat')).toBe(true);
    expect(FOODS.some((f) => f.fixes === 'drikke')).toBe(true);
    expect(HOUSES[0].price).toBe(0);
  });
});

describe('pets and eggs', () => {
  it('every rarity has species and species ids are unique', () => {
    for (const r of RARITY_ORDER) expect(speciesOfRarity(r).length).toBeGreaterThan(0);
    expect(Object.keys(SPECIES_BY_ID).length).toBe(SPECIES.length);
  });
  it('has rare flying and riding pets', () => {
    expect(SPECIES.some((s) => (s.rarity === 'legendarisk' || s.rarity === 'ultra') && (s.bornFly ?? 0) > 0)).toBe(true);
    expect(SPECIES.some((s) => (s.rarity === 'legendarisk' || s.rarity === 'ultra') && (s.bornRide ?? 0) > 0)).toBe(true);
  });
  it('the starter egg never gives rare pets', () => {
    const rng = seeded(1);
    for (let i = 0; i < 300; i++) expect(['vanlig', 'uvanlig']).toContain(rollRarity(EGGS[0], rng));
  });
  it('the gold egg gives legendary pets sometimes', () => {
    const rng = seeded(2);
    const gold = EGGS.find((e) => e.id === 'egg-gull')!;
    const got = new Set(Array.from({ length: 300 }, () => rollRarity(gold, rng)));
    expect(got.has('legendarisk')).toBe(true);
    expect(got.has('vanlig')).toBe(false);
  });
  it('hatches a real species', () => {
    const pet = hatch('egg-eventyr', seeded(3), 100);
    expect(SPECIES_BY_ID[pet.speciesId]).toBeTruthy();
    expect(pet.obtainedAt).toBe(100);
  });
  it('cleans pet names', () => {
    expect(cleanPetName('  <Bella>  ', 'Hund')).toBe('Bella');
    expect(cleanPetName('   ', 'Hund')).toBe('Hund');
    expect(cleanPetName('x'.repeat(40), 'Hund').length).toBe(16);
  });
});

describe('needs, sickness and ageing', () => {
  const base = () => newPetState({ uid: 'p1', speciesId: 'hund', name: 'Hund', flyable: false, rideable: false, obtainedAt: 0 }, 0);
  it('a need appears when the timer is up', () => {
    const p = tickPet(base(), 10_000, seeded(4));
    expect(p.need).not.toBeNull();
  });
  it('ignored needs turn into sickness', () => {
    const p = { ...base(), need: { kind: 'sulten' as const, since: 0, progress: 0 } };
    expect(tickPet(p, SICK_AFTER - 1, seeded(1)).need!.kind).toBe('sulten');
    expect(tickPet(p, SICK_AFTER + 1, seeded(1)).need!.kind).toBe('syk');
  });
  it('rollNeed does not repeat the last need', () => {
    const rng = seeded(5);
    for (let i = 0; i < 200; i++) expect(rollNeed('trott', rng)).not.toBe('trott');
  });
  it('care only counts at the right place and finishes', () => {
    const p = { ...base(), need: { kind: 'syk' as const, since: 0, progress: 0 } };
    expect(addCare(p, 'seng', 10).done).toBe(false);
    const half = addCare(p, 'dyrlege', CARE_AMOUNT.dyrlege / 2);
    expect(half.done).toBe(false);
    expect(half.pet.need!.progress).toBeCloseTo(0.5);
    expect(addCare(half.pet, 'dyrlege', CARE_AMOUNT.dyrlege).done).toBe(true);
  });
  it('completing needs pays bucks and ages the pet', () => {
    let p = base();
    let total = 0;
    let grows = 0;
    const rng = seeded(6);
    for (let i = 0; i < STAGES[STAGES.length - 1].at; i++) {
      p = { ...p, need: { kind: 'trott', since: 0, progress: 1 } };
      const r = completeNeed(p, 0, rng);
      p = r.pet;
      total += r.reward;
      if (r.grewUp) grows++;
    }
    expect(stageOf(p.xp).name).toBe('Voksen');
    expect(grows).toBe(STAGES.length - 1);
    expect(total).toBe(STAGES[STAGES.length - 1].at * NEED_INFO.trott.reward + grows * GROW_BONUS);
    expect(stageIndex(0)).toBe(0);
  });
});

describe('houses and furniture', () => {
  it('clamps furniture to the room and limits scale', () => {
    let h = newHouse('hytte', 'me', 0);
    h = placeItem(h, 'sofa', 100, -100);
    const it = h.items[h.items.length - 1];
    const { w, d } = roomSize('hytte');
    expect(Math.abs(it.x)).toBeLessThan(w / 2);
    expect(Math.abs(it.z)).toBeLessThan(d / 2);
    h = updateItem(h, it.uid, { scale: 9 });
    expect(h.items.find((i) => i.uid === it.uid)!.scale).toBe(MAX_SCALE);
    h = updateItem(h, it.uid, { scale: 0.1, color: '#000000' });
    const after = h.items.find((i) => i.uid === it.uid)!;
    expect(after.scale).toBe(MIN_SCALE);
    expect(after.color).toBe('#000000');
  });
  it('rotates in 45 degree steps', () => {
    let h = placeItem(newHouse('hytte', 'me', 0), 'sofa', 0, 0);
    const id = h.items[h.items.length - 1].uid;
    h = rotateItem(h, id);
    expect(h.items.find((i) => i.uid === id)!.rot).toBeCloseTo(Math.PI / 4);
  });
  it('snaps wall items to the nearest back or side wall', () => {
    const { w, d } = roomSize('hytte');
    expect(snapToWall('hytte', 0, -d / 2 + 0.5).z).toBeCloseTo(-d / 2 + 0.08);
    const left = snapToWall('hytte', -w / 2 + 0.2, 0);
    expect(left.x).toBeCloseTo(-w / 2 + 0.08);
    expect(left.rot).toBeCloseTo(Math.PI / 2);
    expect(clampToRoom('hytte', 0, 999).z).toBeLessThan(d / 2);
  });
  it('only the owner can grant building rights', () => {
    let h = newHouse('hytte', 'owner', 0);
    expect(canEdit(h, 'friend')).toBe(false);
    h = requestEdit(h, 'friend');
    expect(h.editRequests).toContain('friend');
    expect(canEdit(grantEdit(h, 'friend', 'friend'), 'friend')).toBe(false);
    h = grantEdit(h, 'owner', 'friend');
    expect(canEdit(h, 'friend')).toBe(true);
    expect(h.editRequests).not.toContain('friend');
    expect(canEdit(revokeEdit(h, 'owner', 'friend'), 'friend')).toBe(false);
  });
  it('round-trips through JSON and drops unknown items', () => {
    const h = newHouse('villa', 'me', 0);
    const raw = JSON.parse(serializeHouse(h));
    raw.items.push({ uid: 'x', itemId: 'nope', x: 0, z: 0 });
    const back = deserializeHouse(JSON.stringify(raw))!;
    expect(back.items.length).toBe(h.items.length);
    expect(deserializeHouse('{bad')).toBeNull();
  });
});

describe('avatar', () => {
  it('repairs bad avatar data', () => {
    expect(cleanAvatar(null)).toEqual(DEFAULT_AVATAR);
    const a = cleanAvatar({ hair: 'mohawk', skin: 'red', hat: 'krone' });
    expect(a.hair).toBe(DEFAULT_AVATAR.hair);
    expect(a.skin).toBe(DEFAULT_AVATAR.skin);
    expect(a.hat).toBe('krone');
  });
  it('random avatars are valid', () => {
    const rng = seeded(7);
    for (let i = 0; i < 50; i++) {
      const a = randomAvatar(rng);
      expect(cleanAvatar(a)).toEqual(a);
    }
  });
});

describe('economy and save', () => {
  it('claims the free starter egg once and the pet follows', () => {
    const s = freshSave(0);
    const r = buyAndHatch(s, 'egg-start', seeded(8), 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.save.bucks).toBe(START_BUCKS);
    expect(r.save.equipped).toEqual([r.pet.uid]);
    expect(buyAndHatch(r.save, 'egg-start', seeded(8), 0).ok).toBe(false);
  });
  it('cannot buy what you cannot afford', () => {
    const s = { ...freshSave(0), bucks: 5 };
    expect(buyFurniture(s, 'piano')).toMatchObject({ ok: false, reason: 'too-expensive' });
    expect(buyAndHatch(s, 'egg-gull', seeded(1)).ok).toBe(false);
    expect(buyHouse(s, 'slott').ok).toBe(false);
  });
  it('buying, placing and storing furniture', () => {
    let s = freshSave(0);
    const r = buyFurniture(s, 'lenestol');
    expect(r.ok).toBe(true);
    s = r.save;
    expect(s.bucks).toBe(START_BUCKS - FURN_BY_ID.lenestol.price);
    const placed = placeFromInventory(s, 'lenestol', 1, 1);
    expect(placed.ok).toBe(true);
    s = placed.save;
    expect(s.inventory.lenestol).toBeUndefined();
    const item = activeHouse(s).items.find((i) => i.itemId === 'lenestol')!;
    s = storeItem(s, item.uid).save;
    expect(s.inventory.lenestol).toBe(1);
  });
  it('buying a house makes it the active home; owned houses just switch', () => {
    let s = { ...freshSave(0), bucks: 5000 };
    s = buyHouse(s, 'villa').save;
    expect(activeHouse(s).style).toBe('villa');
    const bucks = s.bucks;
    const first = s.houses[0].id;
    s = buyHouse(s, 'hytte').save;
    expect(s.activeHouseId).toBe(first);
    expect(s.bucks).toBe(bucks);
  });
  it('hungry pets need food from the shop; wrong food is not used up', () => {
    let s = buyAndHatch(freshSave(0), 'egg-start', seeded(9), 0).save;
    const uid = s.pets[0].uid;
    s = { ...s, pets: s.pets.map((p) => ({ ...p, need: { kind: 'sulten' as const, since: 0, progress: 0 } })) };
    const wrong = feed(s, uid, 'vann', 0, seeded(1));
    expect(wrong.done).toBe(false);
    expect(wrong.save.bag.vann).toBe(2);
    const ok = feed(s, uid, 'eple', 0, seeded(1));
    expect(ok.done).toBe(true);
    expect(ok.save.bag.eple).toBe(1);
    expect(ok.save.bucks).toBe(START_BUCKS + NEED_INFO.sulten.reward);
    expect(ok.save.pets[0].need).toBeNull();
    expect(buyFood(ok.save, 'pizza').save.bag.pizza).toBe(1);
  });
  it('sick pets get well at the vet', () => {
    let s = buyAndHatch(freshSave(0), 'egg-start', seeded(9), 0).save;
    const uid = s.pets[0].uid;
    s = { ...s, pets: s.pets.map((p) => ({ ...p, need: { kind: 'syk' as const, since: 0, progress: 0 } })) };
    expect(careAt(s, uid, 'lek', 100, 0, seeded(1)).done).toBe(false);
    const r = careAt(s, uid, 'dyrlege', 100, 0, seeded(1));
    expect(r.done).toBe(true);
    expect(r.save.stats.tasks).toBe(1);
  });
  it('potions are not buyable in shops', () => {
    const s = { ...freshSave(0), bucks: 10_000 };
    expect(buyPotion(s, 'flygedrikk').ok).toBe(false);
    expect(buyPotion(s, 'ridedrikk').ok).toBe(false);
  });
  it('potions make pets fly or ride (granted, not bought)', () => {
    let s = { ...buyAndHatch(freshSave(0), 'egg-start', seeded(9), 0).save, bucks: 1000 };
    const uid = s.pets[0].uid;
    expect(usePotion(s, 'flygedrikk', uid).ok).toBe(false);
    s = { ...s, bag: { ...s.bag, flygedrikk: 1 } };
    s = usePotion(s, 'flygedrikk', uid).save;
    expect(s.pets[0].flyable).toBe(true);
    expect(s.bag.flygedrikk).toBeUndefined();
  });
  it('flying pets sometimes drop potions (luck)', () => {
    const base = freshSave(0);
    let hits = 0;
    for (let i = 0; i < 80; i++) {
      const r = maybeDropPotionFromFlight(base, seeded(i + 3));
      if (r.ok) hits++;
    }
    expect(hits).toBeGreaterThan(5);
    expect(hits).toBeLessThan(40);
  });
  it('only one pet follows at a time; a new follower replaces the old one; only the follower gets needs', () => {
    let s = { ...freshSave(0), bucks: 10_000 };
    const rng = seeded(10);
    s = buyAndHatch(s, 'egg-start', rng, 0).save;
    s = buyAndHatch(s, 'egg-vanlig', rng, 0).save;
    s = buyAndHatch(s, 'egg-vanlig', rng, 0).save;
    expect(MAX_EQUIPPED).toBe(1);
    // the first pet follows; later hatchlings do not push it out
    expect(s.equipped).toEqual([s.pets[0].uid]);
    const second = s.pets[1].uid;
    s = toggleEquip(s, second).save;
    expect(s.equipped).toEqual([second]); // the previous one stopped following
    s = toggleEquip(s, s.pets[2].uid).save;
    expect(s.equipped).toEqual([s.pets[2].uid]);
    // switching it off leaves nobody following
    s = toggleEquip(s, s.pets[2].uid).save;
    expect(s.equipped).toEqual([]);
    s = toggleEquip(s, second).save;
    const t = tickSave(s, 999_999, rng);
    for (const p of t.pets) expect(!!p.need).toBe(t.equipped.includes(p.uid));
  });
  it('an old save with two followers is repaired to one', () => {
    let s = { ...freshSave(0), bucks: 10_000 };
    const rng = seeded(12);
    s = buyAndHatch(s, 'egg-start', rng, 0).save;
    s = buyAndHatch(s, 'egg-vanlig', rng, 0).save;
    const old = { ...s, equipped: s.pets.map((p) => p.uid) };
    expect(parseSave(JSON.stringify(old)).equipped).toEqual([s.pets[0].uid]);
  });
  it('save round-trips and repairs broken data', () => {
    const s = buyAndHatch(freshSave(0), 'egg-start', seeded(11), 0).save;
    const back = parseSave(JSON.stringify(s));
    expect(back.pets.length).toBe(1);
    expect(back.equipped).toEqual(s.equipped);
    expect(parseSave('nonsense').version).toBe(1);
    const broken = { ...JSON.parse(JSON.stringify(s)), bucks: -5, bag: { eple: 3, hack: 9 }, inventory: { nope: 1 }, activeHouseId: 'x' };
    const fixed = parseSave(JSON.stringify(broken));
    expect(fixed.bucks).toBe(0);
    expect(fixed.bag).toEqual({ eple: 3 });
    expect(fixed.inventory).toEqual({});
    expect(fixed.activeHouseId).toBe(fixed.houses[0].id);
  });
});

describe('door game', () => {
  it('builds levels with the right number of doors and traps', () => {
    const rng = seeded(5);
    for (let level = 0; level < 5; level++) {
      const doors = makeDoors(level, rng);
      const shape = levelShape(level);
      expect(doors).toHaveLength(shape.doors);
      expect(doors.filter((d) => d.content.type === 'trap')).toHaveLength(shape.traps);
      expect(doors.filter((d) => d.content.type === 'item').length).toBeLessThanOrEqual(1);
    }
  });

  const withDoors = (game: DoorGame, contents: DoorGame['doors'][number]['content'][]): DoorGame => ({
    ...game,
    doors: contents.map((content) => ({ content, opened: false, revealed: false })),
  });

  it('starts with 3 lives; a trap costs a life and keeps the level', () => {
    const rng = seeded(2);
    let g = withDoors(newGame(rng), [{ type: 'trap' }, { type: 'safe' }, { type: 'safe' }]);
    expect(g.lives).toBe(START_LIVES);
    g = openDoor(g, 0, rng);
    expect(g.lives).toBe(2);
    expect(g.level).toBe(0);
    expect(g.doors[0].opened).toBe(true);
    expect(openDoor(g, 0, rng)).toBe(g); // can't reopen
    g = openDoor(g, 1, rng);
    expect(g.level).toBe(1);
    expect(g.points).toBe(POINTS.perLevel);
  });

  it('items help: extra life, key blocks a trap, magnifier reveals a trap', () => {
    const rng = seeded(4);
    let g = withDoors(newGame(rng), [{ type: 'item', item: 'life' }, { type: 'safe' }, { type: 'trap' }]);
    g = openDoor(g, 0, rng);
    expect(g.lives).toBe(4);
    g = withDoors(g, [{ type: 'item', item: 'key' }, { type: 'trap' }, { type: 'safe' }]);
    g = openDoor(g, 0, rng);
    expect(g.keys).toBe(1);
    g = withDoors(g, [{ type: 'trap' }, { type: 'item', item: 'magnifier' }, { type: 'safe' }]);
    g = openDoor(g, 0, rng);
    expect(g.lives).toBe(4);
    expect(g.keys).toBe(0);
    expect(g.lastEvent).toEqual({ type: 'trap-blocked' });
    g = openDoor(g, 1, rng);
    expect(g.magnifiers).toBe(1);
    g = withDoors(g, [{ type: 'safe' }, { type: 'trap' }, { type: 'safe' }]);
    g = useMagnifier(g, rng);
    expect(g.magnifiers).toBe(0);
    expect(g.doors[1].revealed).toBe(true);
    expect(openDoor(g, 1, rng)).toBe(g); // revealed door can't be picked
  });

  it('winning all levels pays the win bonus plus lives', () => {
    const rng = seeded(9);
    let g = newGame(rng, 2);
    for (let i = 0; i < 2; i++) g = openDoor(withDoors(g, [{ type: 'safe' }, { type: 'trap' }]), 0, rng);
    expect(g.status).toBe('won');
    expect(g.points).toBe(2 * POINTS.perLevel + POINTS.winBonus + 3 * POINTS.perLifeLeft);
  });

  it('losing all lives ends with consolation points', () => {
    const rng = seeded(10);
    let g = newGame(rng);
    for (let i = 0; i < 3; i++) g = openDoor(withDoors(g, [{ type: 'trap' }, { type: 'safe' }]), 0, rng);
    expect(g.status).toBe('lost');
    expect(g.lives).toBe(0);
    expect(g.points).toBe(POINTS.consolation);
    expect(openDoor(g, 1, rng)).toBe(g);
  });

  it('a run of random choices always ends', () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = seeded(seed);
      let g = newGame(rng);
      let steps = 0;
      while (g.status === 'playing' && steps++ < 100) {
        const open = g.doors.findIndex((d) => !d.opened && !d.revealed);
        g = openDoor(g, open, rng);
      }
      expect(g.status).not.toBe('playing');
      expect(g.points).toBeGreaterThan(0);
    }
  });
});

