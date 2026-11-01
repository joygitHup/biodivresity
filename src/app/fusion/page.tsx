'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Dna,
  Eye,
  FlaskConical,
  GitMerge,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Mic,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { SimplePagination } from '@/components/simple-pagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
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
import { api, ApiError } from '@/lib/api';

const PAGE_SIZE = 6;

const protectionLabels: Record<string, string> = {
  national_1: '国家一级',
  national_2: '国家二级',
  provincial: '省级保护',
  invasive: '入侵物种',
  none: '无保护',
};

const modalityMeta: Record<
  string,
  { label: string; icon: typeof ImageIcon; className: string }
> = {
  image: { label: '图像', icon: ImageIcon, className: 'bg-sky-50 text-sky-700 border-sky-200' },
  audio: { label: '声学', icon: Mic, className: 'bg-violet-50 text-violet-700 border-violet-200' },
  edna: { label: 'eDNA', icon: FlaskConical, className: 'bg-teal-50 text-teal-700 border-teal-200' },
};

const gradeMeta: Record<string, { label: string; className: string; bar: string }> = {
  strong: { label: '强证据', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500' },
  moderate: { label: '中等证据', className: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'bg-amber-500' },
  weak: { label: '弱证据', className: 'bg-slate-50 text-slate-600 border-slate-200', bar: 'bg-slate-400' },
  conflict: { label: '证据冲突', className: 'bg-red-50 text-red-700 border-red-200', bar: 'bg-red-500' },
  insufficient: { label: '模态不足', className: 'bg-zinc-50 text-zinc-600 border-zinc-200', bar: 'bg-zinc-400' },
};

const statusMeta: Record<string, { label: string; className: string }> = {
  pending: { label: '待复核', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed: { label: '已确认', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: '已驳回', className: 'bg-red-50 text-red-700 border-red-200' },
};

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function formatWindow(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(s.getMonth() + 1)}-${p(s.getDate())} ${p(s.getHours())}:00 ~ ${p(e.getMonth() + 1)}-${p(e.getDate())} ${p(e.getHours())}:00`;
}

function errText(e: any, fallback: string) {
  if (e instanceof ApiError && e.errors) {
    return Object.values(e.errors).flat().join('；');
  }
  return e?.message || fallback;
}

function localDatetimeValue(date = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

interface EdnaForm {
  species: string;
  survey_area: string;
  sample_code: string;
  sampled_at: string;
  result: string;
  detection_confidence: string;
  copy_number: string;
  primer: string;
  lab: string;
  remark: string;
}

function emptyEdnaForm(): EdnaForm {
  return {
    species: '',
    survey_area: '',
    sample_code: '',
    sampled_at: localDatetimeValue(),
    result: 'positive',
    detection_confidence: '0.85',
    copy_number: '',
    primer: '',
    lab: '',
    remark: '',
  };
}

export default function FusionPage() {
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const notify = useCallback((type: 'ok' | 'err', text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4000);
  }, []);

  const [stats, setStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [clusters, setClusters] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalityFilter, setModalityFilter] = useState('all');
  const [conflictOnly, setConflictOnly] = useState(false);

  const [areas, setAreas] = useState<any[]>([]);
  const [speciesOptions, setSpeciesOptions] = useState<any[]>([]);

  const [rebuilding, setRebuilding] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewRemark, setReviewRemark] = useState('');

  const [ednaOpen, setEdnaOpen] = useState(false);
  const [ednaForm, setEdnaForm] = useState<EdnaForm>(emptyEdnaForm());
  const [ednaSaving, setEdnaSaving] = useState(false);
  const [ednaError, setEdnaError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadStats = useCallback(async () => {
    try {
      setStats(await api.fusion.stats());
    } catch (e: any) {
      notify('err', errText(e, '加载融合统计失败'));
    }
  }, [notify]);

  const loadClusters = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, pageSize: PAGE_SIZE };
      if (search) params.search = search;
      if (areaFilter !== 'all') params.survey_area = areaFilter;
      if (gradeFilter !== 'all') params.fused_grade = gradeFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (modalityFilter === 'image') params.has_image = true;
      if (modalityFilter === 'audio') params.has_audio = true;
      if (modalityFilter === 'edna') params.has_edna = true;
      if (conflictOnly) params.conflict_flag = true;
      const data = await api.fusion.clusters(params);
      setClusters(data.list || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      notify('err', errText(e, '加载证据簇失败'));
    } finally {
      setLoading(false);
    }
  }, [page, search, areaFilter, gradeFilter, statusFilter, modalityFilter, conflictOnly, notify]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadClusters();
  }, [loadClusters]);

  useEffect(() => {
    api.surveyAreas
      .all()
      .then((list) => setAreas(list || []))
      .catch(() => setAreas([]));
    api.species
      .list({ pageSize: 200 })
      .then((data) => setSpeciesOptions(data.list || []))
      .catch(() => setSpeciesOptions([]));
  }, []);

  async function handleRebuild() {
    setRebuilding(true);
    try {
      const result = await api.fusion.rebuild(30);
      notify('ok', `重建完成：${result.clusters ?? 0} 个证据簇（清理 ${result.deleted ?? 0} 个过期簇）`);
      await Promise.all([loadStats(), loadClusters()]);
    } catch (e: any) {
      notify('err', errText(e, '重建证据簇失败'));
    } finally {
      setRebuilding(false);
    }
  }

  async function openDetail(cluster: any) {
    setDetailOpen(true);
    setDetail(cluster);
    setReviewRemark('');
    setDetailLoading(true);
    try {
      setDetail(await api.fusion.detail(cluster.id));
    } catch (e: any) {
      notify('err', errText(e, '加载证据详情失败'));
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleReview(status: 'confirmed' | 'rejected') {
    if (!detail) return;
    setReviewing(true);
    try {
      const updated = await api.fusion.review(detail.id, status, reviewRemark.trim());
      setDetail(updated);
      notify('ok', status === 'confirmed' ? '证据簇已确认' : '证据簇已驳回');
      await Promise.all([loadStats(), loadClusters()]);
    } catch (e: any) {
      notify('err', errText(e, '复核失败'));
    } finally {
      setReviewing(false);
    }
  }

  function openEdna() {
    setEdnaForm(emptyEdnaForm());
    setEdnaError('');
    setEdnaOpen(true);
  }

  async function handleEdnaSubmit() {
    if (!ednaForm.species) return setEdnaError('请选择物种');
    if (!ednaForm.survey_area) return setEdnaError('请选择监测样区');
    if (!ednaForm.sampled_at) return setEdnaError('请选择采样时间');
    const confidence = Number(ednaForm.detection_confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      return setEdnaError('检测置信度需在 0~1 之间');
    }
    setEdnaSaving(true);
    setEdnaError('');
    try {
      await api.fusion.edna.create({
        species: Number(ednaForm.species),
        survey_area: Number(ednaForm.survey_area),
        sample_code: ednaForm.sample_code.trim(),
        sampled_at: new Date(ednaForm.sampled_at).toISOString(),
        result: ednaForm.result,
        detection_confidence: confidence,
        copy_number: ednaForm.copy_number ? Number(ednaForm.copy_number) : null,
        primer: ednaForm.primer.trim(),
        lab: ednaForm.lab.trim(),
        remark: ednaForm.remark.trim(),
      });
      setEdnaOpen(false);
      notify('ok', 'eDNA 证据已录入并触发时间窗重建');
      await Promise.all([loadStats(), loadClusters()]);
    } catch (e: any) {
      setEdnaError(errText(e, '录入失败'));
    } finally {
      setEdnaSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">跨模态证据融合</h1>
          <p className="text-muted-foreground text-sm mt-1">
            按物种 × 样区 × 时间窗聚合图像、声学与 eDNA 证据，加权融合并识别冲突
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openEdna}>
            <Plus className="h-4 w-4 mr-2" />
            录入 eDNA 证据
          </Button>
          <Button onClick={handleRebuild} disabled={rebuilding}>
            {rebuilding ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            重建最近 30 天
          </Button>
        </div>
      </div>

      {notice && (
        <Card className={notice.type === 'err' ? 'border-destructive' : 'border-emerald-500'}>
          <CardContent
            className={`p-4 text-sm ${notice.type === 'err' ? 'text-destructive' : 'text-emerald-700'}`}
          >
            {notice.text}
          </CardContent>
        </Card>
      )}

      {/* 统计卡片 */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="证据簇总数" value={stats?.total ?? 0} hint="最近重建结果" icon={GitMerge} />
        <StatCard title="待复核" value={stats?.pending ?? 0} hint={`保护物种 ${stats?.pendingProtected ?? 0}`} icon={Clock} tone="amber" />
        <StatCard title="多模态一致" value={stats?.multiModal ?? 0} hint="≥2 种模态交叉印证" icon={CheckCircle2} tone="emerald" />
        <StatCard title="证据冲突" value={stats?.conflict ?? 0} hint="需人工判定" icon={AlertTriangle} tone="red" />
        <StatCard
          title="模态覆盖"
          value={`${stats?.coverage?.image ?? 0}/${stats?.coverage?.audio ?? 0}/${stats?.coverage?.edna ?? 0}`}
          hint="图像 / 声学 / eDNA"
          icon={Dna}
        />
      </div>

      {/* 筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索物种或样区..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={areaFilter} onValueChange={(v) => { setAreaFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="样区" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部样区</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={modalityFilter} onValueChange={(v) => { setModalityFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="模态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部模态</SelectItem>
            <SelectItem value="image">含图像</SelectItem>
            <SelectItem value="audio">含声学</SelectItem>
            <SelectItem value="edna">含 eDNA</SelectItem>
          </SelectContent>
        </Select>
        <Select value={gradeFilter} onValueChange={(v) => { setGradeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="证据等级" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部等级</SelectItem>
            {Object.entries(gradeMeta).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="复核状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {Object.entries(statusMeta).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 px-2">
          <Switch checked={conflictOnly} onCheckedChange={(v) => { setConflictOnly(v); setPage(1); }} />
          <span className="text-sm text-muted-foreground">仅看冲突</span>
        </div>
      </div>

      {/* 列表 */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>物种</TableHead>
                  <TableHead>样区</TableHead>
                  <TableHead>时间窗</TableHead>
                  <TableHead>模态</TableHead>
                  <TableHead>融合置信度</TableHead>
                  <TableHead>等级</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clusters.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                      暂无证据簇，可点击「重建最近 30 天」或录入 eDNA 证据
                    </TableCell>
                  </TableRow>
                )}
                {clusters.map((c) => {
                  const grade = gradeMeta[c.fused_grade] || gradeMeta.weak;
                  const status = statusMeta[c.status] || statusMeta.pending;
                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => openDetail(c)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="text-sm font-medium">{c.speciesName}</p>
                            <p className="text-[11px] text-muted-foreground italic">{c.speciesLatinName}</p>
                          </div>
                          {c.protectionLevel && c.protectionLevel !== 'none' && (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                              {protectionLabels[c.protectionLevel] || c.protectionLevel}
                            </Badge>
                          )}
                          {c.conflict_flag && (
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{c.surveyAreaName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatWindow(c.window_start, c.window_end)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {(c.modalities || []).map((m: string) => {
                            const meta = modalityMeta[m];
                            if (!meta) return null;
                            const Icon = meta.icon;
                            return (
                              <Badge key={m} variant="outline" className={`text-[10px] ${meta.className}`}>
                                <Icon className="h-3 w-3 mr-0.5" />
                                {meta.label}
                              </Badge>
                            );
                          })}
                          <span className="text-[11px] text-muted-foreground">×{c.evidence_count}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <ConfidenceBar value={c.fused_confidence} barClass={grade.bar} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${grade.className}`}>
                          {grade.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${status.className}`}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); openDetail(c); }}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          详情
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {!loading && total > 0 && (
        <SimplePagination total={total} pageSize={PAGE_SIZE} page={page} onPageChange={setPage} />
      )}

      {/* 证据簇详情 / 复核 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className="truncate">{detail?.speciesName}</span>
              {detail && (
                <Badge variant="outline" className={`text-[10px] ${(gradeMeta[detail.fused_grade] || gradeMeta.weak).className}`}>
                  {(gradeMeta[detail.fused_grade] || gradeMeta.weak).label}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {detail?.speciesLatinName}
              {detail?.protectionLevel && detail.protectionLevel !== 'none'
                ? ` · ${protectionLabels[detail.protectionLevel] || detail.protectionLevel}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <InfoBlock icon={MapPin} label="监测样区" value={detail.surveyAreaName} />
                <InfoBlock
                  icon={Clock}
                  label="时间窗"
                  value={formatWindow(detail.window_start, detail.window_end)}
                />
                <InfoBlock
                  icon={Eye}
                  label="复核状态"
                  value={(statusMeta[detail.status] || statusMeta.pending).label}
                />
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <GitMerge className="h-4 w-4" />
                    融合置信度
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-end gap-3">
                    <span className="text-3xl font-semibold tabular-nums">
                      {(Number(detail.fused_confidence) * 100).toFixed(1)}
                      <span className="text-base font-normal text-muted-foreground ml-0.5">%</span>
                    </span>
                    <span className="text-xs text-muted-foreground mb-1">
                      {detail.modality_count} 种模态 · {detail.evidence_count} 条证据
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${(gradeMeta[detail.fused_grade] || gradeMeta.weak).bar}`}
                      style={{ width: `${Math.min(100, Math.max(0, Number(detail.fused_confidence) * 100))}%` }}
                    />
                  </div>
                  {detail.conflict_note && (
                    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                      {detail.conflict_note}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 模态摘要 */}
              <div className="grid gap-3 sm:grid-cols-3">
                {(detail.modalities || []).map((m: string) => {
                  const meta = modalityMeta[m];
                  const summary = detail.evidence_summary?.[m];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  return (
                    <div key={m} className="rounded-lg border p-3 space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Icon className="h-4 w-4" />
                        {meta.label}
                        <Badge variant="outline" className="text-[10px] ml-auto">
                          {summary?.count ?? 0} 条
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        平均置信度 {((summary?.avgConfidence ?? 0) * 100).toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        权重占比 {((summary?.weightShare ?? 0) * 100).toFixed(1)}%
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* 证据明细 */}
              <div>
                <h3 className="text-sm font-medium mb-2">证据明细</h3>
                <div className="rounded-lg border overflow-hidden overflow-x-auto">
                  <Table className="min-w-[640px]">
                    <TableHeader>
                      <TableRow className="[&>th]:px-2 [&>th]:py-1.5 [&>th]:text-[11px]">
                        <TableHead>模态</TableHead>
                        <TableHead>来源</TableHead>
                        <TableHead>观测时间</TableHead>
                        <TableHead className="text-right">置信</TableHead>
                        <TableHead className="text-right">可靠</TableHead>
                        <TableHead className="text-right">权重</TableHead>
                        <TableHead>方向</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detail.evidences || []).map((ev: any) => {
                        const meta = modalityMeta[ev.modality] || modalityMeta.image;
                        const Icon = meta.icon;
                        return (
                          <TableRow key={ev.id} className="[&>td]:px-2 [&>td]:py-1.5">
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] ${meta.className}`}>
                                <Icon className="h-3 w-3 mr-0.5" />
                                {meta.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs max-w-[140px] truncate" title={ev.source_label}>
                              {ev.source_label || '-'}
                              {ev.sampleCode ? `（${ev.sampleCode}）` : ''}
                              {ev.ednaResult && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ml-1 ${
                                    ev.ednaResult === 'positive'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-slate-50 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  {ev.ednaResult === 'positive' ? '阳' : '阴'}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                              {formatDateTime(ev.observed_at).replace(/:\d{2}$/, '')}
                            </TableCell>
                            <TableCell className="text-xs tabular-nums text-right">
                              {(Number(ev.confidence) * 100).toFixed(0)}%
                            </TableCell>
                            <TableCell className="text-xs tabular-nums text-right">
                              {(Number(ev.reliability) * 100).toFixed(0)}%
                            </TableCell>
                            <TableCell className="text-[11px] tabular-nums text-right">
                              {Number(ev.weight).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  ev.role === 'negative'
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                {ev.role === 'negative' ? '反对' : '支持'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* 复核留痕 */}
              {(detail.reviewLogs || []).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">复核留痕</h3>
                  <div className="space-y-1.5">
                    {(detail.reviewLogs || []).map((log: any) => (
                      <div key={log.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {log.actionLabel}
                        </span>
                        <span>{log.operatorName || '系统'}</span>
                        <span>{formatDateTime(log.created_at)}</span>
                        {log.remark && <span className="text-foreground">“{log.remark}”</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <Label>复核备注</Label>
                <Textarea
                  rows={2}
                  placeholder="填写判定依据或补充说明"
                  value={reviewRemark}
                  onChange={(e) => setReviewRemark(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDetailOpen(false)} disabled={reviewing}>
              关闭
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => handleReview('rejected')}
              disabled={reviewing || detailLoading || !detail}
            >
              {reviewing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
              驳回
            </Button>
            <Button
              onClick={() => handleReview('confirmed')}
              disabled={reviewing || detailLoading || !detail}
            >
              {reviewing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              确认证据
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 录入 eDNA 证据 */}
      <Dialog open={ednaOpen} onOpenChange={setEdnaOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              录入 eDNA 证据
            </DialogTitle>
            <DialogDescription>
              录入后立即重建对应时间窗的证据簇，阳性/阴性结果参与融合
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {ednaError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {ednaError}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>物种 *</Label>
                <Select
                  value={ednaForm.species}
                  onValueChange={(v) => setEdnaForm({ ...ednaForm, species: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择物种" />
                  </SelectTrigger>
                  <SelectContent>
                    {speciesOptions.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.chinese_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>监测样区 *</Label>
                <Select
                  value={ednaForm.survey_area}
                  onValueChange={(v) => setEdnaForm({ ...ednaForm, survey_area: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择样区" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>样本编号</Label>
                <Input
                  placeholder="如：EDNA-2026-001"
                  value={ednaForm.sample_code}
                  onChange={(e) => setEdnaForm({ ...ednaForm, sample_code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>采样时间 *</Label>
                <Input
                  type="datetime-local"
                  value={ednaForm.sampled_at}
                  onChange={(e) => setEdnaForm({ ...ednaForm, sampled_at: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>检测结果</Label>
                <Select
                  value={ednaForm.result}
                  onValueChange={(v) => setEdnaForm({ ...ednaForm, result: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positive">阳性</SelectItem>
                    <SelectItem value="negative">阴性</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>检测置信度 (0~1)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={1}
                  value={ednaForm.detection_confidence}
                  onChange={(e) => setEdnaForm({ ...ednaForm, detection_confidence: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>环境DNA浓度 (copies/L)</Label>
                <Input
                  type="number"
                  placeholder="可选"
                  value={ednaForm.copy_number}
                  onChange={(e) => setEdnaForm({ ...ednaForm, copy_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>引物 / 探针</Label>
                <Input
                  placeholder="可选"
                  value={ednaForm.primer}
                  onChange={(e) => setEdnaForm({ ...ednaForm, primer: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>检测实验室</Label>
              <Input
                placeholder="可选"
                value={ednaForm.lab}
                onChange={(e) => setEdnaForm({ ...ednaForm, lab: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                rows={2}
                value={ednaForm.remark}
                onChange={(e) => setEdnaForm({ ...ednaForm, remark: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdnaOpen(false)} disabled={ednaSaving}>
              取消
            </Button>
            <Button onClick={handleEdnaSubmit} disabled={ednaSaving}>
              {ednaSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              提交并重建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  title: string;
  value: string | number;
  hint: string;
  icon: typeof GitMerge;
  tone?: 'default' | 'amber' | 'emerald' | 'red';
}) {
  const toneClass = {
    default: 'text-foreground',
    amber: 'text-amber-600',
    emerald: 'text-emerald-600',
    red: 'text-red-600',
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{title}</p>
          <Icon className={`h-4 w-4 ${toneClass}`} />
        </div>
        <p className={`text-2xl font-semibold tabular-nums mt-1 ${toneClass}`}>{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
      </CardContent>
    </Card>
  );
}

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
      <p className="text-sm font-medium mt-1">{value}</p>
    </div>
  );
}

function ConfidenceBar({ value, barClass }: { value: number; barClass: string }) {
  const pct = Math.min(100, Math.max(0, Number(value) * 100));
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{pct.toFixed(0)}%</span>
    </div>
  );
}
