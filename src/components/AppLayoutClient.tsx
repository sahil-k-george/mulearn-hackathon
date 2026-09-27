'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppProvider, useApp } from '@/lib/store';
import { Sidebar } from '@/components/Sidebar';

const PUBLIC_ROUTES = ['/login', '/onboarding', '/forgot-password'];

function Shell({ children }: { children: React.ReactNode }) {
  const { authState, isLoaded } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  useEffect(() => {
    if (!isLoaded) return;
    if (authState === 'anonymous' && !isPublic) {
      router.replace('/login');
    }
    if (authState === 'authenticated' && isPublic) {
      router.replace('/dashboard');
    }
  }, [authState, isLoaded, isPublic, router]);

  if (isPublic) {
    return <main className="main-content main-content--public">{children}</main>;
  }

  if (!isLoaded || authState !== 'authenticated') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        Loading your workspace…
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}

export function AppLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <Shell>{children}</Shell>
    </AppProvider>
  );
}
