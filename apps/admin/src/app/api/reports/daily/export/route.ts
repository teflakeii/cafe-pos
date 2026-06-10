import { NextRequest, NextResponse } from 'next/server';
import { readAccessTokenFromCookieString } from '@/lib/auth-token';

function extractErrorMessage(raw: string, fallback: string): string {
  if (!raw) {
    return fallback;
  }

  try {
    const payload = JSON.parse(raw) as { message?: unknown };
    if (Array.isArray(payload.message)) {
      return payload.message.join(' | ');
    }
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message;
    }
  } catch {
    // Keep fallback
  }

  return fallback;
}

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date');
  if (!date) {
    return NextResponse.json(
      { message: 'پارامتر تاریخ الزامی است' },
      { status: 400 },
    );
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, '');
  if (!apiBaseUrl) {
    return NextResponse.json(
      { message: 'تنظیمات آدرس API کامل نیست' },
      { status: 500 },
    );
  }

  const accessToken = readAccessTokenFromCookieString(
    request.headers.get('cookie'),
  );
  if (!accessToken) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز' }, { status: 401 });
  }

  const upstream = await fetch(
    `${apiBaseUrl}/admin/reports/daily/export?date=${encodeURIComponent(date)}`,
    {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'text/csv',
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const payload = await upstream.text();
  if (!upstream.ok) {
    return NextResponse.json(
      {
        message: extractErrorMessage(
          payload,
          `خطا در دریافت خروجی گزارش (کد ${upstream.status})`,
        ),
      },
      { status: upstream.status },
    );
  }

  return new NextResponse(payload, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="gozaresh-rozane-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
