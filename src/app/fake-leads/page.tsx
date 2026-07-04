'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/shell';
import { fmtDate, EmptyState } from '@/components/ui';

export default function FakeLeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/leads?status=fake&limit=200')
      .then(r => r.json())
      .then(d => setLeads(d.leads || []))
      .catch(() => {});
  }, []);

  return (
    <Shell>
      <h1 className="text-lg font-bold mb-1">Leaduri fake</h1>
      <p className="text-sm text-gray-500 mb-4">
        {leads.length} marcate. Telefon/email blocate automat 180 zile.
      </p>
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500 text-xs uppercase">
              <th className="p-3">Dată</th>
              <th className="p-3">Nume</th>
              <th className="p-3">Telefon</th>
              <th className="p-3">Scor risc</th>
              <th className="p-3">Sursă</th>
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
              </tr>
            ))}
            {leads.length === 0 && (
              <tr><td colSpan={5}><EmptyState text="Niciun lead fake ✓" /></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
