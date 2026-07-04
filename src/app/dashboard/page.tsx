'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Shell from '@/components/shell';
import { StatusBadge, ServiceBadge, ActionButton, NEXT_ACTIONS, updateLeadStatus, fmtDate, EmptyState } from '@/components/ui';

interface KPI { label: string; value: number }

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [leads, setLeads] = useState<any[]>([]);

  const load = useCallback(() => {
    fetch('/api/leads/stats').then(r => r.json()).then(d => Array.isArray(d) && setKpis(d)).catch(() => {});
    fetch('/api/leads?limit=50').then(r => r.json()).then(d => setLeads(d.leads || [])).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000); // auto-refresh: reception leaves this open all day
    return () => clearInterval(t);
  }, [load]);

  const needsAction = leads.filter(l => l.status === 'new');
  const inProgress = leads.filter(l => ['confirmed', 'appointment_booked', 'arrived'].includes(l.status));

  const act = async (id: string, status: string) => { await updateLeadStatus(id, status); load(); };

  return (
    <Shell>
      {/* KPI strip — only the 4 that matter at a glance */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {kpis.slice(0, 4).map((kpi, i) => (
          <div key={i} className="bg-white rounded-lg p-4 border">
            <p className="text-xs text-gray-500">{kpi.label}</p>
            <p className="text-3xl font-bold mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* PRIORITY 1: leads that need action right now */}
      <section className="mb-6">
        <h2 className="flex items-center gap-2 font-semibold mb-3">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${needsAction.length ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
          De procesat acum ({needsAction.length})
        </h2>
        <div className="bg-white rounded-lg border divide-y">
          {needsAction.length === 0 && <EmptyState text="Niciun lead nou. Totul procesat ✓" />}
          {needsAction.map(lead => (
            <div key={lead.id} className="flex flex-wrap items-center gap-3 p-3 hover:bg-gray-50">
              <Link href={`/leads/${lead.id}`} className="flex-1 min-w-0">
                <p className="font-medium truncate">{lead.name || 'Necunoscut'} <span className="text-gray-400 font-normal">{lead.phone}</span></p>
                <p className="text-xs text-gray-500 mt-0.5">
                  <ServiceBadge type={lead.service_type} /> · {lead.car_make} {lead.car_model} · {fmtDate(lead.created_at)}
                </p>
              </Link>
              <div className="flex gap-2">
                {(NEXT_ACTIONS.new || []).map(([label, next, color]) => (
                  <ActionButton key={next} label={label} color={color} small onClick={() => act(lead.id, next)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRIORITY 2: pipeline in progress */}
      <section>
        <h2 className="font-semibold mb-3">În lucru ({inProgress.length})</h2>
        <div className="bg-white rounded-lg border divide-y">
          {inProgress.length === 0 && <EmptyState text="Nimic în lucru" />}
          {inProgress.map(lead => (
            <div key={lead.id} className="flex flex-wrap items-center gap-3 p-3 hover:bg-gray-50">
              <StatusBadge status={lead.status} />
              <Link href={`/leads/${lead.id}`} className="flex-1 min-w-0">
                <span className="font-medium">{lead.name || 'Necunoscut'}</span>
                <span className="text-gray-400 text-sm ml-2">{lead.phone}</span>
                <span className="text-xs text-gray-400 ml-2">{lead.appointment_at ? `📅 ${fmtDate(lead.appointment_at)}` : ''}</span>
              </Link>
              <div className="flex gap-2">
                {(NEXT_ACTIONS[lead.status] || []).map(([label, next, color]) => (
                  <ActionButton key={next} label={label} color={color} small onClick={() => act(lead.id, next)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}
