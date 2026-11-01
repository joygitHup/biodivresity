'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  X,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Camera,
  Mic,
  Video,
  AlertTriangle,
  Loader2,
  Download,
  Shield,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';
import { toastSuccess, toastError } from '@/lib/toast';
import { SimplePagination } from '@/components/simple-pagination';

const severityLabels: Record<string, string> = {
  low: '轻度',
  medium: '中度',
  high: '较高',
  critical: '严重',
  none: '无（健康）',
};

const REVIEW_QUEUE_PAGE_SIZE = 50;

const qualityLabels: Record<string, string> = {
  high_noise: '高噪声环境',
  unreliable_separation: '分离不可靠',
  low_vad: '无有效声段',
  overlap_heavy: '声源重叠严重',
  audio_unreliable: '声学不可靠',
  audio_degraded: '声学质量降级',
  low_confidence: '低置信',
};

const audioGradeLabels: Record<string, string> = {
  reliable: '声学可靠',
  degraded: '声学降级',
  unreliable: '声学不可靠',
};

const mediaIcons: Record<string, typeof Camera> = {
  image: Camera,
  video: Video,
  audio: Mic,
};

type ConfidenceBand = 'all' | 'low' | 'medium' | 'high';

export default function ReviewPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [queue, setQueue] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [queuePage, setQueuePage] = useState(1);
  const [breakdown, setBreakdown] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<any>(null);

  const [confidenceBand, setConfidenceBand] = useState<ConfidenceBand>('all');
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [devices, setDevices] = useState<any[]>([]);
  const [speciesSearch, setSpeciesSearch] = useState('');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [correctTarget, setCorrectTarget] = useState<any | null>(null);
  const [speciesOptions, setSpeciesOptions] = useState<any[]>([]);
  const [correctSpeciesId, setCorrectSpeciesId] = useState('');
  const [remark, setRemark] = useState('');
  const [batchAction, setBatchAction] = useState<'confirmed' | 'rejected' | null>(null);

  const buildParams = useCallback(() => {
    const params: Record<string, any> = { page: queuePage, pageSize: REVIEW_QUEUE_PAGE_SIZE };
    if (deviceFilter !== 'all') params.device = Number(deviceFilter);
    if (confidenceBand === 'low') {
      params.confidence__lt = 0.6;
    } else if (confidenceBand === 'medium') {
      params.confidence__gte = 0.6;
      params.confidence__lt = 0.8;
    } else if (confidenceBand === 'high') {
      params.confidence__gte = 0.8;
    }
    if (speciesSearch.trim()) params.search = speciesSearch.trim();
    return params;
  }, [queuePage, deviceFilter, confidenceBand, speciesSearch]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [queueRes, statsRes] = await Promise.all([
        api.records.reviewQueue(buildParams()),
        api.records.reviewStats(),
      ]);
      const qr = queueRes as any;
      const list = qr?.list || [];
      setQueue(list);
      setTotal(qr?.total ?? list.length);
      setBreakdown(qr?.priorityBreakdown || {});
      setStats(statsRes || null);
      setCurrentIndex((idx) => (idx >= list.length ? Math.max(0, list.length - 1) : idx));
      setSelectedIds((prev) => prev.filter((id) => list.some((r: any) => r.id === id)));
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    api.devices
      .list({ pageSize: 100 })
      .then((res) => setDevices(res?.list || []))
      .catch(() => setDevices([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 后端分页或筛选变化时，重置到批次首条
  useEffect(() => {
    setCurrentIndex(0);
  }, [queuePage, deviceFilter, confidenceBand, speciesSearch]);

  const currentRecord = queue[currentIndex];

  // 队列区域按可用高度分页展示，用上下页替代滚动条
  const listRef = useRef<HTMLDivElement | null>(null);
  const [pageSize, setPageSize] = useState(8);
  const pageCount = Math.max(1, Math.ceil(queue.length / pageSize));
  const currentPage = Math.min(pageCount - 1, Math.floor(currentIndex / pageSize));
  const pageStart = currentPage * pageSize;
  const visibleRecords = queue.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const ROW_HEIGHT = 56; // 行高 + 间距，保证每页恰好填满可用高度
    const measure = () => {
      const h = el.clientHeight;
      if (!h) return;
      const size = Math.max(1, Math.floor((h + 8) / ROW_HEIGHT));
      setPageSize((prev) => (prev === size ? prev : size));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, queue.length]);

  async function submitReview(status: string, options?: { remark?: string; correctedSpecies?: number }) {
    if (!currentRecord) return;
    setBusy(true);
    try {
      const statusText = status === 'confirmed' ? '确认' : status === 'rejected' ? '否定' : '修正';
      await api.records.review(currentRecord.id, status, options);
      toastSuccess(`已${statusText}`, currentRecord.speciesName);
      await load(true);
    } catch (e: any) {
      toastError('复核失败', e?.message);
    } finally {
      setBusy(false);
    }
  }

  async function openCorrect(record: any) {
    setCorrectTarget(record);
    setCorrectSpeciesId('');
    setRemark('');
    try {
      const res = await api.species.list({ pageSize: 200 });
      setSpeciesOptions(res?.list || []);
    } catch {
      setSpeciesOptions([]);
    }
  }

  async function handleCorrect() {
    if (!correctTarget) return;
    if (!correctSpeciesId) {
      setError('请选择正确的类别');
      return;
    }
    setBusy(true);
    try {
      await api.records.review(correctTarget.id, 'corrected', {
        correctedSpecies: Number(correctSpeciesId),
        remark,
      });
      toastSuccess('已修正类别', correctTarget.speciesName);
      setCorrectTarget(null);
      await load(true);
    } catch (e: any) {
      toastError('修正失败', e?.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleBatch() {
    if (!batchAction || selectedIds.length === 0) return;
    setBusy(true);
    try {
      await api.records.batchReview(selectedIds, batchAction);
      toastSuccess(
        `批量${batchAction === 'confirmed' ? '确认' : '否定'}完成`,
        `共 ${selectedIds.length} 条记录`
      );
      setBatchAction(null);
      setSelectedIds([]);
      await load(true);
    } catch (e: any) {
      toastError('批量复核失败', e?.message);
    } finally {
      setBusy(false);
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const belowThreshold =
    currentRecord && (currentRecord.confidence ?? 0) < (currentRecord.reviewThreshold ?? 0.6);
  const isHighRisk = ['high', 'critical'].includes(
    currentRecord?.severityLevel
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI识别复核</h1>
          <p className="text-muted-foreground text-sm mt-1">
            按风险优先级处理低置信度识别结果，复核数据可回流为模型训练样本
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              api.records.exportTraining().catch((e) => setError(e?.message || '导出失败'))
            }
          >
            <Download className="h-4 w-4 mr-2" />
            导出训练集
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              api.records.exportPackage({ fmt: 'yolo' }).catch((e) => setError(e?.message || '导出失败'))
            }
          >
            <Download className="h-4 w-4 mr-2" />
            训练包 (YOLO)
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              api.records.exportPackage({ fmt: 'coco' }).catch((e) => setError(e?.message || '导出失败'))
            }
          >
            <Download className="h-4 w-4 mr-2" />
            训练包 (COCO)
          </Button>
          <Button variant="outline" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新队列
          </Button>
        </div>
      </div>

      {/* 复核统计 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="待复核总数"
          value={stats?.pendingTotal ?? '—'}
          hint={`高风险病虫害 ${stats?.pendingProtected ?? 0} 条`}
          tone="primary"
        />
        <StatCard
          label="低置信度待复核"
          value={stats?.pendingLowConfidence ?? '—'}
          hint="置信度低于 60%"
          tone="warning"
        />
        <StatCard
          label="今日已复核"
          value={stats?.reviewedToday ?? '—'}
          hint={`累计 ${stats?.reviewedTotal ?? 0} 条`}
          tone="default"
        />
        <StatCard
          label="复核准确率"
          value={stats ? `${((stats.accuracyRate ?? 0) * 100).toFixed(1)}%` : '—'}
          hint={`修正 ${stats?.corrected ?? 0} · 否定 ${stats?.rejected ?? 0}`}
          tone="success"
        />
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)}>
              关闭
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 筛选 */}
      <Card>
        <CardContent className="p-4 flex items-end gap-3 flex-wrap">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Filter className="h-3 w-3" />
              置信度区间
            </Label>
            <Select value={confidenceBand} onValueChange={(v: ConfidenceBand) => setConfidenceBand(v)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部置信度</SelectItem>
                <SelectItem value="low">低置信度 (&lt;60%)</SelectItem>
                <SelectItem value="medium">中置信度 (60-80%)</SelectItem>
                <SelectItem value="high">高置信度 (≥80%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">设备</Label>
            <Select value={deviceFilter} onValueChange={setDeviceFilter}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部设备</SelectItem>
                {devices.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <Label className="text-xs text-muted-foreground">类别搜索</Label>
            <Input
              placeholder="输入病虫害名称或学名"
              value={speciesSearch}
              onChange={(e) => setSpeciesSearch(e.target.value)}
            />
          </div>
          <Badge variant="secondary" className="h-9 px-3">
            优先复核：高风险 {breakdown.protected ?? 0} · 虫害 {breakdown.invasive ?? 0}
          </Badge>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Camera className="h-12 w-12 mb-3 opacity-50 animate-pulse" />
          <p className="text-sm">加载复核队列...</p>
        </div>
      ) : queue.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Check className="h-16 w-16 text-emerald-500 mb-4" />
            <h3 className="text-lg font-semibold">复核队列已清空</h3>
            <p className="text-sm text-muted-foreground mt-1">
              当前筛选条件下没有待复核记录
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* 队列 */}
          <Card className="lg:col-span-2 h-full flex flex-col">
            <CardHeader className="pb-2 shrink-0">
              <CardTitle className="text-base flex items-center justify-between">
                <span>复核队列</span>
                <span className="text-xs font-normal text-muted-foreground">共 {total} 条</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 flex-1 flex flex-col min-h-0">
              <div ref={listRef} className="flex-1 min-h-0 flex flex-col gap-1 overflow-hidden">
                {visibleRecords.map((record, offset) => {
                  const index = pageStart + offset;
                  const Icon = mediaIcons[record.mediaType || record.media_type] || Camera;
                  const thr = record.reviewThreshold ?? 0.6;
                  const low = (record.confidence ?? 0) < thr;
                  const highRisk = ['high', 'critical'].includes(
                    record.severityLevel
                  );
                  return (
                    <div
                      key={record.id}
                      className={`flex flex-1 min-h-0 max-h-14 items-center gap-2 p-2 rounded-lg cursor-pointer ${
                        index === currentIndex
                          ? 'bg-primary/5 border border-primary/20'
                          : 'hover:bg-muted/50 border border-transparent'
                      }`}
                      onClick={() => setCurrentIndex(index)}
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 shrink-0"
                        checked={selectedIds.includes(record.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleSelect(record.id)}
                      />
                      {(record.media_type || record.mediaType) === 'image' && record.media_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={record.media_url}
                          alt={record.speciesName || '原始照片'}
                          className="h-9 w-9 rounded object-cover shrink-0 border"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-muted shrink-0">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium truncate">
                            {record.speciesName || '-'}
                          </p>
                          {highRisk && (
                            <Shield className="h-3 w-3 text-amber-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {record.deviceName} · {record.surveyAreaName || '-'}
                        </p>
                      </div>
                      <Badge
                        variant={low ? 'destructive' : 'secondary'}
                        className="text-[10px] shrink-0"
                      >
                        {((record.confidence ?? 0) * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  );
                })}
              </div>
              {selectedIds.length > 0 && (
                <div className="mt-2 pt-2 border-t flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground flex-1">
                    已选 {selectedIds.length} 条
                  </span>
                  <Button size="sm" variant="outline" onClick={() => setBatchAction('confirmed')} disabled={busy}>
                    批量确认
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setBatchAction('rejected')} disabled={busy}>
                    批量否定
                  </Button>
                </div>
              )}
              <div className="mt-2 pt-2 border-t flex items-center justify-between gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentIndex(Math.max(0, pageStart - pageSize))}
                  disabled={currentPage === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  上一页
                </Button>
                <span className="text-xs text-muted-foreground">
                  第 {currentPage + 1} / {pageCount} 页（本批）
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentIndex(Math.min(queue.length - 1, pageStart + pageSize))
                  }
                  disabled={currentPage >= pageCount - 1}
                >
                  下一页
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
              {/* 后端分页：跨批次翻页 */}
              {total > REVIEW_QUEUE_PAGE_SIZE && (
                <div className="mt-1 pt-1 border-t">
                  <SimplePagination
                    total={total}
                    pageSize={REVIEW_QUEUE_PAGE_SIZE}
                    page={queuePage}
                    onPageChange={(p) => setQueuePage(p)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* 当前记录 */}
          <div className="lg:col-span-3 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {(() => {
                    const Icon =
                      mediaIcons[currentRecord?.mediaType || currentRecord?.media_type] || Camera;
                    return <Icon className="h-4 w-4" />;
                  })()}
                  原始数据与 AI 识别结果
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                  {currentRecord?.media_url ? (
                    currentRecord.media_type === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={currentRecord.media_url}
                        alt={currentRecord.speciesName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="text-center text-muted-foreground text-sm">
                        媒体文件：{currentRecord.media_url}
                      </div>
                    )
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <Camera className="h-14 w-14 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">暂无原始文件预览</p>
                      <p className="text-xs mt-1">
                        {currentRecord?.deviceName} · {currentRecord?.timestamp}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">AI 识别类别</p>
                    <p className="text-lg font-semibold">{currentRecord?.speciesName || '-'}</p>
                    <p className="text-sm text-muted-foreground italic">
                      {currentRecord?.speciesLatinName || '-'}
                    </p>
                    {currentRecord?.severityLevel && currentRecord.severityLevel !== 'none' && (
                      <Badge className="mt-1.5 text-[10px] bg-amber-100 text-amber-800 border-amber-200">
                        {severityLabels[currentRecord.severityLevel] || currentRecord.severityLevel}
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">置信度 / 复核阈值</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            belowThreshold ? 'bg-red-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min((currentRecord?.confidence ?? 0) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {((currentRecord?.confidence ?? 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      阈值 {((currentRecord?.reviewThreshold ?? 0.6) * 100).toFixed(0)}%
                      {isHighRisk ? '（高风险病虫害高标准）' : '（普通类别）'}
                    </p>
                    {belowThreshold && (
                      <div className="flex items-center gap-1 mt-1.5 text-red-600 text-xs">
                        <AlertTriangle className="h-3 w-3" />
                        低于阈值，需人工确认
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {currentRecord?.quality_flag && (
                    <Badge variant="destructive" className="text-[10px]">
                      {qualityLabels[currentRecord.quality_flag] || currentRecord.quality_flag}
                    </Badge>
                  )}
                  {currentRecord?.audio_grade && (
                    <Badge
                      variant={currentRecord.audio_grade === 'unreliable' ? 'destructive' : 'outline'}
                      className="text-[10px]"
                    >
                      {audioGradeLabels[currentRecord.audio_grade] || currentRecord.audio_grade}
                      {currentRecord.audio_reliability != null
                        ? ` · R=${Number(currentRecord.audio_reliability).toFixed(2)}`
                        : ''}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm pt-2 border-t">
                  <Info label="数量" value={currentRecord?.count ?? '-'} />
                  <Info label="症状" value={currentRecord?.behavior || '-'} />
                  <Info label="样区" value={currentRecord?.surveyAreaName || '-'} />
                  <Info label="设备" value={currentRecord?.deviceName || '-'} />
                </div>

                <div className="pt-3 border-t space-y-2">
                  <Button className="w-full" onClick={() => submitReview('confirmed')} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                    确认识别结果
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => openCorrect(currentRecord)} disabled={busy}>
                      <Edit3 className="h-4 w-4 mr-2" />
                      修正类别
                    </Button>
                    <Button variant="destructive" onClick={() => submitReview('rejected')} disabled={busy}>
                      <X className="h-4 w-4 mr-2" />
                      否定为无效
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                上一条
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentIndex + 1} / {queue.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentIndex(Math.min(queue.length - 1, currentIndex + 1))}
                disabled={currentIndex >= queue.length - 1}
              >
                下一条
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 修正类别 */}
      <Dialog open={!!correctTarget} onOpenChange={(o) => !o && setCorrectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>修正识别结果</DialogTitle>
            <DialogDescription>
              原 AI 结果「{correctTarget?.speciesName}」（
              {((correctTarget?.confidence ?? 0) * 100).toFixed(0)}%），请选择正确类别
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>正确类别 *</Label>
              <Select value={correctSpeciesId} onValueChange={setCorrectSpeciesId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择正确类别" />
                </SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  {speciesOptions
                    .filter((sp) => sp.id !== correctTarget?.speciesId)
                    .map((sp) => (
                      <SelectItem key={sp.id} value={String(sp.id)}>
                        {sp.chinese_name}
                        {sp.latin_name ? `（${sp.latin_name}）` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>复核备注</Label>
              <Textarea
                rows={2}
                placeholder="如：依据毛色与体型判断"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectTarget(null)} disabled={busy}>
              取消
            </Button>
            <Button onClick={handleCorrect} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              提交修正
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量复核确认 */}
      <AlertDialog open={!!batchAction} onOpenChange={(o) => !o && setBatchAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              批量{batchAction === 'confirmed' ? '确认' : '否定'} {selectedIds.length} 条记录？
            </AlertDialogTitle>
            <AlertDialogDescription>
              批量操作将统一写入复核人与复核时间，操作后不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatch} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认执行
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: any;
  hint: string;
  tone: 'primary' | 'warning' | 'success' | 'default';
}) {
  const toneClass = {
    primary: 'text-primary',
    warning: 'text-amber-600',
    success: 'text-emerald-600',
    default: 'text-foreground',
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${toneClass}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium truncate">{value}</p>
    </div>
  );
}
