# UAT – Thomas-verden v5

Kort sjekkliste før publisering. Test på iPhone/iPad Safari om mulig.

## Multiplayer
- [ ] 1. Venners hus på tomtene viser riktig hustype (ikke tilfeldig stil)
- [ ] 1b. Når du besøker et hus (etter at eieren sier ja), ser du møblene deres
- [ ] 8. Besøk: stå ved vennens dør → «Besøk …» → eier får Ja/Nei (ingen chat)

## Kjøretøy
- [ ] 2. Kjøp bil i Bilbutikk → «Kjør» / 🚗-knapp; kjør rundt i byen; Parkér
- [ ] 3. Kjøp vogn i Dyrebutikk, ta med dyr → «Vogn»; dyret sitter i vogna

## Verden
- [ ] 4. Himmel/lys skifter (morgen/dag/kveld/natt); regn av og til
- [ ] 5. Lekeplass: trampoline + boble-/sparkball-minispill
- [ ] 6. Lyder endrer seg i by / hus / lekeplass / butikk (med 🔊 på)
- [ ] 7. På torget: «Start fest» → dansefest eller parade (synlig for andre)

## Generelt
- [ ] Touch: joystick + hopp + nye knapper (Kjør/Vogn/Fest) på iPad
- [ ] Multiplayer: lag rom, del kode, se hverandre med husstil/bil/vogn
- [ ] Lagring: biler/vogner i sekken huskes etter refresh
- [ ] PWA: lukk og åpne appen for oppdatering etter deploy

## Kjente begrensninger
- Worker deployes ikke fra denne branchen (kun push av `feat/v5` når Thomas godkjenner)
- Besøk er lese-modus (gjest bygger ikke i andres hus)
- Prod-avhengigheter: sjekk `npm audit --omit=dev` (skal være 0)
