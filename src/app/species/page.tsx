'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Search,
  Bug,
  Leaf,
  Bird,
  Fish,
  Flower,
  Shell,
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

const categoryIcons: Record<string, typeof Bug> = {
  mammal: Bug,
  bird: Bird,
  reptile: Shell,
  amphibian: Shell,
  fish: Fish,
  insect: Bug,
  plant: Leaf,
  fungi: Flower,
};

const categoryLabels: Record<string, string> = {
  mammal: '哺乳类',
  bird: '鸟类',
  reptile: '爬行类',
  amphibian: '两栖类',
  fish: '鱼类',
  insect: '昆虫',
  plant: '植物',
  fungi: '真菌',
};

const protectionLevelLabels: Record<string, string> = {
  national_1: '国家一级',
  national_2: '国家二级',
  provincial: '省级保护',
  none: '无保护',
  invasive: '入侵物种',
};

const iucnLabels: Record<string, string> = {
  LC: '无危',
  NT: '近危',
  VU: '易危',
  EN: '濒危',
  CR: '极危',
  EW: '野外灭绝',
  EX: '灭绝',
};

const protectionColors: Record<string, string> = {
  national_1: 'bg-red-50 text-red-700 border-red-200',
  national_2: 'bg-orange-50 text-orange-700 border-orange-200',
  provincial: 'bg-amber-50 text-amber-700 border-amber-200',
  none: 'bg-gray-50 text-gray-600 border-gray-200',
  invasive: 'bg-purple-50 text-purple-700 border-purple-200',
};

const iucnColors: Record<string, string> = {
  CR: 'bg-red-100 text-red-800',
  EN: 'bg-orange-100 text-orange-800',
  VU: 'bg-amber-100 text-amber-800',
  NT: 'bg-yellow-100 text-yellow-800',
  LC: 'bg-green-100 text-green-800',
};

interface SpeciesForm {
  chinese_name: string;
  latin_name: string;
  category: string;
  protection_level: string;
  iucn_status: string;
  kingdom: string;
  phylum: string;
  class_name: string;
  order: string;
  family: string;
  genus: string;
  description: string;
  distribution: string;
  image_url: string;
  review_threshold: string;
}

const emptyForm: SpeciesForm = {
  chinese_name: '',
  latin_name: '',
  category: 'mammal',
  protection_level: 'none',
  iucn_status: 'LC',
  kingdom: '',
  phylum: '',
  class_name: '',
  order: '',
  family: '',
  genus: '',
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
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [protectionFilter, setProtectionFilter] = useState<string>('all');

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
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (protectionFilter !== 'all') params.protection_level = protectionFilter;
      const data = await api.species.list(params);
      setSpecies(data.list || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter, protectionFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // 打开详情时拉取完整字段（分类学信息、描述等）
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
      // 拉详情以保证分类学等完整字段可编辑
      const detail = await api.species.detail(sp.id);
      setEditingSpecies(detail);
      setForm({
        chinese_name: detail.chinese_name ?? '',
        latin_name: detail.latin_name ?? '',
        category: detail.category ?? 'mammal',
        protection_level: detail.protection_level ?? 'none',
        iucn_status: detail.iucn_status ?? 'LC',
        kingdom: detail.kingdom ?? '',
        phylum: detail.phylum ?? '',
        class_name: detail.class_name ?? '',
        order: detail.order ?? '',
        family: detail.family ?? '',
        genus: detail.genus ?? '',
        description: detail.description ?? '',
        distribution: detail.distribution ?? '',
        image_url: detail.image_url ?? '',
        review_threshold:
          detail.review_threshold != null ? String(detail.review_threshold) : '',
      });
      setDialogOpen(true);
    } catch (err: any) {
      setError(err?.message || '加载物种详情失败');
    }
  }

  async function handleSave() {
    if (!form.chinese_name.trim()) {
      setFormError('请输入中文名');
      return;
    }
    if (!form.latin_name.trim()) {
      setFormError('请输入拉丁名');
      return;
    }
    setSaving(true);
    setFormError('');
    const payload = {
      chinese_name: form.chinese_name.trim(),
      latin_name: form.latin_name.trim(),
      category: form.category,
      protection_level: form.protection_level,
      iucn_status: form.iucn_status,
      kingdom: form.kingdom.trim(),
      phylum: form.phylum.trim(),
      class_name: form.class_name.trim(),
      order: form.order.trim(),
      family: form.family.trim(),
      genus: form.genus.trim(),
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
        editingSpecies ? '物种已更新' : '物种创建成功',
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
      toastSuccess('物种已删除', deletingSpecies.chinese_name);
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
          <h1 className="text-2xl font-bold tracking-tight">物种档案</h1>
          <p className="text-muted-foreground text-sm mt-1">
            管理监测区域内动植物物种信息，包含分类学信息与保护等级
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          新增物种
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
            placeholder="搜索中文名、拉丁名..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="物种类别" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类别</SelectItem>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={protectionFilter} onValueChange={(v) => { setProtectionFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="保护等级" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部等级</SelectItem>
            {Object.entries(protectionLevelLabels).map(([key, label]) => (
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
          <p className="text-sm">未找到匹配的物种</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {species.map((sp) => {
            const CatIcon = categoryIcons[sp.category] || Bug;
            const protectionLevel = sp.protection_level || 'none';
            const iucnStatus = sp.iucn_status || 'LC';
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
                        <CatIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm truncate">{sp.chinese_name}</h3>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${protectionColors[protectionLevel] || ''}`}
                        >
                          {protectionLevelLabels[protectionLevel] || protectionLevel}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground italic mt-0.5 truncate">
                        {sp.latin_name}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {categoryLabels[sp.category] || sp.category}
                        </Badge>
                        <Badge
                          className={`text-[10px] ${iucnColors[iucnStatus] || 'bg-gray-100 text-gray-700'}`}
                        >
                          IUCN: {iucnStatus}
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
                {selectedSpecies?.latin_name}
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
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={protectionColors[selectedSpecies.protection_level] || ''}
                >
                  {protectionLevelLabels[selectedSpecies.protection_level] ||
                    selectedSpecies.protection_level}
                </Badge>
                <Badge className={iucnColors[selectedSpecies.iucn_status] || ''}>
                  IUCN: {iucnLabels[selectedSpecies.iucn_status] || selectedSpecies.iucn_status}
                </Badge>
                <Badge variant="secondary">
                  {categoryLabels[selectedSpecies.category] || selectedSpecies.category}
                </Badge>
              </div>
              {detailLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">界</span>
                      <p className="font-medium">{selectedSpecies.kingdom || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">门</span>
                      <p className="font-medium">{selectedSpecies.phylum || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">纲</span>
                      <p className="font-medium">{selectedSpecies.class_name || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">目</span>
                      <p className="font-medium">{selectedSpecies.order || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">科</span>
                      <p className="font-medium">{selectedSpecies.family || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">属</span>
                      <p className="font-medium">{selectedSpecies.genus || '-'}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">描述</span>
                    <p className="text-sm mt-1">{selectedSpecies.description || '-'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">分布区域</span>
                    <p className="text-sm mt-1">{selectedSpecies.distribution || '-'}</p>
                  </div>
                </>
              )}
              <div className="pt-2 border-t">
                <span className="text-sm text-muted-foreground">
                  监测记录数:{' '}
                  <strong className="text-foreground">
                    {selectedSpecies.record_count ?? 0}
                  </strong>{' '}
                  条
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
            <DialogTitle>{editingSpecies ? '编辑物种' : '新增物种'}</DialogTitle>
            <DialogDescription>
              {editingSpecies ? '修改物种档案信息' : '录入新的物种档案，包含分类学与保护信息'}
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
                <Label>中文名 *</Label>
                <Input
                  placeholder="如：中华穿山甲"
                  value={form.chinese_name}
                  onChange={(e) => setForm({ ...form, chinese_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>拉丁名 *</Label>
                <Input
                  placeholder="如：Manis pentadactyla"
                  value={form.latin_name}
                  onChange={(e) => setForm({ ...form, latin_name: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>物种类别</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>保护等级</Label>
                <Select
                  value={form.protection_level}
                  onValueChange={(v) => setForm({ ...form, protection_level: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(protectionLevelLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>IUCN 等级</Label>
                <Select
                  value={form.iucn_status}
                  onValueChange={(v) => setForm({ ...form, iucn_status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(iucnLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {key} {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>界</Label>
                <Input
                  placeholder="如：动物界"
                  value={form.kingdom}
                  onChange={(e) => setForm({ ...form, kingdom: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>门</Label>
                <Input
                  placeholder="如：脊索动物门"
                  value={form.phylum}
                  onChange={(e) => setForm({ ...form, phylum: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>纲</Label>
                <Input
                  placeholder="如：哺乳纲"
                  value={form.class_name}
                  onChange={(e) => setForm({ ...form, class_name: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>目</Label>
                <Input
                  placeholder="如：鳞甲目"
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>科</Label>
                <Input
                  placeholder="如：穿山甲科"
                  value={form.family}
                  onChange={(e) => setForm({ ...form, family: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>属</Label>
                <Input
                  placeholder="如：穿山甲属"
                  value={form.genus}
                  onChange={(e) => setForm({ ...form, genus: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                placeholder="物种形态特征、习性等描述"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>分布区域</Label>
              <Input
                placeholder="如：长江以南各省区"
                value={form.distribution}
                onChange={(e) => setForm({ ...form, distribution: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>物种照片</Label>
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
                placeholder="留空按保护等级取默认：保护物种0.8、常见0.6"
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
            <AlertDialogTitle>确认删除物种？</AlertDialogTitle>
            <AlertDialogDescription>
              即将删除「{deletingSpecies?.chinese_name}」，此操作不可恢复，关联监测记录将保留但失去物种关联。
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
