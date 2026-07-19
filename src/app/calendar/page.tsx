'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Shell from '@/components/shell';
import { ServiceBadge, ActionButton, updateLeadStatus, fmtDate, EmptyState } from '@/components/ui';

export default function CalendarPage() {
  const [leads, setLeads] = useState<any[]>([]);

  const load = useCallback(() => {
    fetch('/api/leads?status=appointment_booked&limit=200')
      .then(r => r.json())
      .then(d => setLeads(d.leads || []))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, status: string) => { await updateLeadStatus(id, status); load(); };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const groups: [string, any[]][] = [
    ['Astăzi', leads.filter(l => l.appointment_at && new Date(l.appointment_at) >= today && new Date(l.appointment_at) < tomorrow)],
    ['Viitoare', leads.filter(l => l.appointment_at && new Date(l.appointment_at) >= tomorrow)],
    ['Fără dată', leads.filter(l => !l.appointment_at)],
  ];

  return (
    <Shell>
      <h1 className="text-lg font-bold mb-4">Programări</h1>

      {groups.map(([title, items]) => (
        <section key={title} className="mb-6">
          <h2 className="font-semibold mb-2 text-gray-700">{title} ({items.length})</h2>
          <div className="bg-white rounded-lg border divide-y">
            {items.length === 0 && <EmptyState text={title === 'Fără dată' ? 'Toate programările au dată ✓' : 'Nicio programare'} />}
            {items.map(lead => (
              <div key={lead.id} className="flex flex-wrap items-center gap-3 p-3 hover:bg-gray-50">
                <span className="font-mono text-sm font-medium min-w-[90px]">
                  {lead.appointment_at
                    ? title === 'Astăzi'
                      ? new Date(lead.appointment_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
                      : fmtDate(lead.appointment_at)
                    : '—'}
                </span>
                <Link href={`/leads/${lead.id}`} className="flex-1 min-w-0">
                  <span className="font-medium">{lead.name || 'Necunoscut'}</span>
                  <span className="text-gray-400 text-sm ml-2">{lead.phone}</span>
                  {lead.registration_number && <span className="text-xs font-bold text-gray-700 ml-2">{lead.registration_number}</span>}
                </Link>
                <ServiceBadge type={lead.service_type} />
                <span className="text-xs text-gray-400">{lead.car_make} {lead.car_model}</span>
                <ActionButton label="A sosit" color="amber" small onClick={() => act(lead.id, 'arrived')} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </Shell>
  );
}
