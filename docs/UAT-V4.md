# UAT – Thomas-verden v4

Kort sjekkliste før publisering. Test på iPhone/iPad Safari om mulig.

## Bugfiks
- [ ] 1. Taket på huset ser riktig ut utenfra (ingen hull/z-fighting), og tak/taket er lukket oppe inne
- [ ] 4. Avatar går ikke gjennom trær, lamper, benker, fontene, butikker, lekeplass, gjerder, møbler
- [ ] 5. Inne i huset ser du ikke spillere som står ute (og omvendt)
- [ ] 7. Kart viser vei til lekeplassen; ingen lykt midt i veien
- [ ] 13. Når noen rir på hest/ponni, sitter de på dyret hos andre spillere (ikke ved siden av)
- [ ] 14. Bytte av avatar midt i spillet synes hos andre i rommet med en gang

## Nytt
- [ ] 2. Flere hustyper; kan kjøpe/bytte hus via Kart mens du spiller
- [ ] 3. Hver spiller har sitt hus/tomt i nabolaget (multiplayer)
- [ ] 6. Benker har bein; «Sett deg» fyller energi (⚡)
- [ ] 8. Bilbutikk og dyrebutikk (vogner + dyreleker) – gå inn og handle
- [ ] 9. Hopp (⬆ / space): over benker, opp på fontenen
- [ ] 10. Flere antrekk (ferdige presets + nye hatter/ting)
- [ ] 11. Luftigere trær, noen pastell-lilla

## Generelt
- [ ] Touch: joystick + hopp-knapp fungerer på iPad
- [ ] Multiplayer: lag rom, del kode, se hverandre
- [ ] Lagring: husvalg og kjøp huskes etter refresh
- [ ] PWA: lukk og åpne appen for å få oppdatering etter deploy

## Kjente begrensninger
- Worker deployes ikke fra denne branchen (kun push av `feat/v4`)
- Prod-avhengigheter: 0 sårbarheter (app + server). Dev-only: vitest/tinypool, vite-plugin-pwa (workbox) – ikke i live-build
