import { button, el, sheet, toast } from '../ui/dom.ts';
import { cleanCode, isValidCode } from './codes.ts';
import { NAME_MAX, nameError } from './names.ts';
import { EMOTES, type EmoteId } from './protocol.ts';
import type { MpSession } from './session.ts';
import type { Avatar } from '../logic/avatar.ts';

const NAME_KEY = 'thomasverden-mp-name';

export function loadMpName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
export function saveMpName(n: string) {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    /* ignore */
  }
}

export function openMpSheet(
  session: MpSession,
  getAvatar: () => Avatar,
  getPlayerId: () => string,
  onChanged: () => void,
): void {
  if (session.code) {
    openInRoom(session, onChanged);
    return;
  }
  const s = sheet('Spill sammen 👫', '#3fa4ff');
  const nameIn = el('input', {
    class: 'field',
    type: 'text',
    maxlength: String(NAME_MAX),
    placeholder: 'Ditt navn',
    value: loadMpName(),
    autocomplete: 'nickname',
    spellcheck: 'false',
  }) as HTMLInputElement;
  const codeIn = el('input', {
    class: 'field mono',
    type: 'text',
    maxlength: '5',
    placeholder: 'Kode (f.eks. K7H2M)',
    spellcheck: 'false',
    autocomplete: 'off',
  }) as HTMLInputElement;
  codeIn.style.textTransform = 'uppercase';
  codeIn.style.letterSpacing = '0.15em';
  codeIn.style.textAlign = 'center';
  codeIn.style.fontSize = '22px';

  const err = el('p', { class: 'mp-err' }, '');
  const setErr = (t: string) => {
    err.textContent = t;
  };

  const start = (mode: 'create' | 'join') => {
    const ne = nameError(nameIn.value);
    if (ne) {
      setErr(ne);
      return;
    }
    saveMpName(nameIn.value.trim());
    if (mode === 'create') {
      const code = session.createRoom(nameIn.value, getAvatar(), getPlayerId());
      if (!code) {
        setErr('Ugyldig navn.');
        return;
      }
      s.close();
      toast(`Rom laget! Kode: ${code}`, 'gold');
      onChanged();
      openInRoom(session, onChanged);
      return;
    }
    const code = cleanCode(codeIn.value);
    if (!isValidCode(code)) {
      setErr('Skriv en kode på 5 tegn.');
      return;
    }
    if (!session.joinRoom(code, nameIn.value, getAvatar(), getPlayerId())) {
      setErr('Klarte ikke å bli med.');
      return;
    }
    s.close();
    toast(`Kobler til ${code}…`);
    onChanged();
  };

  s.body.append(
    el('p', { class: 'hint' }, 'Lag et rom og del koden med en venn, eller skriv inn en kode for å bli med. Maks 8 spillere. Husene er private.'),
    el('label', { class: 'mp-label' }, 'Navn', nameIn),
    el(
      'div',
      { class: 'row' },
      button('Lag rom', () => start('create'), 'btn big green'),
    ),
    el('hr', { class: 'mp-hr' }),
    el('label', { class: 'mp-label' }, 'Har du en kode?', codeIn),
    el('div', { class: 'row' }, button('Bli med', () => start('join'), 'btn big')),
    err,
  );
  nameIn.focus();
}

function openInRoom(session: MpSession, onChanged: () => void) {
  const s = sheet('Spill sammen 👫', '#54c45e');
  const codeEl = el('div', { class: 'mp-code' }, session.code ?? '—');
  const status = el('p', { class: 'hint' }, statusText(session));
  const copy = () => {
    const c = session.code;
    if (!c) return;
    void navigator.clipboard?.writeText(c).then(
      () => toast('Kode kopiert!'),
      () => toast(c, 'gold'),
    );
  };
  s.body.append(
    el('p', { class: 'hint' }, `Du er ${session.youName ?? ''}. Del koden med vennene dine:`),
    codeEl,
    el('div', { class: 'row' }, button('Kopier kode', copy, 'btn'), button('Forlat rom', () => {
      session.leave();
      s.close();
      toast('Du forlot rommet.');
      onChanged();
    }, 'btn grey')),
    status,
    el('p', { class: 'hint' }, 'Tips: trykk på smilefjeset for å sende en reaksjon.'),
  );
}

function statusText(session: MpSession): string {
  const n = session.remotes.size + (session.youId ? 1 : 0);
  const st = session.transport.status;
  if (st === 'connecting') return 'Kobler til…';
  if (st === 'error') return 'Fikk ikke kontakt. Prøver på nytt…';
  if (st === 'open') return `${n} spiller${n === 1 ? '' : 'e'} i rommet.`;
  return 'Ikke tilkoblet.';
}

export function openEmotePicker(session: MpSession): void {
  if (!session.active) {
    toast('Bli med i et rom først.', 'bad');
    return;
  }
  const s = sheet('Reaksjon', '#ff8fb1', undefined, 'emote-sheet');
  const grid = el('div', { class: 'emote-grid' });
  for (const e of EMOTES) {
    grid.append(
      button(
        el('span', { class: 'emote-btn' }, el('span', { class: 'emote-emoji' }, e.emoji), el('small', {}, e.label)),
        () => {
          session.sendEmote(e.id as EmoteId);
          s.close();
        },
        'btn emote',
      ),
    );
  }
  s.body.append(grid);
}
