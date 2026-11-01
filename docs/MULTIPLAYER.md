# Flerspiller (web)

Thomas-verden kan spilles sammen i et privat rom via en Cloudflare Worker med Durable Objects (WebSocket). Enspilleren fungerer som før når du ikke er i et rom, eller hvis serveren er nede.

## Hva som deles (v1)

- Avatar, visningsnavn, posisjon/retning/animasjon i byen
- Dyret som følger deg
- Bruk av lekeapparater
- Faste reaksjoner (emoji)
- Spillere inne i butikk/sykehus synes; inne i **eget hus** forsvinner de for de andre

Hus, møblering, bucks og lagring er fortsatt bare lokalt på enheten.

## Lokalt (utvikling)

```bash
# Terminal 1 – multiplayer-server
cd server && npm install && npm run dev
# lytter på ws://127.0.0.1:8787

# Terminal 2 – spillet
cd .. && npm run dev
# http://127.0.0.1:4740  (VITE_MP_URL fra .env.development)
```

Åpne to vinduer, trykk **Sammen** → **Lag rom** / **Bli med**.

## Produksjon

- Worker: `https://thomas-verden-mp.heddasverden.workers.dev` (WSS: `wss://thomas-verden-mp.heddasverden.workers.dev`)
- WebSocket godtas bare fra Origin `https://thomasaitest.github.io` (og localhost for lokal utvikling).

## Det Thomas må gjøre for hosting

1. **Cloudflare-konto** (gratis): https://dash.cloudflare.com/sign-up  
2. Installer Wrangler og logg inn på din Mac: `npx wrangler login`  
3. Fra `server/`: `npx wrangler deploy`  
   - Første gang: godta å lage worker `thomas-verden-mp` og Durable Object-klassen.  
   - Du får en URL, f.eks. `https://thomas-verden-mp.<subdomene>.workers.dev`  
4. Bygg klienten med WebSocket-URL (merk `wss://`):  
   ```bash
   VITE_MP_URL=wss://thomas-verden-mp.<subdomene>.workers.dev npm run build
   ```
   (Eller sett hemmeligheten i GitHub Actions for Pages-bygget.)
5. **Ikke** legg Cloudflare API-token i repoet. Til automatisk deploy av workeren: lag et API-token med Workers-rettigheter og lagre det som GitHub-secret `CLOUDFLARE_API_TOKEN` (pluss `CLOUDFLARE_ACCOUNT_ID`). Et eksempel-workflow ligger i `.github/workflows/mp-server.yml` (skrur du det på først når token er på plass).

## Kostnad (gratisnivå)

Cloudflare Workers free inkluderer Durable Objects med generøse grenser for et familie-/vennespill (få samtidige rom). Ingen lagring av navn eller chat på serveren; rommet lever bare i minnet til DO-en mens noen er koblet på. Forvent **0 kr** ved normal bruk. Sjekk gjeldende grenser på cloudflare.com hvis bruken vokser.

## Sikkerhet

- Kun romkode (ingen offentlig romliste)
- Maks 8 spillere per rom
- Meldinger valideres (størrelse, form, rate-limit)
- Visningsnavn: bare bokstaver, 2–12 tegn, enkel filterliste
- Ingen personopplysninger lagres server-side; ingen logger av navn

## Bytt backend senere

Klientens transport ligger bak `MpTransport` (`src/mp/transport.ts` / `wsTransport.ts`). Protokollen er JSON over WebSocket (`src/mp/protocol.ts`).
