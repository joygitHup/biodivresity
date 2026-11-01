'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Search,
  User,
  LogOut,
  Loader2,
  Settings,
  CheckCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  KeyRound,
  Clock,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';
import { api } from '@/lib/api';
import { toastSuccess, toastError } from '@/lib/toast';

interface CurrentUser {
  id?: number;
  username: string;
  email?: string;
  phone?: string;
  role?: string;
  avatar?: string;
}

const roleLabels: Record<string, string> = {
  admin: '管理员',
  staff: '农技人员',
  user: '普通用户',
};

const levelMeta: Record<string, { variant: 'destructive' | 'default' | 'secondary' | 'outline'; label: string; Icon: any }> = {
  critical: { variant: 'destructive', label: '严重', Icon: AlertTriangle },
  warning: { variant: 'default', label: '警告', Icon: AlertCircle },
  info: { variant: 'secondary', label: '提示', Icon: Info },
};

function fmtTime(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function Header() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // 通知
  const [unreadAlerts, setUnreadAlerts] = useState<any[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  // 个人设置 Dialog
  const [profileOpen, setProfileOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<CurrentUser>({ username: '', email: '', phone: '' });

  // 改密 Dialog
  const [pwdOpen, setPwdOpen] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwd, setPwd] = useState({ old: '', neu: '', confirm: '' });

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (raw) {
      try {
        setCurrentUser(JSON.parse(raw));
      } catch { /* ignore */ }
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    setNotifLoading(true);
    try {
      const data = await api.alerts.list({ pageSize: 20, page: 1 });
      const items = data.list || [];
      setUnreadAlerts(items.filter((a: any) => !(a.isRead ?? a.is_read)));
    } catch {
      /* 静默 */
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const t = setInterval(loadAlerts, 60_000); // 每分钟刷新
    return () => clearInterval(t);
  }, [loadAlerts]);

  async function handleMarkAllRead() {
    try {
      await api.alerts.markAllRead();
      toastSuccess('已全部标记为已读');
      setUnreadAlerts([]);
    } catch {
      toastError('操作失败');
    }
  }

  async function handleMarkRead(id: number) {
    try {
      await api.alerts.markRead(id);
      setUnreadAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch { /* ignore */ }
  }

  // ── 个人设置 ─────────────────────────────────────────
  function openProfile() {
    setProfileForm({
      username: currentUser?.username || '',
      email: currentUser?.email || '',
      phone: currentUser?.phone || '',
      avatar: currentUser?.avatar || '',
    });
    setProfileOpen(true);
  }

  async function saveProfile() {
    if (!currentUser) return;
    setSavingProfile(true);
    try {
      const updated = await api.auth.updateProfile({
        username: profileForm.username,
        email: profileForm.email,
        phone: profileForm.phone,
        avatar: profileForm.avatar,
      });
      setCurrentUser((prev) => ({ ...prev!, ...updated }));
      localStorage.setItem('user', JSON.stringify({ ...currentUser, ...updated }));
      toastSuccess('个人资料已更新');
      setProfileOpen(false);
    } catch (e: any) {
      toastError(e?.message || '保存失败');
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword() {
    if (pwd.neu !== pwd.confirm) {
      toastError('两次新密码不一致');
      return;
    }
    if (pwd.neu.length < 6) {
      toastError('新密码至少 6 位');
      return;
    }
    setSavingPwd(true);
    try {
      await api.auth.changePassword(pwd.old, pwd.neu);
      toastSuccess('密码已修改，请重新登录');
      setPwdOpen(false);
      setPwd({ old: '', neu: '', confirm: '' });
      setTimeout(() => {
        api.auth.logout();
        localStorage.removeItem('user');
        router.replace('/login');
      }, 1200);
    } catch (e: any) {
      toastError(e?.message || '修改失败');
    } finally {
      setSavingPwd(false);
    }
  }

  function handleLogout() {
    api.auth.logout();
    localStorage.removeItem('user');
    router.replace('/login');
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="搜索物种、设备、样区..."
          className="w-full pl-8 h-9 bg-muted/50 border-0"
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        {/* 通知消息下拉 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="通知">
              <Bell className="h-4.5 w-4.5" />
              {unreadAlerts.length > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
                >
                  {unreadAlerts.length > 99 ? '99+' : unreadAlerts.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center justify-between">
                <span className="font-medium">通知消息</span>
                {unreadAlerts.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-primary"
                    onClick={handleMarkAllRead}
                  >
                    <CheckCheck className="h-3 w-3 mr-1" />
                    全部已读
                  </Button>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : unreadAlerts.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <Bell className="h-5 w-5 mx-auto mb-1 opacity-50" />
                暂无新通知
              </div>
            ) : (
              <>
                {unreadAlerts.slice(0, 5).map((alert) => {
                  const meta = levelMeta[alert.level] || levelMeta.info;
                  const Icon = meta.Icon;
                  return (
                    <DropdownMenuItem
                      key={alert.id}
                      className="cursor-default group"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <div className="flex items-start gap-2 w-full">
                        <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant={meta.variant} className="text-[10px] h-4">
                              {meta.label}
                            </Badge>
                            <span className="text-sm font-medium truncate">{alert.title}</span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {alert.description}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-muted-foreground">
                              {fmtTime(alert.created_at)}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleMarkRead(alert.id)}
                            >
                              已读
                            </Button>
                          </div>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/alerts" className="text-center text-sm text-primary cursor-pointer">
                查看全部通知 →
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 用户菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{currentUser?.username ?? '未登录'}</span>
                <span className="text-xs text-muted-foreground">
                  {currentUser?.role ? roleLabels[currentUser.role] ?? currentUser.role : ''}
                  {currentUser?.email ? ` · ${currentUser.email}` : ''}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openProfile(); }}>
              <Settings className="mr-2 h-4 w-4" />
              个人设置
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── 个人设置 Dialog ──────────────────────────────── */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              个人设置
            </DialogTitle>
            <DialogDescription>更新个人资料或修改登录密码</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {(profileForm.username || '?').slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-xs text-muted-foreground">
                角色：{currentUser?.role ? roleLabels[currentUser.role] ?? currentUser.role : '—'}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>用户名</Label>
                <Input
                  value={profileForm.username}
                  onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>邮箱</Label>
                <Input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>手机号</Label>
                <Input
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                />
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                修改登录密码
              </div>
              <Button variant="outline" size="sm" onClick={() => setPwdOpen(true)}>
                修改密码
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileOpen(false)}>取消</Button>
            <Button onClick={saveProfile} disabled={savingProfile}>
              {savingProfile && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 修改密码 Dialog ──────────────────────────────── */}
      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              修改登录密码
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>原密码</Label>
              <Input
                type="password"
                value={pwd.old}
                onChange={(e) => setPwd({ ...pwd, old: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>新密码（至少 6 位）</Label>
              <Input
                type="password"
                value={pwd.neu}
                onChange={(e) => setPwd({ ...pwd, neu: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>确认新密码</Label>
              <Input
                type="password"
                value={pwd.confirm}
                onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdOpen(false)}>取消</Button>
            <Button onClick={savePassword} disabled={savingPwd}>
              {savingPwd && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              确认修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
