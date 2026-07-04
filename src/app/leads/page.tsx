'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Shell from '@/components/shell';
import { StatusBadge, ServiceBadge, ActionButton, NEXT_ACTIONS, STATUS_LABELS, updateLeadStatus, fmtDate } from '@/components/ui';

const PIPELINE = ['new', 'confirmed', 'appointment_booked', 'arrived', 'work_completed'];
const SERVICE_FILTERS = ['all', 'itp', 'mecanica', 'gpl', 'aer_conditionat', 'diagnoza', 'electrica'];

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    fetch('/api/leads?limit=200').then(r => r.json()).then(d => setLeads(d.leads || [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, status: string) => { await updateLeadStatus(id, status); load(); };

  const q = search.toLowerCase().trim();
  const visible = leads.filter(l => {
    if (filter !== 'all' && l.service_type !== filter) return false;
    if (!q) return true;
    return [l.name, l.phone, l.registration_number, l.car_make, l.car_model]
      .some(v => v && String(v).toLowerCase().includes(q));
  });

  return (
    <Shell>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="text-lg font-bold">Leaduri</h1>
        <input
          type="search"
          placeholder="Caută nume / telefon / nr. înmatriculare…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] max-w-md border rounded-md px-3 py-1.5 text-sm"
        />
      </div>

      {/* Service filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {SERVICE_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-sm ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            {f === 'all' ? 'Toate' : f === 'aer_conditionat' ? 'AC' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE.map(status => {
          const items = visible.filter(l => l.status === status);
          return (
            <div key={status} className="min-w-[260px] w-[260px] shrink-0 bg-gray-100 rounded-lg p-2">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs font-semibold text-gray-600 uppercase">{STATUS_LABELS[status]}</span>
                <span className="text-xs bg-white rounded-full px-2 py-0.5 font-medium">{items.length}</span>
              </div>
              <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                {items.map(lead => (
                  <div key={lead.id} className="bg-white rounded-md border p-3 hover:shadow">
                    <Link href={`/leads/${lead.id}`} className="block">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{lead.name || 'Necunoscut'}</p>
                        <ServiceBadge type={lead.service_type} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{lead.phone}</p>
                      <p className="text-xs text-gray-400">{lead.car_make} {lead.car_model} {lead.registration_number ? `· ${lead.registration_number}` : ''}</p>
                      {lead.appointment_at && <p className="text-xs text-purple-600 mt-1">📅 {fmtDate(lead.appointment_at)}</p>}
                    </Link>
                    <div className="flex gap-1.5 mt-2">
                      {(NEXT_ACTIONS[lead.status] || []).map(([label, next, color]) => (
                        <ActionButton key={next} label={label} color={color} small onClick={() => act(lead.id, next)} />
                      ))}
                    </div>
                  </div>
                ))}
                {items.length === 0 && <p className="text-xs text-gray-400 text-center py-4">—</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}
