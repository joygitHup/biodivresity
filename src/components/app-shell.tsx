'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Header } from '@/components/header';
import { ensureTokenCookie } from '@/lib/api';

const PUBLIC_PATHS = ['/login'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token && !isPublic) {
      router.replace('/login');
      return;
    }
    if (token && isPublic) {
      router.replace('/');
      return;
    }
    // 补写 middleware 所需的 token cookie（兼容仅存在 localStorage 的老会话）
    if (token) ensureTokenCookie();
    setAuthorized(true);
  }, [pathname, isPublic, router]);

  // Token 过期（401）时跳转登录页
  useEffect(() => {
    function onExpired() {
      localStorage.removeItem('user');
      setAuthorized(false);
      router.replace('/login');
    }
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [router]);

  // 公开页面（登录页）不渲染侧边栏与顶栏
  if (isPublic) {
    return <>{children}</>;
  }

  // 未通过鉴权前显示加载态，避免闪烁受保护内容
  if (!authorized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <main className="flex-1 overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
