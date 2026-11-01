'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Map,
  Plus,
  Search,
  TreePine,
  Droplets,
  Wheat,
  Waves,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  DialogTrigger,
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

const typeIcons: Record<string, typeof TreePine> = {
  forest: TreePine,
  wetland: Droplets,
  farmland: Wheat,
  water: Waves,
};

const typeColors: Record<string, string> = {
  forest: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  wetland: 'bg-sky-50 text-sky-700 border-sky-200',
  farmland: 'bg-amber-50 text-amber-700 border-amber-200',
  water: 'bg-blue-50 text-blue-700 border-blue-200',
};

const surveyAreaTypeLabels: Record<string, string> = {
  forest: '森林',
  wetland: '湿地',
  farmland: '农田',
  water: '水域',
};

interface AreaForm {
  name: string;
  type: string;
  area: string;
  elevation: string;
  lat: string;
  lng: string;
  vegetation: string;
  status: string;
}

const emptyForm: AreaForm = {
  name: '',
  type: 'forest',
  area: '',
  elevation: '',
  lat: '',
  lng: '',
  vegetation: '',
  status: 'active',
};

const PAGE_SIZE = 9;

export default function SurveyAreasPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // 过滤条件（searchInput 为输入框即时值，search 为防抖后实际查询值）
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // 新建/编辑对话框
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<any | null>(null);
  const [form, setForm] = useState<AreaForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // 删除确认
  const [deletingArea, setDeletingArea] = useState<any | null>(null);
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
      if (typeFilter !== 'all') params.type = typeFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      const data = await api.surveyAreas.list(params);
      setAreas(data.list || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditingArea(null);
    setForm(emptyForm);
    setFormError('');
    setDialogOpen(true);
  }

  function openEdit(area: any) {
    setEditingArea(area);
    setForm({
      name: area.name ?? '',
      type: area.type ?? 'forest',
      area: area.area != null ? String(area.area) : '',
      elevation: area.elevation ?? '',
      lat: area.lat != null ? String(area.lat) : '',
      lng: area.lng != null ? String(area.lng) : '',
      vegetation: area.vegetation ?? '',
      status: area.status ?? 'active',
    });
    setFormError('');
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setFormError('请输入样区名称');
      return;
    }
    if (!form.area || isNaN(Number(form.area))) {
      setFormError('请输入有效的面积数值');
      return;
    }
    if (!form.lat || isNaN(Number(form.lat)) || !form.lng || isNaN(Number(form.lng))) {
      setFormError('请输入有效的经纬度数值');
      return;
    }
    setSaving(true);
    setFormError('');
    const payload = {
      name: form.name.trim(),
      type: form.type,
      area: Number(form.area),
      elevation: form.elevation.trim(),
      lat: Number(form.lat),
      lng: Number(form.lng),
      vegetation: form.vegetation.trim(),
      status: form.status,
    };
    try {
      if (editingArea) {
        await api.surveyAreas.update(editingArea.id, payload);
        toastSuccess('样区已更新', editingArea.name);
      } else {
        await api.surveyAreas.create(payload);
        toastSuccess('样区创建成功', payload.name);
      }
      setDialogOpen(false);
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
    if (!deletingArea) return;
    setDeleting(true);
    try {
      await api.surveyAreas.delete(deletingArea.id);
      toastSuccess('样区已删除', deletingArea.name);
      const deletedName = deletingArea.name;
      setDeletingArea(null);
      // 删除后若当前页已空且非第一页，回退一页
      if (areas.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        load();
      }
    } catch (e: any) {
      toastError('删除失败', e?.message);
      setDeletingArea(null);
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">样区管理</h1>
          <p className="text-muted-foreground text-sm mt-1">
            管理标准化监测样区，覆盖森林、湿地、农田、水域等生态系统
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              新增样区
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingArea ? '编辑监测样区' : '新增监测样区'}</DialogTitle>
              <DialogDescription>
                {editingArea ? '修改样区基本信息' : '填写样区基本信息，创建新的标准化监测样区'}
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
                  <Label>样区名称 *</Label>
                  <Input
                    placeholder="如：凤阳山北麓样区"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>生态系统类型</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm({ ...form, type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="forest">森林</SelectItem>
                      <SelectItem value="wetland">湿地</SelectItem>
                      <SelectItem value="farmland">农田</SelectItem>
                      <SelectItem value="water">水域</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>面积 (km²) *</Label>
                  <Input
                    type="number"
                    placeholder="10-20"
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>海拔范围</Label>
                  <Input
                    placeholder="如：800-1400m"
                    value={form.elevation}
                    onChange={(e) => setForm({ ...form, elevation: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>纬度 *</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="如：27.9234"
                    value={form.lat}
                    onChange={(e) => setForm({ ...form, lat: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>经度 *</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="如：119.2345"
                    value={form.lng}
                    onChange={(e) => setForm({ ...form, lng: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>主要植被类型</Label>
                  <Input
                    placeholder="如：常绿阔叶林"
                    value={form.vegetation}
                    onChange={(e) => setForm({ ...form, vegetation: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>状态</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">活跃</SelectItem>
                      <SelectItem value="inactive">停用</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                取消
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingArea ? '保存修改' : '确认创建'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索样区名称或植被类型..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="生态类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="forest">森林</SelectItem>
            <SelectItem value="wetland">湿地</SelectItem>
            <SelectItem value="farmland">农田</SelectItem>
            <SelectItem value="water">水域</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="active">活跃</SelectItem>
            <SelectItem value="inactive">停用</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Survey Area Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 mb-3 animate-spin opacity-50" />
          <p className="text-sm">加载中...</p>
        </div>
      ) : areas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Map className="h-12 w-12 mb-3 opacity-50" />
          <p className="text-sm">未找到匹配的样区</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {areas.map((area) => {
            const TypeIcon = typeIcons[area.type] || TreePine;
            return (
              <Card
                key={area.id}
                className="hover:shadow-md transition-all group"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`rounded-lg p-2 border ${typeColors[area.type] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                        <TypeIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                          {area.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {surveyAreaTypeLabels[area.type] || area.type} · {area.area ?? '-'} km²
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={area.status === 'active' ? 'default' : 'secondary'}
                      className="text-[10px]"
                    >
                      {area.status === 'active' ? '活跃' : '停用'}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>海拔范围</span>
                      <span className="font-medium text-foreground">{area.elevation ?? '-'}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>经纬度</span>
                      <span className="font-medium text-foreground">
                        {area.lat ?? '-'}, {area.lng ?? '-'}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>植被类型</span>
                      <span className="font-medium text-foreground">{area.vegetation ?? '-'}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Map className="h-3 w-3" />
                        {area.device_count ?? 0} 台设备
                      </span>
                      <span className="flex items-center gap-1">
                        <TreePine className="h-3 w-3" />
                        {area.species_count ?? 0} 物种
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(area)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeletingArea(area)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingArea} onOpenChange={(open) => !open && setDeletingArea(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除样区？</AlertDialogTitle>
            <AlertDialogDescription>
              即将删除「{deletingArea?.name}」，此操作不可恢复。样区关联的设备将解除绑定。
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
