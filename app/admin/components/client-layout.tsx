/* bitesite/app/admin/components/client-layout.tsx */
'use client';

import { AuthProvider } from './auth-context';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
