'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Search,
  Bug,
  Leaf,
  Sprout,
  Plus,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Label } from '@/components/ui/label';
import { SimplePagination } from '@/components/simple-pagination';
import { toastSuccess, toastError } from '@/lib/toast';
import { api, ApiError } from '@/lib/api';

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

const damageTypeLabels: Record<string, string> = {
  disease: '病害',
  pest: '虫害',
  healthy: '健康',
};

const partLabels: Record<string, string> = {
  leaf: '叶片',
  fruit: '果实',
  stem: '茎秆',
  root: '根茎',
  whole: '整株',
};

const severityLabels: Record<string, string> = {
  low: '轻度',
  medium: '中度',
  high: '较高',
  critical: '严重',
  none: '无（健康）',
};

const damageTypeIcons: Record<string, typeof Bug> = {
  disease: Leaf,
  pest: Bug,
  healthy: Sprout,
};

const damageTypeColors: Record<string, string> = {
  disease: 'bg-amber-50 text-amber-700 border-amber-200',
  pest: 'bg-purple-50 text-purple-700 border-purple-200',
  healthy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const severityColors: Record<string, string> = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-sky-50 text-sky-700 border-sky-200',
  none: 'bg-gray-50 text-gray-600 border-gray-200',
};

interface SpeciesForm {
  chinese_name: string;
  latin_name: string;
  crop: string;
  damage_type: string;
  part: string;
  severity: string;
  symptoms: string;
  prevention: string;
  description: string;
  distribution: string;
  image_url: string;
  review_threshold: string;
}

const emptyForm: SpeciesForm = {
  chinese_name: '',
  latin_name: '',
  crop: 'tomato',
  damage_type: 'disease',
  part: 'leaf',
  severity: 'medium',
  symptoms: '',
  prevention: '',
  description: '',
  distribution: '',
  image_url: '',
  review_threshold: '',
};

const PAGE_SIZE = 12;

export default function SpeciesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [species, setSpecies] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [cropFilter, setCropFilter] = useState<string>('all');
  const [damageFilter, setDamageFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  // 详情弹窗
  const [selectedSpecies, setSelectedSpecies] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 新建/编辑对话框
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSpecies, setEditingSpecies] = useState<any | null>(null);
  const [form, setForm] = useState<SpeciesForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');

  // 删除确认
  const [deletingSpecies, setDeletingSpecies] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 搜索防抖
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { page, pageSize: PAGE_SIZE };
      if (search) params.search = search;
      if (cropFilter !== 'all') params.crop = cropFilter;
      if (damageFilter !== 'all') params.damage_type = damageFilter;
      if (severityFilter !== 'all') params.severity = severityFilter;
      const data = await api.species.list(params);
      setSpecies(data.list || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, search, cropFilter, damageFilter, severityFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // 打开详情时拉取完整字段（症状、防治建议等）
  async function openDetail(sp: any) {
    setSelectedSpecies(sp);
    setDetailLoading(true);
    try {
      const detail = await api.species.detail(sp.id);
      setSelectedSpecies(detail);
    } catch {
      // 详情拉取失败时保留列表数据展示
    } finally {
      setDetailLoading(false);
    }
  }

  function openCreate() {
    setEditingSpecies(null);
    setForm(emptyForm);
    setFormError('');
    setPhotoFile(null);
    setPreviewUrl('');
    setDialogOpen(true);
  }

  async function openEdit(sp: any, e?: React.MouseEvent) {
    e?.stopPropagation();
    setFormError('');
    setSaving(false);
    setPhotoFile(null);
    setPreviewUrl('');
    try {
      // 拉详情以保证完整字段可编辑
      const detail = await api.species.detail(sp.id);
      setEditingSpecies(detail);
      setForm({
        chinese_name: detail.chinese_name ?? '',
        latin_name: detail.latin_name ?? '',
        crop: detail.crop ?? 'tomato',
        damage_type: detail.damage_type ?? 'disease',
        part: detail.part ?? 'leaf',
        severity: detail.severity ?? 'medium',
        symptoms: detail.symptoms ?? '',
        prevention: detail.prevention ?? '',
        description: detail.description ?? '',
        distribution: detail.distribution ?? '',
        image_url: detail.image_url ?? '',
        review_threshold:
          detail.review_threshold != null ? String(detail.review_threshold) : '',
      });
      setDialogOpen(true);
    } catch (err: any) {
      setError(err?.message || '加载病虫害详情失败');
    }
  }

  async function handleSave() {
    if (!form.chinese_name.trim()) {
      setFormError('请输入病虫害名称');
      return;
    }
    setSaving(true);
    setFormError('');
    const payload = {
      chinese_name: form.chinese_name.trim(),
      latin_name: form.latin_name.trim(),
      crop: form.crop,
      damage_type: form.damage_type,
      part: form.part,
      severity: form.severity,
      symptoms: form.symptoms.trim(),
      prevention: form.prevention.trim(),
      description: form.description.trim(),
      distribution: form.distribution.trim(),
      image_url: form.image_url.trim(),
      review_threshold: form.review_threshold.trim()
        ? Number(form.review_threshold)
        : null,
    };
    try {
      let saved: any;
      if (editingSpecies) {
        saved = await api.species.update(editingSpecies.id, payload);
      } else {
        saved = await api.species.create(payload);
      }
      // 选择了本地图片文件时，上传到 MinIO 并回写 image_url
      if (photoFile) {
        const targetId = saved?.id ?? editingSpecies?.id;
        if (targetId) {
          const res = await api.species.uploadPhoto(targetId, photoFile);
          const url = res?.image_url || res?.data?.image_url;
          if (url) setPreviewUrl(url);
        }
      }
      setDialogOpen(false);
      setPhotoFile(null);
      setPreviewUrl('');
      toastSuccess(
        editingSpecies ? '病虫害类别已更新' : '病虫害类别创建成功',
        editingSpecies?.chinese_name || payload.chinese_name
      );
      load();
    } catch (e: any) {
      const msg =
        e instanceof ApiError && e.errors
          ? Object.values(e.errors).flat().join('；')
          : e?.message || '保存失败';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingSpecies) return;
    setDeleting(true);
    try {
      await api.species.delete(deletingSpecies.id);
      toastSuccess('病虫害类别已删除', deletingSpecies.chinese_name);
      setDeletingSpecies(null);
      if (species.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        load();
      }
    } catch (e: any) {
      toastError('删除失败', e?.message);
      setDeletingSpecies(null);
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">病虫害类别档案</h1>
          <p className="text-muted-foreground text-sm mt-1">
            管理作物病虫害类别，包含受害部位、危害等级、症状特征与防治建议
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          新增类别
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索病虫害名称、学名..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={cropFilter} onValueChange={(v) => { setCropFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="作物" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部作物</SelectItem>
            {Object.entries(cropLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={damageFilter} onValueChange={(v) => { setDamageFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            {Object.entries(damageTypeLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="危害等级" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部等级</SelectItem>
            {Object.entries(severityLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Species Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 mb-3 animate-spin opacity-50" />
          <p className="text-sm">加载中...</p>
        </div>
      ) : species.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Bug className="h-12 w-12 mb-3 opacity-50" />
          <p className="text-sm">未找到匹配的病虫害类别</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {species.map((sp) => {
            const Icon = damageTypeIcons[sp.damage_type] || Bug;
            const severity = sp.severity || 'none';
            return (
              <Card
                key={sp.id}
                className="hover:shadow-md transition-all cursor-pointer group"
                onClick={() => openDetail(sp)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {sp.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sp.image_url}
                        alt={sp.chinese_name}
                        className="h-16 w-16 rounded-lg object-cover shrink-0 border bg-muted"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted shrink-0">
                        <Icon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm truncate">{sp.chinese_name}</h3>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${severityColors[severity] || ''}`}
                        >
                          {severityLabels[severity] || severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground italic mt-0.5 truncate">
                        {sp.latin_name || '—'}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="secondary" className="text-[10px]">
                          {cropLabels[sp.crop] || sp.crop}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${damageTypeColors[sp.damage_type] || ''}`}
                        >
                          {damageTypeLabels[sp.damage_type] || sp.damage_type}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {partLabels[sp.part] || sp.part}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
                        <span>{sp.record_count ?? 0} 条记录</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => openEdit(sp, e)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingSpecies(sp);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <SimplePagination
        total={total}
        pageSize={PAGE_SIZE}
        page={page}
        onPageChange={setPage}
      />

      {/* Species Detail Dialog */}
      <Dialog open={!!selectedSpecies} onOpenChange={() => setSelectedSpecies(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{selectedSpecies?.chinese_name}</span>
              <span className="text-sm font-normal text-muted-foreground italic">
                {selectedSpecies?.latin_name || ''}
              </span>
            </DialogTitle>
          </DialogHeader>
          {selectedSpecies && (
            <div className="space-y-4">
              {selectedSpecies.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedSpecies.image_url}
                  alt={selectedSpecies.chinese_name}
                  className="w-full aspect-video rounded-lg object-cover border bg-muted"
                />
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={severityColors[selectedSpecies.severity] || ''}
                >
                  {severityLabels[selectedSpecies.severity] || selectedSpecies.severity}
                </Badge>
                <Badge
                  variant="outline"
                  className={damageTypeColors[selectedSpecies.damage_type] || ''}
                >
                  {damageTypeLabels[selectedSpecies.damage_type] || selectedSpecies.damage_type}
                </Badge>
                <Badge variant="secondary">
                  {cropLabels[selectedSpecies.crop] || selectedSpecies.crop}
                </Badge>
                <Badge variant="outline">
                  {partLabels[selectedSpecies.part] || selectedSpecies.part}
                </Badge>
              </div>
              {detailLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div>
                    <span className="text-sm text-muted-foreground">症状特征</span>
                    <p className="text-sm mt-1">{selectedSpecies.symptoms || '-'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">防治建议</span>
                    <p className="text-sm mt-1">{selectedSpecies.prevention || '-'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">描述</span>
                    <p className="text-sm mt-1">{selectedSpecies.description || '-'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">发生区域</span>
                    <p className="text-sm mt-1">{selectedSpecies.distribution || '-'}</p>
                  </div>
                </>
              )}
              <div className="pt-2 border-t flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  监测记录数:{' '}
                  <strong className="text-foreground">
                    {selectedSpecies.record_count ?? 0}
                  </strong>{' '}
                  条
                </span>
                <span className="text-sm text-muted-foreground">
                  复核阈值:{' '}
                  <strong className="text-foreground">
                    {selectedSpecies.review_threshold ?? '按等级默认'}
                  </strong>
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSpecies ? '编辑病虫害类别' : '新增病虫害类别'}</DialogTitle>
            <DialogDescription>
              {editingSpecies
                ? '修改病虫害类别信息'
                : '录入新的作物病虫害类别，包含受害部位、危害等级与防治信息'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {formError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {formError}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>病虫害名称 *</Label>
                <Input
                  placeholder="如：番茄晚疫病"
                  value={form.chinese_name}
                  onChange={(e) => setForm({ ...form, chinese_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>学名 / 拉丁名</Label>
                <Input
                  placeholder="如：Phytophthora infestans（健康类别可留空）"
                  value={form.latin_name}
                  onChange={(e) => setForm({ ...form, latin_name: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>作物</Label>
                <Select value={form.crop} onValueChange={(v) => setForm({ ...form, crop: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(cropLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>类型</Label>
                <Select
                  value={form.damage_type}
                  onValueChange={(v) => setForm({ ...form, damage_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(damageTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>受害部位</Label>
                <Select value={form.part} onValueChange={(v) => setForm({ ...form, part: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(partLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>危害等级</Label>
                <Select
                  value={form.severity}
                  onValueChange={(v) => setForm({ ...form, severity: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(severityLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>症状特征</Label>
              <Textarea
                placeholder="如：叶尖叶缘出现水渍状暗绿斑，湿度大时生白色霉层"
                rows={3}
                value={form.symptoms}
                onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>防治建议</Label>
              <Textarea
                placeholder="如：控制棚内湿度、及早喷施预防性药剂"
                rows={3}
                value={form.prevention}
                onChange={(e) => setForm({ ...form, prevention: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                placeholder="病害流行特点、危害程度等补充说明"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>发生区域</Label>
              <Input
                placeholder="如：番茄主产区"
                value={form.distribution}
                onChange={(e) => setForm({ ...form, distribution: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>样本照片</Label>
              <div className="flex items-start gap-3">
                {(previewUrl || form.image_url) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl || form.image_url}
                    alt="照片预览"
                    className="h-24 w-32 rounded-md object-cover border bg-muted shrink-0"
                  />
                )}
                <div className="flex-1 space-y-2">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setPhotoFile(file);
                      setPreviewUrl(file ? URL.createObjectURL(file) : '');
                    }}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground">
                    支持 JPG/PNG/WebP，最大 10MB；保存后自动上传至 MinIO
                  </p>
                  <Input
                    placeholder="或填写已有照片地址（http://...）"
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>AI复核阈值（0-1）</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                max={1}
                placeholder="留空按危害等级取默认：高风险0.8、其余0.6"
                value={form.review_threshold}
                onChange={(e) => setForm({ ...form, review_threshold: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                低于该阈值时识别结果自动进入人工复核队列
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingSpecies ? '保存修改' : '确认创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingSpecies} onOpenChange={(open) => !open && setDeletingSpecies(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除病虫害类别？</AlertDialogTitle>
            <AlertDialogDescription>
              即将删除「{deletingSpecies?.chinese_name}」，此操作不可恢复，关联监测记录将保留但失去类别关联。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
