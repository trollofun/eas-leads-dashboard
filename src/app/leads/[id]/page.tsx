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

  const act = async (status: string) => {
    // work_completed with no final value: prompt inline (value drives Google conversion)
    if (status === 'work_completed' && !finalValue) {
      const v = window.prompt('Valoare finală lucrare (RON)? Lasă gol pentru valoarea implicită.');
      if (v) await save({ final_value: Number(v) });
    }
    await updateLeadStatus(lead.id, status);
    load();
  };

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

  if (loading) return <Shell><Spinner /></Shell>;
  if (!lead || lead.error) return <Shell><p className="p-8">Lead negăsit</p></Shell>;

  return (
    <Shell>
      <Link href="/leads" className="text-sm text-blue-600 mb-3 inline-block">← Leaduri</Link>

      {/* Header: who + status + next action, all in one glance */}
      <div className="bg-white rounded-lg border p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={lead.status} />
          <h1 className="text-xl font-bold">{lead.name || 'Necunoscut'}</h1>
          <ServiceBadge type={lead.service_type} />
          {lead.fake_score > 40 && (
            <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs font-semibold">⚠ risc {lead.fake_score}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-4 mt-3 text-sm">
          {lead.phone && <a href={`tel:${lead.phone}`} className="text-blue-600 font-medium">📞 {lead.phone}</a>}
          {lead.email && <a href={`mailto:${lead.email}`} className="text-blue-600">✉ {lead.email}</a>}
          <span className="text-gray-600">🚗 {lead.car_make} {lead.car_model} {lead.car_year} {lead.registration_number ? `· ${lead.registration_number}` : ''}</span>
        </div>
        {/* Next actions — big, obvious */}
        <div className="flex flex-wrap gap-2 mt-4">
          {(NEXT_ACTIONS[lead.status] || []).map(([label, next, color]) => (
            <ActionButton key={next} label={label} color={color} onClick={() => act(next)} />
          ))}
          {lead.status !== 'fake' && lead.status !== 'new' && (
            <ActionButton label="Marchează fake" color="gray" onClick={() => act('fake')} />
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Editable operational fields */}
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">Operațional</h3>

          <label className="block text-xs text-gray-500 mb-1">Programare</label>
          <div className="flex gap-2 mb-3">
            <input
              type="datetime-local"
              value={appointmentAt}
              onChange={e => setAppointmentAt(e.target.value)}
              className="border rounded px-2 py-1.5 text-sm flex-1"
            />
            <ActionButton label="Salvează" small disabled={saving}
              onClick={() => save({ appointment_at: appointmentAt ? new Date(appointmentAt).toISOString() : null })} />
          </div>

          <label className="block text-xs text-gray-500 mb-1">Valoare finală (RON)</label>
          <div className="flex gap-2 mb-3">
            <input
              type="number"
              value={finalValue}
              onChange={e => setFinalValue(e.target.value)}
              placeholder={lead.estimated_value ? `estimat: ${lead.estimated_value}` : '—'}
              className="border rounded px-2 py-1.5 text-sm flex-1"
            />
            <ActionButton label="Salvează" small disabled={saving}
              onClick={() => save({ final_value: finalValue ? Number(finalValue) : null })} />
          </div>

          <label className="block text-xs text-gray-500 mb-1">Notă internă</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="border rounded px-2 py-1.5 text-sm w-full mb-2"
          />
          <ActionButton label="Salvează nota" small disabled={saving} onClick={() => save({ internal_notes: notes })} />
        </div>

        {/* Read-only context */}
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">Context</h3>
          <InfoRow label="Sursă" value={lead.source || '—'} />
          <InfoRow label="Mesaj client" value={lead.message || '—'} />
          <InfoRow label="Creat la" value={fmtDate(lead.created_at)} />
          <InfoRow label="Sosit la" value={fmtDate(lead.arrived_at)} />
          <InfoRow label="Conversie Google" value={lead.google_conversion_status || 'not_ready'} />
          <InfoRow label="Trimisă la" value={fmtDate(lead.google_conversion_sent_at)} />
        </div>
      </div>

      {/* History */}
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm py-1.5 border-b last:border-0">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-right break-words">{value}</span>
    </div>
  );
}
