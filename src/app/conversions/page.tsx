'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface QueueItem {
  id: string;
  created_at: string;
  conversion_event: string;
  transaction_id: string;
  status: string;
  attempts: number;
  last_error: string | null;
  request_id: string | null;
  lead?: { name: string | null; phone: string | null };
}

export default function ConversionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [jobs, setJobs] = useState<QueueItem[]>([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    const url = filter === 'all' ? '/api/conversions' : `/api/conversions?status=${filter}`;
    fetch(url)
      .then(r => r.json())
      .then(data => setJobs(data.jobs || []))
      .catch(() => {});
  }, [filter]);

  if (status === 'loading') return <div className="p-8">Se încarcă...</div>;

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    sent: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    skipped: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <Link href="/leads" className="text-sm text-blue-600 mb-4 inline-block">← Înapoi</Link>
      <h1 className="text-xl font-bold mb-4">🔄 Coadă Conversii Google</h1>

      <div className="flex gap-2 mb-4">
        {['all', 'pending', 'sent', 'failed', 'skipped'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-sm ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {f === 'all' ? 'Toate' : f}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="p-3">Dată</th>
              <th className="p-3">Eveniment</th>
              <th className="p-3">Transaction ID</th>
              <th className="p-3">Status</th>
              <th className="p-3">Încercări</th>
              <th className="p-3">Request ID</th>
              <th className="p-3">Eroare</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => (
              <tr key={job.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="p-3 text-xs">{new Date(job.created_at).toLocaleString('ro-RO')}</td>
                <td className="p-3 text-xs font-mono">{job.conversion_event}</td>
                <td className="p-3 text-xs text-gray-500 max-w-[120px] truncate">{job.transaction_id}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs ${statusColors[job.status] || ''}`}>
                    {job.status}
                  </span>
                </td>
                <td className="p-3 text-xs text-center">{job.attempts}</td>
                <td className="p-3 text-xs text-gray-400">{job.request_id || '—'}</td>
                <td className="p-3 text-xs text-red-500 max-w-[200px] truncate">{job.last_error || '—'}</td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-gray-400">Nicio conversie în coadă</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
