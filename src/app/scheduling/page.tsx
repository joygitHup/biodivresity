'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Cpu,
  Cloud,
  ArrowUpRight,
  Gauge,
  ShieldCheck,
  RefreshCw,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Settings2,
  GitCompareArrows,
  Timer,
  CircleDollarSign,
  Activity,
  Layers3,
  Cog,
  Clock,
  AlertTriangle,
  MapPin,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { SimplePagination } from '@/components/simple-pagination';
import { MaskCanvas } from '@/components/mask-canvas';
import { api } from '@/lib/api';

const tierLabels: Record<string, string> = {
  edge: '边缘轻量',
  cloud: '云端大模型',
};

const statusLabels: Record<string, string> = {
  pending: '待处理',
  running: '执行中',
  succeeded: '已完成',
  failed: '失败',
  skipped: '已跳过',
};

const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  succeeded: 'default',
  running: 'secondary',
  pending: 'outline',
  failed: 'destructive',
  skipped: 'secondary',
};

const reasonLabels: Record<string, string> = {
  low_confidence: '边缘置信度不足',
  protected_species: '保护物种强制上云',
  ambiguous: '候选歧义',
  low_quality: '质量异常',
  edge_error: '边缘推理异常',
  force_cloud: '强制云端',
  budget_exhausted: '云端预算耗尽',
};

const sourceTypeLabels: Record<string, string> = {
  image: '图像',
  video: '视频',
  audio: '音频',
  edna: 'eDNA',
};

const PAGE_SIZE = 10;

function formatTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('zh-CN', { hour12: false });
}

function percent(value?: number | null) {
  if (value === null || value === undefined) return '—';
  return `${value}%`;
}

export default function SchedulingPage() {
  const [stats, setStats] = useState<any | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [days, setDays] = useState(7);

  const [tasks, setTasks] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [decidedByFilter, setDecidedByFilter] = useState('all');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const data = await api.inference.schedulingStats(days);
      setStats(data);
    } catch (e: any) {
      setError(e?.message || '调度统计加载失败');
    } finally {
      setLoadingStats(false);
    }
  }, [days]);

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const params: Record<string, any> = { page, pageSize: PAGE_SIZE };
      if (search) params.search = search;
      if (tierFilter !== 'all') params.tier = tierFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (reasonFilter !== 'all') params.escalation_reason = reasonFilter;
      if (decidedByFilter !== 'all') params.decided_by = decidedByFilter;
      const data = await api.inference.tasks(params);
      setTasks(data.list || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e?.message || '任务列表加载失败');
    } finally {
      setLoadingTasks(false);
    }
  }, [page, search, tierFilter, statusFilter, reasonFilter, decidedByFilter]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function openDetail(task: any) {
    setDetailOpen(true);
    setDetail(task);
    setDetailLoading(true);
    try {
      const data = await api.inference.taskDetail(task.id);
      setDetail(data);
    } catch {
      /* 保留列表中的基础信息 */
    } finally {
      setDetailLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const policy = stats?.policy;
  const budget = stats?.cloudBudget ?? 0;
  const budgetUsed = stats?.cloudBudgetUsedToday ?? 0;
  const budgetPercent = budget > 0 ? Math.min(100, Math.round((budgetUsed / budget) * 100)) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">识别调度</h1>
          <p className="text-muted-foreground text-sm mt-1">
            边缘端轻量模型先行直判，疑难样本自动上云复核，兼顾时延与识别精度
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-28 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">近 1 天</SelectItem>
              <SelectItem value="7">近 7 天</SelectItem>
              <SelectItem value="30">近 30 天</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadStats();
              loadTasks();
            }}
            disabled={loadingStats || loadingTasks}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingStats || loadingTasks ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/system?tab=settings&group=scheduling">
              <Settings2 className="h-4 w-4 mr-2" />
              调度配置
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Cpu className="h-4 w-4 text-emerald-500" /> 边缘直判
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.edgeAccepted ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  直判率 {percent(stats?.acceptRate)} · 今日 {stats?.todayEdgeAccepted ?? 0}
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Cloud className="h-4 w-4 text-sky-500" /> 上云复核
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.escalated ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  上云率 {percent(stats?.escalationRate)} · 今日 {stats?.todayEscalated ?? 0}
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-amber-500" /> 节省云端调用
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.cloudCallsSaved ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  云端调用 {stats?.cloudCalls ?? 0} 次
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <GitCompareArrows className="h-4 w-4 text-violet-500" /> 边缘/云端一致性
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{percent(stats?.agreementRate)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  对比 {stats?.comparedTasks ?? 0} 条 · 置信度差 {stats?.avgConfidenceDelta ?? '—'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Timer className="h-4 w-4 text-rose-500" /> 平均耗时
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {stats?.avgEdgeLatencyMs ?? 0}
                  <span className="text-sm font-normal text-muted-foreground"> ms</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  云端 {stats?.avgCloudLatencyMs ?? 0} ms
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 策略 + 上云原因 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> 当前调度策略
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingStats || !policy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant={policy.enabled ? 'default' : 'secondary'}>
                    边缘调度 {policy.enabled ? '已启用' : '已关闭'}
                  </Badge>
                  <Badge variant="outline">直判阈值 ≥ {policy.accept_threshold}</Badge>
                  <Badge variant="outline">歧义差 &lt; {policy.ambiguous_margin} 上云</Badge>
                  <Badge variant="outline">
                    保护物种上云 {policy.protected_escalate ? '开' : '关'}
                  </Badge>
                  <Badge variant="outline">
                    质量异常上云 {policy.quality_escalate ? '开' : '关'}
                  </Badge>
                  <Badge variant="outline">
                    边缘异常降级 {policy.fallback_to_cloud ? '开' : '关'}
                  </Badge>
                  <Badge variant="outline">范围 {policy.scope === 'all' ? '全部数据' : '仅边缘设备'}</Badge>
                  <Badge variant="outline">后端 {policy.provider}</Badge>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>云端日预算</span>
                    <span>
                      {budget > 0 ? `${budgetUsed} / ${budget} 次` : '不限量'}
                    </span>
                  </div>
                  {budget > 0 && <Progress value={budgetPercent} className="h-2" />}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4" /> 上云原因分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : stats?.escalationReasons?.length ? (
              <div className="space-y-2">
                {stats.escalationReasons.map((item: any) => (
                  <div key={item.reason} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">暂无上云记录</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 任务列表 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Gauge className="h-4 w-4" /> 识别任务流水
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  className="h-8 w-56 pl-8"
                  placeholder="搜索请求ID / 设备 / 样区"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <Select value={tierFilter} onValueChange={(v) => { setTierFilter(v); setPage(1); }}>
                <SelectTrigger className="h-8 w-28">
                  <SelectValue placeholder="层级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部层级</SelectItem>
                  <SelectItem value="edge">边缘轻量</SelectItem>
                  <SelectItem value="cloud">云端大模型</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="h-8 w-28">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="pending">待处理</SelectItem>
                  <SelectItem value="running">执行中</SelectItem>
                  <SelectItem value="succeeded">已完成</SelectItem>
                  <SelectItem value="failed">失败</SelectItem>
                </SelectContent>
              </Select>
              <Select value={reasonFilter} onValueChange={(v) => { setReasonFilter(v); setPage(1); }}>
                <SelectTrigger className="h-8 w-32">
                  <SelectValue placeholder="上云原因" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部原因</SelectItem>
                  {Object.entries(reasonLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={decidedByFilter} onValueChange={(v) => { setDecidedByFilter(v); setPage(1); }}>
                <SelectTrigger className="h-8 w-28">
                  <SelectValue placeholder="判定方" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部判定</SelectItem>
                  <SelectItem value="edge">边缘直判</SelectItem>
                  <SelectItem value="cloud">云端判定</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingTasks ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">暂无识别任务</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>资产</TableHead>
                  <TableHead>设备 / 样区</TableHead>
                  <TableHead>层级</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>边缘置信度</TableHead>
                  <TableHead>云端置信度</TableHead>
                  <TableHead>上云原因</TableHead>
                  <TableHead>耗时</TableHead>
                  <TableHead>创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow
                    key={task.id}
                    className="cursor-pointer"
                    onClick={() => openDetail(task)}
                  >
                    <TableCell>
                      <div className="font-mono text-xs">{task.request_id}</div>
                      <div className="text-xs text-muted-foreground">
                        {sourceTypeLabels[task.asset?.source_type] || task.asset?.source_type || '—'} · {task.task_type === 'audio' ? '声学' : '图像'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{task.deviceName || '—'}</div>
                      <div className="text-xs text-muted-foreground">{task.surveyAreaName || '—'}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={task.tier === 'edge' ? 'default' : 'secondary'}>
                        {tierLabels[task.tier] || task.tier}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[task.status] || 'outline'}>
                        {statusLabels[task.status] || task.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {task.edge_confidence != null ? task.edge_confidence.toFixed(3) : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {task.cloud_confidence != null ? task.cloud_confidence.toFixed(3) : '—'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {task.escalated ? (
                        <span className="text-amber-600">
                          {reasonLabels[task.escalation_reason] || task.escalation_reason}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {task.edge_latency_ms != null && (
                        <div>边缘 {task.edge_latency_ms}ms</div>
                      )}
                      {task.latency_ms != null && (
                        <div className="text-muted-foreground">云端 {task.latency_ms}ms</div>
                      )}
                      {task.edge_latency_ms == null && task.latency_ms == null && '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatTime(task.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <SimplePagination total={total} pageSize={PAGE_SIZE} page={page} onPageChange={setPage} />
        </CardContent>
      </Card>

      {/* 任务详情 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <Activity className="h-5 w-5 text-sky-500" />
              识别任务详情
              {detail && (
                <>
                  <Badge
                    variant={detail.tier === 'edge' ? 'default' : 'secondary'}
                    className="text-[10px]"
                  >
                    {tierLabels[detail.tier] || detail.tier}
                  </Badge>
                  <Badge
                    variant={statusVariants[detail.status] || 'outline'}
                    className="text-[10px]"
                  >
                    {statusLabels[detail.status] || detail.status}
                  </Badge>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {detail?.request_id || '—'}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <div className="space-y-5">
              {/* 基础信息 - InfoBlock 卡片 */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <InfoBlock
                  icon={MapPin}
                  label="设备"
                  value={detail.deviceName || '—'}
                />
                <InfoBlock
                  icon={Layers3}
                  label="监测样区"
                  value={detail.surveyAreaName || '—'}
                />
                <InfoBlock
                  icon={CheckCircle2}
                  label="最终判定"
                  value={
                    detail.decided_by === 'edge'
                      ? '边缘直判'
                      : detail.decided_by === 'cloud'
                      ? '云端判定'
                      : '—'
                  }
                />
                <InfoBlock
                  icon={ArrowUpRight}
                  label="上云原因"
                  value={
                    detail.escalated
                      ? reasonLabels[detail.escalation_reason] || detail.escalation_reason
                      : '未上云'
                  }
                />
              </div>

              {/* 执行链路 - 模型 & 耗时 */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    执行链路
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* 边缘侧 */}
                    <div className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                          <Cpu className="h-4 w-4" />
                          边缘侧
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {detail.edge_model_version || '未执行'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-muted-foreground">置信度</div>
                          <div className="font-medium tabular-nums">
                            {detail.edge_confidence != null
                              ? `${(Number(detail.edge_confidence) * 100).toFixed(1)}%`
                              : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">耗时</div>
                          <div className="font-medium tabular-nums">
                            {detail.edge_latency_ms != null
                              ? `${detail.edge_latency_ms} ms`
                              : '—'}
                          </div>
                        </div>
                      </div>
                      {detail.edge_confidence != null && (
                        <Progress
                          value={Math.round(Number(detail.edge_confidence) * 100)}
                          className="h-1.5 [&>div]:bg-emerald-500"
                        />
                      )}
                    </div>

                    {/* 云端侧 */}
                    <div className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium text-sky-600">
                          <Cloud className="h-4 w-4" />
                          云端侧
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {detail.result_payload?.model_version || detail.cloud_model_version || '未执行'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-muted-foreground">置信度</div>
                          <div className="font-medium tabular-nums">
                            {detail.cloud_confidence != null
                              ? `${(Number(detail.cloud_confidence) * 100).toFixed(1)}%`
                              : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">耗时</div>
                          <div className="font-medium tabular-nums">
                            {detail.latency_ms != null ? `${detail.latency_ms} ms` : '—'}
                          </div>
                        </div>
                      </div>
                      {detail.cloud_confidence != null && (
                        <Progress
                          value={Math.round(Number(detail.cloud_confidence) * 100)}
                          className="h-1.5 [&>div]:bg-sky-500"
                        />
                      )}
                    </div>
                  </div>

                  {/* 一致性对比 */}
                  {detail.edge_confidence != null && detail.cloud_confidence != null && (
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <GitCompareArrows className="h-3.5 w-3.5" />
                        置信度差
                      </span>
                      <span className="font-medium tabular-nums">
                        {(
                          Math.abs(Number(detail.cloud_confidence) - Number(detail.edge_confidence)) * 100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 执行元数据 */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Cog className="h-4 w-4" />
                    执行元数据
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
                    <MetaRow label="请求 ID" value={detail.request_id || '—'} mono />
                    <MetaRow label="资源标识" value={detail.asset?.source_type || detail.asset_id || '—'} />
                    <MetaRow label="任务类型" value={detail.task_type === 'audio' ? '声学识别' : '图像识别'} />
                    <MetaRow
                      label="尝试次数"
                      value={detail.attempts != null ? `${detail.attempts} / ${detail.max_attempts}` : '—'}
                    />
                    <MetaRow
                      label="创建时间"
                      value={formatTime(detail.created_at)}
                    />
                    <MetaRow
                      label="完成时间"
                      value={formatTime(detail.finished_at)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 错误信息 */}
              {detail.error_message && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    {detail.error_code && (
                      <span className="font-mono mr-1">[{detail.error_code}]</span>
                    )}
                    {detail.error_message}
                  </div>
                </div>
              )}

              <Separator />

              {/* Top-K 识别结果 */}
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Gauge className="h-4 w-4" />
                  候选识别结果
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <ResultColumn
                    title="边缘 Top-K"
                    results={detail.edge_result?.top_k}
                    emptyText="未执行边缘模型"
                    color="emerald"
                  />
                  <ResultColumn
                    title="云端 Top-K"
                    results={detail.result_payload?.top_k}
                    emptyText="未执行云端模型"
                    color="sky"
                  />
                </div>

                {/* 像素级分割 */}
                {(detail.segmentation_result?.seg_count ?? 0) > 0 || detail.result_payload?.seg_count > 0 ? (
                  <>
                    <Separator />
                    <div>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Eye className="h-4 w-4 text-violet-500" />
                          像素级分割
                          <Badge variant="secondary" className="text-[10px]">
                            {detail.segmentation_result?.model_version || detail.result_payload?.seg_model_version}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {detail.segmentation_result?.seg_count ?? detail.result_payload?.seg_count} 个实例
                          </Badge>
                          {(detail.segmentation_result?.latency_ms ?? detail.result_payload?.seg_latency_ms) > 0 && (
                            <Badge variant="outline" className="text-[10px]">
                              {(detail.segmentation_result?.latency_ms ?? detail.result_payload?.seg_latency_ms)}ms
                            </Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <MaskCanvas
                          imageUrl={detail.asset?.file || detail.asset?.media_url}
                          segmentations={detail.segmentation_result?.segmentations || detail.result_payload?.segmentations || []}
                          width={480}
                          height={320}
                        />
                      </CardContent>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── 辅助组件 ──────────────────────────────────────────── */}
      {/* InfoBlock 统一的图标+标签+值小卡片（与 fusion 详情风格一致） */}
    </div>
  );
}

// ── 详情弹窗辅助组件 ───────────────────────────────────────────

function InfoBlock({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="text-sm font-medium mt-1 truncate" title={value}>
        {value || '—'}
      </p>
    </div>
  );
}

function MetaRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium truncate max-w-[60%] ${mono ? 'font-mono' : ''}`} title={value}>
        {value || '—'}
      </span>
    </div>
  );
}

function ResultColumn({
  title,
  results,
  emptyText,
  color,
}: {
  title: string;
  results?: { chinese_name?: string; species_id?: number | string; confidence: number }[];
  emptyText: string;
  color: 'emerald' | 'sky';
}) {
  const barClass = color === 'emerald' ? '[&>div]:bg-emerald-500' : '[&>div]:bg-sky-500';
  const labelClass = color === 'emerald' ? 'text-emerald-700' : 'text-sky-700';
  const badgeClass =
    color === 'emerald'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-sky-50 text-sky-700 border-sky-200';
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`text-xs font-medium ${labelClass}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {results?.length ? (
          <div className="space-y-1.5">
            {results.map((item: any, idx: number) => {
              const pct = Math.round(Number(item.confidence) * 100);
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <Badge variant="outline" className={`text-[10px] ${badgeClass}`}>
                        #{idx + 1}
                      </Badge>
                      {item.chinese_name || item.species_id}
                    </span>
                    <span className="tabular-nums font-medium">{pct}%</span>
                  </div>
                  <Progress value={pct} className={`h-1 ${barClass}`} />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-2">{emptyText}</p>
        )}
      </CardContent>
    </Card>
  );
}
