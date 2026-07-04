'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(setSettings)
      .catch(() => {});
  }, []);

  if (status === 'loading' || !settings) return <div className="p-8">Se încarcă...</div>;

  const convSettings = settings.google_conversions || {};

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <Link href="/leads" className="text-sm text-blue-600 mb-4 inline-block">← Înapoi</Link>
      <h1 className="text-xl font-bold mb-6">⚙️ Setări</h1>

      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="font-semibold mb-4">Conversii Google</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Status:</span>
            <span className={`ml-2 px-2 py-1 rounded text-xs ${convSettings.enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {convSettings.enabled ? 'Activ' : 'Inactiv'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Validate Only:</span>
            <span className={`ml-2 px-2 py-1 rounded text-xs ${convSettings.validateOnly ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
              {convSettings.validateOnly ? 'Da (test)' : 'Nu (live)'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Valoare default:</span>
            <span className="ml-2">{convSettings.defaultCurrency || 'RON'}</span>
          </div>
        </div>

        {convSettings.rules && (
          <div className="mt-4">
            <h3 className="text-sm font-medium mb-2">Reguli conversie</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="p-2">Eveniment</th>
                  <th className="p-2">Activ</th>
                  <th className="p-2">Valoare</th>
                  <th className="p-2">Conversion Action ID</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(convSettings.rules).map(([key, rule]: [string, any]) => (
                  <tr key={key} className="border-b last:border-0">
                    <td className="p-2 font-mono text-xs">{key}</td>
                    <td className="p-2">
                      <span className={`text-xs ${rule.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                        {rule.enabled ? '✅' : '❌'}
                      </span>
                    </td>
                    <td className="p-2">{rule.defaultValue} RON</td>
                    <td className="p-2 text-xs text-gray-500 font-mono">
                      {rule.conversionActionId?.startsWith('REPLACE') ? (
                        <span className="text-red-500">⚠️ Neconfigurat</span>
                      ) : rule.conversionActionId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h2 className="font-semibold mb-4">Cont utilizator</h2>
        <div className="text-sm space-y-2">
          <p><span className="text-gray-500">Email:</span> {(session?.user as any)?.email}</p>
          <p><span className="text-gray-500">Rol:</span> {(session?.user as any)?.role}</p>
        </div>
      </div>
    </div>
  );
}
