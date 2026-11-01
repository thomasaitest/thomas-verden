import { pick, type Rng } from './rng.ts';

export const SKIN = ['#ffe0c7', '#f9d1b0', '#eab48c', '#d79a6b', '#b77a4f', '#8d5a3b', '#5e3b26', '#ffd84d', '#b6e3a1', '#a6d0ff', '#e0b8ff', '#ffb3d1'];
/** Natural skin tones (the first ones in SKIN); the rest are for fun. */
export const NATURAL_SKIN = 7;
export const HAIR_STYLES = [
  { id: 'ingen', name: 'Skallet' },
  { id: 'kort', name: 'Kort' },
  { id: 'lang', name: 'Langt' },
  { id: 'hestehale', name: 'Hestehale' },
  { id: 'fletter', name: 'Musefletter' },
  { id: 'bob', name: 'Pasje' },
  { id: 'krus', name: 'Krøller' },
  { id: 'piggete', name: 'Piggete' },
  { id: 'afro', name: 'Afro' },
  { id: 'totter', name: 'Totter' },
  { id: 'sidefletter', name: 'Sidefletter' },
  { id: 'lugg', name: 'Lugg' },
  { id: 'topknott', name: 'Topknott' },
  { id: 'hanekam', name: 'Hanekam' },
] as const;
export const HAIR_COLORS = ['#2b2118', '#5b3a29', '#a0632f', '#e0a64f', '#fff0a8', '#ff6f6f', '#ff8fc7', '#c88bff', '#5cc3f2', '#7ccf6a', '#ffffff', '#ff9f43', '#3ad6b4', '#8a2be2', '#1f3fff', '#9aa0b5', '#7a2f2f'];
export const FACES = [
  { id: 'smil', name: 'Smil' },
  { id: 'glad', name: 'Glad' },
  { id: 'blunk', name: 'Blunk' },
  { id: 'katt', name: 'Kattemunn' },
  { id: 'rodme', name: 'Rødmer' },
  { id: 'kul', name: 'Kul' },
  { id: 'wow', name: 'Wow' },
  { id: 'tunge', name: 'Tunge ut' },
  { id: 'sovnig', name: 'Søvnig' },
  { id: 'stjerneoyne', name: 'Stjerneøyne' },
  { id: 'hjerteoyne', name: 'Hjerteøyne' },
  { id: 'fregner', name: 'Fregner' },
  { id: 'sur', name: 'Sur' },
] as const;
export const CLOTH_COLORS = ['#ff6f6f', '#ff8fb1', '#ffa6d5', '#ffb84d', '#ffe066', '#7ccf6a', '#9ad8c8', '#5cc3f2', '#3f6fd8', '#c88bff', '#ffffff', '#555a75', '#2b2b38', '#8a5a3c', '#ff4f7f', '#2fbf8f', '#7a4dff', '#b8e0ff'];
export const SHIRT_PRINTS = [
  { id: 'ingen', name: 'Glatt' },
  { id: 'striper', name: 'Striper' },
  { id: 'hjerte', name: 'Hjerte' },
  { id: 'stjerne', name: 'Stjerne' },
  { id: 'pote', name: 'Pote' },
  { id: 'regnbue', name: 'Regnbue' },
  { id: 'blomst', name: 'Blomst' },
  { id: 'smiley', name: 'Smiley' },
  { id: 'lyn', name: 'Lyn' },
  { id: 'enhjorn', name: 'Enhjørning' },
  { id: 'hjerter', name: 'Hjerter' },
  { id: 'prikker', name: 'Prikker' },
  { id: 'katt', name: 'Katt' },
] as const;
export const BOTTOMS = [
  { id: 'bukse', name: 'Bukse' },
  { id: 'shorts', name: 'Shorts' },
  { id: 'skjort', name: 'Skjørt' },
  { id: 'miniskjort', name: 'Miniskjørt' },
  { id: 'langtskort', name: 'Langt skjørt' },
  { id: 'tutu', name: 'Tutu' },
  { id: 'plissert', name: 'Plissert skjørt' },
  { id: 'kjole', name: 'Kjole' },
  { id: 'ballkjole', name: 'Ballkjole' },
  { id: 'overall', name: 'Overall' },
  { id: 'jeans', name: 'Jeans' },
  { id: 'joggebukse', name: 'Joggebukse' },
] as const;
export const SHOES = [
  { id: 'sko', name: 'Sko' },
  { id: 'stovler', name: 'Støvler' },
  { id: 'sneakers', name: 'Joggesko' },
] as const;
export const HATS = [
  { id: 'ingen', name: 'Ingen' },
  { id: 'caps', name: 'Caps' },
  { id: 'krone', name: 'Krone' },
  { id: 'lue', name: 'Lue' },
  { id: 'katteorer', name: 'Katteører' },
  { id: 'kaninorer', name: 'Kaninører' },
  { id: 'cowboy', name: 'Cowboyhatt' },
  { id: 'blomster', name: 'Blomsterkrans' },
  { id: 'trollmann', name: 'Trollmannshatt' },
  { id: 'pirat', name: 'Piratlue' },
  { id: 'prinsesse', name: 'Prinsessehatt' },
  { id: 'festhatt', name: 'Festhatt' },
  { id: 'hodeband', name: 'Hodebånd' },
  { id: 'hjelm', name: 'Sykkelhjelm' },
  { id: 'kokkelue', name: 'Kokkelue' },
  { id: 'nisse', name: 'Nisselue' },
  { id: 'beret', name: 'Beret' },
  { id: 'enhjorn', name: 'Enhjørning' },
  { id: 'bandeau', name: 'Bandeau' },
  { id: 'frosk', name: 'Froskelu' },
] as const;
export const ACCESSORIES = [
  { id: 'ingen', name: 'Ingen' },
  { id: 'briller', name: 'Briller' },
  { id: 'vinger', name: 'Feevinger' },
  { id: 'vinger-engel', name: 'Englevinger' },
  { id: 'vinger-regnbue', name: 'Regnbuevinger' },
  { id: 'sekk', name: 'Ryggsekk' },
  { id: 'sekk-stjerne', name: 'Stjerneryggsekk' },
  { id: 'sekk-rosa', name: 'Rosa ryggsekk' },
  { id: 'skjerf', name: 'Skjerf' },
  { id: 'kappe', name: 'Kappe' },
  { id: 'glorie', name: 'Glorie' },
  { id: 'solbriller', name: 'Solbriller' },
  { id: 'hodetelefoner', name: 'Hodetelefoner' },
  { id: 'halskjede', name: 'Halskjede' },
  { id: 'perlekjede', name: 'Perlekjede' },
  { id: 'oreringer', name: 'Øreringer' },
  { id: 'armband', name: 'Armbånd' },
  { id: 'sommerfugl', name: 'Sommerfugl' },
  { id: 'maske', name: 'Maske' },
  { id: 'ballong', name: 'Ballong' },
  { id: 'veske', name: 'Veske' },
  { id: 'veske-hjerte', name: 'Hjerteveske' },
  { id: 'veske-gul', name: 'Gul veske' },
  { id: 'stjernekappe', name: 'Stjernekappe' },
  { id: 'skjerfstripete', name: 'Stripete skjerf' },
  { id: 'klokke', name: 'Klokke' },
] as const;

export interface Avatar {
  skin: string;
  hair: (typeof HAIR_STYLES)[number]['id'];
  hairColor: string;
  face: (typeof FACES)[number]['id'];
  shirt: string;
  print: (typeof SHIRT_PRINTS)[number]['id'];
  pants: string;
  bottom: (typeof BOTTOMS)[number]['id'];
  shoes: string;
  shoeStyle: (typeof SHOES)[number]['id'];
  hat: (typeof HATS)[number]['id'];
  accessory: (typeof ACCESSORIES)[number]['id'];
}

export const DEFAULT_AVATAR: Avatar = {
  skin: SKIN[1],
  hair: 'hestehale',
  hairColor: HAIR_COLORS[3],
  face: 'smil',
  shirt: '#ff8fb1',
  print: 'hjerte',
  pants: '#3f6fd8',
  bottom: 'bukse',
  shoes: '#ffffff',
  shoeStyle: 'sko',
  hat: 'ingen',
  accessory: 'ingen',
};


/** Ready-made outfits with thumbnails in the avatar editor. */
export const OUTFIT_PRESETS: { id: string; name: string; patch: Partial<Avatar> }[] = [
  { id: 'prinsesse', name: 'Prinsesse', patch: { hat: 'prinsesse', shirt: '#ffa6d5', print: 'hjerte', pants: '#c88bff', bottom: 'kjole', shoes: '#ffe066', shoeStyle: 'sko', accessory: 'glorie', hair: 'lang', hairColor: '#e0a64f' } },
  { id: 'ridder', name: 'Ridder', patch: { hat: 'hjelm', shirt: '#555a75', print: 'ingen', pants: '#2b2b38', bottom: 'bukse', shoes: '#2b2b38', shoeStyle: 'stovler', accessory: 'kappe', hair: 'kort', hairColor: '#2b2118' } },
  { id: 'pirat', name: 'Pirat', patch: { hat: 'pirat', shirt: '#ff6f6f', print: 'ingen', pants: '#2b2b38', bottom: 'bukse', shoes: '#8a5a3c', shoeStyle: 'stovler', accessory: 'ingen', hair: 'piggete', hairColor: '#2b2118' } },
  { id: 'trollmann', name: 'Trollmann', patch: { hat: 'trollmann', shirt: '#7a4dff', print: 'stjerne', pants: '#2b2b38', bottom: 'bukse', shoes: '#c88bff', shoeStyle: 'sko', accessory: 'stjernekappe', hair: 'lang', hairColor: '#ffffff' } },
  { id: 'sporty', name: 'Sporty', patch: { hat: 'caps', shirt: '#5cc3f2', print: 'lyn', pants: '#3f6fd8', bottom: 'shorts', shoes: '#ffffff', shoeStyle: 'sneakers', accessory: 'hodetelefoner', hair: 'kort', hairColor: '#5b3a29' } },
  { id: 'fe', name: 'Fe', patch: { hat: 'blomster', shirt: '#e0b8ff', print: 'blomst', pants: '#ffa6d5', bottom: 'kjole', shoes: '#ffffff', shoeStyle: 'sko', accessory: 'vinger', hair: 'fletter', hairColor: '#c88bff' } },
  { id: 'kokk', name: 'Kokk', patch: { hat: 'kokkelue', shirt: '#ffffff', print: 'ingen', pants: '#555a75', bottom: 'bukse', shoes: '#2b2b38', shoeStyle: 'sko', accessory: 'ingen', hair: 'kort', hairColor: '#a0632f' } },
  { id: 'enhjorn', name: 'Enhjørning', patch: { hat: 'enhjorn', shirt: '#ff8fb1', print: 'enhjorn', pants: '#c88bff', bottom: 'overall', shoes: '#ffe066', shoeStyle: 'sneakers', accessory: 'sommerfugl', hair: 'lang', hairColor: '#ff8fc7' } },
  { id: 'ballerina', name: 'Ballerina', patch: { hat: 'bandeau', shirt: '#ffa6d5', print: 'ingen', pants: '#ff8fb1', bottom: 'tutu', shoes: '#ffffff', shoeStyle: 'sko', accessory: 'vinger-engel', hair: 'bob', hairColor: '#2b2118' } },
  { id: 'shopper', name: 'Shopper', patch: { hat: 'ingen', shirt: '#ffe066', print: 'hjerte', pants: '#ff4f7f', bottom: 'miniskjort', shoes: '#ffffff', shoeStyle: 'sneakers', accessory: 'veske-hjerte', hair: 'hestehale', hairColor: '#a0632f' } },
];

export function randomAvatar(rng: Rng): Avatar {
  return {
    skin: pick(rng() < 0.9 ? SKIN.slice(0, NATURAL_SKIN) : SKIN.slice(NATURAL_SKIN), rng),
    hair: pick(HAIR_STYLES.slice(1), rng).id,
    hairColor: pick(HAIR_COLORS, rng),
    face: pick(FACES, rng).id,
    shirt: pick(CLOTH_COLORS, rng),
    print: pick(SHIRT_PRINTS, rng).id,
    pants: pick(CLOTH_COLORS, rng),
    bottom: pick(BOTTOMS, rng).id,
    shoes: pick(CLOTH_COLORS, rng),
    shoeStyle: pick(SHOES, rng).id,
    hat: rng() < 0.5 ? 'ingen' : pick(HATS, rng).id,
    accessory: rng() < 0.6 ? 'ingen' : pick(ACCESSORIES, rng).id,
  };
}

const isColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const oneOf = <T extends { id: string }>(list: readonly T[], v: unknown, fallback: T['id']): T['id'] => (list.some((o) => o.id === v) ? (v as T['id']) : fallback);

/** Repair an avatar from storage; unknown parts fall back to defaults. */
export function cleanAvatar(raw: unknown): Avatar {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_AVATAR;
  return {
    skin: isColor(a.skin) ? a.skin : d.skin,
    hair: oneOf(HAIR_STYLES, a.hair, d.hair),
    hairColor: isColor(a.hairColor) ? a.hairColor : d.hairColor,
    face: oneOf(FACES, a.face, d.face),
    shirt: isColor(a.shirt) ? a.shirt : d.shirt,
    print: oneOf(SHIRT_PRINTS, a.print, d.print),
    pants: isColor(a.pants) ? a.pants : d.pants,
    bottom: oneOf(BOTTOMS, a.bottom, d.bottom),
    shoes: isColor(a.shoes) ? a.shoes : d.shoes,
    shoeStyle: oneOf(SHOES, a.shoeStyle, d.shoeStyle),
    hat: oneOf(HATS, a.hat, d.hat),
    accessory: oneOf(ACCESSORIES, a.accessory, d.accessory),
  };
}
