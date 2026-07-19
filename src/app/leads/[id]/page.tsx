'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Shell from '@/components/shell';
import { StatusBadge, ServiceBadge, ActionButton, NEXT_ACTIONS, updateLeadStatus, fmtDate, Spinner, STATUS_LABELS } from '@/components/ui';

export default function LeadDetailPage() {
  const params = useParams();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [finalValue, setFinalValue] = useState('');
  const [appointmentAt, setAppointmentAt] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!params.id) return;
    fetch(`/api/leads/${params.id}`)
      .then(r => r.json())
      .then(l => {
        setLead(l);
        setNotes(l.internal_notes || '');
        setFinalValue(l.final_value ? String(l.final_value) : '');
        setAppointmentAt(l.appointment_at ? new Date(l.appointment_at).toISOString().slice(0, 16) : '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  const save = async (fields: Record<string, any>) => {
    setSaving(true);
    await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    setSaving(false);
    load();
  };

  const act = async (status: string) => {
    if (status === 'work_completed' && !finalValue) {
      const v = window.prompt('Valoare finală lucrare (RON)? Lasă gol pentru valoarea implicită.');
      if (v) await save({ final_value: Number(v) });
    }
    await updateLeadStatus(lead.id, status);
    load();
  };

  if (loading) return <Shell><Spinner /></Shell>;
  if (!lead || lead.error) return <Shell><p className="p-8">Lead negăsit</p></Shell>;

  const raw = lead.raw_metadata?.original_body || {};
  const tracking = lead.ad_click || {};
  const car = [lead.car_make, lead.car_model, lead.car_year].filter(Boolean).join(' ');

  return (
    <Shell>
      <Link href="/leads" className="text-sm text-blue-600 mb-3 inline-block">← Leaduri</Link>

      <div className="bg-white rounded-lg border p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={lead.status} />
          <ServiceBadge type={lead.service_type} />
          {lead.registration_number && <span className="px-3 py-1 rounded bg-slate-900 text-white text-sm font-bold tracking-wide">{lead.registration_number}</span>}
          {lead.fake_score > 40 && <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs font-semibold">risc {lead.fake_score}/100</span>}
        </div>
        <h1 className="text-2xl font-bold mt-3">{lead.name || 'Necunoscut'}</h1>
        <div className="flex flex-wrap gap-4 mt-2 text-sm">
          {lead.phone && <a href={`tel:${lead.phone}`} className="text-blue-600 font-medium">{lead.phone}</a>}
          {lead.email && <a href={`mailto:${lead.email}`} className="text-blue-600">{lead.email}</a>}
          <span className="text-gray-500">Creat: {fmtDate(lead.created_at)}</span>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {(NEXT_ACTIONS[lead.status] || []).map(([label, next, color]) => (
            <ActionButton key={next} label={label} color={color} onClick={() => act(next)} />
          ))}
          {lead.status !== 'fake' && <ActionButton label="Lead nevalid" color="gray" onClick={() => act('fake')} />}
        </div>
      </div>

      <div className="grid xl:grid-cols-3 gap-4">
        <Panel title="Client">
          <InfoRow label="Nume" value={lead.name || '—'} />
          <InfoRow label="Telefon" value={lead.phone || '—'} />
          <InfoRow label="Email" value={lead.email || '—'} />
          <InfoRow label="Mesaj" value={lead.message || raw.message || raw.mesaj || '—'} />
        </Panel>

        <Panel title="Vehicul / ITP">
          <InfoRow label="Nr. înmatriculare" value={lead.registration_number || raw.numar_inmatriculare || raw.registration_number || raw.nr_inmatriculare || '—'} strong />
          <InfoRow label="Mașină" value={car || '—'} />
          <InfoRow label="Data dorită" value={raw.data_programarii_itp || raw.data || raw.date || '—'} />
          <InfoRow label="Serviciu" value={lead.service_type || '—'} />
        </Panel>

        <Panel title="Reconciliere">
          <InfoRow label="Status" value={STATUS_LABELS[lead.status] || lead.status} />
          <InfoRow label="Programare" value={fmtDate(lead.appointment_at)} />
          <InfoRow label="Sosit la" value={fmtDate(lead.arrived_at)} />
          <InfoRow label="Valoare finală" value={lead.final_value ? `${lead.final_value} RON` : '—'} />
        </Panel>

        <Panel title="Operațional">
          <label className="block text-xs text-gray-500 mb-1">Programare</label>
          <div className="flex gap-2 mb-3">
            <input type="datetime-local" value={appointmentAt} onChange={e => setAppointmentAt(e.target.value)} className="border rounded px-2 py-1.5 text-sm flex-1" />
            <ActionButton label="Salvează" small disabled={saving} onClick={() => save({ appointment_at: appointmentAt ? new Date(appointmentAt).toISOString() : null })} />
          </div>
          <label className="block text-xs text-gray-500 mb-1">Valoare finală (RON)</label>
          <div className="flex gap-2 mb-3">
            <input type="number" value={finalValue} onChange={e => setFinalValue(e.target.value)} placeholder={lead.estimated_value ? `estimat: ${lead.estimated_value}` : '—'} className="border rounded px-2 py-1.5 text-sm flex-1" />
            <ActionButton label="Salvează" small disabled={saving} onClick={() => save({ final_value: finalValue ? Number(finalValue) : null })} />
          </div>
          <label className="block text-xs text-gray-500 mb-1">Notă internă</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="border rounded px-2 py-1.5 text-sm w-full mb-2" />
          <ActionButton label="Salvează nota" small disabled={saving} onClick={() => save({ internal_notes: notes })} />
        </Panel>

        <Panel title="Tracking PPC / formular">
          <InfoRow label="Sursă lead" value={lead.source || '—'} />
          <InfoRow label="GCLID" value={tracking.gclid || raw.gclid || raw.gcl_id || '—'} />
          <InfoRow label="Landing page" value={tracking.landing_page || raw.page_url || raw.form_url || '—'} />
          <InfoRow label="UTM" value={[tracking.utm_source, tracking.utm_medium, tracking.utm_campaign].filter(Boolean).join(' / ') || '—'} />
          <InfoRow label="Google lead ID" value={raw.lead_id || '—'} />
          <InfoRow label="Campaign / Adgroup" value={[raw.campaign_id, raw.adgroup_id].filter(Boolean).join(' / ') || '—'} />
          <InfoRow label="Creative" value={raw.creative_id || '—'} />
          <InfoRow label="Telefon verificat" value={raw.user_column_data?.find?.((c: any) => c.column_id === 'PHONE_NUMBER_VERIFIED')?.string_value || '—'} />
          <InfoRow label="User agent" value={tracking.user_agent || raw.user_agent || raw.meta?.user_agent || '—'} />
        </Panel>

        <Panel title="Conversii Google Ads">
          <InfoRow label="Status conversie" value={lead.google_conversion_status || 'not_ready'} />
          <InfoRow label="Trimisă la" value={fmtDate(lead.google_conversion_sent_at)} />
          <InfoRow label="Transaction ID" value={lead.google_transaction_id || '—'} />
          <InfoRow label="Idempotency" value={lead.idempotency_key || '—'} />
        </Panel>
      </div>

      <div className="bg-white rounded-lg border p-4 mt-4">
        <h3 className="text-sm font-semibold text-gray-500 mb-3">Istoric</h3>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {(lead.lead_events || []).map((event: any) => (
            <div key={event.id} className="flex items-baseline gap-3 text-sm">
              <span className="text-gray-400 text-xs whitespace-nowrap">{fmtDate(event.created_at)}</span>
              <span>{event.event_type === 'status_changed' && event.to_status
                ? `${STATUS_LABELS[event.from_status] || event.from_status || '?'} → ${STATUS_LABELS[event.to_status] || event.to_status}`
                : event.event_type}</span>
            </div>
          ))}
          {(!lead.lead_events || lead.lead_events.length === 0) && <p className="text-sm text-gray-400">Fără evenimente</p>}
        </div>
      </div>
    </Shell>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="min-w-0 bg-white rounded-lg border p-4"><h3 className="text-sm font-semibold text-gray-500 mb-3">{title}</h3>{children}</section>;
}

function InfoRow({ label, value, strong = false }: { label: string; value: any; strong?: boolean }) {
  return (
    <div className="flex flex-col gap-1 text-sm py-2 border-b last:border-0 sm:flex-row sm:justify-between sm:gap-4">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`min-w-0 break-all sm:text-right ${strong ? 'font-bold text-gray-900' : ''}`}>{value || '—'}</span>
    </div>
  );
}
