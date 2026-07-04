'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ServicePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    fetch('/api/leads?limit=100')
      .then(r => r.json())
      .then(data => setLeads((data.leads || []).filter((l: any) => l.service_type !== 'itp')))
      .catch(() => {});
  }, []);

  if (status === 'loading') return <div className="p-8">Se încarcă...</div>;

  const active = leads.filter(l => ['confirmed', 'appointment_booked', 'arrived', 'work_in_progress'].includes(l.status));

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <Link href="/leads" className="text-sm text-blue-600 mb-4 inline-block">← Înapoi</Link>
      <h1 className="text-xl font-bold mb-4">🔧 Service — Mecanică & Alte Servicii</h1>

      <div className="bg-white rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
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
                <td className="p-3">{lead.name || '—'}</td>
                <td className="p-3 text-xs">{lead.service_type}</td>
                <td className="p-3 text-xs">{lead.car_make} {lead.car_model}</td>
                <td className="p-3"><span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs">{lead.status}</span></td>
                <td className="p-3"><Link href={`/leads/${lead.id}`} className="text-blue-600 text-xs hover:underline">→</Link></td>
              </tr>
            ))}
            {active.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400">Niciun service activ</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
