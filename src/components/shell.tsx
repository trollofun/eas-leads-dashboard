'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Users, Wrench, ClipboardCheck, Settings, AlertTriangle, ArrowRightLeft, Calendar, LogOut, UserPlus } from 'lucide-react';
import { Spinner } from './ui';

const NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Acasă' },
  { href: '/leads', icon: Users, label: 'Leaduri' },
  { href: '/calendar', icon: Calendar, label: 'Programări' },
  { href: '/itp', icon: ClipboardCheck, label: 'ITP' },
  { href: '/service', icon: Wrench, label: 'Service' },
  { href: '/import', icon: UserPlus, label: 'Clienți' },
  { href: '/conversions', icon: ArrowRightLeft, label: 'Conversii' },
  { href: '/fake-leads', icon: AlertTriangle, label: 'Fake' },
  { href: '/settings', icon: Settings, label: 'Setări' },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  if (status === 'loading') return <Spinner />;
  if (status === 'unauthenticated') return null;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar: vertical on desktop, horizontal bar on mobile */}
      <aside className="md:w-52 shrink-0 bg-white border-b md:border-b-0 md:border-r flex md:flex-col">
        <div className="hidden md:block px-4 py-4 border-b">
          <p className="text-sm font-bold">Euro Auto Service</p>
          <p className="text-xs text-gray-400">Leads</p>
        </div>
        <nav className="flex md:flex-col flex-1 overflow-x-auto md:overflow-visible p-2 gap-1">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm whitespace-nowrap transition-colors ${
                  active ? 'bg-blue-600 text-white font-medium' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="hidden md:flex items-center gap-2 px-5 py-3 text-sm text-gray-500 hover:text-red-600 border-t"
        >
          <LogOut size={16} /> Ieșire
        </button>
      </aside>

      <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</main>
    </div>
  );
}
