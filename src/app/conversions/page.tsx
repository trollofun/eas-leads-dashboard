'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/shell';
import { fmtDate, EmptyState } from '@/components/ui';

interface QueueItem {
  id: string;
  created_at: string;
  conversion_event: string;
  transaction_id: string;
  status: string;
  attempts: number;
  last_error: string | null;
  lead?: { name: string | null; phone: string | null };
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  sent: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  skipped: 'bg-gray-100 text-gray-500',
};

const STATUS_RO: Record<string, string> = {
  all: 'Toate', pending: 'În așteptare', sent: 'Trimise', failed: 'Eșuate', skipped: 'Omise',
};

export default function ConversionsPage() {
  const [jobs, setJobs] = useState<QueueItem[]>([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const url = filter === 'all' ? '/api/conversions' : `/api/conversions?status=${filter}`;
    fetch(url).then(r => r.json()).then(d => setJobs(d.jobs || [])).catch(() => {});
  }, [filter]);

  return (
    <Shell>
      <h1 className="text-lg font-bold mb-4">Conversii Google</h1>

      <div className="flex gap-2 mb-4 flex-wrap">
        {Object.entries(STATUS_RO).map(([f, label]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-sm ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500 text-xs uppercase">
              <th className="p-3">Dată</th>
              <th className="p-3">Client</th>
              <th className="p-3">Eveniment</th>
              <th className="p-3">Status</th>
              <th className="p-3">Încercări</th>
              <th className="p-3">Eroare</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => (
              <tr key={job.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="p-3 text-xs whitespace-nowrap">{fmtDate(job.created_at)}</td>
                <td className="p-3 text-xs">{job.lead?.name || '—'} <span className="text-gray-400">{job.lead?.phone}</span></td>
                <td className="p-3 text-xs font-mono">{job.conversion_event}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[job.status] || ''}`}>
                    {STATUS_RO[job.status] || job.status}
                  </span>
                </td>
                <td className="p-3 text-xs text-center">{job.attempts}</td>
                <td className="p-3 text-xs text-red-500 max-w-[240px] truncate" title={job.last_error || ''}>{job.last_error || '—'}</td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr><td colSpan={6}><EmptyState text="Nicio conversie" /></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
