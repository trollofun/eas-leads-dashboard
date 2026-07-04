'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function FakeLeadsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    fetch('/api/leads?status=fake&limit=200')
      .then(r => r.json())
      .then(data => setLeads(data.leads || []))
      .catch(() => {});
  }, []);

  if (status === 'loading') return <div className="p-8">Se încarcă...</div>;

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <Link href="/leads" className="text-sm text-blue-600 mb-4 inline-block">← Înapoi la leaduri</Link>
      <h1 className="text-xl font-bold mb-4">🚫 Leaduri marcate Fake</h1>
      <p className="text-sm text-gray-500 mb-4">
        {leads.length} leaduri marcate ca fake. Semnalele de blocare sunt active 180 zile pentru telefon/email.
      </p>
      <div className="bg-white rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="p-3">Dată</th>
              <th className="p-3">Nume</th>
              <th className="p-3">Telefon</th>
              <th className="p-3">Scor</th>
              <th className="p-3">Motiv</th>
              <th className="p-3">Sursă</th>
            </tr>
          </thead>
          <tbody>
            {leads.map(lead => (
              <tr key={lead.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="p-3 text-xs">{new Date(lead.created_at).toLocaleDateString('ro-RO')}</td>
                <td className="p-3">{lead.name || '—'}</td>
                <td className="p-3">{lead.phone || '—'}</td>
                <td className="p-3">
                  <span className="px-2 py-1 rounded bg-red-100 text-red-700 font-mono text-xs">{lead.fake_score}</span>
                </td>
                <td className="p-3 text-xs text-gray-500">{lead.service_type}</td>
                <td className="p-3 text-xs text-gray-400">{lead.source}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400">Niciun lead fake</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
