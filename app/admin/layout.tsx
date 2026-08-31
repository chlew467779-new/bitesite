/* bitesite/app/admin/layout.tsx */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClientLayout } from './components/client-layout';
import './admin-globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BiteSite Admin — Analytics Dashboard',
  description: 'BiteSite analytics dashboard for restaurant partners.',
  robots: 'noindex, nofollow',
};

export const dynamic = 'force-dynamic';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-100 min-h-screen`}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
