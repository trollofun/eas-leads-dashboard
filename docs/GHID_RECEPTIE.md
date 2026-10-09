# Ghid recepție — CRM leaduri ITP

## Reguli critice (09.10.2026)

### Număr de înmatriculare OBLIGATORIU

**Pentru marcarea ca Programat sau Finalizat, numărul de înmatriculare este OBLIGATORIU.**

#### În dashboard (`/leads/[id]`)

Când apeși butonul **Programează** sau **Finalizat**:
1. Dacă leadul NU are număr de înmatriculare → ți se cere să-l introduci
2. Format acceptat: cod județ (1-2 litere) + cifre (2-3) + litere (3, fără I/O/Q)
   - Exemplu valid: `CT-05-EAM`, `B-123-ABC`, `BH12XYZ`
   - Cratimele și spațiile sunt opționale — vor fi eliminate automat
3. După validare → numărul e salvat și statusul se schimbă
4. Conversie Google Ads trimisă DOAR după salvarea numărului

#### În email (linkuri ✅ Programat / 🏁 Finalizat)

1. **Leadul FĂRĂ număr:**
   - Click pe link → formular care cere numărul
   - Introdu numărul → validare → marcare + conversie
   - Număr invalid → mesaj de eroare + „Încearcă din nou"

2. **Leadul CU număr:**
   - Click pe link → buton de confirmare direct
   - Click pe buton → marcare + conversie

## Flux complet marcarea unui lead

### 1. Lead nou sosește (status: `new`)

- Verifică GCLID (în secțiunea Tracking PPC) — dacă lipsește, conversia NU va fi atribuită corect
- Verifică fake score — dacă > 40, verifică telefon/email înainte de a apela
- Completează câmpurile lipsă:
  - **Număr înmatriculare** (dacă nu e completat automat din formular)
  - Mașină (marca/model/an) dacă lipsește
  - Data dorită (dacă e menționată în mesaj)

### 2. După contact telefonic

#### Dacă clientul confirmă programarea:

1. **Setează data programării** (câmpul "Programare" din secțiunea Operațional)
2. **Verifică că există număr de înmatriculare** — dacă NU, introdu-l acum
3. **Apasă butonul "Programează"** → status devine `appointment_booked`
4. **Conversie `appointment_booked` trimisă automat** către Google Ads

#### Dacă clientul nu răspunde:

- Buton **Nu răspunde** → status `no_answer` (fără conversie)

#### Dacă e lead nevalid (spam):

- Buton **Lead nevalid** → status `fake` (blochează semnalele de telefon/email)

### 3. Când clientul sosește la ITP

1. Buton **A sosit** → status `arrived`
2. Notă internă: orice observație despre vehicul sau client

### 4. După finalizarea ITP

1. **Introdu valoarea finală** (câmpul "Valoare finală RON")
   - Dacă nu o introduci acum, ți se va cere când apeși butonul Finalizat
2. **Verifică că există număr de înmatriculare** — dacă NU, introdu-l
3. **Apasă butonul "Finalizat"** → status `work_completed`
4. **Conversie `work_done` trimisă automat** către Google Ads (120 RON, Primary/bidding)

## De ce e important numărul?

- **Google Ads Enhanced Conversions for Leads**: Pentru a asocia conversia corect cu click-ul publicitar, Google folosește identificatori (GCLID + email/telefon + **număr înmatriculare**)
- **Fără număr → conversie trimisă, dar Google nu o poate asocia corect** → licitarea automată nu învață din conversia respectivă
- **Cu număr → Google face match precis** → licitarea automată optimizează pentru leaduri care chiar vin și plătesc

## Erori frecvente

### ❌ „Am apăsat Programat dar nu s-a schimbat statusul"

**Cauză:** Lipsește numărul de înmatriculare.

**Fix:** Când apeși butonul, ți se cere numărul într-un prompt. Introdu-l acolo.

### ❌ „Am introdus numărul dar zice 'invalid'"

**Cauză:** Format incorect (de exemplu: `CTX-05-EAM` — X nu e cod județ valid).

**Fix:** Verifică formatul:
- Cod județ valid RO (AB, AR, AG, B, BC, BH, BN, BR, BT, BV, BZ, CJ, CL, CS, CT, CV, DB, DJ, GL, GR, GJ, HD, HR, IL, IS, IF, MM, MH, MS, NT, OT, PH, SJ, SM, SV, TR, TM, TL, VS, VL, VN)
- 2-3 cifre
- 3 litere (fără I, O, Q — acestea nu se folosesc pe plăcuțe RO)

### ❌ „Link-ul din email nu funcționează"

**Cauză:** Probabil scanner de linkuri din client de email (Gmail, Outlook). Scannerul face GET automat, dar NU face POST.

**Fix:** Click pe link → se deschide pagină cu buton / formular → click pe buton / completează formular → ACUM se trimite acțiunea.

## Raportare conversii

Conversiile trimise către Google Ads:
- **`appointment_booked`** — când marchezi ca Programat
- **`work_done`** — când marchezi ca Finalizat (120 RON, Primary for bidding)

Verifică statusul conversiei în secțiunea **Conversii Google Ads** din pagina leadului:
- `queued` — în coadă, așteaptă trimitere
- `sent` — trimisă, așteaptă confirmare de la Google
- `confirmed` — Google a acceptat-o
- `failed` — eroare la trimitere (verifică log-urile sau contactează admin)

---

**Data ultimei actualizări:** 09.10.2026  
**Modificări:** Număr de înmatriculare obligatoriu pentru Programat/Finalizat (decizii owner EUR-114)
