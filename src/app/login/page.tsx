'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Leaf, Loader2, User, Lock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';

const demoAccounts = [
  { role: '管理员', username: 'admin', password: 'admin123' },
  { role: '农技人员', username: 'staff', password: 'staff123' },
  { role: '普通用户', username: 'user01', password: 'user123456' },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('请输入用户名和密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.auth.login(username.trim(), password);
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  function fillAccount(acc: (typeof demoAccounts)[number]) {
    setUsername(acc.username);
    setPassword(acc.password);
    setError('');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[oklch(0.16_0.04_155)] p-4 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[oklch(0.35_0.1_155/0.3)] blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-[oklch(0.45_0.12_160/0.2)] blur-3xl" />
      </div>

      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center relative z-10">
        {/* 左侧品牌区 */}
        <div className="hidden md:flex flex-col gap-6 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[oklch(0.45_0.12_155)]">
              <Leaf className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">生物多样性智慧监测平台</h1>
              <p className="text-sm text-white/60">Biodiversity Intelligent Monitoring</p>
            </div>
          </div>
          <p className="text-white/70 leading-relaxed">
            天空地一体化监测网络，融合红外相机、声纹识别、AI 智能分析，
            为生物多样性保护提供全流程数字化支撑。
          </p>
          <div className="flex items-center gap-2 text-sm text-white/50">
            <ShieldCheck className="h-4 w-4" />
            <span>基于多模态的生物多样性识别分析系统 V1.0</span>
          </div>
        </div>

        {/* 右侧登录卡片 */}
        <Card className="w-full shadow-2xl border-white/10">
          <CardHeader className="space-y-1">
            <div className="flex md:hidden items-center gap-2 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <Leaf className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold">生物多样性监测平台</span>
            </div>
            <CardTitle className="text-2xl">登录</CardTitle>
            <CardDescription>请输入账号信息以访问监测平台</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    placeholder="请输入用户名"
                    className="pl-9"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="请输入密码"
                    className="pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={loading}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? '登录中...' : '登 录'}
              </Button>
            </form>

            {/* 演示账号 */}
            <div className="mt-6 pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">演示账号（点击填充）：</p>
              <div className="flex flex-wrap gap-2">
                {demoAccounts.map((acc) => (
                  <Button
                    key={acc.username}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => fillAccount(acc)}
                  >
                    {acc.role} {acc.username}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
