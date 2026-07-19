# ITP Worker — ghid integrare în alte proiecte

## Verdict rapid

Workerul oferă API HTTP pentru verificare valabilitate ITP prin RARPOL/RAROM, folosind CIV sau VIN.

Endpoint recomandat:

```text
https://rarvin.euroautoservice.ro/check
```

Endpoint vechi `https://itp-worker.tuca-ioan-teodor.workers.dev/check` funcționează din nou după deploy 2026-07-19, dar pentru integrare publică folosește domeniul canonic `https://rarvin.euroautoservice.ro/check`.

## Status verificat 2026-07-19

Contract API, CORS, routing și verificare RARPOL: funcționale după fix 2026-07-19.

Teste reale:

```bash
OPTIONS /check Origin: https://euroautoservice.ro -> HTTP 204
POST /check {} -> HTTP 400 {"error":"missing civ or vin"}
POST /debug -> HTTP 200, WEBSHARE_TOKEN prezent, proxy_count=1
POST /check {"civ":"R-298707"} -> HTTP 200, VALABIL, expira_iso=2028-07-03, attempts=1
```

Root cause incident 2026-07-19: HTML-ul RARPOL folosește câmpul `cod_verificare`; workerul trimitea `cod_securitate`. Modelul CAPTCHA era OK. Fix: ambele ramuri `verifyThroughProxy` și `verifyDirect` trimit `cod_verificare`.

## Endpointuri

### `POST /check`

Verifică ITP după CIV sau VIN.

Headers browser:

```http
Content-Type: application/json
Origin: https://euroautoservice.ro
```

Headers server-to-server din proiecte externe:

```http
Content-Type: application/json
X-API-Key: <secret setat în Cloudflare Worker>
```

Body acceptat:

```json
{ "civ": "R-298707" }
```

sau:

```json
{ "serie_civ": "R-298707" }
```

sau:

```json
{ "vin": "VF1LM0C0H34741140" }
```

sau:

```json
{ "nr_id": "VF1LM0C0H34741140" }
```

Normalizare internă:

```js
civ = body.civ || body.serie_civ
vin = body.vin || body.nr_id
```

Prioritate: CIV înainte de VIN dacă ambele există.

### `POST /lead`

Fallback simplu pentru captare lead în KV Worker. Nu înlocuiește dashboardul EAS.

Body minim:

```json
{
  "phone": "+40729440127",
  "vin": "VF1...",
  "civ": "R-298707",
  "status": "EXPIRAT",
  "expira": "03.07.2027"
}
```

Răspuns:

```json
{ "success": true, "saved": true }
```

### `POST /debug`

Diagnostic intern. Folosește doar server-to-server sau din origin permis.

Răspuns tipic:

```json
{
  "has_webshare_token": true,
  "proxy_count": 1,
  "first_proxy": { "host": "p.webshare.io", "port": 80 }
}
```

## CORS și auth

Origin permis în browser:

```js
/^https?:\/\/([a-z0-9-]+\.)*euroautoservice\.ro$|^http:\/\/localhost(:\d+)?$/i
```

Implicații:

- merge direct din `https://euroautoservice.ro` și subdomenii;
- merge local dev pe `http://localhost:<port>`;
- alte proiecte/domenii NU pot apela din browser fără modificare `ORIGIN_RE`;
- server-to-server poate apela cu `X-API-Key` dacă `API_KEY` e setat ca secret.

Pentru integrare în alt domeniu public, ai două opțiuni:

1. Adaugi domeniul în `ORIGIN_RE` și redeploy worker.
2. Pui un backend proxy în proiectul nou; browserul cheamă backendul propriu, backendul cheamă worker cu `X-API-Key`.

Recomandare: pentru proiecte externe, folosește backend proxy + API key. Nu lărgi CORS fără nevoie.

## Răspunsuri `/check`

Succes cu ITP găsit:

```json
{
  "success": true,
  "kind": "found",
  "status": "VALABIL",
  "vin": "VF1LM0C0H34741140",
  "expira": "03.07.2027",
  "expira_iso": "2027-07-03",
  "valid": true,
  "captcha": "7234",
  "confidence": 0.9943,
  "proxy": "p.webshare.io:80",
  "attempts": 1
}
```

Negăsit:

```json
{
  "success": true,
  "kind": "not_found",
  "status": "NEGASIT",
  "message": "Vehiculul nu este în evidența RAR"
}
```

Eroare validare:

```json
{ "error": "missing civ or vin" }
```

Important: tratați orice `error` ca eșec UI, chiar dacă `success` poate veni `true` din implementarea actuală.

## Integrare browser minimă

```html
<form id="itp-form">
  <input id="itp-q" name="q" placeholder="CIV sau VIN" required>
  <button>Verifică ITP</button>
</form>
<pre id="itp-result"></pre>
<script>
const endpoint = 'https://rarvin.euroautoservice.ro';
function classify(q) {
  q = q.trim().toUpperCase();
  if (/^[A-Z]-?\d{4,7}$/.test(q)) return { civ: q.replace(/^([A-Z])-?/, '$1-') };
  if (/^[A-HJ-NPR-Z0-9]{11,17}$/.test(q)) return { vin: q };
  return null;
}
document.getElementById('itp-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = classify(document.getElementById('itp-q').value);
  if (!payload) return alert('Introdu CIV sau VIN valid');
  const r = await fetch(endpoint + '/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await r.json();
  if (!r.ok || data.error) {
    document.getElementById('itp-result').textContent = 'Verificare indisponibilă momentan.';
    return;
  }
  document.getElementById('itp-result').textContent =
    data.status === 'VALABIL'
      ? `ITP valabil până la ${data.expira}`
      : data.status === 'EXPIRAT'
        ? `ITP expirat pe ${data.expira || 'dată necunoscută'}`
        : 'Vehicul negăsit în evidența RAR';
});
</script>
```

## Integrare server-to-server Node.js

```js
export async function checkItp({ civ, vin }) {
  const res = await fetch('https://rarvin.euroautoservice.ro/check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.ITP_WORKER_API_KEY,
    },
    body: JSON.stringify(civ ? { civ } : { vin }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `itp_worker_${res.status}`);
  return data;
}
```

## Integrare Hugo / Euro Auto Service

Implementarea curentă este în:

```text
layouts/partials/itp-checker.html
```

Activează toolul într-o pagină Hugo cu partial/shortcode existent. Endpoint curent:

```html
<section class="itpc" data-endpoint="https://rarvin.euroautoservice.ro">
```

Reguli UX păstrate:

- toolul de verificare stă above-the-fold pe `/itp/verificare-rar/`;
- acceptă CIV cu prefixe dincolo de `C-`, ex. `R-298707`;
- pentru status `EXPIRAT` sau expirare în curând, afișează lead capture;
- lead primary merge la `https://www.uitdeitp.ro/api/kiosk/submit`;
- fallback lead merge la worker `/lead`.

## Integrare în alt proiect

Checklist:

1. Decide mod apel:
   - browser direct doar dacă domeniul e în CORS;
   - backend proxy dacă domeniul e extern.
2. Setează secret Cloudflare:
   ```bash
   cd ~/.hermes/profiles/beba/itp-worker
   export HOME=/home/john
   npx wrangler secret put API_KEY
   ```
3. Dacă folosești proxy Webshare:
   ```bash
   npx wrangler secret put WEBSHARE_TOKEN
   ```
4. Adaugă domeniu în `ORIGIN_RE` doar dacă vrei browser direct.
5. Rulează:
   ```bash
   npx wrangler deploy
   ```
6. Verifică:
   ```bash
   curl -X POST https://rarvin.euroautoservice.ro/check \
     -H 'Content-Type: application/json' \
     -H 'X-API-Key: <key>' \
     -d '{"civ":"R-298707"}'
   ```

## Observabilitate minimă

Pentru health check fără RARPOL:

```bash
curl -X POST https://rarvin.euroautoservice.ro/debug \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: <key>' \
  -d '{}'
```

Pentru test RARPOL complet, folosește un CIV/VIN cunoscut și verifică:

- `HTTP 200`;
- fără `error`;
- `kind` = `found` sau `not_found`;
- `attempts <= 2` ideal;
- `confidence` rezonabil.

## Limitări și riscuri

- RARPOL poate schimba HTML/form/captcha oricând.
- Incident 2026-07-19: eșecul live nu a fost model CAPTCHA; a fost nume greșit câmp RARPOL (`cod_securitate` în loc de `cod_verificare`). Fix deployat și retestat.
- `success:true` cu `error` este comportament ambiguu; clientul trebuie să trateze `error` ca eșec.
- `/lead` salvează în Worker KV, nu trimite automat în EAS Leads Dashboard.
- Nu afișa `captcha` în UI public; este doar debug.

## Îmbunătățiri recomandate înainte de integrare externă serioasă

1. Normalizează răspunsul: `success:false` când există `error` final.
2. Adaugă `GET /health` fără auth care verifică doar worker config, nu RARPOL.
3. Mută CORS allowed origins într-o listă din env/config, nu regex hardcodat.
4. Adaugă rate-limit per IP/API key.
5. Păstrează test de regresie pe câmpul RARPOL `cod_verificare` + un CIV cunoscut. Reantrenează CAPTCHA doar dacă testul manual confirmă cod citit greșit.
6. Ascunde câmpurile debug (`captcha`, `proxy`) în răspuns public sau fă-le disponibile doar cu flag intern.
