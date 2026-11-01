import { describe, expect, it } from 'vitest';
import type { PetState } from '../logic/needs.ts';
import { reconcileTasks, taskViews } from './tasks.ts';

const pet = (uid: string, kind: string | null, progress = 0, name = 'Pus'): PetState =>
  ({ uid, name, speciesId: 'x', need: kind ? { kind, progress, since: 0 } : undefined }) as unknown as PetState;
const keyed = (pets: PetState[]) => taskViews(pets).map((v) => ({ uid: v.uid, kind: pets.find((p) => p.uid === v.uid)!.need!.kind }));

describe('oppgaver panel does not flicker', () => {
  it('progress moving never rebuilds a card', () => {
    const first = keyed([pet('a', 'sulten', 0.1)]);
    for (let p = 0.1; p < 1; p += 0.013) {
      const r = reconcileTasks(first, keyed([pet('a', 'sulten', p)]));
      expect(r.add).toEqual([]);
      expect(r.remove).toEqual([]);
    }
  });
  it('renaming a pet only patches the text', () => {
    const r = reconcileTasks(keyed([pet('a', 'sulten', 0.5)]), keyed([pet('a', 'sulten', 0.5, 'Fluffy')]));
    expect(r).toEqual({ add: [], remove: [] });
  });
  it('a new task, a different task or a finished task changes the cards', () => {
    const a = keyed([pet('a', 'sulten')]);
    expect(reconcileTasks(a, keyed([pet('a', 'sulten'), pet('b', 'syk')]))).toEqual({ add: ['b'], remove: [] });
    expect(reconcileTasks(a, keyed([pet('a', 'torst')]))).toEqual({ add: ['a'], remove: ['a'] });
    expect(reconcileTasks(a, [])).toEqual({ add: [], remove: ['a'] });
  });
  it('views carry rounded percent and the sick flag; pets without a need are skipped', () => {
    const v = taskViews([pet('a', 'syk', 0.456), pet('b', null)]);
    expect(v.length).toBe(1);
    expect(v[0].pct).toBe(46);
    expect(v[0].sick).toBe(true);
  });
});
