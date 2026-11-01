'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScanLine,
  Upload,
  Loader2,
  Image as ImageIcon,
  AlertTriangle,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SimplePagination } from '@/components/simple-pagination';
import { api } from '@/lib/api';
import { toastSuccess, toastError } from '@/lib/toast';

const PAGE_SIZE = 20;

const cropLabels: Record<string, string> = {
  apple: '苹果',
  blueberry: '蓝莓',
  cherry: '樱桃',
  corn: '玉米',
  grape: '葡萄',
  orange: '柑橘',
  peach: '桃',
  pepper: '辣椒',
  potato: '马铃薯',
  raspberry: '树莓',
  soybean: '大豆',
  squash: '南瓜',
  strawberry: '草莓',
  tomato: '番茄',
};

function pct(value?: number | null) {
  if (value == null) return '—';
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function formatTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('zh-CN', { hour12: false });
}

export default function RecognizePage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropId, setCropId] = useState<string>('all');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadHistory = useCallback(async (targetPage: number) => {
    setHistoryLoading(true);
    try {
      const res = await api.recognize.history({ page: targetPage, pageSize: PAGE_SIZE });
      setRecords(res?.list || []);
      setTotal(res?.total || 0);
    } catch (e: any) {
      toastError(e?.message || '识别历史加载失败');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(1);
  }, [loadHistory]);

  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function handleUpload(selected: File) {
    setFile(selected);
    setError('');
    setAnalyzing(true);
    try {
      const data = await api.recognize.upload(selected, cropId === 'all' ? undefined : cropId);
      setResult(data);
      toastSuccess('识别完成');
      loadHistory(1);
      setPage(1);
    } catch (e: any) {
      setError(e?.message || '识别失败，请稍后重试');
      toastError(e?.message || '识别失败');
    } finally {
      setAnalyzing(false);
    }
  }

  async function openDetail(id: number) {
    setDetailOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await api.recognize.historyDetail(id);
      setDetail(data);
    } catch (e: any) {
      toastError(e?.message || '详情加载失败');
    } finally {
      setDetailLoading(false);
    }
  }

  const advisory = result?.advisory;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ScanLine className="h-6 w-6 text-primary" />
          病虫害识别
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          上传作物叶片/果实图像，返回 Top-5 病虫害类别与防治建议（结果仅供参考）
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 上传与结果 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">图像识别</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Select value={cropId} onValueChange={setCropId}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="作物（可选）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部作物</SelectItem>
                  {Object.entries(cropLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  if (selected) handleUpload(selected);
                  e.target.value = '';
                }}
              />
              <Button onClick={() => fileRef.current?.click()} disabled={analyzing}>
                {analyzing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {analyzing ? '识别中...' : '选择图片'}
              </Button>
            </div>

            <div className="rounded-lg border border-dashed p-3 flex items-center justify-center min-h-[180px] bg-muted/30">
              {preview ? (
                <img
                  src={preview}
                  alt="待识别图像"
                  className="max-h-[220px] rounded-md object-contain"
                />
              ) : (
                <div className="text-center text-sm text-muted-foreground">
                  <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-60" />
                  支持 JPG / PNG / WebP，单张不超过 10MB
                </div>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {result && (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2 rounded-md border p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Top-1 识别结果</p>
                    <p className="text-lg font-semibold mt-0.5">{result.top_k?.[0]?.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {result.top_k?.[0]?.path}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-primary">
                      {pct(result.top_k?.[0]?.confidence)}
                    </p>
                    {result.rejected ? (
                      <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                        置信度偏低，建议人工复核
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        置信度达标
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {(result.top_k || []).map((item: any) => (
                    <div key={item.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate">{item.name}</span>
                        <span className="text-muted-foreground">{pct(item.confidence)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(100, (item.confidence || 0) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {advisory && (
                  <div className="rounded-md border p-3 text-sm space-y-1">
                    <p className="font-medium flex items-center gap-1.5">
                      {result.rejected ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      )}
                      防治建议（{advisory.damage_type} · 危害等级 {advisory.severity}）
                    </p>
                    <p className="text-muted-foreground">症状：{advisory.symptoms}</p>
                    <p className="text-muted-foreground">措施：{advisory.measures}</p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  {result.disclaimer} · 模型版本 {result.model_version}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 识别历史 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">我的识别历史</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {historyLoading ? (
              <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">
                加载中...
              </div>
            ) : records.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">
                暂无识别记录
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>识别类别</TableHead>
                    <TableHead>置信度</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatTime(record.created_at)}
                      </TableCell>
                      <TableCell className="text-sm">{record.top_category_name}</TableCell>
                      <TableCell className="text-sm">{pct(record.top_confidence)}</TableCell>
                      <TableCell>
                        {record.rejected ? (
                          <Badge variant="secondary">置信度偏低</Badge>
                        ) : (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            通过
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(record.id)}>
                          <Eye className="h-4 w-4 mr-1" />
                          详情
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <SimplePagination
              total={total}
              pageSize={PAGE_SIZE}
              page={page}
              onPageChange={(next) => {
                setPage(next);
                loadHistory(next);
              }}
            />
          </CardContent>
        </Card>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>识别详情</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">加载中...</div>
          ) : detail ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <p className="text-muted-foreground">识别时间</p>
                <p>{formatTime(detail.created_at)}</p>
                <p className="text-muted-foreground">请求编号</p>
                <p className="break-all">{detail.request_id || '—'}</p>
                <p className="text-muted-foreground">模型版本</p>
                <p>{detail.model_version}</p>
              </div>
              <div className="space-y-2 border-t pt-3">
                {(detail.top5_result || []).map((item: any, index: number) => (
                  <div key={`${item.id}-${index}`} className="flex items-center justify-between">
                    <span>
                      {index + 1}. {item.name}
                      {item.path ? (
                        <span className="text-xs text-muted-foreground ml-1">({item.path})</span>
                      ) : null}
                    </span>
                    <span className="text-muted-foreground">{pct(item.confidence)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">暂无数据</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
