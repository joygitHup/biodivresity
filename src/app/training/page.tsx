'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Database,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Search,
  Camera,
  Mic,
  Video,
  CheckCircle2,
  Sparkles,
  FlaskConical,
  Play,
  Plus,
  FileCheck2,
  ShieldCheck,
  XCircle,
  Eye,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SimplePagination } from '@/components/simple-pagination';
import { api } from '@/lib/api';
import { toastSuccess, toastError } from '@/lib/toast';

const PAGE_SIZE = 20;

const mediaLabels: Record<string, string> = {
  image: '图像',
  video: '视频',
  audio: '音频',
};

const mediaIcons: Record<string, typeof Camera> = {
  image: Camera,
  video: Video,
  audio: Mic,
};

const sourceLabels: Record<string, string> = {
  auto: '自动确认',
  review: '人工复核',
  ai: 'AI识别',
};

const statusLabels: Record<string, string> = {
  ready: '就绪',
  exported: '已导出',
  invalid: '不可用',
};

const qualityLabels: Record<string, string> = {
  high_noise: '高噪声环境',
  unreliable_separation: '分离不可靠',
  low_vad: '无有效声段',
  overlap_heavy: '声源重叠严重',
  audio_unreliable: '声学不可靠',
  audio_degraded: '声学质量降级',
  low_confidence: '低置信',
  edge_budget_degraded: '预算降级直判',
};

const runStatusMeta: Record<string, { label: string; className: string }> = {
  queued: { label: '排队中', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  running: { label: '训练中', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  succeeded: { label: '已完成', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed: { label: '失败', className: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: '已取消', className: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
};

const reportStatusMeta: Record<string, { label: string; className: string }> = {
  report_ready: { label: '报告已生成', className: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
  pending_review: { label: '待一级审核', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  pending_final: { label: '待终审', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  approved: { label: '已通过', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: '已驳回', className: 'bg-red-50 text-red-700 border-red-200' },
};

function formatTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('zh-CN', { hour12: false });
}

function pct(value?: number | null) {
  if (value == null) return '—';
  return `${(Number(value) * 100).toFixed(2)}%`;
}

function errText(e: any, fallback: string) {
  return e?.message || fallback;
}

export default function TrainingPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          模型训练
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          训练样本池、训练任务与训练报告审批闭环，报告审批通过后模型方可灰度或上线
        </p>
      </div>

      <Tabs defaultValue="samples" className="space-y-4">
        <TabsList>
          <TabsTrigger value="samples">
            <Database className="h-4 w-4 mr-1.5" />
            训练样本池
          </TabsTrigger>
          <TabsTrigger value="runs">
            <Play className="h-4 w-4 mr-1.5" />
            训练任务
          </TabsTrigger>
          <TabsTrigger value="reports">
            <FileCheck2 className="h-4 w-4 mr-1.5" />
            报告审批
          </TabsTrigger>
        </TabsList>

        <TabsContent value="samples">
          <SamplePoolTab />
        </TabsContent>
        <TabsContent value="runs">
          <RunsTab />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── 训练样本池 ───────────────────────────────────────────────

function SamplePoolTab() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState<any | null>(null);
  const [samples, setSamples] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [mediaType, setMediaType] = useState('all');
  const [labelSource, setLabelSource] = useState('all');
  const [status, setStatus] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const buildParams = useCallback(() => {
    const params: Record<string, any> = { page, pageSize: PAGE_SIZE };
    if (mediaType !== 'all') params.media_type = mediaType;
    if (labelSource !== 'all') params.label_source = labelSource;
    if (status !== 'all') params.status = status;
    if (keyword) params.keyword = keyword;
    return params;
  }, [page, mediaType, labelSource, status, keyword]);

  const loadStats = useCallback(async () => {
    try {
      setStats(await api.records.trainingStats());
    } catch (e: any) {
      toastError(errText(e, '加载样本统计失败'));
    }
  }, []);

  const loadSamples = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.records.trainingSamples(buildParams());
      setSamples(data.list || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      toastError(errText(e, '加载训练样本失败'));
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadSamples();
  }, [loadSamples]);

  function handleSearch() {
    setPage(1);
    setKeyword(searchInput.trim());
  }

  async function handleExport(fmt: 'yolo' | 'coco') {
    setExporting(true);
    try {
      const params: Record<string, any> = { fmt };
      if (mediaType !== 'all') params.media_type = mediaType;
      await api.records.exportPackage(params);
      toastSuccess(`训练包已导出（${fmt.toUpperCase()} 格式）`);
      loadStats();
      loadSamples();
    } catch (e: any) {
      toastError(errText(e, '导出训练包失败'));
    } finally {
      setExporting(false);
    }
  }

  async function handleExportCsv() {
    setExporting(true);
    try {
      const params: Record<string, any> = {};
      if (mediaType !== 'all') params.media_type = mediaType;
      if (labelSource !== 'all') params.label_source = labelSource;
      if (status !== 'all') params.status = status;
      if (keyword) params.keyword = keyword;
      await api.records.trainingSamplesCsv(params);
      toastSuccess('样本清单已导出');
    } catch (e: any) {
      toastError(errText(e, '导出样本清单失败'));
    } finally {
      setExporting(false);
    }
  }

  const byMedia = stats?.byMediaType || {};

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-end gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleExportCsv} disabled={exporting}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            导出清单 CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport('coco')} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            COCO 训练包
          </Button>
          <Button onClick={() => handleExport('yolo')} disabled={exporting}>
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            YOLO 训练包
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">样本总数</p>
            <p className="text-2xl font-semibold mt-1">{stats?.total ?? 0}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(Object.keys(mediaLabels) as string[]).map((key) => (
                <Badge key={key} variant="outline" className="gap-1">
                  {mediaLabels[key]} {byMedia[key] ?? 0}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">就绪样本</p>
            <p className="text-2xl font-semibold mt-1 text-emerald-600">
              {stats?.ready ?? 0}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              已导出 {stats?.exported ?? 0} 条，导出率{' '}
              {stats ? `${Math.round((stats.exportRate || 0) * 100)}%` : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">自动确认记录</p>
            <p className="text-2xl font-semibold mt-1 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              {stats?.autoConfirmedTotal ?? 0}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.autoConfirmEnabled
                ? `阈值 ≥ ${stats?.autoConfirmThreshold ?? 0.9}，保护物种跳过`
                : '自动确认通道已关闭'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">标签来源</p>
            <div className="mt-2 space-y-1.5 text-sm">
              {(['auto', 'review', 'ai'] as const).map((key) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{sourceLabels[key]}</span>
                  <span className="font-medium">{stats?.byLabelSource?.[key] ?? 0}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              最近导出：{formatTime(stats?.lastExportedAt)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>样本列表</span>
            <Button variant="ghost" size="sm" onClick={() => { loadStats(); loadSamples(); }}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              刷新
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="w-[220px] pl-8"
                placeholder="物种 / 设备 / 样区"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleSearch}>
              搜索
            </Button>
            <Select
              value={mediaType}
              onValueChange={(v) => {
                setMediaType(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="媒体类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部模态</SelectItem>
                <SelectItem value="image">图像</SelectItem>
                <SelectItem value="video">视频</SelectItem>
                <SelectItem value="audio">音频</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={labelSource}
              onValueChange={(v) => {
                setLabelSource(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="标签来源" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部来源</SelectItem>
                <SelectItem value="auto">自动确认</SelectItem>
                <SelectItem value="review">人工复核</SelectItem>
                <SelectItem value="ai">AI识别</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="ready">就绪</SelectItem>
                <SelectItem value="exported">已导出</SelectItem>
                <SelectItem value="invalid">不可用</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : samples.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              暂无训练样本。确认复核结果或等待高置信度记录自动确认后将自动登记。
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">模态</TableHead>
                  <TableHead>标签物种</TableHead>
                  <TableHead className="w-[110px]">标签来源</TableHead>
                  <TableHead className="w-[90px]">置信度</TableHead>
                  <TableHead className="w-[140px]">质量标记</TableHead>
                  <TableHead>设备 / 样区</TableHead>
                  <TableHead className="w-[160px]">采集时间</TableHead>
                  <TableHead className="w-[90px]">状态</TableHead>
                  <TableHead className="w-[160px]">导出时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {samples.map((sample) => {
                  const MediaIcon = mediaIcons[sample.media_type] || Camera;
                  return (
                    <TableRow key={sample.id}>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-sm">
                          <MediaIcon className="h-4 w-4 text-muted-foreground" />
                          {mediaLabels[sample.media_type] || sample.media_type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{sample.labelName || '—'}</div>
                        <div className="text-xs text-muted-foreground italic">
                          {sample.labelLatinName || '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            sample.label_source === 'auto'
                              ? 'default'
                              : sample.label_source === 'review'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {sourceLabels[sample.label_source] || sample.label_source}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {((sample.confidence || 0) * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {qualityLabels[sample.quality_flag] || sample.quality_flag || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{sample.deviceName || '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {sample.surveyAreaName || '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTime(sample.capturedAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={sample.status === 'exported' ? 'default' : 'outline'}>
                          {sample.status === 'exported' && (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          )}
                          {statusLabels[sample.status] || sample.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTime(sample.exported_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <SimplePagination
            total={total}
            pageSize={PAGE_SIZE}
            page={page}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ── 训练任务 ─────────────────────────────────────────────────

function StatusBadge({ map, value }: { map: Record<string, { label: string; className: string }>; value: string }) {
  const meta = map[value] || { label: value || '—', className: 'bg-zinc-100 text-zinc-600 border-zinc-200' };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${meta.className}`}>
      {meta.label}
    </span>
  );
}

interface RunForm {
  media_type: string;
  label_sources: string;
  min_confidence: string;
  exclude_quality: boolean;
  epochs: string;
  batch_size: string;
}

const emptyRunForm: RunForm = {
  media_type: 'image',
  label_sources: '',
  min_confidence: '0',
  exclude_quality: false,
  epochs: '30',
  batch_size: '16',
};

function RunsTab() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any | null>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [mediaFilter, setMediaFilter] = useState('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<RunForm>(emptyRunForm);
  const [creating, setCreating] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setStats(await api.training.stats());
    } catch (e: any) {
      toastError(errText(e, '加载训练统计失败'));
    }
  }, []);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, pageSize: PAGE_SIZE };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (mediaFilter !== 'all') params.media_type = mediaFilter;
      const data = await api.training.runs(params);
      setRuns(data.list || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      toastError(errText(e, '加载训练任务失败'));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, mediaFilter]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  async function openDetail(id: number) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      setDetail(await api.training.runDetail(id));
    } catch (e: any) {
      toastError(errText(e, '加载任务详情失败'));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshAll() {
    await Promise.all([loadStats(), loadRuns()]);
    if (detail?.id) {
      try {
        setDetail(await api.training.runDetail(detail.id));
      } catch { /* ignore */ }
    }
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const payload: Record<string, any> = {
        media_type: form.media_type,
        epochs: Number(form.epochs) || 30,
        batch_size: Number(form.batch_size) || 16,
        min_confidence: Number(form.min_confidence) || 0,
        exclude_quality: form.exclude_quality,
      };
      if (form.label_sources) payload.label_sources = [form.label_sources];
      await api.training.createRun(payload);
      toastSuccess('训练任务已创建，正在异步执行');
      setCreateOpen(false);
      setForm(emptyRunForm);
      setPage(1);
      refreshAll();
    } catch (e: any) {
      toastError(errText(e, '发起训练失败'));
    } finally {
      setCreating(false);
    }
  }

  async function handleRetry(run: any) {
    try {
      await api.training.retryRun(run.id);
      toastSuccess('已重新投递训练任务');
      refreshAll();
    } catch (e: any) {
      toastError(errText(e, '重试失败'));
    }
  }

  async function handleCancel(run: any) {
    try {
      await api.training.cancelRun(run.id);
      toastSuccess('训练任务已取消');
      refreshAll();
    } catch (e: any) {
      toastError(errText(e, '取消失败'));
    }
  }

  const byStatus = stats?.runsByStatus || {};

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="任务状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="queued">排队中</SelectItem>
              <SelectItem value="running">训练中</SelectItem>
              <SelectItem value="succeeded">已完成</SelectItem>
              <SelectItem value="failed">失败</SelectItem>
              <SelectItem value="cancelled">已取消</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={mediaFilter}
            onValueChange={(v) => {
              setMediaFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="模态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部模态</SelectItem>
              <SelectItem value="image">图像</SelectItem>
              <SelectItem value="video">视频</SelectItem>
              <SelectItem value="audio">音频</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={refreshAll}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            刷新
          </Button>
        </div>
        <Button
          onClick={() => {
            setForm(emptyRunForm);
            setCreateOpen(true);
          }}
          disabled={stats && stats.trainingEnabled === false}
        >
          <Plus className="h-4 w-4 mr-2" />
          发起训练
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">训练任务总数</p>
            <p className="text-2xl font-semibold mt-1">{stats?.totalRuns ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-2">
              成功率 {stats ? `${Math.round((stats.successRate || 0) * 100)}%` : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">进行中</p>
            <p className="text-2xl font-semibold mt-1 text-sky-600">
              {(byStatus.queued || 0) + (byStatus.running || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              排队 {byStatus.queued || 0} · 训练 {byStatus.running || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">已完成</p>
            <p className="text-2xl font-semibold mt-1 text-emerald-600">
              {byStatus.succeeded || 0}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              失败 {byStatus.failed || 0} · 取消 {byStatus.cancelled || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">待审批报告</p>
            <p className="text-2xl font-semibold mt-1 flex items-center gap-1.5 text-amber-600">
              <ShieldCheck className="h-4 w-4" />
              {stats?.pendingReports ?? 0}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              审批层级：{stats?.approvalLevel === 'dual' ? '两级审批' : '单级审批'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : runs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              暂无训练任务。点击「发起训练」将基于当前样本池冻结快照并执行训练。
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[70px]">任务</TableHead>
                  <TableHead className="w-[90px]">模态</TableHead>
                  <TableHead className="w-[100px]">状态</TableHead>
                  <TableHead className="w-[120px]">样本 / 类别</TableHead>
                  <TableHead className="w-[130px]">报告状态</TableHead>
                  <TableHead className="w-[90px]">Top-1</TableHead>
                  <TableHead>提交人</TableHead>
                  <TableHead className="w-[160px]">创建时间</TableHead>
                  <TableHead className="w-[160px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="text-sm font-medium">#{run.id}</TableCell>
                    <TableCell className="text-sm">
                      {mediaLabels[run.media_type] || run.media_type}
                    </TableCell>
                    <TableCell>
                      <StatusBadge map={runStatusMeta} value={run.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {run.snapshotCount} / {run.classCount}
                    </TableCell>
                    <TableCell>
                      {run.reportStatus ? (
                        <StatusBadge map={reportStatusMeta} value={run.reportStatus} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {pct(run.metricsSummary?.top1)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {run.submittedBy || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTime(run.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(run.id)}>
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          详情
                        </Button>
                        {(run.status === 'failed' || run.status === 'cancelled') && (
                          <Button variant="ghost" size="sm" onClick={() => handleRetry(run)}>
                            <RefreshCw className="h-3.5 w-3.5 mr-1" />
                            重试
                          </Button>
                        )}
                        {(run.status === 'queued' || run.status === 'running') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleCancel(run)}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            取消
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <SimplePagination total={total} pageSize={PAGE_SIZE} page={page} onPageChange={setPage} />
        </CardContent>
      </Card>

      {/* 发起训练 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>发起训练</DialogTitle>
            <DialogDescription>
              系统将冻结符合条件的样本快照，异步执行训练并自动生成训练报告
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>训练模态</Label>
                <Select
                  value={form.media_type}
                  onValueChange={(v) => setForm({ ...form, media_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">图像</SelectItem>
                    <SelectItem value="video">视频</SelectItem>
                    <SelectItem value="audio">音频</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>标签来源</Label>
                <Select
                  value={form.label_sources || 'all'}
                  onValueChange={(v) => setForm({ ...form, label_sources: v === 'all' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部来源</SelectItem>
                    <SelectItem value="auto">自动确认</SelectItem>
                    <SelectItem value="review">人工复核</SelectItem>
                    <SelectItem value="ai">AI识别</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>最低置信度</Label>
                <Select
                  value={form.min_confidence}
                  onValueChange={(v) => setForm({ ...form, min_confidence: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">不限</SelectItem>
                    <SelectItem value="0.7">0.7</SelectItem>
                    <SelectItem value="0.9">0.9</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>训练轮数</Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={form.epochs}
                  onChange={(e) => setForm({ ...form, epochs: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Batch Size</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.batch_size}
                  onChange={(e) => setForm({ ...form, batch_size: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>排除质量异常样本</Label>
                <p className="text-xs text-muted-foreground">
                  高噪声、分离不可靠等带质量标记的样本不参与训练
                </p>
              </div>
              <Switch
                checked={form.exclude_quality}
                onCheckedChange={(v) => setForm({ ...form, exclude_quality: v })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              当前最少样本要求 {stats?.minSamples ?? 20} 条，训练完成后报告需审批通过才可发布模型。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              开始训练
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 任务详情 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              训练任务 #{detail?.id ?? ''}
            </DialogTitle>
            <DialogDescription>训练指标、数据快照与报告审批状态</DialogDescription>
          </DialogHeader>
          {detailLoading || !detail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <RunDetailContent detail={detail} onChange={refreshAll} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RunDetailContent({ detail, onChange }: { detail: any; onChange: () => void }) {
  const metrics = detail.metrics || {};
  const report = detail.latestReport;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge map={runStatusMeta} value={detail.status} />
        <span className="text-muted-foreground">模态：{mediaLabels[detail.media_type] || detail.media_type}</span>
        <span className="text-muted-foreground">模型族：{detail.model_family}</span>
        <span className="text-muted-foreground">提交人：{detail.submittedBy || '—'}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">样本 / 类别</p>
          <p className="text-lg font-semibold mt-1">{detail.snapshotCount} / {detail.classCount}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">训练 / 验证 / 测试</p>
          <p className="text-lg font-semibold mt-1">
            {detail.trainCount} / {detail.valCount} / {detail.testCount}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Top-1 / mAP</p>
          <p className="text-lg font-semibold mt-1">
            {pct(metrics.top1_accuracy)} / {pct(metrics.map50)}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">保护物种召回</p>
          <p className="text-lg font-semibold mt-1">{pct(metrics.protected_recall)}</p>
        </div>
      </div>

      {detail.error_message && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {detail.error_message}
        </div>
      )}

      {report ? (
        <div className="space-y-3">
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">训练报告 r{report.revision}</span>
              <StatusBadge map={reportStatusMeta} value={report.status} />
              {report.qualityGate?.passed ? (
                <Badge className="bg-emerald-600 text-[10px]">门禁通过</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                  门禁未通过
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => openReportHtml(report.id)}>
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                在线查看
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadReportPdf(report.id)}>
                <Download className="h-3.5 w-3.5 mr-1" />
                PDF
              </Button>
            </div>
          </div>
          {report.conclusion && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{report.conclusion}</p>
          )}
          <ReportActions report={report} onDone={onChange} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {detail.status === 'succeeded' ? '报告生成中…' : '训练完成后将自动生成训练报告。'}
        </p>
      )}
    </div>
  );
}

// ── 报告审批 ─────────────────────────────────────────────────

function ReportsTab() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, pageSize: PAGE_SIZE };
      if (statusFilter !== 'all') params.status = statusFilter;
      const data = await api.training.reports(params);
      setReports(data.list || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      toastError(errText(e, '加载训练报告失败'));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function openDetail(id: number) {
    setDetailOpen(true);
    setDetail(null);
    try {
      setDetail(await api.training.reportDetail(id));
    } catch (e: any) {
      toastError(errText(e, '加载报告详情失败'));
      setDetailOpen(false);
    }
  }

  async function refreshDetail() {
    load();
    if (detail?.id) {
      try {
        setDetail(await api.training.reportDetail(detail.id));
      } catch { /* ignore */ }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="审批状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="report_ready">报告已生成</SelectItem>
              <SelectItem value="pending_review">待一级审核</SelectItem>
              <SelectItem value="pending_final">待终审</SelectItem>
              <SelectItem value="approved">已通过</SelectItem>
              <SelectItem value="rejected">已驳回</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            刷新
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          提交人不能审批自己的报告；含保护/入侵物种的模型必须人工审批通过后才能发布
        </p>
      </div>

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : reports.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              暂无训练报告。训练任务完成后会自动生成报告。
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[70px]">报告</TableHead>
                  <TableHead className="w-[90px]">训练任务</TableHead>
                  <TableHead className="w-[60px]">版本</TableHead>
                  <TableHead className="w-[130px]">审批状态</TableHead>
                  <TableHead className="w-[90px]">门禁</TableHead>
                  <TableHead className="w-[90px]">Top-1</TableHead>
                  <TableHead>提交人 / 审批人</TableHead>
                  <TableHead className="w-[160px]">生成时间</TableHead>
                  <TableHead className="w-[190px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="text-sm font-medium">#{report.id}</TableCell>
                    <TableCell className="text-sm">#{report.runId}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">r{report.revision}</TableCell>
                    <TableCell>
                      <StatusBadge map={reportStatusMeta} value={report.status} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {report.qualityGate?.passed ? (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> 通过
                        </span>
                      ) : (
                        <span className="text-amber-600 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> 未通过
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{pct(report.metrics?.top1_accuracy)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {report.submittedBy || '—'}
                      {report.approvedBy ? ` / ${report.approvedBy}` : ''}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTime(report.generatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(report.id)}>
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          详情
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openReportHtml(report.id)}>
                          <ExternalLink className="h-3.5 w-3.5 mr-1" />
                          报告
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => downloadReportPdf(report.id)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <SimplePagination total={total} pageSize={PAGE_SIZE} page={page} onPageChange={setPage} />
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              训练报告 #{detail?.id ?? ''} · 训练任务 #{detail?.runId ?? ''}
            </DialogTitle>
            <DialogDescription>指标、质量门禁与审批记录</DialogDescription>
          </DialogHeader>
          {!detail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ReportDetailContent report={detail} onChange={refreshDetail} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReportDetailContent({ report, onChange }: { report: any; onChange: () => void }) {
  const metrics = report.metrics || {};
  const gate = report.qualityGate || {};
  const perClass = metrics.per_class || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge map={reportStatusMeta} value={report.status} />
        <Badge variant="outline" className="text-xs">
          {report.approval_level >= 2 ? '两级审批' : '单级审批'}
        </Badge>
        <span className="text-xs text-muted-foreground">
          生成于 {formatTime(report.generatedAt)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => openReportHtml(report.id)}>
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            在线报告
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadReportPdf(report.id)}>
            <Download className="h-3.5 w-3.5 mr-1" />
            PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Top-1</p>
          <p className="text-lg font-semibold mt-1">{pct(metrics.top1_accuracy)}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">mAP@0.5</p>
          <p className="text-lg font-semibold mt-1">{pct(metrics.map50)}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">保护物种召回</p>
          <p className="text-lg font-semibold mt-1">{pct(metrics.protected_recall)}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">误报率</p>
          <p className="text-lg font-semibold mt-1">{pct(metrics.false_positive_rate)}</p>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          质量门禁
        </p>
        <div className="rounded-lg border divide-y">
          {(gate.checks || []).map((check: any) => (
            <div key={check.key} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>{check.label}</span>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">
                  {pct(check.value)} / 阈值 {pct(check.threshold)}
                </span>
                {check.passed ? (
                  <span className="text-emerald-600 text-xs">通过</span>
                ) : (
                  <span className="text-destructive text-xs">未通过</span>
                )}
              </div>
            </div>
          ))}
          {(!gate.checks || gate.checks.length === 0) && (
            <div className="px-3 py-2 text-sm text-muted-foreground">未启用门禁校验</div>
          )}
        </div>
      </div>

      {report.comparison?.available && (
        <div>
          <p className="text-sm font-medium mb-2">与线上版本对比</p>
          <div className="rounded-lg border px-3 py-2 text-sm flex flex-wrap gap-4">
            <span>线上版本 {report.comparison.baseline?.version}</span>
            <span>Top-1 变化 {pct(report.comparison.delta_top1)}</span>
            <span>Top-5 变化 {pct(report.comparison.delta_top5)}</span>
          </div>
        </div>
      )}

      {perClass.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">逐类指标</p>
          <div className="max-h-56 overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>物种</TableHead>
                  <TableHead className="w-[70px]">样本</TableHead>
                  <TableHead className="w-[80px]">召回</TableHead>
                  <TableHead className="w-[80px]">精确</TableHead>
                  <TableHead className="w-[80px]">F1</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perClass.map((cls: any) => (
                  <TableRow key={cls.id ?? cls.name}>
                    <TableCell className="text-sm">
                      {cls.name}
                      {cls.protected && (
                        <Badge variant="outline" className="ml-1.5 text-[10px]">保护</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{cls.support}</TableCell>
                    <TableCell className="text-sm">{pct(cls.recall)}</TableCell>
                    <TableCell className="text-sm">{pct(cls.precision)}</TableCell>
                    <TableCell className="text-sm">{pct(cls.f1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {report.conclusion && (
        <div>
          <p className="text-sm font-medium mb-1">结论</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{report.conclusion}</p>
        </div>
      )}

      <div className="rounded-lg border px-3 py-2 text-sm space-y-1">
        <p>提交人：{report.submittedBy || '—'} · {formatTime(report.submittedAt)}</p>
        <p>一级审核：{report.reviewedBy || '—'} · {report.reviewComment || '—'}</p>
        <p>终审：{report.approvedBy || '—'} · {report.approvalComment || '—'}</p>
      </div>

      <ReportActions report={report} onDone={onChange} />
    </div>
  );
}

function ReportActions({ report, onDone }: { report: any; onDone: () => void }) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const canSubmit = report.canSubmit;
  const canReview = report.canReview;
  const canApprove = report.canApprove;
  const canReject = report.canReject;
  const anyAction = canSubmit || canReview || canApprove || canReject;

  async function act(kind: 'submit' | 'review' | 'approve' | 'reject') {
    setBusy(true);
    try {
      if (kind === 'submit') await api.training.submitReport(report.id, comment);
      if (kind === 'review') await api.training.reviewReport(report.id, comment);
      if (kind === 'approve') await api.training.approveReport(report.id, comment);
      if (kind === 'reject') await api.training.rejectReport(report.id, comment);
      toastSuccess(
        kind === 'submit'
          ? '报告已提交审批'
          : kind === 'reject'
            ? '报告已驳回'
            : '审批已通过'
      );
      setComment('');
      onDone();
    } catch (e: any) {
      toastError(errText(e, '操作失败'));
    } finally {
      setBusy(false);
    }
  }

  if (!anyAction) {
    return (
      <p className="text-xs text-muted-foreground">
        {report.isSubmitter
          ? '为确保审批独立性，提交人不能审批自己的训练报告。'
          : '当前报告无可用审批操作。'}
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <Label className="text-xs">审批意见（驳回时必填）</Label>
      <Textarea
        rows={2}
        placeholder="填写审核意见或驳回原因"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        {canSubmit && (
          <Button size="sm" onClick={() => act('submit')} disabled={busy}>
            {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            <FileCheck2 className="h-3.5 w-3.5 mr-1.5" />
            提交审批
          </Button>
        )}
        {canReview && (
          <Button size="sm" onClick={() => act('review')} disabled={busy}>
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
            一级审核通过
          </Button>
        )}
        {canApprove && (
          <Button size="sm" onClick={() => act('approve')} disabled={busy}>
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
            终审通过
          </Button>
        )}
        {canReject && (
          <Button
            size="sm"
            variant="outline"
            className="text-destructive border-destructive/40 hover:text-destructive"
            onClick={() => act('reject')}
            disabled={busy}
          >
            <XCircle className="h-3.5 w-3.5 mr-1.5" />
            驳回
          </Button>
        )}
      </div>
    </div>
  );
}

// ── 报告在线查看 / 下载 ──────────────────────────────────────

async function openReportHtml(reportId: number) {
  try {
    const html = await api.training.reportHtml(reportId);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e: any) {
    toastError(errText(e, '打开训练报告失败'));
  }
}

async function downloadReportPdf(reportId: number) {
  try {
    await api.training.reportPdf(reportId);
    toastSuccess('报告 PDF 已开始下载');
  } catch (e: any) {
    toastError(errText(e, '下载报告 PDF 失败'));
  }
}
