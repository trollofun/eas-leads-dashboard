'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Shell from '@/components/shell';
import { StatusBadge, ActionButton, NEXT_ACTIONS, updateLeadStatus, fmtDate, EmptyState } from '@/components/ui';

export default function ITPPage() {
  const [leads, setLeads] = useState<any[]>([]);

  const load = useCallback(() => {
    fetch('/api/leads?service_type=itp&limit=200')
      .then(r => r.json())
      .then(d => setLeads(d.leads || []))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, status: string) => { await updateLeadStatus(id, status); load(); };

  const pending = leads.filter(l => ['new', 'confirmed', 'appointment_booked', 'arrived'].includes(l.status));
  const done = leads.filter(l => ['work_completed', 'invoiced', 'conversion_sent'].includes(l.status));

  return (
    <Shell>
      <h1 className="text-lg font-bold mb-4">ITP — Inspecția Tehnică Periodică</h1>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Active" value={pending.length} />
        <Stat label="Finalizate" value={done.length} />
        <Stat label="Total" value={leads.length} />
      </div>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500 text-xs uppercase">
              <th className="p-3">Programare</th>
              <th className="p-3">Nume</th>
              <th className="p-3">Telefon</th>
              <th className="p-3">Nr. înmatr.</th>
              <th className="p-3">Status</th>
              <th className="p-3">Acțiune</th>
            </tr>
          </thead>
          <tbody>
            {pending.map(lead => (
              <tr key={lead.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="p-3 text-xs whitespace-nowrap">{fmtDate(lead.appointment_at)}</td>
                <td className="p-3"><Link href={`/leads/${lead.id}`} className="font-medium hover:text-blue-600">{lead.name || '—'}</Link></td>
                <td className="p-3 text-xs">{lead.phone ? <a href={`tel:${lead.phone}`} className="text-blue-600">{lead.phone}</a> : '—'}</td>
                <td className="p-3 font-mono text-xs font-bold">{lead.registration_number || '—'}</td>
                <td className="p-3"><StatusBadge status={lead.status} /></td>
                <td className="p-3">
                  <div className="flex gap-1.5">
                    {(NEXT_ACTIONS[lead.status] || []).map(([label, next, color]) => (
                      <ActionButton key={next} label={label} color={color} small onClick={() => act(lead.id, next)} />
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {pending.length === 0 && (
              <tr><td colSpan={6}><EmptyState text="Nicio programare ITP activă" /></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
