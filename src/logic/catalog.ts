import type { CareWhere } from './needs.ts';

export type FurnCat = 'sove' | 'bad' | 'kjokken' | 'stue' | 'lek' | 'pynt' | 'lys' | 'planter' | 'vegg' | 'gulv';

export const FURN_CATS: { id: FurnCat; label: string; emoji: string }[] = [
  { id: 'sove', label: 'Soverom', emoji: '🛏️' },
  { id: 'bad', label: 'Bad', emoji: '🛁' },
  { id: 'kjokken', label: 'Kjøkken', emoji: '🍳' },
  { id: 'stue', label: 'Stue', emoji: '🛋️' },
  { id: 'lek', label: 'Lek', emoji: '🧸' },
  { id: 'pynt', label: 'Pynt', emoji: '🎈' },
  { id: 'lys', label: 'Lys', emoji: '💡' },
  { id: 'planter', label: 'Planter', emoji: '🪴' },
  { id: 'vegg', label: 'Vegg', emoji: '🖼️' },
  { id: 'gulv', label: 'Tepper', emoji: '🟪' },
];

export interface Furniture {
  id: string;
  name: string;
  cat: FurnCat;
  price: number;
  /** Procedural 3D model key. */
  model: string;
  color: string;
  /** Rough footprint (m) for picking and spacing. */
  size: number;
  /** Pets can get this kind of care next to it. */
  care?: CareWhere;
  /** Hangs on the nearest wall. */
  wall?: boolean;
}

const F = (id: string, name: string, cat: FurnCat, price: number, model: string, color: string, size: number, extra: Partial<Furniture> = {}): Furniture => ({ id, name, cat, price, model, color, size, ...extra });

export const FURNITURE: Furniture[] = [
  // Soverom
  F('seng', 'Seng', 'sove', 30, 'bed', '#8fb8ff', 2.2, { care: 'seng' }),
  F('dobbeltseng', 'Dobbeltseng', 'sove', 60, 'bedwide', '#ff8fb1', 2.6, { care: 'seng' }),
  F('koyeseng', 'Køyeseng', 'sove', 70, 'bunk', '#7ccf6a', 2.2, { care: 'seng' }),
  F('himmelseng', 'Himmelseng', 'sove', 120, 'canopy', '#ffa6d5', 2.6, { care: 'seng' }),
  F('stjerneseng', 'Stjerneseng', 'sove', 140, 'starbed', '#7b8cff', 2.4, { care: 'seng' }),
  F('dyreseng', 'Dyrekurv', 'sove', 20, 'petbed', '#ffb84d', 1.2, { care: 'seng' }),
  F('hengekoye', 'Hengekøye', 'sove', 50, 'hammock', '#ff6f6f', 2.6, { care: 'seng' }),
  // Bad
  F('badekar', 'Badekar', 'bad', 40, 'bathtub', '#ffffff', 2.0, { care: 'bad' }),
  F('dusj', 'Dusj', 'bad', 45, 'shower', '#bfe9ff', 1.3, { care: 'bad' }),
  F('boblebad', 'Boblebad', 'bad', 150, 'hottub', '#5cc3f2', 2.4, { care: 'bad' }),
  F('toalett', 'Toalett', 'bad', 15, 'toilet', '#ffffff', 1.0),
  F('vask', 'Vask', 'bad', 15, 'sink', '#ffffff', 1.0),
  F('badematte', 'Badematte', 'bad', 6, 'rugrect', '#9ad8c8', 1.4),
  F('speil', 'Speil', 'bad', 20, 'mirror', '#d8f0ff', 1.0, { wall: true }),
  // Kjøkken
  F('kjoleskap', 'Kjøleskap', 'kjokken', 35, 'fridge', '#ffffff', 1.2),
  F('komfyr', 'Komfyr', 'kjokken', 35, 'stove', '#e8e8f0', 1.1),
  F('benk', 'Kjøkkenbenk', 'kjokken', 25, 'counter', '#ffd6a8', 1.4),
  F('spisebord', 'Spisebord', 'kjokken', 30, 'table', '#d9a066', 2.0),
  F('kjokkenstol', 'Stol', 'kjokken', 10, 'chair', '#7fc8ff', 0.9),
  F('krakk', 'Krakk', 'kjokken', 8, 'stool', '#ff8fb1', 0.7),
  F('matskal', 'Matskål', 'kjokken', 8, 'bowl', '#ff6f6f', 0.7),
  F('vannskal', 'Vannskål', 'kjokken', 8, 'waterbowl', '#5cc3f2', 0.7),
  // Stue
  F('sofa', 'Sofa', 'stue', 45, 'sofa', '#ff8fb1', 2.4),
  F('langsofa', 'Langsofa', 'stue', 70, 'sofalong', '#8fa8ff', 3.2),
  F('lenestol', 'Lenestol', 'stue', 30, 'armchair', '#ffb84d', 1.3),
  F('sacco', 'Saccosekk', 'stue', 15, 'beanbag', '#b78bff', 1.2),
  F('salongbord', 'Salongbord', 'stue', 20, 'coffeetable', '#c98a55', 1.5),
  F('tv', 'TV', 'stue', 60, 'tv', '#555a75', 1.6),
  F('bokhylle', 'Bokhylle', 'stue', 30, 'bookshelf', '#c98a55', 1.6),
  F('klesskap', 'Klesskap', 'stue', 40, 'wardrobe', '#9ad8c8', 1.6),
  F('kommode', 'Kommode', 'stue', 25, 'dresser', '#ffe066', 1.4),
  F('peis', 'Peis', 'stue', 90, 'fireplace', '#d97b5b', 1.8),
  F('piano', 'Piano', 'stue', 110, 'piano', '#2f3550', 1.8, { care: 'lek' }),
  // Lek
  F('ball', 'Ball', 'lek', 5, 'ball', '#ff6f6f', 0.6, { care: 'lek' }),
  F('lekekasse', 'Lekekasse', 'lek', 15, 'toybox', '#5cc3f2', 1.2, { care: 'lek' }),
  F('sklie', 'Sklie', 'lek', 60, 'slide', '#ffe066', 2.6, { care: 'lek' }),
  F('trampoline', 'Trampoline', 'lek', 70, 'trampoline', '#7ccf6a', 2.4, { care: 'lek' }),
  F('dukkehus', 'Dukkehus', 'lek', 40, 'dollhouse', '#ffa6d5', 1.4),
  F('gyngehest', 'Gyngehest', 'lek', 35, 'rockinghorse', '#ffb84d', 1.4, { care: 'lek' }),
  F('kloretre', 'Klatretre for dyr', 'lek', 45, 'cattree', '#d9a066', 1.4, { care: 'lek' }),
  F('basseng', 'Basseng', 'lek', 90, 'pool', '#5cc3f2', 3.0, { care: 'bad' }),
  F('ballbinge', 'Ballbinge', 'lek', 80, 'ballpit', '#c88bff', 2.6, { care: 'lek' }),
  // Pynt
  F('ballonger', 'Ballonger', 'pynt', 10, 'balloons', '#ff6fa8', 0.8),
  F('gave', 'Gavepakke', 'pynt', 8, 'gift', '#ff6f6f', 0.7),
  F('bamse', 'Bamse', 'pynt', 15, 'teddy', '#c98a55', 0.8),
  F('globus', 'Globus', 'pynt', 20, 'globe', '#5cc3f2', 0.8),
  F('akvarium', 'Akvarium', 'pynt', 55, 'aquarium', '#7fd8ff', 1.4),
  F('discokule', 'Discokule', 'pynt', 50, 'discoball', '#d8e6ff', 1.0),
  F('regnbue', 'Regnbue', 'pynt', 40, 'rainbow', '#ff6f6f', 2.0),
  F('stjerne', 'Stor stjerne', 'pynt', 25, 'star', '#ffe066', 1.0),
  F('hjertepute', 'Hjertepute', 'pynt', 8, 'heart', '#ff5a8a', 0.7),
  F('vase', 'Blomstervase', 'pynt', 12, 'vase', '#c88bff', 0.6),
  F('kake', 'Bursdagskake', 'pynt', 20, 'cake', '#ffc6e3', 0.8),
  // Lys
  F('gulvlampe', 'Gulvlampe', 'lys', 20, 'floorlamp', '#ffd84d', 0.8),
  F('bordlampe', 'Liten lampe', 'lys', 12, 'tablelamp', '#ff8fb1', 0.6),
  F('lavalampe', 'Lavalampe', 'lys', 25, 'lavalamp', '#c88bff', 0.5),
  F('stearinlys', 'Stearinlys', 'lys', 6, 'candles', '#fff4c2', 0.5),
  F('lysslynge', 'Lysslynge', 'lys', 30, 'lights', '#fff27a', 2.4, { wall: true }),
  F('neonhjerte', 'Neonhjerte', 'lys', 35, 'neonheart', '#ff4fa8', 1.0, { wall: true }),
  // Planter
  F('potteplante', 'Potteplante', 'planter', 8, 'plant', '#5cc36b', 0.7),
  F('kaktus', 'Kaktus', 'planter', 8, 'cactus', '#4caf50', 0.6),
  F('palme', 'Palme', 'planter', 30, 'palm', '#3fbf5a', 1.4),
  F('solsikke', 'Solsikke', 'planter', 10, 'sunflower', '#ffd23f', 0.6),
  F('innetre', 'Lite tre', 'planter', 25, 'tree', '#5cc36b', 1.2),
  F('blomsterkasse', 'Blomsterkasse', 'planter', 15, 'flowerbox', '#ff8fb1', 1.2),
  // Vegg
  F('maleri', 'Maleri', 'vegg', 15, 'painting', '#ffb84d', 1.2, { wall: true }),
  F('klokke', 'Klokke', 'vegg', 15, 'clock', '#ff8fb1', 0.8, { wall: true }),
  F('vegghylle', 'Vegghylle', 'vegg', 12, 'shelf', '#c98a55', 1.2, { wall: true }),
  F('plakat', 'Enhjørningplakat', 'vegg', 10, 'poster', '#c88bff', 1.0, { wall: true }),
  F('vindu', 'Vindu', 'vegg', 20, 'window', '#bfe9ff', 1.4, { wall: true }),
  // Tepper
  F('rundtteppe', 'Rundt teppe', 'gulv', 10, 'ruground', '#ff9ccf', 2.2),
  F('teppe', 'Stort teppe', 'gulv', 15, 'rugrect', '#8fa8ff', 3.0),
  F('regnbueteppe', 'Regnbueteppe', 'gulv', 25, 'rugrainbow', '#ff6f6f', 2.6),
  F('dansegulv', 'Dansegulv', 'gulv', 80, 'dancefloor', '#c88bff', 3.0, { care: 'lek' }),
];
export const FURN_BY_ID: Record<string, Furniture> = Object.fromEntries(FURNITURE.map((f) => [f.id, f]));

export interface FoodItem {
  id: string;
  name: string;
  emoji: string;
  price: number;
  fixes: 'mat' | 'drikke';
}
export const FOODS: FoodItem[] = [
  { id: 'eple', name: 'Eple', emoji: '🍎', price: 3, fixes: 'mat' },
  { id: 'gulrot', name: 'Gulrot', emoji: '🥕', price: 3, fixes: 'mat' },
  { id: 'brod', name: 'Brødskive', emoji: '🍞', price: 4, fixes: 'mat' },
  { id: 'pizza', name: 'Pizza', emoji: '🍕', price: 8, fixes: 'mat' },
  { id: 'kakestykke', name: 'Kake', emoji: '🍰', price: 10, fixes: 'mat' },
  { id: 'is', name: 'Is', emoji: '🍦', price: 6, fixes: 'mat' },
  { id: 'vann', name: 'Vann', emoji: '💧', price: 2, fixes: 'drikke' },
  { id: 'melk', name: 'Melk', emoji: '🥛', price: 3, fixes: 'drikke' },
  { id: 'juice', name: 'Juice', emoji: '🧃', price: 5, fixes: 'drikke' },
  { id: 'smoothie', name: 'Smoothie', emoji: '🥤', price: 7, fixes: 'drikke' },
];
export const FOOD_BY_ID: Record<string, FoodItem> = Object.fromEntries(FOODS.map((f) => [f.id, f]));

export interface Potion {
  id: 'flygedrikk' | 'ridedrikk';
  name: string;
  emoji: string;
  price: number;
  text: string;
}
export const POTIONS: Potion[] = [
  { id: 'ridedrikk', name: 'Ridedrikk', emoji: '🧪', price: 0, text: 'Gjør et dyr til et ridedyr (finnes hos flygedyr)' },
  { id: 'flygedrikk', name: 'Flygedrikk', emoji: '🪽', price: 0, text: 'Gjør et dyr til et flygedyr (finnes hos flygedyr)' },
];

export type HouseStyle = 'hytte' | 'villa' | 'gard' | 'slott' | 'moderne' | 'trehus' | 'sjohus';
export const HOUSES: { style: HouseStyle; name: string; price: number; w: number; d: number; wall: string; roof: string; text: string }[] = [
  { style: 'hytte', name: 'Solcellehus', price: 0, w: 22, d: 18, wall: '#f2f6fb', roof: '#1a3358', text: 'Ditt første hjem: 2 etasjer og 6 rom' },
  { style: 'villa', name: 'Glassvilla', price: 600, w: 26, d: 20, wall: '#e8f0ff', roof: '#1a3358', text: 'Stor villa med glass og tre' },
  { style: 'gard', name: 'Teknogård', price: 900, w: 30, d: 22, wall: '#efe6d8', roof: '#1a3358', text: 'Plass til masse dyr, 2 etasjer' },
  { style: 'moderne', name: 'Kurvehjem', price: 1200, w: 14, d: 11, wall: '#f8fafc', roof: '#1a3358', text: 'Hvite kurver og store vinduer' },
  { style: 'trehus', name: 'Trepanelhus', price: 750, w: 24, d: 18, wall: '#c4a574', roof: '#1a3358', text: 'Varmt trepanel med soltak' },
  { style: 'sjohus', name: 'Havkapsel', price: 1400, w: 26, d: 20, wall: '#d6ecff', roof: '#1a3358', text: 'Blått hus ved vannet' },
  { style: 'slott', name: 'Tårnkompleks', price: 1800, w: 34, d: 26, wall: '#eef2f8', roof: '#1a3358', text: 'Høye tårn med glassheis-følelse' },
];
export const HOUSE_BY_STYLE = Object.fromEntries(HOUSES.map((h) => [h.style, h])) as Record<HouseStyle, (typeof HOUSES)[number]>;

export const PALETTE = ['#ff6f6f', '#ff8fb1', '#ffa6d5', '#ffb84d', '#ffe066', '#7ccf6a', '#9ad8c8', '#5cc3f2', '#8fa8ff', '#c88bff', '#ffffff', '#d9a066', '#8a5a3c', '#555a75', '#2b2b38'];
export const WALL_COLORS = ['#f2f6fb', '#e8f0ff', '#efe6d8', '#e6f4ea', '#f3e8ff', '#eef2f8', '#d6ecff', '#d6f5ef', '#f0e8f4', '#c9d8ff'];
export const FLOOR_COLORS = ['#c4a574', '#9a7a55', '#d8dee8', '#e8eef6', '#cfe8ff', '#d7f5c6', '#e6e6ee', '#b8c0d0', '#3a4555'];

export type ToyPlay = 'fetch' | 'chase' | 'cuddle';
export interface Toy {
  id: string;
  name: string;
  emoji: string;
  price: number;
  play: ToyPlay;
  /** Shown in the shop and in the backpack. */
  text: string;
  /** What the pet is doing, for the toast. */
  verb: string;
}
/** Toys stay in the backpack when you use them (they are not eaten). */
export const TOYS: Toy[] = [
  { id: 'leke-ball', name: 'Ball', emoji: '⚽', price: 6, play: 'fetch', text: 'Kast den – dyret henter!', verb: 'henter ballen' },
  { id: 'leke-pinne', name: 'Pinne', emoji: '🪵', price: 4, play: 'fetch', text: 'Kast pinnen langt av gårde', verb: 'henter pinnen' },
  { id: 'leke-bamse', name: 'Kosebamse', emoji: '🧸', price: 12, play: 'cuddle', text: 'Å kose med og sove ved', verb: 'koser med bamsen' },
  { id: 'leke-garn', name: 'Garnnøste', emoji: '🧶', price: 7, play: 'chase', text: 'Ruller rundt – dyret jager det', verb: 'jager garnnøstet' },
];
export const TOY_BY_ID: Record<string, Toy> = Object.fromEntries(TOYS.map((t) => [t.id, t]));
/** What every new player starts with in the backpack. */
export const STARTER_TOYS = ['leke-ball', 'leke-garn'] as const;

/** Items sold in the pet shop (dyrebutikk): prams and pet toys. */
export interface PetShopItem {
  id: string;
  name: string;
  emoji: string;
  price: number;
  kind: 'vogn' | 'dyreleke';
  text: string;
}
export const PET_SHOP: PetShopItem[] = [
  { id: 'vogn-rosa', name: 'Rosa vogn', emoji: '🍼', price: 80, kind: 'vogn', text: 'Koselig barnevogn til dyrene' },
  { id: 'vogn-blaa', name: 'Blå vogn', emoji: '🩵', price: 80, kind: 'vogn', text: 'Luftig vogn for små dyr' },
  { id: 'vogn-gull', name: 'Gullvogn', emoji: '✨', price: 200, kind: 'vogn', text: 'Eksklusiv vogn med glitter' },
  { id: 'dyreleke-mus', name: 'Lekemus', emoji: '🐭', price: 15, kind: 'dyreleke', text: 'En myk mus å jage' },
  { id: 'dyreleke-tau', name: 'Tauleke', emoji: '🪢', price: 12, kind: 'dyreleke', text: 'Tau å tygge og trekke i' },
  { id: 'dyreleke-fjols', name: 'Fjølsball', emoji: '🎾', price: 10, kind: 'dyreleke', text: 'Softball som piper' },
  { id: 'dyreleke-tunnel', name: 'Leketunnel', emoji: '🌀', price: 35, kind: 'dyreleke', text: 'En tunnel å løpe gjennom' },
];
export const PET_SHOP_BY_ID = Object.fromEntries(PET_SHOP.map((i) => [i.id, i]));

/** Cars sold in the car shop (bilbutikk). */
export interface CarItem {
  id: string;
  name: string;
  emoji: string;
  price: number;
  color: string;
  text: string;
}
export const CARS: CarItem[] = [
  { id: 'bil-rosa', name: 'Rosa svevebil', emoji: '🚗', price: 250, color: '#e8a0b8', text: 'Åpen svevebil med glasskuppel' },
  { id: 'bil-gul', name: 'Gul kapsel', emoji: '🚕', price: 250, color: '#c9b86a', text: 'Rund svevekapsel – kompakt og rask' },
  { id: 'bil-bla', name: 'Blå fraktebil', emoji: '🚙', price: 300, color: '#6a90a8', text: 'Høy svevebil med masse plass' },
  { id: 'bil-gronn', name: 'Grønn terrengsvever', emoji: '🛻', price: 280, color: '#5a8a62', text: 'Terrengsvever med lysbar' },
  { id: 'bil-lilla', name: 'Lilla sportssvever', emoji: '🏎️', price: 400, color: '#8a90a8', text: 'Lav sportssvever med spoiler' },
];
export const CAR_BY_ID = Object.fromEntries(CARS.map((c) => [c.id, c]));
