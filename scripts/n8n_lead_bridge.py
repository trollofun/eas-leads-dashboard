#!/usr/bin/env python3
"""n8n -> EAS Dashboard lead bridge.

Why: n8n runs on remote VPS (n8n.uitdeitp.ro / 46.247.109.213) and CANNOT reach
the dashboard (LAN 192.168.1.164 / WG 10.99.0.1) — connect ETIMEDOUT.
This host CAN reach both. Bridge polls n8n executions API, extracts lead
payloads from the 'Send to EAS Dashboard' node output, and POSTs them to the
local dashboard ingest API with HMAC. Idempotency = execution id, so re-runs
are safe and the dashboard dedupes.

Silent when nothing new (cron watchdog pattern). Prints summary when it acts.
"""
import base64
import hashlib
import hmac as hmac_mod
import json
import os
import time
import ssl
import urllib.request

N8N_BASE = os.environ.get('N8N_BASE_URL', 'https://n8n.uitdeitp.ro').rstrip('/')
N8N_KEY = os.environ['N8N_API_KEY']
DASH_URL = os.environ['EAS_DASHBOARD_INGEST_URL']
DASH_HOST = os.environ.get('EAS_DASHBOARD_HOST_HEADER', '')
TLS_VERIFY = os.environ.get('EAS_DASHBOARD_TLS_VERIFY', '1') != '0'
API_KEY = os.environ['EAS_INGEST_API_KEY']
HMAC_SECRET = os.environ['EAS_INGEST_HMAC_SECRET']
STATE_FILE = os.path.expanduser(os.environ.get('EAS_BRIDGE_STATE_FILE', '~/.cache/eas/n8n_lead_bridge.json'))
APP_URL = os.environ.get('EAS_DASHBOARD_APP_URL', 'https://leads.dev.euroautoservice.ro')

WORKFLOWS = {
    'rf5hRUxNvEPZLtjr': {'source': 'ppc_shortform', 'name': 'Programare ITP ShortForm'},
    'NXzQqlYe6UcvMz1E': {'source': 'website_form', 'name': 'EAS - Leads'},
    'YvQoLJdULyAxwoAh': {'source': 'google_lead_form', 'name': 'Google Lead Forms'},
}

def n8n_get(path):
    req = urllib.request.Request(N8N_BASE + path, headers={'X-N8N-API-KEY': N8N_KEY})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def load_state():
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except Exception:
        return {'processed': []}

def save_state(state):
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    # ponytail: keep last 500 ids only; enough for dedup window
    state['processed'] = state['processed'][-500:]
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f)

def col(body, key):
    for c in body.get('user_column_data') or []:
        if c.get('column_id') == key or c.get('column_name') == key or key.lower() in (c.get('column_name') or '').lower():
            return c.get('string_value') or ''
    return ''

def build_payload(wid, meta, body, headers):
    ip = headers.get('cf-connecting-ip') or headers.get('x-real-ip') or (headers.get('x-forwarded-for') or '').split(',')[0].strip() or body.get('ip') or body.get('ip_address') or ''
    ua = headers.get('user-agent') or body.get('user_agent') or (body.get('meta') or {}).get('user_agent') or ''
    if meta['source'] == 'website_form':
        lead = body.get('lead') or {}
        tracking = body.get('tracking') or {}
        name = lead.get('name') or body.get('nume_complet') or ''
        phone = lead.get('phone') or body.get('telefon') or ''
        email = lead.get('email') or body.get('email') or ''
        gclid = tracking.get('gclid') or body.get('gclid') or ''
        landing = tracking.get('page_url') or body.get('page_url') or ''
        utm = {k: tracking.get('utm_' + k) or body.get('utm_' + k) for k in ('source', 'medium', 'campaign', 'term')}
        service = (body.get('service') or {}).get('code') or 'altul'
    else:
        name = body.get('nume_complet') or col(body, 'FULL_NAME') or body.get('full_name') or body.get('nume') or ''
        phone = body.get('telefon') or col(body, 'PHONE_NUMBER') or body.get('phone') or ''
        email = body.get('email') or col(body, 'email') or ''
        gclid = body.get('gcl_id') or body.get('gclid') or body.get('google_click_id') or ''
        landing = body.get('page_url') or body.get('form_url') or body.get('landing_page') or ''
        utm = {k: body.get('utm_' + k) for k in ('source', 'medium', 'campaign', 'term')}
        service = 'itp'
    now = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    headless = body.get('headless') or {}
    payload = {
        'source': meta['source'],
        'service_type': service,
        'contact': {'name': name, 'phone': phone, 'email': email},
        'message': body.get('message') or body.get('mesaj') or f"Lead din {meta['name']} (bridge)",
        'ad_click': {
            'gclid': gclid, 'gbraid': body.get('gbraid'), 'wbraid': body.get('wbraid'),
            'utm_source': utm.get('source'), 'utm_medium': utm.get('medium'),
            'utm_campaign': utm.get('campaign'), 'utm_term': utm.get('term'),
            'landing_page': landing, 'session_id': body.get('session_id'),
            'browser_risk_score': headless.get('score') or body.get('browser_risk_score') or 0,
            'browser_risk_reasons': json.dumps(headless.get('reasons') or []),
            'user_agent': ua, 'ip_address': ip,
        },
        'consent': {'ad_user_data': True, 'ad_personalization': True, 'collected_at': now, 'method': 'form_submission'},
        'raw_metadata': {'n8n_workflow_id': wid, 'n8n_workflow_name': meta['name'], 'source_kind': meta['source'], 'bridge': True, 'original_body': body},
    }
    if body.get('numar_inmatriculare'):
        payload['vehicle'] = {'registration_number': body['numar_inmatriculare']}
        payload['numar_inmatriculare'] = body['numar_inmatriculare']
    return payload

def post_lead(payload, idem):
    raw = json.dumps(payload)
    ts = str(int(time.time() * 1000))
    sig = hmac_mod.new(HMAC_SECRET.encode(), f'{ts}.{raw}'.encode(), hashlib.sha256).hexdigest()
    headers = {
        'Content-Type': 'application/json', 'X-EAS-Api-Key': API_KEY,
        'X-EAS-Timestamp': ts, 'X-EAS-Signature': sig, 'X-Idempotency-Key': idem,
    }
    if DASH_HOST:
        headers['Host'] = DASH_HOST
    req = urllib.request.Request(DASH_URL, data=raw.encode(), method='POST', headers=headers)
    ctx = None if TLS_VERIFY else ssl._create_unverified_context()
    with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
        return r.status, r.read().decode()[:300]

def main():
    state = load_state()
    done = set(state['processed'])
    results = []
    cutoff = time.time() - 7 * 86400  # only recover last 7 days
    for wid, meta in WORKFLOWS.items():
        entries = []
        for st in ('success', 'error'):
            try:
                ex = n8n_get(f'/api/v1/executions?limit=20&workflowId={wid}&status={st}')
                entries.extend(ex.get('data', []))
            except Exception as e:
                results.append(f'ERR list {wid} {st}: {e}')
        for e in entries:
            eid = str(e['id'])
            if eid in done:
                continue
            started = e.get('startedAt') or ''
            try:
                t = time.mktime(time.strptime(started[:19], '%Y-%m-%dT%H:%M:%S'))
                if t < cutoff:
                    done.add(eid)
                    continue
            except Exception:
                pass
            try:
                d = n8n_get(f'/api/v1/executions/{eid}?includeData=true')
                run = d.get('data', {}).get('resultData', {}).get('runData', {})
                node = run.get('Send to EAS Dashboard')
                js = None
                if node:
                    try:
                        js = node[0]['data']['main'][0][0]['json']
                    except Exception:
                        js = None
                if js is None:
                    # Code node crashed (WebCrypto) — recover raw input from Webhook node
                    for wname, items in run.items():
                        if 'webhook' in wname.lower():
                            try:
                                js = items[0]['data']['main'][0][0]['json']
                            except Exception:
                                js = None
                            break
                if js is None:
                    done.add(eid)
                    continue
                dash = js.get('eas_dashboard') or {}
                if dash.get('ok'):
                    done.add(eid)  # n8n delivered it directly; nothing to do
                    continue
                body = js.get('body') or js
                headers = js.get('headers') or {}
                payload = build_payload(wid, meta, body, headers)
                if not payload['contact']['phone']:
                    done.add(eid)
                    continue
                # Use n8n Code node idem when present, so the signed action links
                # in the reception email (built from that idem) resolve the lead.
                idem = js.get('eas_idem') or hashlib.sha256(f'n8n-bridge:{eid}'.encode()).hexdigest()
                status, resp = post_lead(payload, idem)
                results.append(f'BRIDGED exec={eid} wf={meta["name"]} http={status} resp={resp}')
                done.add(eid)
            except Exception as ex2:
                results.append(f'ERR exec={eid}: {type(ex2).__name__} {str(ex2)[:200]}')
    state['processed'] = sorted(done)
    save_state(state)
    if results:
        print('\n'.join(results))

if __name__ == '__main__':
    main()
