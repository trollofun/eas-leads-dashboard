# n8n Lead Bridge — EAS Leads Dashboard

## Verdict

Bridge-ul este necesar cât timp `n8n.uitdeitp.ro` rulează pe VPS extern și dashboardul rulează în LAN/WireGuard.

Nu este redundant cu emailul n8n:

```text
n8n email = notificare + linkuri semnate
bridge = creează leadul în dashboard
click email = schimbă status + creează conversie
```

Fără bridge, linkul `Programat` poate ajunge în dashboard, dar dashboardul nu are leadul încă și răspunde `lead_not_found`.

## De ce există

`n8n.uitdeitp.ro` nu poate apela endpointul intern al dashboardului:

```text
http://10.99.0.1/api/ingest/lead
http://192.168.1.164/api/ingest/lead
```

Simptom observat:

```text
connect ETIMEDOUT 10.99.0.1:80
```

De aceea n8n NU face POST direct spre dashboard. n8n trimite doar emailul și păstrează payloadul în execution data. Bridge-ul rulează local, într-o rețea care vede și n8n prin internet, și dashboardul prin LAN/WireGuard.

## Flux activ

```text
Website / PPC form
  -> n8n webhook
  -> n8n Code node: normalizează payload, calculează eas_idem, generează dashboard_action_links
  -> n8n Gmail: trimite email la birou@euroautoservice.ro cu Fake / Programat / Finalizat
  -> bridge local poll n8n executions
  -> bridge POST /api/ingest/lead cu HMAC + X-Idempotency-Key = eas_idem
  -> recepția click Programat/Finalizat
  -> dashboard /api/public/lead-action găsește leadul după id sau idempotency_key
  -> status + google_conversion_queue
```

## Workflow-uri acoperite

În `scripts/n8n_lead_bridge.py`:

```python
WORKFLOWS = {
    'rf5hRUxNvEPZLtjr': {'source': 'ppc_shortform', 'name': 'Programare ITP ShortForm'},
    'NXzQqlYe6UcvMz1E': {'source': 'website_form', 'name': 'EAS - Leads'},
    'YvQoLJdULyAxwoAh': {'source': 'google_lead_form', 'name': 'Google Lead Forms'},
}
```

Notă: `Google Lead Forms` este dezactivat acum, fiindcă avea același webhook path ca ShortForm. Bridge-ul încă știe să-l proceseze dacă devine activ cu path separat.

## Contract n8n Code node

Nodul `Send to EAS Dashboard` trebuie să lase în output:

```json
{
  "eas_idem": "<sha256 stable id>",
  "dashboard_action_links": {
    "spam": "http://192.168.1.164/api/public/lead-action?token=...",
    "programat": "http://192.168.1.164/api/public/lead-action?token=...",
    "finalizat": "http://192.168.1.164/api/public/lead-action?token=...",
    "dashboard": "http://192.168.1.164/leads"
  },
  "eas_dashboard": {
    "ok": false,
    "skipped": "direct_post_disabled_bridge_handles_ingest"
  }
}
```

Important: nu face `httpRequest` direct din n8n către dashboard. Blochează workflow-ul până la timeout.

## Contract dashboard ingest

Bridge POST:

```http
POST http://10.99.0.1/api/ingest/lead
Content-Type: application/json
X-EAS-Api-Key: <dashboard ingest api key>
X-EAS-Timestamp: <epoch-ms>
X-EAS-Signature: HMAC-SHA256(secret, "<timestamp>.<raw_json>")
X-Idempotency-Key: <eas_idem>
```

Dashboard dedupează după `idempotency_key`. Linkurile emailului folosesc același `eas_idem`, deci clickul găsește leadul.

## Config runtime

Script versionat:

```text
scripts/n8n_lead_bridge.py
```

Copia activă cron:

```text
/home/john/.hermes/profiles/beba/scripts/n8n_lead_bridge.py
```

Cron Hermes:

```text
name: EAS n8n lead bridge
schedule: every 5m
no_agent: true
script: n8n_lead_bridge.sh
```

State file:

```text
~/.hermes/profiles/beba/cron/state/n8n_lead_bridge.json
```

Environment required:

```text
N8N_API_KEY
N8N_BASE_URL=https://n8n.uitdeitp.ro
```

Dashboard ingest env vars:

```text
EAS_DASHBOARD_INGEST_URL=http://10.99.0.1/api/ingest/lead
EAS_INGEST_API_KEY=<dashboard ingest api key>
EAS_INGEST_HMAC_SECRET=<dashboard ingest hmac secret>
EAS_DASHBOARD_APP_URL=http://192.168.1.164
EAS_BRIDGE_STATE_FILE=~/.hermes/profiles/beba/cron/state/n8n_lead_bridge.json
```

Do not commit real API/HMAC secrets.

## Test manual

Run bridge once:

```bash
source ~/.hermes/profiles/beba/.env
python3 scripts/n8n_lead_bridge.py
```

Expected when new lead exists:

```text
BRIDGED exec=<id> wf=<workflow> http=201 resp={"lead_id":"...","status":"new",...}
```

Expected when no new lead exists: no output.

Verify latest lead in DB:

```bash
docker exec rmrt1ch412ea6va7hqct0pf1 psql -U postgres -d postgres -t -A -F' | ' \
  -c "SELECT left(id::text,8), name, phone, status, left(idempotency_key,16) FROM leads ORDER BY created_at DESC LIMIT 5;"
```

Click test: use `dashboard_action_links.programat` from n8n execution output. After click:

```text
status = appointment_booked
google_conversion_queue has appointment_booked pending
```

For internal test leads, always cleanup:

```sql
UPDATE google_conversion_queue
SET status='skipped'
WHERE lead_id::text IN (SELECT id::text FROM leads WHERE phone='<test_phone>')
  AND status='pending';

UPDATE leads
SET status='fake', fake_reason='test intern beba'
WHERE phone='<test_phone>';
```

## When bridge can be removed

Bridge becomes redundant only if one condition is true:

1. Dashboard gets a public HTTPS ingest endpoint protected by HMAC/rate limits/IP allowlist.
2. n8n joins WireGuard/LAN and can reach `10.99.0.1` reliably.
3. n8n and dashboard run on same server/network.

Until then, keep bridge.

## Known pitfalls

- n8n sandbox lacks `fetch`, `crypto.subtle`, and `require('crypto')` in Code node. Use pure JS hashing for token signing.
- n8n workflow direct POST to LAN causes `ETIMEDOUT` and delays webhook response.
- `Google Lead Forms` must not share webhook path with ShortForm while active.
- `/api/public/lead-action` must support token lead IDs that are either UUIDs or 64-char idempotency hashes.
- Bridge must use `eas_idem` from n8n when present. Fallback `sha256('n8n-bridge:'+exec_id)` is only for legacy executions without email token alignment.
