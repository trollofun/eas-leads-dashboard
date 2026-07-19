# EAS Leads Dashboard — migrare Dokploy

## Verdict

Nu dezinstala Coolify până nu ai confirmat în Dokploy:

1. aplicația pornește;
2. Postgres restaurat are datele;
3. login merge;
4. `/api/health` merge;
5. n8n lead bridge scrie în noul endpoint;
6. linkurile din email schimbă status și pun conversia în queue.

Codul este pe GitHub și backupul DB există local. Partea nepublică rămasă: env secrets + restaurarea DB în Dokploy.

## Repo

```text
https://github.com/trollofun/eas-leads-dashboard.git
branch: main
```

Commituri relevante:

```text
6d6f428 fix: lead-action token lookup for idempotency_key (non-UUID) tokens
6758b83 docs: document n8n lead bridge integration
```

Commiturile docs ulterioare nu schimbă runtime.

## Backup local creat

Folder local, permisiuni restrictive:

```text
/home/john/.hermes/profiles/beba/eas-leads-dashboard/migration/dokploy-20260719T140128Z/
```

Fișiere:

```text
eas-leads-postgres.dump   # pg_dump custom format, restaurabil cu pg_restore
schema.sql.gz             # schema-only backup comprimat
schema.sql                # schema-only plain SQL
app.env.actual            # env real, cu secrets; NU commitui, chmod 600
app.env.sanitized         # env fără valori sensibile
docker-inventory.txt      # imagini/container names vechi
db-stats.txt              # număr rânduri pentru verificare
```

Verificare backup:

```text
leads | 21
lead_events | 30
google_conversion_queue | 3
```

TOC dump verificat cu `pg_restore -l` în container Postgres.

## App build

Dockerfile existent:

```text
Dockerfile
```

Port intern:

```text
3000
```

Health endpoint:

```text
GET /api/health
```

Next.js standalone activ:

```ts
// next.config.ts
output: "standalone"
```

## Dokploy — varianta recomandată

### 1. Creează Postgres în Dokploy

- image: `postgres:16-alpine`
- database: `postgres` sau nume nou, dar actualizează `DATABASE_URL`
- user/parolă generate în Dokploy
- păstrează storage persistent

### 2. Restaurează DB

Copiază dumpul pe serverul Dokploy, apoi:

```bash
cat eas-leads-postgres.dump | docker exec -i <dokploy-postgres-container> \
  pg_restore -U <postgres_user> -d <database_name> --clean --if-exists --no-owner --no-privileges
```

Verifică:

```bash
docker exec <dokploy-postgres-container> psql -U <postgres_user> -d <database_name> -t -A -F' | ' \
  -c "SELECT 'leads', count(*) FROM leads UNION ALL SELECT 'lead_events', count(*) FROM lead_events UNION ALL SELECT 'google_conversion_queue', count(*) FROM google_conversion_queue;"
```

Așteptat, înainte de leaduri noi:

```text
leads | 21
lead_events | 30
google_conversion_queue | 3
```

### 3. Creează aplicația în Dokploy

- type: Git app
- repo: `https://github.com/trollofun/eas-leads-dashboard.git`
- branch: `main`
- build: Dockerfile
- internal port: `3000`

### 4. Setează env vars

Folosește local:

```text
migration/dokploy-20260719T140128Z/app.env.actual
```

Nu copia mecanic `DATABASE_URL`; schimb-o pe Postgresul Dokploy.

Env importante:

```text
DATABASE_URL=postgresql://<user>:<pass>@<dokploy-postgres-host>:5432/<db>
APP_URL=<url publică sau LAN nouă>
NEXTAUTH_URL=<aceeași origine ca APP_URL>
AUTH_TRUST_HOST=true
NEXTAUTH_SECRET=<păstrează sau regenerează doar dacă accepți invalidarea sesiunilor>
LEAD_ACTION_SECRET=<păstrează pentru linkuri email deja trimise>
INGEST_API_KEY=<păstrează dacă n8n bridge rămâne același>
INGEST_HMAC_SECRET=<păstrează dacă n8n bridge rămâne același>
```

Google Ads / Data Manager, dacă sunt folosite:

```text
GOOGLE_ADS_OPERATING_ACCOUNT_ID
GOOGLE_ADS_LOGIN_ACCOUNT_ID
GOOGLE_ADS_DEFAULT_CONVERSION_ACTION_ID
GOOGLE_DATAMANAGER_VALIDATE_ONLY
GOOGLE_APPLICATION_CREDENTIALS
GOOGLE_CONSENT_AD_USER_DATA
GOOGLE_CONSENT_AD_PERSONALIZATION
```

SMTP poate rămâne gol dacă emailul vine din n8n. Nu e necesar pentru fluxul actual.

### 5. Deploy + health

După deploy:

```bash
curl -sS <APP_URL>/api/health
```

Așteptat:

```json
{"ok":true,"service":"eas-leads-dashboard"}
```

### 6. Update n8n lead bridge

Bridge-ul local scrie acum la vechiul dashboard LAN. După Dokploy, schimbă:

```text
DASH_URL / EAS_DASHBOARD_INGEST_URL -> <dokploy-app-url>/api/ingest/lead
APP_URL / EAS_DASHBOARD_APP_URL -> <dokploy-app-url>
```

Dacă folosești copia activă Hermes:

```text
/home/john/.hermes/profiles/beba/scripts/n8n_lead_bridge.py
```

Verifică prin run manual:

```bash
source /home/john/.hermes/profiles/beba/.env
python3 /home/john/.hermes/profiles/beba/scripts/n8n_lead_bridge.py
```

Când apare lead nou:

```text
BRIDGED exec=<id> wf=<workflow> http=201 resp={...}
```

### 7. Test cap-coadă

1. Submit test către webhook n8n.
2. Verifică email birou@ cu butoane.
3. Rulează bridge sau așteaptă cron.
4. Verifică lead în Dokploy DB.
5. Click `Programat`.
6. Verifică:

```text
leads.status = appointment_booked
google_conversion_queue.status = pending
```

Curăță testul:

```sql
UPDATE google_conversion_queue
SET status='skipped'
WHERE lead_id::text IN (SELECT id::text FROM leads WHERE phone='<test_phone>')
  AND status='pending';

UPDATE leads
SET status='fake', fake_reason='test intern migrare dokploy'
WHERE phone='<test_phone>';
```

## Ce NU trebuie pierdut la dezinstalare Coolify

- container DB vechi: `rmrt1ch412ea6va7hqct0pf1`
- dump local: `migration/dokploy-20260719T140128Z/eas-leads-postgres.dump`
- env real: `migration/dokploy-20260719T140128Z/app.env.actual`
- repo GitHub: `trollofun/eas-leads-dashboard`
- n8n workflows live: nu sunt în Coolify
- bridge Hermes cron: nu este în Coolify

## Poți dezinstala Coolify când

Checklist final:

```text
[ ] dump copiat off-host / în Dokploy server
[ ] Dokploy Postgres restore OK, counturi confirmate
[ ] Dokploy app health OK
[ ] login OK
[ ] n8n bridge actualizat spre Dokploy și testat
[ ] email action links OK pe Dokploy
[ ] conversie queue OK
[ ] rollback window acceptată
```

Dacă dezinstalezi Coolify înainte de checklist, riști doar downtime / pierdere acces la containerele vechi. Datele sunt salvate în dump local, dar trebuie copiat în afara hostului dacă dezinstalarea șterge disk/volume Docker.
