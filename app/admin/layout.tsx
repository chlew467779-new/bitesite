/* bitesite/app/admin/layout.tsx */
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './admin-globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BiteSite Admin — Analytics Dashboard',
  description: 'BiteSite analytics dashboard for restaurant partners.',
  robots: 'noindex, nofollow',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-100 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
