'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ITPPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    fetch('/api/leads?service_type=itp&limit=100')
      .then(r => r.json())
      .then(data => setLeads(data.leads || []))
      .catch(() => {});
  }, []);

  if (status === 'loading') return <div className="p-8">Se încarcă...</div>;

  const pendingITP = leads.filter(l => ['confirmed', 'appointment_booked', 'arrived'].includes(l.status));
  const doneITP = leads.filter(l => ['work_completed', 'conversion_sent'].includes(l.status));

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <Link href="/leads" className="text-sm text-blue-600 mb-4 inline-block">← Înapoi</Link>
      <h1 className="text-xl font-bold mb-4">🔍 ITP — Inspecția Tehnică Periodică</h1>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-400">În așteptare</p>
          <p className="text-2xl font-bold">{pendingITP.length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-400">Finalizate astăzi</p>
          <p className="text-2xl font-bold">{doneITP.length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-400">Total</p>
          <p className="text-2xl font-bold">{leads.length}</p>
        </div>
      </div>

      <h2 className="font-semibold mb-3">Programări ITP</h2>
      <div className="bg-white rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="p-3">Dată</th>
              <th className="p-3">Nume</th>
              <th className="p-3">Mașină</th>
              <th className="p-3">Înmatriculare</th>
              <th className="p-3">Status</th>
              <th className="p-3">Acțiune</th>
            </tr>
          </thead>
          <tbody>
            {pendingITP.map(lead => (
              <tr key={lead.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="p-3 text-xs">{lead.appointment_at ? new Date(lead.appointment_at).toLocaleString('ro-RO') : '—'}</td>
                <td className="p-3">{lead.name || '—'}</td>
                <td className="p-3 text-xs">{lead.car_make} {lead.car_model} {lead.car_year}</td>
                <td className="p-3 font-mono text-xs">{lead.registration_number || '—'}</td>
                <td className="p-3">
                  <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs">{lead.status}</span>
                </td>
                <td className="p-3">
                  <Link href={`/leads/${lead.id}`} className="text-blue-600 text-xs hover:underline">Detalii →</Link>
                </td>
              </tr>
            ))}
            {pendingITP.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400">Nicio programare ITP activă</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
