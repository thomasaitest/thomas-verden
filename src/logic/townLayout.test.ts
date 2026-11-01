import { describe, expect, it } from 'vitest';
import {
  benchBackrestOffset,
  benchForward,
  benchSpots,
  buildRoadNetwork,
  buildingsFromPlaces,
  faceStreet,
  HOUSE_PLOTS,
  onRoad,
  roadHitsBuilding,
  sitFacesAwayFromBackrest,
} from './townLayout.ts';

describe('town road network', () => {
  const roads = buildRoadNetwork();
  const buildings = buildingsFromPlaces();

  it('has a real grid network (not hub-and-spoke from the fountain)', () => {
    expect(roads.length).toBeGreaterThanOrEqual(12);
    for (const s of roads) {
      const fromCentre = Math.hypot(s.x1, s.z1) < 1 || Math.hypot(s.x2, s.z2) < 1;
      expect(fromCentre).toBe(false);
      const dx = Math.abs(s.x2 - s.x1);
      const dz = Math.abs(s.z2 - s.z1);
      expect(dx < 0.2 || dz < 0.2, `diagonal road ${s.x1},${s.z1}→${s.x2},${s.z2}`).toBe(true);
    }
  });

  it('no road intersects a building footprint', () => {
    for (const s of roads) {
      for (const b of buildings) {
        expect(roadHitsBuilding(s, b, 0.4), `${b.id} vs ${s.x1.toFixed(0)},${s.z1.toFixed(0)}→${s.x2.toFixed(0)},${s.z2.toFixed(0)}`).toBe(false);
      }
    }
  });

  it('every shop/house faces a cardinal street (axis-aligned rot)', () => {
    for (const b of buildings) {
      if (b.id === 'play') continue; // round playground
      const cardinals = [0, Math.PI / 2, Math.PI, -Math.PI / 2, -Math.PI];
      const ok = cardinals.some((c) => Math.abs(Math.atan2(Math.sin(b.rot - c), Math.cos(b.rot - c))) < 0.05);
      expect(ok, `${b.id} rot=${b.rot}`).toBe(true);
      expect(b.rot).toBe(faceStreet(b.x, b.z));
    }
  });

  it('benches never sit on a road', () => {
    const benches = benchSpots(roads);
    expect(benches.length).toBeGreaterThanOrEqual(4);
    for (const b of benches) {
      expect(onRoad(b.x, b.z, roads, 0.9), `${b.x.toFixed(1)},${b.z.toFixed(1)}`).toBe(false);
    }
  });

  it('sit yaw faces away from the backrest for every bench', () => {
    const benches = benchSpots(roads);
    for (const b of benches) {
      expect(sitFacesAwayFromBackrest(b.yaw), `${b.x.toFixed(1)},${b.z.toFixed(1)}`).toBeLessThan(-0.2);
    }
  });
});

describe('bench sit facing math', () => {
  const angles = [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 2, 1.1, -2.4, 0.37, Math.PI * 1.5];

  it('forward vector is (sin, cos) for 0/90/180/270 and arbitrary angles', () => {
    for (const yaw of angles) {
      const f = benchForward(yaw);
      expect(f.x).toBeCloseTo(Math.sin(yaw), 10);
      expect(f.z).toBeCloseTo(Math.cos(yaw), 10);
      expect(Math.hypot(f.x, f.z)).toBeCloseTo(1, 10);
    }
  });

  it('backrest is always behind the sitter (dot with forward < 0)', () => {
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, ...angles]) {
      const f = benchForward(yaw);
      const back = benchBackrestOffset(yaw);
      const dot = f.x * back.x + f.z * back.z;
      expect(dot, `yaw=${yaw}`).toBeLessThan(-0.25);
      // avatar facing = forward ⇒ same yaw
      expect(sitFacesAwayFromBackrest(yaw)).toBeLessThan(-0.25);
    }
  });

  it('avatar facing equal to sitYaw means looking toward seat front, not into backrest', () => {
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const f = benchForward(yaw);
      const back = benchBackrestOffset(yaw, 0.48);
      // vector from sit toward backrest should be opposite forward
      expect(back.x).toBeCloseTo(-f.x * 0.48, 8);
      expect(back.z).toBeCloseTo(-f.z * 0.48, 8);
    }
  });
});

describe('house plots', () => {
  it('HOUSE_PLOTS clear of shops and playground (centres ≥ 22 m apart)', () => {
    const buildings = buildingsFromPlaces().filter((b) => b.id !== 'home');
    for (const plot of HOUSE_PLOTS) {
      for (const b of buildings) {
        const gap = Math.hypot(plot.x - b.x, plot.z - b.z) - Math.hypot(b.hw, b.hd) - 10;
        expect(gap, `plot ${plot.x},${plot.z} vs ${b.id}`).toBeGreaterThan(0);
      }
    }
  });
});
