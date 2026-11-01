'use client';

import { useEffect, useState } from 'react';
import {
  Search,
  Camera,
  Mic,
  Video,
  Image,
  Download,
  Loader2,
  Play,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { toastSuccess, toastError } from '@/lib/toast';
import { api } from '@/lib/api';

const PAGE_SIZE = 10;

const mediaTypeIcons: Record<string, typeof Image> = {
  image: Image,
  video: Video,
  audio: Mic,
};

const mediaTypeLabels: Record<string, string> = {
  image: '图像',
  video: '视频',
  audio: '音频',
};

const reviewStatusConfig: Record<string, { label: string; variant: 'secondary' | 'default' | 'destructive' | 'outline' }> = {
  pending: { label: '待复核', variant: 'secondary' },
  confirmed: { label: '已确认', variant: 'default' },
  rejected: { label: '已否定', variant: 'destructive' },
  corrected: { label: '已修正', variant: 'outline' },
};

export default function RecordsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [areas, setAreas] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [reviewFilter, setReviewFilter] = useState<string>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all');
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  // 媒体预览：图像放大查看，音频/视频点击播放
  const [preview, setPreview] = useState<{
    type: string;
    url: string;
    title: string;
  } | null>(null);
  // 仅农技人员与管理员可导出（F4-3）
  const [canExport, setCanExport] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      const role = raw ? JSON.parse(raw)?.role : null;
      setCanExport(role === 'admin' || role === 'staff');
    } catch {
      setCanExport(false);
    }
  }, []);

  // 筛选变化时回到第一页
  useEffect(() => {
    setPage(1);
  }, [searchTerm, areaFilter, reviewFilter, confidenceFilter]);

  // 把当前界面筛选条件转换为后端查询参数
  function buildExportParams() {
    const params: Record<string, any> = { ordering: '-timestamp' };
    if (searchTerm.trim()) params.search = searchTerm.trim();
    if (areaFilter !== 'all') params.survey_area = areaFilter;
    if (reviewFilter !== 'all') params.review_status = reviewFilter;
    if (confidenceFilter === 'high') params.confidence__gte = 0.8;
    if (confidenceFilter === 'medium') {
      params.confidence__gte = 0.6;
      params.confidence__lt = 0.8;
    }
    if (confidenceFilter === 'low') params.confidence__lt = 0.6;
    return params;
  }

  // 把当前界面筛选条件转换为后端查询参数
  function buildListParams() {
    const params: Record<string, any> = {
      page,
      pageSize: PAGE_SIZE,
      ordering: '-timestamp',
    };
    if (searchTerm.trim()) params.search = searchTerm.trim();
    if (areaFilter !== 'all') params.survey_area = areaFilter;
    if (reviewFilter !== 'all') params.review_status = reviewFilter;
    if (confidenceFilter === 'high') params.confidence__gte = 0.8;
    if (confidenceFilter === 'medium') {
      params.confidence__gte = 0.6;
      params.confidence__lt = 0.8;
    }
    if (confidenceFilter === 'low') params.confidence__lt = 0.6;
    return params;
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      await api.records.export(buildExportParams());
      toastSuccess('导出已完成', '文件已开始下载');
    } catch (e: any) {
      toastError('导出失败', e?.message);
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [recRes, areaRes] = await Promise.all([
          api.records.list(buildListParams()),
          api.surveyAreas.all().catch(() => []),
        ]);
        if (!cancelled) {
          setRecords(recRes?.list || []);
          setTotal(recRes?.total || 0);
          setAreas(areaRes || []);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchTerm, areaFilter, reviewFilter, confidenceFilter]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">监测记录</h1>
          <p className="text-muted-foreground text-sm mt-1">
            查看和管理所有监测设备采集的物种识别记录
          </p>
        </div>
        {canExport && (
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {exporting ? '导出中...' : '导出数据'}
          </Button>
        )}
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">
            加载失败：{error}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索物种名、设备名..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="样区" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部样区</SelectItem>
            {areas.map((area) => (
              <SelectItem key={area.id} value={String(area.id)}>
                {area.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={reviewFilter} onValueChange={setReviewFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="复核状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="pending">待复核</SelectItem>
            <SelectItem value="confirmed">已确认</SelectItem>
            <SelectItem value="rejected">已否定</SelectItem>
            <SelectItem value="corrected">已修正</SelectItem>
          </SelectContent>
        </Select>
        <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="置信度" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="high">高 (≥80%)</SelectItem>
            <SelectItem value="medium">中 (60-80%)</SelectItem>
            <SelectItem value="low">低 (&lt;60%)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Records Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Camera className="h-12 w-12 mb-3 opacity-50 animate-pulse" />
          <p className="text-sm">加载中...</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>物种</TableHead>
                  <TableHead>设备</TableHead>
                  <TableHead>样区</TableHead>
                  <TableHead>行为</TableHead>
                  <TableHead>数量</TableHead>
                  <TableHead>置信度</TableHead>
                  <TableHead>复核状态</TableHead>
                  <TableHead>类型</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => {
                  const MediaIcon = mediaTypeIcons[record.mediaType || record.media_type] || Image;
                  const review =
                    reviewStatusConfig[record.reviewStatus ?? record.review_status] ||
                    reviewStatusConfig.pending;
                  const confidence = record.confidence ?? 0;
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="text-xs">
                        {new Date(record.timestamp || record.created_at).toLocaleDateString('zh-CN')}
                        <br />
                        <span className="text-muted-foreground">
                          {new Date(record.timestamp || record.created_at).toLocaleTimeString('zh-CN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">
                            {record.speciesName || record.species_name || '-'}
                          </p>
                          <p className="text-[11px] text-muted-foreground italic">
                            {record.speciesLatinName || record.species_latin_name || '-'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {record.deviceName || record.device_name || '-'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {record.surveyAreaName || record.survey_area_name || '-'}
                      </TableCell>
                      <TableCell className="text-xs">{record.behavior || '-'}</TableCell>
                      <TableCell className="text-center text-sm">{record.count ?? '-'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            confidence >= 0.8
                              ? 'default'
                              : confidence >= 0.6
                                ? 'secondary'
                                : 'destructive'
                          }
                          className="text-[10px]"
                        >
                          {(confidence * 100).toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={review.variant} className="text-[10px]">
                          {review.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const mediaType = record.mediaType || record.media_type;
                          const url = record.mediaUrl || record.media_url;
                          const speciesName =
                            record.speciesName || record.species_name || '监测记录';
                          if (!url) {
                            return <MediaIcon className="h-4 w-4 text-muted-foreground" />;
                          }
                          if (mediaType === 'image') {
                            return (
                              <button
                                type="button"
                                title="点击查看大图"
                                onClick={() =>
                                  setPreview({
                                    type: 'image',
                                    url,
                                    title: `${speciesName} · 图像`,
                                  })
                                }
                                className="block h-9 w-9 overflow-hidden rounded border bg-muted transition hover:ring-2 hover:ring-primary/40"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={url}
                                  alt={speciesName}
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            );
                          }
                          return (
                            <button
                              type="button"
                              title={mediaType === 'audio' ? '点击播放音频' : '点击播放视频'}
                              onClick={() =>
                                setPreview({
                                  type: mediaType,
                                  url,
                                  title: `${speciesName} · ${mediaTypeLabels[mediaType] || mediaType}`,
                                })
                              }
                              className="relative flex h-9 w-9 items-center justify-center rounded border bg-muted/60 text-muted-foreground transition hover:bg-muted hover:text-primary"
                            >
                              <MediaIcon className="h-4 w-4" />
                              {(mediaType === 'audio' || mediaType === 'video') && (
                                <Play className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-background p-[1px] text-primary" />
                              )}
                            </button>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!loading && records.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Camera className="h-12 w-12 mb-3 opacity-50" />
          <p className="text-sm">未找到匹配的监测记录</p>
        </div>
      )}

      {/* 媒体预览 */}
      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.title || '媒体预览'}</DialogTitle>
          </DialogHeader>
          {preview?.type === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.url}
              alt={preview.title}
              className="max-h-[75vh] w-full rounded-md object-contain bg-muted"
            />
          )}
          {preview?.type === 'video' && (
            <video
              src={preview.url}
              controls
              autoPlay
              className="max-h-[75vh] w-full rounded-md bg-black"
            />
          )}
          {preview?.type === 'audio' && (
            <audio src={preview.url} controls autoPlay className="w-full" />
          )}
        </DialogContent>
      </Dialog>

      {/* 分页 */}
      <SimplePagination
        total={total}
        pageSize={PAGE_SIZE}
        page={page}
        onPageChange={setPage}
      />
    </div>
  );
}
