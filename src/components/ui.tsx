'use client';

// Shared UI primitives — Prägnanz: one source of truth for labels, colors, actions.

export const STATUS_LABELS: Record<string, string> = {
  new: 'Nou',
  confirmed: 'Confirmat',
  appointment_booked: 'Programat',
  arrived: 'Sosit',
  work_in_progress: 'În lucru',
  itp_done: 'ITP făcut',
  work_completed: 'Finalizat',
  invoiced: 'Facturat',
  conversion_sent: 'Conversie trimisă',
  fake: 'Fake',
};

export const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-teal-100 text-teal-800',
  appointment_booked: 'bg-purple-100 text-purple-800',
  arrived: 'bg-amber-100 text-amber-800',
  work_in_progress: 'bg-orange-100 text-orange-800',
  itp_done: 'bg-green-100 text-green-800',
  work_completed: 'bg-green-100 text-green-800',
  invoiced: 'bg-emerald-100 text-emerald-800',
  conversion_sent: 'bg-emerald-100 text-emerald-800',
  fake: 'bg-red-100 text-red-800',
};

export const SERVICE_LABELS: Record<string, string> = {
  itp: 'ITP',
  mecanica: 'Mecanică',
  gpl: 'GPL',
  aer_conditionat: 'AC',
  diagnoza: 'Diagnoză',
  electrica: 'Electrică',
  revizie: 'Revizie',
  vopsitorie: 'Vopsitorie',
};

// Next actions per status: [label, nextStatus, color]
export const NEXT_ACTIONS: Record<string, [string, string, string][]> = {
  new: [['Confirmă', 'confirmed', 'green'], ['Fake', 'fake', 'red']],
  confirmed: [['Programează', 'appointment_booked', 'blue']],
  appointment_booked: [['A sosit', 'arrived', 'amber']],
  arrived: [['Finalizat', 'work_completed', 'green']],
  work_completed: [['Facturat', 'invoiced', 'blue']],
};

const BTN_COLORS: Record<string, string> = {
  green: 'bg-green-600 hover:bg-green-700',
  red: 'bg-red-600 hover:bg-red-700',
  blue: 'bg-blue-600 hover:bg-blue-700',
  amber: 'bg-amber-500 hover:bg-amber-600',
  gray: 'bg-gray-500 hover:bg-gray-600',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function ServiceBadge({ type }: { type: string }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium uppercase whitespace-nowrap">
      {SERVICE_LABELS[type] || type || '—'}
    </span>
  );
}

export function ActionButton({ label, color = 'blue', onClick, small = false, disabled = false }: {
  label: string; color?: string; onClick: () => void; small?: boolean; disabled?: boolean;
}) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      disabled={disabled}
      className={`${BTN_COLORS[color] || BTN_COLORS.blue} text-white rounded font-medium disabled:opacity-50 ${small ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm'}`}
    >
      {label}
    </button>
  );
}

export async function updateLeadStatus(id: string, status: string): Promise<boolean> {
  const res = await fetch(`/api/leads/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return res.ok;
}

export function fmtDate(d?: string | null, withTime = true) {
  if (!d) return '—';
  const date = new Date(d);
  return withTime
    ? date.toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('ro-RO');
}

export function Spinner() {
  return <div className="p-8 text-center text-gray-400">Se încarcă…</div>;
}

export function EmptyState({ text }: { text: string }) {
  return <p className="p-8 text-center text-gray-400 text-sm">{text}</p>;
}
