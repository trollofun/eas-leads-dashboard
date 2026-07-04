'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Shell from '@/components/shell';
import { ActionButton, fmtDate, EmptyState, Spinner } from '@/components/ui';

interface ImportRow { id: string; created_at: string; name: string; phone: string | null; email: string | null; source: string; synced_to_google: boolean }

export default function ImportPage() {
  const [items, setItems] = useState<ImportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const csvRef = useRef<HTMLInputElement>(null);

  // sync state
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const unsyncedCount = items.filter(i => !i.synced_to_google && i.source !== 'manual').length || items.filter(i => !i.synced_to_google).length;

  const load = useCallback(() => {
    fetch('/api/customer-import?limit=100')
      .then(r => r.json())
      .then(d => { setItems(d.items || []); setTotal(d.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const addManual = async () => {
    if (!name.trim()) return;
    setSaving(true); setMsg('');
    const res = await fetch('/api/customer-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, address }),
    });
    const d = await res.json();
    setSaving(false);
    if (d.created) {
      setMsg(`✓ ${d.created} adăugat`);
      setName(''); setPhone(''); setEmail(''); setAddress('');
      load();
    } else if (d.skipped) {
      setMsg(`Skip — telefon deja existent`);
    }
  };

  const handleCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true); setMsg('');
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { setMsg('CSV gol sau fără date'); setSaving(false); return; }

    const header = lines[0].toLowerCase();
    const nameIdx = header.split(',').findIndex(h => h.includes('nume') || h.includes('name'));
    const phoneIdx = header.split(',').findIndex(h => h.includes('telefon') || h.includes('phone') || h.includes('nr'));
    const emailIdx = header.split(',').findIndex(h => h.includes('email'));
    const addrIdx = header.split(',').findIndex(h => h.includes('adress') || h.includes('adres'));

    const csvItems = lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      return {
        name: nameIdx >= 0 ? cols[nameIdx] : cols[0],
        phone: phoneIdx >= 0 ? cols[phoneIdx] : undefined,
        email: emailIdx >= 0 ? cols[emailIdx] : undefined,
        address: addrIdx >= 0 ? cols[addrIdx] : undefined,
      };
    }).filter(i => i.name);

    const res = await fetch('/api/customer-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: csvItems }),
    });
    const d = await res.json();
    setSaving(false);
    setMsg(`✓ ${d.created} adăugat, ${d.skipped} skip`);
    load();
    if (csvRef.current) csvRef.current.value = '';
  };

  const syncToGoogle = async () => {
    setSyncing(true); setSyncMsg('');
    try {
      const res = await fetch('/api/customer-match/sync', { method: 'POST' });
      const d = await res.json();
      if (d.errors?.length) {
        setSyncMsg(`⚠ ${d.synced} sync, erori: ${d.errors[0].slice(0, 100)}`);
      } else {
        setSyncMsg(`✓ ${d.synced} trimiși către Google`);
      }
      load();
    } catch {
      setSyncMsg('Eroare la sincronizare');
    }
    setSyncing(false);
  };

  return (
    <Shell>
      <h1 className="text-lg font-bold mb-4">Import clienți (Customer Match)</h1>
      <p className="text-sm text-gray-500 mb-4">
        Clienți de pe cererile GDPR semnate la recepție. Datele sunt hash-uite și trimise Google pentru potrivire.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Manual entry */}
        <div className="bg-white rounded-lg border p-4">
          <h2 className="font-semibold mb-3">Adaugă manual</h2>
          <div className="space-y-2">
            <input type="text" placeholder="Nume complet *" value={name} onChange={e => setName(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-full" />
            <input type="tel" placeholder="Telefon (0729...)" value={phone} onChange={e => setPhone(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-full" />
            <input type="email" placeholder="Email (opțional)" value={email} onChange={e => setEmail(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-full" />
            <input type="text" placeholder="Adresă (opțional)" value={address} onChange={e => setAddress(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-full" />
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              GDPR: clientul a semnat cererea ✓
            </div>
            <div className="flex items-center gap-3">
              <ActionButton label={saving ? '...' : 'Adaugă'} onClick={addManual} disabled={saving || !name.trim()} />
              {msg && <span className="text-sm text-gray-600">{msg}</span>}
            </div>
          </div>
        </div>

        {/* CSV + sync */}
        <div className="bg-white rounded-lg border p-4">
          <h2 className="font-semibold mb-3">Import CSV</h2>
          <p className="text-xs text-gray-500 mb-3">
            Format: <code>nume, telefon, email, adresa</code> — prima linie = antet.
          </p>
          <input ref={csvRef} type="file" accept=".csv" onChange={handleCSV}
            className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          <p className="text-xs text-gray-400 mt-2">
            Duplicări telefon skip automat.
          </p>

          <div className="border-t mt-4 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">
                {unsyncedCount > 0 ? `${unsyncedCount} de sincronizat` : 'Totul sincronizat ✓'}
              </span>
              <ActionButton
                label={syncing ? 'Se trimite...' : '→ Sincronizează cu Google'}
                onClick={syncToGoogle}
                disabled={syncing || unsyncedCount === 0}
                small
              />
            </div>
            {syncMsg && <p className="text-xs text-gray-600 mt-1">{syncMsg}</p>}
          </div>
        </div>
      </div>

      {/* Recent imports */}
      <div className="bg-white rounded-lg border p-4 mt-6">
        <h2 className="font-semibold mb-3">Importați ({total} total)</h2>
        {loading ? <Spinner /> : items.length === 0 ? <EmptyState text="Niciun client importat" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500 text-xs uppercase">
                  <th className="p-2">Dată</th>
                  <th className="p-2">Nume</th>
                  <th className="p-2">Telefon</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Sursă</th>
                  <th className="p-2">Google Match</th>
                </tr>
              </thead>
              <tbody>
                {items.map(row => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-2 text-xs">{fmtDate(row.created_at, false)}</td>
                    <td className="p-2 font-medium">{row.name}</td>
                    <td className="p-2 font-mono text-xs">{row.phone || '—'}</td>
                    <td className="p-2 text-xs text-gray-500">{row.email || '—'}</td>
                    <td className="p-2 text-xs">{row.source}</td>
                    <td className="p-2">
                      <span className={`text-xs ${row.synced_to_google ? 'text-green-600' : 'text-gray-400'}`}>
                        {row.synced_to_google ? '✓ sincronizat' : 'în așteptare'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
