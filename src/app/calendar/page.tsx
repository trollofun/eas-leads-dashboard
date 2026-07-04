'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    fetch('/api/leads?status=appointment_booked&limit=100')
      .then(r => r.json())
      .then(data => setLeads(data.leads || []))
      .catch(() => {});
  }, []);

  if (status === 'loading') return <div className="p-8">Se încarcă...</div>;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayAppts = leads.filter(l => {
    if (!l.appointment_at) return false;
    const d = new Date(l.appointment_at);
    return d >= today && d < tomorrow;
  });

  const futureAppts = leads.filter(l => {
    if (!l.appointment_at) return false;
    const d = new Date(l.appointment_at);
    return d >= tomorrow;
  });

  const noDate = leads.filter(l => !l.appointment_at);

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <Link href="/leads" className="text-sm text-blue-600 mb-4 inline-block">← Înapoi</Link>
      <h1 className="text-xl font-bold mb-4">📅 Programări</h1>

      <h2 className="font-semibold mb-2">Astăzi ({todayAppts.length})</h2>
      <div className="bg-white rounded-lg border mb-6">
        {todayAppts.length === 0 ? (
          <p className="p-4 text-center text-gray-400 text-sm">Nicio programare astăzi</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {todayAppts.map(lead => (
                <tr key={lead.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-3">{new Date(lead.appointment_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="p-3">{lead.name || '—'}</td>
                  <td className="p-3 text-xs">{lead.service_type}</td>
                  <td className="p-3 text-xs">{lead.car_make} {lead.car_model}</td>
                  <td className="p-3"><Link href={`/leads/${lead.id}`} className="text-blue-600 text-xs">→</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="font-semibold mb-2">Viitoare ({futureAppts.length})</h2>
      <div className="bg-white rounded-lg border mb-6">
        {futureAppts.length === 0 ? (
          <p className="p-4 text-center text-gray-400 text-sm">Nicio programare viitoare</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {futureAppts.map(lead => (
                <tr key={lead.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-3 text-xs">{new Date(lead.appointment_at).toLocaleString('ro-RO')}</td>
                  <td className="p-3">{lead.name || '—'}</td>
                  <td className="p-3 text-xs">{lead.service_type}</td>
                  <td className="p-3"><Link href={`/leads/${lead.id}`} className="text-blue-600 text-xs">→</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="font-semibold mb-2">Fără dată ({noDate.length})</h2>
      <div className="bg-white rounded-lg border">
        {noDate.length === 0 ? (
          <p className="p-4 text-center text-gray-400 text-sm">Toate programările au dată</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {noDate.map(lead => (
                <tr key={lead.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-3">{lead.name || '—'}</td>
                  <td className="p-3 text-xs">{lead.service_type}</td>
                  <td className="p-3"><Link href={`/leads/${lead.id}`} className="text-blue-600 text-xs">→</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
