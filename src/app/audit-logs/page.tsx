'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  Search,
  Loader2,
  Filter,
  Clock,
  User,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SimplePagination } from '@/components/simple-pagination';
import { api } from '@/lib/api';

const PAGE_SIZE = 20;

const actionLabels: Record<string, string> = {
  login: '登录',
  logout: '退出登录',
  change_password: '修改密码',
  update_profile: '更新资料',
  create: '创建',
  update: '更新',
  delete: '删除',
  review: '复核',
  export: '导出',
  config_change: '修改配置',
  force_cloud: '强制上云',
};

const levelColor: Record<string, string> = {
  login: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  logout: 'bg-slate-50 text-slate-600 border-slate-200',
  change_password: 'bg-amber-50 text-amber-700 border-amber-200',
  update_profile: 'bg-sky-50 text-sky-700 border-sky-200',
  create: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  update: 'bg-sky-50 text-sky-700 border-sky-200',
  delete: 'bg-destructive/10 text-destructive border-destructive/30',
  review: 'bg-violet-50 text-violet-700 border-violet-200',
  export: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  config_change: 'bg-amber-50 text-amber-700 border-amber-200',
  force_cloud: 'bg-rose-50 text-rose-700 border-rose-200',
};

function fmtTime(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // 统计卡片数字
  const [todayCount, setTodayCount] = useState(0);
  const [loginCount, setLoginCount] = useState(0);
  const [configCount, setConfigCount] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [daysFilter, setDaysFilter] = useState('7');

  // 搜索防抖
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // 筛选变化时回到第一页
  useEffect(() => {
    setPage(1);
  }, [actionFilter, daysFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = {
        days: daysFilter, page, pageSize: PAGE_SIZE,
      };
      if (search) params.q = search;
      if (actionFilter !== 'all') params.action = actionFilter;
      const data = await api.auditLog.list(params);
      setLogs(data.list || []);
      setTotal(data.total || 0);

      // 统计卡片：后端聚合，避免全量拉取
      const statParams: Record<string, any> = { days: daysFilter };
      if (search) statParams.q = search;
      if (actionFilter !== 'all') statParams.action = actionFilter;
      const statData = await api.auditLog.stats(statParams);
      setTodayCount(statData?.todayCount ?? 0);
      setLoginCount(statData?.loginCount ?? 0);
      setConfigCount(statData?.configCount ?? 0);
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [search, actionFilter, daysFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  // 渲染直接用 logs（后端已分页）

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" />
          操作日志
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          系统关键操作审计记录，支持按操作类型、关键字与时间范围筛选
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" /> 全部记录
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
            <p className="text-xs text-muted-foreground mt-1">最近 {daysFilter} 天</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" /> 今日
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayCount}</div>
            <p className="text-xs text-muted-foreground mt-1">今日操作数</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <User className="h-3.5 w-3.5" /> 登录
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loginCount}</div>
            <p className="text-xs text-muted-foreground mt-1">登录次数</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Filter className="h-3.5 w-3.5" /> 配置变更
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{configCount}</div>
            <p className="text-xs text-muted-foreground mt-1">系统配置变更次数</p>
          </CardContent>
        </Card>
      </div>

      {/* 筛选 + 列表 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-sm font-medium">日志列表</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  className="h-8 w-56 pl-8"
                  placeholder="搜索操作人 / 对象 / 详情"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <Select value={actionFilter} onValueChange={(v) => setActionFilter(v)}>
                <SelectTrigger className="h-8 w-32">
                  <SelectValue placeholder="操作类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  {Object.entries(actionLabels).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={daysFilter} onValueChange={(v) => setDaysFilter(v)}>
                <SelectTrigger className="h-8 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">近 1 天</SelectItem>
                  <SelectItem value="7">近 7 天</SelectItem>
                  <SelectItem value="30">近 30 天</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-destructive">
              {error}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ShieldCheck className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">暂无操作记录</p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border overflow-hidden overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-[11px]">
                      <TableHead>操作时间</TableHead>
                      <TableHead>操作类型</TableHead>
                      <TableHead>操作人</TableHead>
                      <TableHead>对象</TableHead>
                      <TableHead>详情</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id} className="[&>td]:px-3 [&>td]:py-2 text-xs">
                        <TableCell className="tabular-nums whitespace-nowrap text-muted-foreground">
                          {fmtTime(log.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${levelColor[log.action] || ''}`}
                          >
                            {log.action_label || actionLabels[log.action] || log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{log.actor_name || '系统'}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {log.target_type ? `${log.target_type}${log.target_id ? ` #${log.target_id}` : ''}` : '—'}
                        </TableCell>
                        <TableCell className="max-w-[280px] truncate" title={log.detail || log.target_label || ''}>
                          {log.detail || log.target_label || '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-[11px]">
                          {log.ip || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <SimplePagination
                total={logs.length}
                pageSize={PAGE_SIZE}
                page={page}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
