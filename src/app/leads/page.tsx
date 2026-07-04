'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const STATUS_COLUMNS = ['new', 'confirmed', 'appointment_booked', 'arrived', 'work_in_progress', 'work_completed', 'conversion_sent'];
const STATUS_LABELS: Record<string, string> = {
  new: 'Nou',
  confirmed: 'Confirmat',
  appointment_booked: 'Programat',
  arrived: 'Sosit',
  work_in_progress: 'În lucru',
  work_completed: 'Finalizat',
  conversion_sent: 'Conversie',
};

export default function LeadsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [leads, setLeads] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    fetch('/api/leads?limit=100')
      .then(r => r.json())
      .then(data => setLeads(data.leads || []))
      .catch(() => {});
  }, []);

  if (status === 'loading') return <div className="p-8">Se încarcă...</div>;

  const grouped: Record<string, any[]> = {};
  STATUS_COLUMNS.forEach(c => { grouped[c] = leads.filter(l => l.status === c); });

  return (
    <div className="min-h-screen flex">
      <main className="flex-1 p-4">
        <h1 className="text-lg font-bold mb-4">Leaduri</h1>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {['all', 'itp', 'mecanica', 'gpl', 'diagnoza', 'electrica'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-sm ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
            >
              {f === 'all' ? 'Toate' : f.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Kanban */}
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STATUS_COLUMNS.map(status => {
            const items = filter === 'all'
              ? grouped[status]
              : grouped[status].filter(l => l.service_type === filter);

            return (
              <div key={status} className="min-w-[240px] bg-gray-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-500 mb-2">
                  {STATUS_LABELS[status]} ({items.length})
                </div>
                <div className="space-y-2">
                  {items.map(lead => (
                    <Link
                      key={lead.id}
                      href={`/leads/${lead.id}`}
                      className="block bg-white rounded border p-3 hover:shadow-sm"
                    >
                      <p className="text-sm font-medium">{lead.name || 'Necunoscut'}</p>
                      <p className="text-xs text-gray-400">{lead.phone}</p>
                      <p className="text-xs text-gray-400">{lead.car_make} {lead.car_model}</p>
                      <p className="text-xs mt-1 text-gray-500">{lead.source} • {lead.service_type}</p>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
