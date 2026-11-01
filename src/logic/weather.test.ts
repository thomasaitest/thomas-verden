import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, skyAt, skyLabel, weatherAt } from './weather.ts';

describe('weather / always day', () => {
  it('never goes dark – noon and former midnight are both bright day', () => {
    const noon = skyAt(DAY_SECONDS * 0.5);
    const wasMidnight = skyAt(0);
    const late = skyAt(DAY_SECONDS * 0.95);
    for (const s of [noon, wasMidnight, late]) {
      expect(s.daylight).toBeGreaterThan(0.8);
      expect(s.sunIntensity).toBeGreaterThan(1);
      expect(skyLabel(s)).not.toMatch(/Natt/);
      expect(skyLabel(s)).toMatch(/^Dag/);
    }
  });
  it('picks weather slots', () => {
    expect(['clear', 'cloudy', 'rain']).toContain(weatherAt(0));
    expect(skyLabel(skyAt(10))).toMatch(/Sol|Skyet|Regn/);
  });
});
