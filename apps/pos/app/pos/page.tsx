'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { hasPosAccessToken } from '@/lib/pos-auth';

export default function PosRootPage() {
  const router = useRouter();

  useEffect(() => {
    if (hasPosAccessToken()) {
      router.replace('/pos/tables');
      return;
    }

    router.replace('/pos/login');
  }, [router]);

  return null;
}
