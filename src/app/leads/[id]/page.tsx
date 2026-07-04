'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function LeadDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (params.id) {
      fetch(`/api/leads/${params.id}`)
        .then(r => r.json())
        .then(setLead)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [params.id]);

  if (loading || status === 'loading') return <div className="p-8">Se încarcă...</div>;
  if (!lead) return <div className="p-8">Lead negăsit</div>;

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <Link href="/leads" className="text-sm text-blue-600 mb-4 inline-block">← Înapoi la leaduri</Link>

      <h1 className="text-xl font-bold mb-6">
        <StatusBadge status={lead.status} />
        <span className="ml-2">{lead.name || 'Necunoscut'}</span>
      </h1>

      {/* KPI bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <InfoCard label="Telefon" value={lead.phone || '—'} />
        <InfoCard label="Email" value={lead.email || '—'} />
        <InfoCard label="Mașină" value={`${lead.car_make || ''} ${lead.car_model || ''} ${lead.car_year || ''}`} />
        <InfoCard label="Înmatriculare" value={lead.registration_number || '—'} />
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mb-6">
        {lead.status === 'new' && (
          <>
            <ActionButton label="Confirmă" color="green" onClick={() => updateStatus(lead.id, 'confirmed')} />
            <ActionButton label="Fake" color="red" onClick={() => updateStatus(lead.id, 'fake')} />
          </>
        )}
        {lead.status === 'confirmed' && (
          <ActionButton label="Programează" color="blue" onClick={() => updateStatus(lead.id, 'appointment_booked')} />
        )}
        {lead.status === 'appointment_booked' && (
          <ActionButton label="Sosit" color="amber" onClick={() => updateStatus(lead.id, 'arrived')} />
        )}
        {lead.status === 'arrived' && lead.service_type === 'itp' && (
          <ActionButton label="ITP admis" color="green" onClick={() => updateStatus(lead.id, 'itp_done')} />
        )}
        {lead.status === 'arrived' && (
          <ActionButton label="Finalizat" color="green" onClick={() => updateStatus(lead.id, 'work_completed')} />
        )}
        {lead.status === 'work_completed' && (
          <ActionButton label="Facturat" color="blue" onClick={() => updateStatus(lead.id, 'invoiced')} />
        )}
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-6">
        <Section title="Detalii">
          <InfoRow label="Sursă" value={lead.source} />
          <InfoRow label="Serviciu" value={lead.service_type} />
          <InfoRow label="Mesaj" value={lead.message || '—'} />
          <InfoRow label="Scor risc" value={String(lead.fake_score)} />
          <InfoRow label="Notă internă" value={lead.internal_notes || '—'} />
          <InfoRow label="Programare" value={lead.appointment_at ? new Date(lead.appointment_at).toLocaleString('ro') : '—'} />
          <InfoRow label="Sosit la" value={lead.arrived_at ? new Date(lead.arrived_at).toLocaleString('ro') : '—'} />
        </Section>

        <Section title="Conversie Google">
          <InfoRow label="Status conversie" value={lead.google_conversion_status || 'not_ready'} />
          <InfoRow label="Trimis la" value={lead.google_conversion_sent_at ? new Date(lead.google_conversion_sent_at).toLocaleString('ro') : '—'} />
          <InfoRow label="Transaction ID" value={lead.google_transaction_id || '—'} />
          <InfoRow label="Valoare estimată" value={lead.estimated_value ? `${lead.estimated_value} RON` : '—'} />
          <InfoRow label="Valoare finală" value={lead.final_value ? `${lead.final_value} RON` : '—'} />
        </Section>
      </div>

      {/* Event log */}
      <Section title="Istoric evenimente" className="mt-6">
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {lead.lead_events?.map((event: any) => (
            <div key={event.id} className="flex items-center gap-3 text-sm border-b pb-2">
              <span className="text-gray-400 text-xs">{new Date(event.created_at).toLocaleString('ro')}</span>
              <span className="font-medium">{event.event_type}</span>
              {event.from_status && <span className="text-gray-400">{event.from_status} → {event.to_status}</span>}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function updateStatus(leadId: string, status: string) {
  fetch(`/api/leads/${leadId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  }).then(() => window.location.reload());
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border rounded p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium mt-1">{value}</p>
    </div>
  );
}

function ActionButton({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  const colors: Record<string, string> = {
    green: 'bg-green-600 hover:bg-green-700',
    red: 'bg-red-600 hover:bg-red-700',
    blue: 'bg-blue-600 hover:bg-blue-700',
    amber: 'bg-amber-600 hover:bg-amber-700',
  };
  return (
    <button onClick={onClick} className={`${colors[color]} text-white px-4 py-2 rounded text-sm font-medium`}>
      {label}
    </button>
  );
}

function Section({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border rounded-lg p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-500 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1 border-b last:border-0">
      <span className="text-gray-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}
