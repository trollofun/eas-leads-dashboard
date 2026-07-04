'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Shell from '@/components/shell';
import { Spinner } from '@/components/ui';

export default function SettingsPage() {
  const { data: session } = useSession();
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setSettings).catch(() => {});
  }, []);

  if (!settings) return <Shell><Spinner /></Shell>;

  const conv = settings.google_conversions || {};

  return (
    <Shell>
      <h1 className="text-lg font-bold mb-4">Setări</h1>

      <div className="bg-white rounded-lg border p-5 mb-4">
        <h2 className="font-semibold mb-3">Conversii Google</h2>
        <div className="flex flex-wrap gap-4 text-sm mb-4">
          <Badge ok={conv.enabled} okText="Activ" badText="Inactiv" />
          <Badge ok={!conv.validateOnly} okText="Live" badText="Mod test (validateOnly)" warn />
          <span className="text-gray-500">Monedă: <b>{conv.defaultCurrency || 'RON'}</b></span>
        </div>

        {conv.rules && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500 text-xs uppercase">
                <th className="p-2">Eveniment</th>
                <th className="p-2">Activ</th>
                <th className="p-2">Valoare</th>
                <th className="p-2">Conversion Action</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(conv.rules).map(([key, rule]: [string, any]) => (
                <tr key={key} className="border-b last:border-0">
                  <td className="p-2 font-mono text-xs">{key}</td>
                  <td className="p-2">{rule.enabled ? '✅' : '—'}</td>
                  <td className="p-2">{rule.defaultValue} RON</td>
                  <td className="p-2 text-xs font-mono text-gray-500">
                    {rule.conversionActionId?.startsWith('REPLACE')
                      ? <span className="text-red-500">⚠ Neconfigurat</span>
                      : rule.conversionActionId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-lg border p-5">
        <h2 className="font-semibold mb-3">Cont</h2>
        <div className="text-sm space-y-1">
          <p><span className="text-gray-500">Email:</span> {(session?.user as any)?.email || '—'}</p>
          <p><span className="text-gray-500">Rol:</span> {(session?.user as any)?.role || '—'}</p>
        </div>
      </div>
    </Shell>
  );
}

function Badge({ ok, okText, badText, warn = false }: { ok: boolean; okText: string; badText: string; warn?: boolean }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
      ok ? 'bg-green-100 text-green-800' : warn ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
    }`}>
      {ok ? okText : badText}
    </span>
  );
}
