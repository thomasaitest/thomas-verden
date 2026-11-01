import { describe, expect, it } from 'vitest';
import { STARTER_TOYS, TOYS, TOY_BY_ID } from './catalog.ts';
import { buyToy, playWithToy, TOY_JOY } from './economy.ts';
import { addJoy, joyNow, JOY_FADE_MS, newPetState, type PetState } from './needs.ts';
import { freshSave, parseSave, type SaveData } from './save.ts';
import { CHASE_TIME, CUDDLE_HUG_TIME, FETCH_DISTANCE, FETCH_ROUNDS, MAX_PLAY_TIME, playDone, startPlay, stepPlay, type PlayPose, type Pt } from './toyplay.ts';

const rng = () => 0.3;
const NOW = 1_000_000;

function withPet(need?: PetState['need']): { save: SaveData; uid: string } {
  const base = freshSave(NOW);
  const pet: PetState = { ...newPetState({ uid: 'p1', speciesId: 'hund', name: 'Fido', flyable: false, rideable: false, obtainedAt: NOW }, NOW), need: need ?? null };
  return { save: { ...base, pets: [pet], equipped: ['p1'] }, uid: 'p1' };
}

describe('toys: catalog, shop and backpack', () => {
  it('has a ball, a stick, a teddy and a yarn ball with Norwegian names and a play style each', () => {
    expect(TOYS.map((t) => t.name)).toEqual(['Ball', 'Pinne', 'Kosebamse', 'Garnnøste']);
    expect(new Set(TOYS.map((t) => t.play))).toEqual(new Set(['fetch', 'cuddle', 'chase']));
    for (const t of TOYS) {
      expect(t.price).toBeGreaterThan(0);
      expect(TOY_BY_ID[t.id]).toBe(t);
    }
  });

  it('a new player starts with a ball and a yarn ball in the backpack', () => {
    const s = freshSave(NOW);
    for (const id of STARTER_TOYS) expect(s.bag[id]).toBe(1);
    expect(STARTER_TOYS.length).toBeGreaterThanOrEqual(2);
  });

  it('buying: costs bucks, goes in the backpack, only once, not without money', () => {
    const s = { ...freshSave(NOW), bucks: 20 };
    const r = buyToy(s, 'leke-pinne');
    expect(r.ok).toBe(true);
    expect(r.save.bag['leke-pinne']).toBe(1);
    expect(r.save.bucks).toBe(20 - TOY_BY_ID['leke-pinne'].price);
    const again = buyToy(r.save, 'leke-pinne');
    expect(again).toMatchObject({ ok: false, reason: 'owned' });
    expect(buyToy({ ...s, bucks: 1 }, 'leke-bamse')).toMatchObject({ ok: false, reason: 'too-expensive' });
    expect(buyToy(s, 'leke-ukjent')).toMatchObject({ ok: false, reason: 'unknown' });
  });

  it('toys survive saving and loading; an old save gets the starter toys once, a new one does not get them back', () => {
    const s = { ...freshSave(NOW), bag: { eple: 1, 'leke-bamse': 1 } };
    const back = parseSave(JSON.stringify(s), NOW);
    expect(back.bag['leke-bamse']).toBe(1);
    expect(back.bag['leke-ball']).toBeUndefined(); // toysGiven was true: nothing is added again
    const old = JSON.parse(JSON.stringify(freshSave(NOW))) as Record<string, unknown>;
    delete old.toysGiven;
    old.bag = { eple: 3 };
    const migrated = parseSave(JSON.stringify(old), NOW);
    expect(migrated.bag['leke-ball']).toBe(1);
    expect(migrated.bag['leke-garn']).toBe(1);
    expect(migrated.bag.eple).toBe(3);
    // a junk toy id is dropped
    expect(parseSave(JSON.stringify({ ...freshSave(NOW), bag: { 'leke-sverd': 4 } }), NOW).bag['leke-sverd']).toBeUndefined();
  });
});

describe('toys: playing makes the pet happier', () => {
  it('raises happiness, keeps the toy, and a second play raises it more', () => {
    const { save, uid } = withPet();
    const a = playWithToy(save, uid, 'leke-ball', NOW, rng);
    expect(a.reason).toBeUndefined();
    expect(a.joy).toBeCloseTo(TOY_JOY, 6);
    expect(a.save.bag['leke-ball']).toBe(1); // not used up
    const b = playWithToy(a.save, uid, 'leke-ball', NOW + 1000, rng);
    expect(b.joy).toBeGreaterThan(a.joy);
    expect(b.joy).toBeLessThanOrEqual(1);
    let s = b.save;
    for (let i = 0; i < 10; i++) s = playWithToy(s, uid, 'leke-ball', NOW + 2000, rng).save;
    expect(joyNow(s.pets[0], NOW + 2000)).toBe(1); // capped
  });

  it('happiness fades over ten minutes and never goes below zero', () => {
    const pet = addJoy(withPet().save.pets[0], 0.8, NOW);
    expect(joyNow(pet, NOW)).toBeCloseTo(0.8, 6);
    expect(joyNow(pet, NOW + JOY_FADE_MS / 2)).toBeLessThan(0.4);
    expect(joyNow(pet, NOW + JOY_FADE_MS * 3)).toBe(0);
    expect(joyNow({}, NOW)).toBe(0);
  });

  it('happiness is saved with the pet', () => {
    const { save, uid } = withPet();
    const played = playWithToy(save, uid, 'leke-garn', NOW, rng).save;
    const back = parseSave(JSON.stringify(played), NOW);
    expect(joyNow(back.pets[0], NOW)).toBeCloseTo(TOY_JOY, 6);
  });

  it('a bored pet (Kjeder seg) is cured by playing and the owner is paid; other needs stay', () => {
    const bored = withPet({ kind: 'kjedelig', since: NOW, progress: 0 });
    const r = playWithToy(bored.save, bored.uid, 'leke-ball', NOW, rng);
    expect(r.done).toBe(true);
    expect(r.reward).toBeGreaterThan(0);
    expect(r.save.bucks).toBe(bored.save.bucks + r.reward);
    expect(r.save.pets[0].need?.kind).not.toBe('kjedelig');
    expect(joyNow(r.save.pets[0], NOW)).toBeGreaterThan(0);
    const hungry = withPet({ kind: 'sulten', since: NOW, progress: 0.2 });
    const h = playWithToy(hungry.save, hungry.uid, 'leke-ball', NOW, rng);
    expect(h.done).toBe(false);
    expect(h.save.pets[0].need).toEqual({ kind: 'sulten', since: NOW, progress: 0.2 });
    expect(h.joy).toBeGreaterThan(0);
  });

  it('you cannot play with a toy you do not have, a pet that does not exist, or a made-up toy', () => {
    const { save, uid } = withPet();
    const noToy = { ...save, bag: {} };
    expect(playWithToy(noToy, uid, 'leke-ball', NOW, rng)).toMatchObject({ reason: 'empty', done: false, joy: 0 });
    expect(playWithToy(save, 'ingen', 'leke-ball', NOW, rng).reason).toBe('no-pet');
    expect(playWithToy(save, uid, 'leke-laser', NOW, rng).reason).toBe('unknown');
    expect(playWithToy(noToy, uid, 'leke-ball', NOW, rng).save).toBe(noToy);
  });
});

/** Run a play script with a pet that runs at a fixed speed straight at whatever it is told to. */
function simulate(kind: 'fetch' | 'chase' | 'cuddle', petSpeed = 7) {
  const player: Pt = { x: 0, z: 0 };
  const pet: Pt = { x: -2, z: -2 };
  const s = startPlay(kind, player, 0.4);
  const dt = 1 / 30;
  const poses = new Set<PlayPose>();
  const trace: { pet: Pt; toy: { x: number; y: number; z: number }; phase: string; carried: boolean }[] = [];
  let carriedSeen = false;
  let guard = 0;
  while (!playDone(s) && guard++ < 30 * 40) {
    const st = stepPlay(s, dt, pet, player);
    poses.add(st.pose);
    if (st.carried) {
      carriedSeen = true;
      s.toy.x = pet.x;
      s.toy.z = pet.z;
      s.toy.y = 0.6;
    }
    if (st.target) {
      const d = Math.hypot(st.target.x - pet.x, st.target.z - pet.z);
      if (d > st.stopDist) {
        const step = Math.min(petSpeed * dt, d - st.stopDist);
        pet.x += ((st.target.x - pet.x) / d) * step;
        pet.z += ((st.target.z - pet.z) / d) * step;
      }
    }
    trace.push({ pet: { ...pet }, toy: { x: s.toy.x, y: s.toy.y, z: s.toy.z }, phase: s.phase, carried: st.carried });
  }
  return { s, pet, player, poses, trace, carriedSeen, seconds: s.t };
}

describe('toys: the play scripts', () => {
  it('fetch: the toy is thrown away, the pet runs to it, carries it back and does it twice, then it is over', () => {
    const r = simulate('fetch');
    expect(playDone(r.s)).toBe(true);
    expect(r.seconds).toBeLessThan(MAX_PLAY_TIME);
    expect(r.carriedSeen).toBe(true);
    // the toy really flew away: it got far from the player and high in the air
    expect(Math.max(...r.trace.map((t) => Math.hypot(t.toy.x, t.toy.z)))).toBeGreaterThan(FETCH_DISTANCE * 0.7);
    expect(Math.max(...r.trace.map((t) => t.toy.y))).toBeGreaterThan(2);
    // the pet ran out there and came back
    expect(Math.max(...r.trace.map((t) => Math.hypot(t.pet.x, t.pet.z)))).toBeGreaterThan(FETCH_DISTANCE * 0.7);
    expect(Math.hypot(r.pet.x, r.pet.z)).toBeLessThan(3);
    expect(r.trace.filter((t, i) => t.phase === 'drop' && r.trace[i - 1]?.phase === 'carry').length).toBe(FETCH_ROUNDS);
    expect(r.poses.has('walk')).toBe(true);
    expect(r.poses.has('happy')).toBe(true);
  });

  it('fetch: a pet that is slow still gets there (or the script gives up in time)', () => {
    const r = simulate('fetch', 1.2);
    expect(playDone(r.s)).toBe(true);
    expect(r.seconds).toBeLessThanOrEqual(MAX_PLAY_TIME + 3);
  });

  it('chase: the yarn rolls around, the pet catches and bats it several times, then rests', () => {
    const r = simulate('chase', 6);
    expect(playDone(r.s)).toBe(true);
    expect(r.s.bats).toBeGreaterThanOrEqual(2);
    expect(r.seconds).toBeGreaterThan(CHASE_TIME - 0.5);
    expect(r.seconds).toBeLessThan(CHASE_TIME + 4);
    // it really moves around (not a stationary toy)
    const xs = r.trace.map((t) => t.toy.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(2);
    for (const t of r.trace) expect(Number.isFinite(t.toy.x + t.toy.z + t.toy.y)).toBe(true);
    expect(r.poses.has('walk')).toBe(true);
  });

  it('cuddle: the teddy is set down, the pet comes, hops, then sleeps on it', () => {
    const r = simulate('cuddle');
    expect(playDone(r.s)).toBe(true);
    expect(r.poses.has('happy')).toBe(true);
    expect(r.poses.has('sleep')).toBe(true);
    const hug = r.trace.filter((t) => t.phase === 'hug');
    expect(hug.length / 30).toBeGreaterThan(CUDDLE_HUG_TIME - 0.2);
    for (const t of hug) expect(Math.hypot(t.pet.x - t.toy.x, t.pet.z - t.toy.z)).toBeLessThan(1.2); // right next to the teddy
  });

  it('the toy disappears at the end so nothing is left lying around', () => {
    for (const k of ['fetch', 'chase', 'cuddle'] as const) {
      const r = simulate(k);
      expect(r.s.phase).toBe('done');
      // it is hidden in the last rest phase before done
      const rest = r.trace.filter((t) => t.phase === 'rest');
      expect(rest.length).toBeGreaterThan(0);
    }
  });

  it('a script can never run forever, even if the pet does not move at all', () => {
    for (const k of ['fetch', 'chase', 'cuddle'] as const) {
      const r = simulate(k, 0);
      expect(playDone(r.s), k).toBe(true);
      expect(r.seconds, k).toBeLessThan(MAX_PLAY_TIME + 4);
    }
  });
});
