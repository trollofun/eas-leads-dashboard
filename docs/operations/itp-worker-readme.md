# ITP Worker — Verificare ITP RARPOL

Cloudflare Worker care verifică ITP-ul unui vehicul prin CIV sau VIN, cu CAPTCHA solver integrat (CNN pur în JS, fără dependențe WASM/ONNX).

Emulează flow-ul n8n `uitdeitp.ro` într-un singur Worker gratuit.

## Endpoint live

```
POST https://rarvin.euroautoservice.ro/check
Content-Type: application/json

{"vin": "VF1LM0C0H34741140"}     # sau
{"civ": "R-298707"}
```

Endpoint workers.dev există și el, dar integrarea publică folosește domeniul canonic `rarvin.euroautoservice.ro`.

Răspuns:
```json
{
  "success": true,
  "status": "VALABIL",        // VALABIL | EXPIRAT | NEGASIT | NECUNOSCUT
  "vin": "VF1LM0C0H34741140",
  "expira": "03.07.2027",     // DD.MM.YYYY
  "expira_iso": "2027-07-03",
  "valid": true,
  "captcha": "7234",
  "confidence": 0.9943,
  "attempts": 1
}
```

## Arhitectură

| Fișier | Rol |
|---|---|
| `src/index.js` | Flow HTTP (fetch→solve→post→parse), parser rezultat, cache, auth |
| `src/captcha.js` | Preprocessing pur JS: decode BMP 24-bit → red_mask → crop 4 coloane → resize INTER_AREA |
| `src/model.js` | CNN forward pass pur JS (conv+bn folded+relu+maxpool+dense) |
| `src/weights.json` | Weights CNN cu BatchNorm folded în conv (~1.2MB) |

## Flow RARPOL (detalii critice)

1. `GET https://prog.rarom.ro/rarpol/` → HTML form + cookie ASP (`ASPSESSIONID...`)
2. Extrage `images/default.asp?NNNN` din HTML
3. `GET images/default.asp?NNNN` (cu cookie) → CAPTCHA BMP 86×21, **și setează AL DOILEA cookie ASP care leagă codul de sesiune**
4. **CHEIE:** merge cookie-ul din pasul 3 (`capJar`) peste cel din pasul 1 (`pageJar`) → `mergedJar`
5. Solve CAPTCHA (CNN, 4 cifre)
6. `POST rarpol.asp` cu `mergedJar` + form:
   - `serie_civ`, `nr_id`, `cod_verificare`, `from_url`, `id`, `trimite`
7. Parse răspuns

**Fără merge-ul cookie-ului de la pasul 3, RARPOL respinge orice cod CAPTCHA corect.** (descoperit prin debug live)

### Incident/fix 2026-07-19

RARPOL live cere câmpul de formular:

```text
cod_verificare
```

Workerul trimitea greșit:

```text
cod_securitate
```

Simptom:

```json
{"error":"captcha_failed_after_retries","kind":"captcha_wrong","attempts":6}
```

Root cause nu era modelul CAPTCHA. Modelul citea corect; RARPOL respingea requestul fiindcă primea codul în câmp greșit.

Fix aplicat în ambele ramuri:

- `verifyThroughProxy`
- `verifyDirect`

Dovadă după deploy:

```json
{
  "success": true,
  "kind": "found",
  "status": "VALABIL",
  "expira_iso": "2028-07-03",
  "attempts": 1
}
```

## Parser rezultat

Markere RARPOL (format text românesc):
- **Găsit valid:** `I.T.P. valabilă până la 3-iul-2027` → data `D-lunăRO-YYYY` (lună abreviată română)
- **Negăsit:** `NU A FOST GASIT` / `nu este în evidenţa`
- **Expirat:** `EXPIRAT` / `nu mai este valabil`
- **CAPTCHA greșit:** `cod de verificare ... incorect` / `copiat incorect`
- **VIN extras:** `seria caroseriei XXXX`

Luni RO: ian feb mar apr mai iun iul aug sep oct noi dec

## CAPTCHA solver

- Model CNN: `Conv(1→16)→BN→ReLU→Pool → Conv(16→32)→BN→ReLU→Pool → Flatten → Linear(768→64)→ReLU → Linear(64→10)`
- Input: 24×16 grayscale per cifră
- Preprocessing: `red_mask` = `(R>130 & G<100 & B<100)` invertit; crop coloane `[(4,16),(14,26),(24,36),(34,46)]`; resize la 16×24 (INTER_AREA)
- Antrenat pe 1000 samples etichetate manual → 97.5% exact
- **BatchNorm folded în conv** la export → forward pass simplu în JS pur (~13ms/captcha)
- PyTorch weights sursă: `/tmp/rar_batch/digit1000.pt`; ONNX: `~/.hermes/profiles/beba/rarpol-captcha-solver/`

De ce JS pur, nu ONNX: `onnxruntime-web` crapă în Workers cu `no available backend found. ERR: [wasm] cannot determine the script source URL` — WASM loading nu funcționează în runtime-ul Workers.

## Deploy

```bash
export HOME=/home/john    # wrangler login e stocat în HOME real, nu profil
cd ~/.hermes/profiles/beba/itp-worker
npx wrangler deploy
```

Dacă tokenul Cloudflare nu are permisiuni de routes, `wrangler deploy` poate încărca scriptul și apoi pica la `/workers/routes` cu `Authentication error [code: 10000]`. În cazul ăsta, deployează scriptul fără blocul `routes` (nu atinge custom domain; doar actualizează worker service). Custom domainul existent continuă să folosească versiunea nouă.

Cont Cloudflare: `tuca.ioan.teodor@gmail.com`

## De adăugat (opțional)

- **KV cache** (TTL adaptiv, comentat în wrangler.toml): `wrangler kv namespace create ITP_CACHE`, apoi decomentează binding-ul
- **API key** (anti-abuz): `wrangler secret put API_KEY`, apoi trimite header `X-API-Key`

## Teste

```bash
npm test    # parity CNN JS vs labels pe 1000 samples
```

Robustețe verificată live:
- 5/5 rulări consecutive VALABIL, toate `attempts=1` (0 retry captcha)
- Input invalid → `{"error":"missing civ or vin"}`
- VIN inexistent → `NEGASIT` graceful
- 8+ requests fără rate-limit (IP rotativ CF)
