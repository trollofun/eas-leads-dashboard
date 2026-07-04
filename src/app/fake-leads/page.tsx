'use client';

import { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/shell';
import { ActionButton, fmtDate, EmptyState } from '@/components/ui';

export default function FakeLeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const load = useCallback(() => {
    fetch('/api/leads?status=fake&limit=200')
      .then(r => r.json())
      .then(d => setLeads(d.leads || []))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const unsyncedCount = leads.filter(l => !l.fake_synced_to_google).length;

  const syncExclusions = async () => {
    setSyncing(true); setSyncMsg('');
    try {
      const res = await fetch('/api/fake-leads/sync', { method: 'POST' });
      const d = await res.json();
      setSyncMsg(d.errors?.length ? `⚠ ${d.synced} sync, eroare: ${d.errors[0].slice(0, 80)}` : `✓ ${d.synced} trimiși în lista de excludere Google Ads`);
      load();
    } catch {
      setSyncMsg('Eroare la sincronizare');
    }
    setSyncing(false);
  };

  return (
    <Shell>
      <h1 className="text-lg font-bold mb-1">Leaduri fake</h1>
      <p className="text-sm text-gray-500 mb-4">
        {leads.length} marcate. Telefon/email blocate automat 180 zile.
      </p>

      <div className="bg-white rounded-lg border p-4 mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Excludere Google Ads</p>
          <p className="text-xs text-gray-500">
            {unsyncedCount > 0 ? `${unsyncedCount} de trimis în lista „Excluderi - Fake Leads"` : 'Toate sincronizate ✓'}
            {' '}— Google nu le va mai afișa reclame, iar Smart Bidding evită utilizatori similari.
          </p>
        </div>
        <ActionButton
          label={syncing ? 'Se trimite...' : '🚫 Exclude din Ads'}
          onClick={syncExclusions}
          disabled={syncing || unsyncedCount === 0}
          small
        />
      </div>
      {syncMsg && <p className="text-xs text-gray-600 mb-4">{syncMsg}</p>}

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500 text-xs uppercase">
              <th className="p-3">Dată</th>
              <th className="p-3">Nume</th>
              <th className="p-3">Telefon</th>
              <th className="p-3">Scor risc</th>
              <th className="p-3">Sursă</th>
              <th className="p-3">Exclus Ads</th>
            </tr>
          </thead>
          <tbody>
            {leads.map(lead => (
              <tr key={lead.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="p-3 text-xs">{fmtDate(lead.created_at, false)}</td>
                <td className="p-3">{lead.name || '—'}</td>
                <td className="p-3 font-mono text-xs">{lead.phone || '—'}</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-mono text-xs">{lead.fake_score}</span>
                </td>
                <td className="p-3 text-xs text-gray-400">{lead.source}</td>
                <td className="p-3 text-xs">
                  {lead.fake_synced_to_google ? <span className="text-green-600">✓</span> : <span className="text-gray-400">—</span>}
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr><td colSpan={6}><EmptyState text="Niciun lead fake ✓" /></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
