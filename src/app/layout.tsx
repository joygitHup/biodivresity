import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/app-shell';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: {
    default: '生物多样性智慧监测平台',
    template: '%s | 生物多样性监测',
  },
  description:
    '天空地一体化生物多样性智慧监测平台，实现自动化数据采集、AI智能识别、动态分析与预警',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <TooltipProvider>
          <AppShell>{children}</AppShell>
        </TooltipProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
