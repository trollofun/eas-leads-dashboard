'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Shell from '@/components/shell';
import { StatusBadge, ServiceBadge, ActionButton, NEXT_ACTIONS, updateLeadStatus, fmtDate, EmptyState } from '@/components/ui';

export default function ServicePage() {
  const [leads, setLeads] = useState<any[]>([]);

  const load = useCallback(() => {
    fetch('/api/leads?limit=200')
      .then(r => r.json())
      .then(d => setLeads((d.leads || []).filter((l: any) => l.service_type !== 'itp')))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, status: string) => { await updateLeadStatus(id, status); load(); };

  const active = leads.filter(l => ['new', 'confirmed', 'appointment_booked', 'arrived', 'work_in_progress'].includes(l.status));

  return (
    <Shell>
      <h1 className="text-lg font-bold mb-4">Service — Mecanică & alte lucrări</h1>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500 text-xs uppercase">
              <th className="p-3">Programare</th>
              <th className="p-3">Nume</th>
              <th className="p-3">Serviciu</th>
              <th className="p-3">Mașină</th>
              <th className="p-3">Status</th>
              <th className="p-3">Acțiune</th>
            </tr>
          </thead>
          <tbody>
            {active.map(lead => (
              <tr key={lead.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="p-3 text-xs whitespace-nowrap">{fmtDate(lead.appointment_at)}</td>
                <td className="p-3"><Link href={`/leads/${lead.id}`} className="font-medium hover:text-blue-600">{lead.name || '—'}</Link></td>
                <td className="p-3"><ServiceBadge type={lead.service_type} /></td>
                <td className="p-3 text-xs">{lead.car_make} {lead.car_model}</td>
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
            {active.length === 0 && (
              <tr><td colSpan={6}><EmptyState text="Niciun service activ" /></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
