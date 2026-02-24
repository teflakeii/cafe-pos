import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { Sidebar } from '@/components/admin/Sidebar';
import { Topbar } from '@/components/admin/Topbar';
import { me, readAccessTokenFromCookieHeader } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { isAdminRole } from '@/lib/routes';

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let session;

  try {
    const requestHeaders = await headers();
    const cookieHeader = requestHeaders.get('cookie');
    const accessToken = readAccessTokenFromCookieHeader(cookieHeader);

    if (!accessToken) {
      redirect('/login');
    }

    session = await me({
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      Authorization: `Bearer ${accessToken}`,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect('/login');
    }

    throw error;
  }

  if (!isAdminRole(session.user.role) || session.user.active === false) {
    redirect('/login');
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '250px minmax(0, 1fr)',
        minHeight: '100vh',
      }}
    >
      <Sidebar />

      <div style={{ minWidth: 0, display: 'grid', gridTemplateRows: 'auto 1fr' }}>
        <Topbar email={session.user.email} />
        <main style={{ padding: '20px' }}>{children}</main>
      </div>
    </div>
  );
}
