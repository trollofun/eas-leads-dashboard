'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Home, Users, Wrench, ClipboardCheck, Settings, AlertTriangle, ArrowRightLeft, Calendar } from 'lucide-react';

interface KPI {
  label: string;
  value: number;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [kpis, setKpis] = useState<KPI[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    fetch('/api/leads/stats')
      .then(r => r.json())
      .then(setKpis)
      .catch(() => {});
  }, []);

  if (status === 'loading') return <div className="p-8">Se încarcă...</div>;

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r p-4 flex flex-col gap-2">
        <h2 className="text-sm font-bold text-gray-400 uppercase mb-4">EAS Leads</h2>

        <NavItem href="/leads" icon={<Users size={16} />} label="Leaduri" />
        <NavItem href="/itp" icon={<ClipboardCheck size={16} />} label="ITP" />
        <NavItem href="/service" icon={<Wrench size={16} />} label="Service" />
        <NavItem href="/calendar" icon={<Calendar size={16} />} label="Programări" />
        <NavItem href="/conversions" icon={<ArrowRightLeft size={16} />} label="Conversii" />
        <NavItem href="/fake-leads" icon={<AlertTriangle size={16} />} label="Fake" />
        <NavItem href="/settings" icon={<Settings size={16} />} label="Setări" />
      </aside>

      {/* Main */}
      <main className="flex-1 p-6">
        {/* KPI bar */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {kpis.map((kpi, i) => (
            <div key={i} className="bg-white rounded-lg p-3 border">
              <p className="text-xs text-gray-400">{kpi.label}</p>
              <p className="text-2xl font-bold">{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-2">Leaduri recente</h3>
          <RecentLeads />
        </div>
      </main>
    </div>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3 py-2 rounded text-sm text-gray-700 hover:bg-gray-100"
    >
      {icon}
      {label}
    </Link>
  );
}

function RecentLeads() {
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/leads?limit=10')
      .then(r => r.json())
      .then(data => setLeads(data.leads || []))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-2">
      {leads.map((lead) => (
        <Link
          key={lead.id}
          href={`/leads/${lead.id}`}
          className="flex items-center justify-between p-2 hover:bg-gray-50 rounded text-sm border-b last:border-0"
        >
          <div className="flex items-center gap-3">
            <StatusBadge status={lead.status} />
            <span className="font-medium">{lead.name || 'Necunoscut'}</span>
            <span className="text-gray-400">{lead.phone}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-400 text-xs">
            <ServiceBadge type={lead.service_type} />
            <span>{lead.source}</span>
            <span>{new Date(lead.created_at).toLocaleString('ro')}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700',
    confirmed: 'bg-green-100 text-green-700',
    fake: 'bg-red-100 text-red-700',
    appointment_booked: 'bg-purple-100 text-purple-700',
    arrived: 'bg-amber-100 text-amber-700',
    work_completed: 'bg-green-100 text-green-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function ServiceBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    itp: 'ITP',
    mecanica: 'Mecanică',
    gpl: 'GPL',
    aer_conditionat: 'AC',
    diagnoza: 'Diagnoză',
    electrica: 'Electrică',
    revizie: 'Revizie',
  };
  return <span className="uppercase">{labels[type] || type}</span>;
}
