'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Map,
  Camera,
  Bug,
  ClipboardList,
  BarChart3,
  Bell,
  Settings,
  Leaf,
  GitMerge,
  Cpu,
  ShieldCheck,
  FlaskConical,
  ScanLine,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';

const navigationItems = [
  { title: '监测看板', url: '/', icon: LayoutDashboard },
  { title: '样区管理', url: '/survey-areas', icon: Map },
  { title: '设备管理', url: '/devices', icon: Camera },
  { title: '病虫害类别', url: '/species', icon: Bug },
  { title: '监测记录', url: '/records', icon: ClipboardList },
  { title: '病虫害识别', url: '/recognize', icon: ScanLine },
  { title: 'AI识别复核', url: '/review', icon: ClipboardList },
  { title: '证据融合', url: '/fusion', icon: GitMerge },
  { title: '识别调度', url: '/scheduling', icon: Cpu },
  { title: '模型训练', url: '/training', icon: FlaskConical },
];

const analysisItems = [
  { title: '统计分析', url: '/analytics', icon: BarChart3 },
  { title: '预警通知', url: '/alerts', icon: Bell },
];

const systemItems = [
  { title: '系统管理', url: '/system', icon: Settings },
  { title: '操作日志', url: '/audit-logs', icon: ShieldCheck },
];

export function AppSidebar() {
  const pathname = usePathname();

  const isActive = (url: string) => {
    if (url === '/') return pathname === '/';
    return pathname.startsWith(url);
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Leaf className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-primary-foreground">
              病虫害分析系统
            </span>
            <span className="text-[10px] text-sidebar-foreground/60">
              Crop Pest Analysis
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>监测管理</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>分析与预警</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {analysisItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>系统</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
