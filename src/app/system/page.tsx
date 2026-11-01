'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Users,
  Shield,
  FileText,
  Settings,
  Plus,
  Search,
  Pencil,
  Trash2,
  Clock,
  Key,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRightIcon,
  RotateCcw,
  Zap,
  GitMerge,
  Cpu,
  Database,
  FlaskConical,
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
import { SimplePagination } from '@/components/simple-pagination';
import { toastSuccess, toastError } from '@/lib/toast';
import { api, ApiError } from '@/lib/api';

// ── 常量映射 ─────────────────────────────────────────────────

const roleLabels: Record<string, string> = {
  admin: '管理员',
  staff: '农技人员',
  user: '普通用户',
};

const roleColors: Record<string, string> = {
  admin: 'bg-red-50 text-red-700 border-red-200',
  staff: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  user: 'bg-sky-50 text-sky-700 border-sky-200',
};

const modelStatusLabels: Record<string, string> = {
  draft: '草稿',
  testing: '测试中',
  stable: '稳定版',
  active: '线上使用中',
  archived: '已归档',
};

const approvalStatusLabels: Record<string, string> = {
  none: '无需审批',
  pending: '报告待审批',
  approved: '报告已通过',
  rejected: '报告已驳回',
};

const approvalStatusClass: Record<string, string> = {
  none: 'bg-muted text-muted-foreground',
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-destructive/10 text-destructive',
};

const nodeTypeLabels: Record<string, string> = {
  crop: '作物',
  part: '部位',
  type: '病害/虫害',
  leaf: '具体类别',
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function errText(e: any, fallback: string) {
  if (e instanceof ApiError && e.errors) return Object.values(e.errors).flat().join('；');
  return e?.message || fallback;
}

const PAGE_SIZE = 10;

export default function SystemPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'users';

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">系统管理</h1>
        <p className="text-muted-foreground text-sm mt-1">
          用户权限管理、AI模型管理、病虫害类别体系与系统配置
        </p>
      </div>

      <Tabs defaultValue={initialTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">
            <Users className="h-4 w-4 mr-1.5" />
            用户管理
          </TabsTrigger>
          <TabsTrigger value="models">
            <Settings className="h-4 w-4 mr-1.5" />
            AI模型
          </TabsTrigger>
          <TabsTrigger value="categories">
            <Shield className="h-4 w-4 mr-1.5" />
            分类体系
          </TabsTrigger>
          <TabsTrigger value="settings">
            <FileText className="h-4 w-4 mr-1.5" />
            系统配置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="models">
          <ModelsTab />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── 用户管理 ─────────────────────────────────────────────────

interface UserForm {
  username: string;
  email: string;
  phone: string;
  role: string;
  is_active: boolean;
  password: string;
}

const emptyUserForm: UserForm = {
  username: '',
  email: '',
  phone: '',
  role: 'user',
  is_active: true,
  password: '',
};

function UsersTab() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<UserForm>(emptyUserForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [resetTarget, setResetTarget] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const [deleting, setDeleting] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, pageSize: PAGE_SIZE };
      if (search) params.search = search;
      if (roleFilter !== 'all') params.role = roleFilter;
      const data = await api.users.list(params);
      setUsers(data.list || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      toastError( errText(e, '加载用户失败'));
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyUserForm);
    setFormError('');
    setDialogOpen(true);
  }

  function openEdit(user: any) {
    setEditing(user);
    setForm({
      username: user.username ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      role: user.role ?? 'user',
      is_active: user.is_active ?? true,
      password: '',
    });
    setFormError('');
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.username.trim()) {
      setFormError('请输入用户名');
      return;
    }
    if (!editing && form.password && form.password.length < 6) {
      setFormError('密码长度至少 6 位');
      return;
    }
    setSaving(true);
    setFormError('');
    const payload: Record<string, any> = {
      username: form.username.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      role: form.role,
      is_active: form.is_active,
    };
    if (form.password) payload.password = form.password;
    try {
      if (editing) {
        await api.users.update(editing.id, payload);
        toastSuccess( '用户信息已更新');
      } else {
        await api.users.create(payload);
        toastSuccess( '用户创建成功');
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      setFormError(errText(e, '保存失败'));
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!resetTarget) return;
    if (newPassword.length < 6) {
      toastError( '密码长度至少 6 位');
      return;
    }
    setResetting(true);
    try {
      await api.users.resetPassword(resetTarget.id, newPassword);
      toastSuccess( `已重置「${resetTarget.username}」的密码`);
      setResetTarget(null);
      setNewPassword('');
    } catch (e: any) {
      toastError( errText(e, '重置密码失败'));
    } finally {
      setResetting(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.users.delete(deleting.id);
      toastSuccess( '用户已删除');
      setDeleting(null);
      if (users.length === 1 && page > 1) setPage(page - 1);
      else load();
    } catch (e: any) {
      toastError( errText(e, '删除失败'));
      setDeleting(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索用户名、邮箱、手机号..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="角色" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部角色</SelectItem>
              <SelectItem value="admin">管理员</SelectItem>
              <SelectItem value="staff">农技人员</SelectItem>
              <SelectItem value="user">普通用户</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            新增用户
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>最近登录</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      未找到用户
                    </TableCell>
                  </TableRow>
                )}
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{user.username}</p>
                      <p className="text-xs text-muted-foreground">{user.email || user.phone || '-'}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${roleColors[user.role] || ''}`}>
                        {roleLabels[user.role] || user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(user.last_login)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? 'default' : 'secondary'} className="text-[10px]">
                        {user.is_active ? '活跃' : '停用'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(user)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => { setResetTarget(user); setNewPassword(''); }}
                        >
                          <Key className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleting(user)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 分页 */}
      <SimplePagination total={total} pageSize={PAGE_SIZE} page={page} onPageChange={setPage} />

      {/* 新增/编辑用户 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑用户' : '新增用户'}</DialogTitle>
            <DialogDescription>
              {editing ? '修改账号信息与权限角色' : '创建新的系统用户账号'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {formError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {formError}
              </p>
            )}
            <div className="space-y-2">
              <Label>用户名 *</Label>
              <Input
                placeholder="登录账号"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>邮箱</Label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>手机号</Label>
              <Input
                placeholder="可选"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{editing ? '重置密码（留空则不修改）' : '初始密码（留空默认为 123456）'}</Label>
              <Input
                type="password"
                placeholder="至少 6 位"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>角色</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">管理员</SelectItem>
                    <SelectItem value="staff">农技人员</SelectItem>
                    <SelectItem value="user">普通用户</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>账号状态</Label>
                <div className="flex items-center gap-2 h-9">
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                  />
                  <span className="text-sm text-muted-foreground">
                    {form.is_active ? '启用' : '停用'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? '保存修改' : '确认创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置密码 */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
            <DialogDescription>为「{resetTarget?.username}」设置新密码</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label>新密码</Label>
            <Input
              type="password"
              placeholder="至少 6 位"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)} disabled={resetting}>
              取消
            </Button>
            <Button onClick={handleReset} disabled={resetting}>
              {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认重置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除用户 */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除用户？</AlertDialogTitle>
            <AlertDialogDescription>
              即将删除「{deleting?.username}」，此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── AI 模型管理 ──────────────────────────────────────────────

interface ModelForm {
  name: string;
  version: string;
  input_size: string;
  top1_accuracy: string;
  top5_accuracy: string;
  status: string;
  file_path: string;
  description: string;
}

const emptyModelForm: ModelForm = {
  name: '',
  version: '',
  input_size: '224x224',
  top1_accuracy: '',
  top5_accuracy: '',
  status: 'draft',
  file_path: '',
  description: '',
};

function ModelsTab() {
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<ModelForm>(emptyModelForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [activating, setActivating] = useState<any | null>(null);
  const [rollingBack, setRollingBack] = useState(false);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.models.list({ page, pageSize: PAGE_SIZE });
      setModels(data.list || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      toastError( errText(e, '加载模型失败'));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyModelForm);
    setFormError('');
    setDialogOpen(true);
  }

  function openEdit(m: any) {
    setEditing(m);
    setForm({
      name: m.name ?? '',
      version: m.version ?? '',
      input_size: m.input_size ?? '224x224',
      top1_accuracy: m.top1_accuracy != null ? String(m.top1_accuracy) : '',
      top5_accuracy: m.top5_accuracy != null ? String(m.top5_accuracy) : '',
      status: m.status ?? 'draft',
      file_path: m.file_path ?? '',
      description: m.description ?? '',
    });
    setFormError('');
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return setFormError('请输入模型名称');
    if (!form.version.trim()) return setFormError('请输入版本号');
    setSaving(true);
    setFormError('');
    const payload: Record<string, any> = {
      name: form.name.trim(),
      version: form.version.trim(),
      input_size: form.input_size.trim() || '224x224',
      status: form.status,
      file_path: form.file_path.trim(),
      description: form.description.trim(),
    };
    if (form.top1_accuracy.trim()) payload.top1_accuracy = Number(form.top1_accuracy);
    if (form.top5_accuracy.trim()) payload.top5_accuracy = Number(form.top5_accuracy);
    try {
      if (editing) {
        const m = await api.models.detail(editing.id);
        await api.models.update(editing.id, {
          ...payload,
          file_hash: m.file_hash ?? '',
        });
        toastSuccess( '模型信息已更新');
      } else {
        await api.models.create(payload);
        toastSuccess( '模型注册成功');
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      setFormError(errText(e, '保存失败'));
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate() {
    if (!activating) return;
    const id = activating.id;
    setActivating(null);
    try {
      await api.models.activate(id);
      toastSuccess( '已切换为线上版本');
      load();
    } catch (e: any) {
      toastError( errText(e, '切换失败'));
    }
  }

  async function handleRollback() {
    setRollingBack(true);
    try {
      await api.models.rollback();
      toastSuccess( '已回滚至上一稳定版本');
      load();
    } catch (e: any) {
      toastError( errText(e, '回滚失败'));
    } finally {
      setRollingBack(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.models.delete(deleting.id);
      toastSuccess( '模型版本已删除');
      setDeleting(null);
      if (models.length === 1 && page > 1) setPage(page - 1);
      else load();
    } catch (e: any) {
      toastError( errText(e, '删除失败'));
      setDeleting(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          管理 CNN 分类模型版本，支持版本切换与一键回滚
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRollback} disabled={rollingBack}>
            {rollingBack ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            回滚版本
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            注册新模型
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>模型名称</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead>输入尺寸</TableHead>
                  <TableHead>Top-1</TableHead>
                  <TableHead>推理量</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>报告审批</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      暂无模型版本
                    </TableCell>
                  </TableRow>
                )}
                {models.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{m.name}</p>
                        {m.is_active && (
                          <Badge className="text-[10px] bg-emerald-600">线上</Badge>
                        )}
                      </div>
                      {m.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                          {m.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{m.version}</TableCell>
                    <TableCell className="text-xs">{m.input_size}</TableCell>
                    <TableCell className="text-xs">
                      {m.top1_accuracy != null ? `${Number(m.top1_accuracy).toFixed(2)}%` : '-'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {m.inference_count ?? 0}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.is_active ? 'default' : 'secondary'} className="text-[10px]">
                        {modelStatusLabels[m.status] || m.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {m.training_run ? (
                        <span
                          className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium ${approvalStatusClass[m.approval_status] || approvalStatusClass.none}`}
                          title="训练产生的模型版本需报告审批通过后才能灰度/上线"
                        >
                          {approvalStatusLabels[m.approval_status] || m.approval_status || '无需审批'}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(m.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!m.is_active && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-emerald-600"
                            title="设为线上版本"
                            onClick={() => setActivating(m)}
                          >
                            <Zap className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleting(m)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 分页 */}
      <SimplePagination total={total} pageSize={PAGE_SIZE} page={page} onPageChange={setPage} />

      {/* 新增/编辑模型 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑模型' : '注册新模型'}</DialogTitle>
            <DialogDescription>
              {editing ? '修改模型元数据' : '登记 CNN 模型版本及评估指标'}
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
                <Label>模型名称 *</Label>
                <Input
                  placeholder="如：PestCNN-ResNet50"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>版本号 *</Label>
                <Input
                  placeholder="如：v1.2.0"
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>输入尺寸</Label>
                <Input
                  value={form.input_size}
                  onChange={(e) => setForm({ ...form, input_size: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Top-1 (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  value={form.top1_accuracy}
                  onChange={(e) => setForm({ ...form, top1_accuracy: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Top-5 (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  value={form.top5_accuracy}
                  onChange={(e) => setForm({ ...form, top5_accuracy: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>状态</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(modelStatusLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>模型文件路径</Label>
                <Input
                  placeholder="如：models/pest_v1.2.0.pt"
                  value={form.file_path}
                  onChange={(e) => setForm({ ...form, file_path: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>版本说明</Label>
              <Textarea
                rows={3}
                placeholder="训练数据、改进点、已知问题等"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? '保存修改' : '确认注册'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 切换线上版本确认 */}
      <AlertDialog open={!!activating} onOpenChange={(o) => !o && setActivating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>切换线上模型版本？</AlertDialogTitle>
            <AlertDialogDescription>
              将「{activating?.name} {activating?.version}」设为当前线上推理版本，切换后立即生效。
            </AlertDialogDescription>
            {activating?.training_run && activating?.approval_status !== 'approved' && (
              <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
                该版本由训练任务产生，报告审批尚未通过（{approvalStatusLabels[activating?.approval_status] || '待审批'}），切换将被发布门禁拦截。
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleActivate}>确认切换</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除模型 */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除模型版本？</AlertDialogTitle>
            <AlertDialogDescription>
              即将删除「{deleting?.name} {deleting?.version}」，此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── 分类体系 ─────────────────────────────────────────────────

interface CategoryForm {
  parent: string;
  name: string;
  node_type: string;
  model_index: string;
  description: string;
  sort_order: string;
}

const emptyCategoryForm: CategoryForm = {
  parent: 'none',
  name: '',
  node_type: 'leaf',
  model_index: '',
  description: '',
  sort_order: '0',
};

function CategoriesTab() {
  const [loading, setLoading] = useState(true);
  const [tree, setTree] = useState<any[]>([]);
  const [flat, setFlat] = useState<any[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyCategoryForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [treeData, listData] = await Promise.all([
        api.categories.tree(),
        api.categories.list({ pageSize: 500 }),
      ]);
      setTree(treeData || []);
      setFlat(listData.list || []);
    } catch (e: any) {
      toastError( errText(e, '加载分类失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, []);

  function openCreate(parent?: any) {
    setEditing(null);
    setForm({
      ...emptyCategoryForm,
      parent: parent ? String(parent.id) : 'none',
      node_type: parent
        ? ['crop', 'part', 'type', 'leaf'][
            Math.min(['crop', 'part', 'type', 'leaf'].indexOf(parent.node_type) + 1, 3)
          ]
        : 'crop',
    });
    setFormError('');
    setDialogOpen(true);
  }

  function openEdit(node: any) {
    setEditing(node);
    setForm({
      parent: node.parent ? String(node.parent) : 'none',
      name: node.name ?? '',
      node_type: node.node_type ?? 'leaf',
      model_index: node.model_index != null ? String(node.model_index) : '',
      description: node.description ?? '',
      sort_order: node.sort_order != null ? String(node.sort_order) : '0',
    });
    setFormError('');
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return setFormError('请输入类别名称');
    setSaving(true);
    setFormError('');
    const payload: Record<string, any> = {
      parent: form.parent === 'none' ? null : Number(form.parent),
      name: form.name.trim(),
      node_type: form.node_type,
      description: form.description.trim(),
      sort_order: form.sort_order ? Number(form.sort_order) : 0,
      model_index: form.model_index.trim() ? Number(form.model_index) : null,
    };
    try {
      if (editing) {
        await api.categories.update(editing.id, payload);
        toastSuccess( '类别已更新');
      } else {
        await api.categories.create(payload);
        toastSuccess( '类别已创建');
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      setFormError(errText(e, '保存失败'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.categories.delete(deleting.id);
      toastSuccess( '类别已删除');
      setDeleting(null);
      load();
    } catch (e: any) {
      toastError( errText(e, '删除失败'));
      setDeleting(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  const toggle = (id: number) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  function renderNode(node: any, depth = 0) {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expanded[node.id] ?? depth < 1;
    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/60 group"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <button
            type="button"
            className="h-4 w-4 flex items-center justify-center text-muted-foreground"
            onClick={() => hasChildren && toggle(node.id)}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRightIcon className="h-3.5 w-3.5" />
              )
            ) : (
              <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
            )}
          </button>
          <span className="text-sm">{node.name}</span>
          <Badge variant="secondary" className="text-[10px]">
            {nodeTypeLabels[node.node_type] || node.node_type}
          </Badge>
          {node.model_index != null && (
            <Badge variant="outline" className="text-[10px]">
              索引 {node.model_index}
            </Badge>
          )}
          {hasChildren && (
            <span className="text-[11px] text-muted-foreground">({node.children.length})</span>
          )}
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {node.node_type !== 'leaf' && (
              <Button variant="ghost" size="icon" className="h-6 w-6" title="添加子类别" onClick={() => openCreate(node)}>
                <Plus className="h-3 w-3" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(node)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={() => setDeleting(node)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div>{node.children.map((child: any) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          多级类别体系：作物 → 部位 → 病害/虫害 → 具体类别（共 {flat.length} 个节点）
        </p>
        <Button onClick={() => openCreate()}>
          <Plus className="h-4 w-4 mr-2" />
          新增根类别
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">类别树</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tree.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">暂无分类数据</div>
          ) : (
            <div className="space-y-0.5">{tree.map((node) => renderNode(node))}</div>
          )}
        </CardContent>
      </Card>

      {/* 新增/编辑类别 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑类别' : '新增类别'}</DialogTitle>
            <DialogDescription>
              {editing ? '修改类别信息与模型索引映射' : '在类别树中创建新节点'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {formError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {formError}
              </p>
            )}
            <div className="space-y-2">
              <Label>类别名称 *</Label>
              <Input
                placeholder="如：水稻 / 叶片 / 稻瘟病"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>上级类别</Label>
                <Select value={form.parent} onValueChange={(v) => setForm({ ...form, parent: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">无（根节点）</SelectItem>
                    {flat
                      .filter((c) => !editing || c.id !== editing.id)
                      .map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>节点类型</Label>
                <Select value={form.node_type} onValueChange={(v) => setForm({ ...form, node_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(nodeTypeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>模型输出索引</Label>
                <Input
                  type="number"
                  placeholder="留空表示非模型输出类别"
                  value={form.model_index}
                  onChange={(e) => setForm({ ...form, model_index: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>排序</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? '保存修改' : '确认创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除类别 */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除类别？</AlertDialogTitle>
            <AlertDialogDescription>
              即将删除「{deleting?.name}」及其全部子类别，此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── 系统配置 ─────────────────────────────────────────────────

const CONFIG_GROUPS: {
  title: string;
  icon: typeof Shield;
  items: { key: string; label: string; hint: string; type: 'switch' | 'select' | 'text' | 'password'; options?: { value: string; label: string }[]; placeholder?: string }[];
}[] = [
  {
    title: '安全设置',
    icon: Shield,
    items: [
      {
        key: 'two_factor_auth',
        label: '双因素认证',
        hint: '登录时需要额外验证',
        type: 'switch',
      },
      {
        key: 'data_masking',
        label: '敏感数据脱敏',
        hint: '对非授权用户隐藏精确坐标',
        type: 'switch',
      },
    ],
  },
  {
    title: '数据管理',
    icon: Clock,
    items: [
      { key: 'auto_backup', label: '自动备份', hint: '每日增量备份，每周全量备份', type: 'switch' },
      {
        key: 'raw_retention_months',
        label: '原始文件保留',
        hint: '音视频/图像保留时长',
        type: 'select',
        options: [
          { value: '3', label: '3个月' },
          { value: '6', label: '6个月' },
          { value: '12', label: '12个月' },
        ],
      },
    ],
  },
  {
    title: 'AI识别配置',
    icon: Settings,
    items: [
      {
        key: 'review_threshold',
        label: '人工复核阈值',
        hint: '置信度低于此值标记为待复核',
        type: 'select',
        options: [
          { value: '0.5', label: '0.5' },
          { value: '0.6', label: '0.6' },
          { value: '0.7', label: '0.7' },
          { value: '0.8', label: '0.8' },
        ],
      },
      {
        key: 'review_threshold_protected',
        label: '高风险病虫害复核阈值',
        hint: '高风险/严重等级类别默认阈值',
        type: 'select',
        options: [
          { value: '0.7', label: '0.7' },
          { value: '0.8', label: '0.8' },
          { value: '0.9', label: '0.9' },
        ],
      },
      {
        key: 'review_threshold_common',
        label: '普通类别复核阈值',
        hint: '非高风险类别默认阈值',
        type: 'select',
        options: [
          { value: '0.5', label: '0.5' },
          { value: '0.6', label: '0.6' },
          { value: '0.7', label: '0.7' },
        ],
      },
      {
        key: 'anomaly_threshold',
        label: '数据异常阈值',
        hint: '单设备单日触发次数上限',
        type: 'select',
        options: [
          { value: '200', label: '200次' },
          { value: '500', label: '500次' },
          { value: '1000', label: '1000次' },
        ],
      },
      {
        key: 'protection_alert_days',
        label: '高风险病虫害预警回溯周期',
        hint: '该周期内高风险类别的异常触发预警',
        type: 'select',
        options: [
          { value: '15', label: '15天' },
          { value: '30', label: '30天' },
          { value: '60', label: '60天' },
        ],
      },
    ],
  },
  {
    title: '训练样本配置',
    icon: Database,
    items: [
      {
        key: 'auto_confirm_enabled',
        label: '高置信度自动确认',
        hint: '达到阈值且无质量异常的记录自动确认，免人工复核',
        type: 'switch',
      },
      {
        key: 'auto_confirm_threshold',
        label: '自动确认阈值',
        hint: '置信度达到该值才允许自动确认',
        type: 'select',
        options: [
          { value: '0.85', label: '0.85' },
          { value: '0.9', label: '0.9' },
          { value: '0.95', label: '0.95' },
          { value: '0.98', label: '0.98' },
        ],
      },
      {
        key: 'auto_confirm_skip_protected',
        label: '高风险病虫害跳过自动确认',
        hint: '高风险类别仍走人工复核，避免误判风险',
        type: 'switch',
      },
      {
        key: 'training_sample_enabled',
        label: '自动登记训练样本',
        hint: '确认后的记录自动进入训练样本池',
        type: 'switch',
      },
      {
        key: 'training_audio_enabled',
        label: '纳入音频样本',
        hint: '音频样本进入训练池与训练包',
        type: 'switch',
      },
      {
        key: 'training_video_enabled',
        label: '纳入视频样本',
        hint: '视频按帧率抽帧后进入训练包',
        type: 'switch',
      },
      {
        key: 'video_frame_fps',
        label: '视频抽帧帧率',
        hint: '导出训练包时每秒抽取的帧数',
        type: 'select',
        options: [
          { value: '0.5', label: '0.5 fps' },
          { value: '1', label: '1 fps' },
          { value: '2', label: '2 fps' },
          { value: '5', label: '5 fps' },
        ],
      },
    ],
  },
  {
    title: '模型训练与审批配置',
    icon: FlaskConical,
    items: [
      {
        key: 'training_enabled',
        label: '启用模型训练任务',
        hint: '关闭后无法发起新的训练任务，已有任务不受影响',
        type: 'switch',
      },
      {
        key: 'training_provider_type',
        label: '训练后端',
        hint: 'mock 为本地模拟训练，http 为远程训练服务',
        type: 'select',
        options: [
          { value: 'mock', label: 'mock(本地模拟)' },
          { value: 'http', label: 'http(远程服务)' },
        ],
      },
      {
        key: 'training_min_samples',
        label: '最少样本数',
        hint: '样本数量低于该值时禁止发起训练',
        type: 'text',
        placeholder: '20',
      },
      {
        key: 'training_split_train',
        label: '训练集比例',
        hint: '与验证集、测试集比例之和应为 1',
        type: 'text',
        placeholder: '0.7',
      },
      {
        key: 'training_split_val',
        label: '验证集比例',
        hint: '用于训练过程中的调参验证',
        type: 'text',
        placeholder: '0.15',
      },
      {
        key: 'training_split_test',
        label: '测试集比例',
        hint: '用于生成报告中的最终评估指标',
        type: 'text',
        placeholder: '0.15',
      },
      {
        key: 'training_report_required',
        label: '报告强制生成与门禁',
        hint: '训练结果报告审批通过后，模型版本才允许灰度/上线',
        type: 'switch',
      },
      {
        key: 'training_approval_level',
        label: '审批层级',
        hint: 'single 为单级审核，dual 为初审 + 终审两级',
        type: 'select',
        options: [
          { value: 'single', label: '单级审批' },
          { value: 'dual', label: '两级审批' },
        ],
      },
      {
        key: 'training_reviewer_ids',
        label: '指定审批人ID',
        hint: '逗号分隔的用户ID，留空表示管理员/农技人员均可审批',
        type: 'text',
        placeholder: '如：3,5',
      },
      {
        key: 'training_force_manual_for_protected',
        label: '高风险病虫害强制人工审批',
        hint: '训练样本含高风险/虫害类别时，不允许自动通过',
        type: 'switch',
      },
      {
        key: 'training_retry_max',
        label: '失败重试上限',
        hint: '训练任务失败自动指数退避重试的次数',
        type: 'text',
        placeholder: '3',
      },
      {
        key: 'training_quality_gate_enabled',
        label: '启用报告质量门禁',
        hint: '报告生成时校验关键指标是否达标并标注结果',
        type: 'switch',
      },
      {
        key: 'training_gate_protected_recall',
        label: '高风险病虫害召回率下限',
        hint: '低于该值时质量门禁标记为未通过',
        type: 'select',
        options: [
          { value: '0.8', label: '0.80' },
          { value: '0.9', label: '0.90' },
          { value: '0.95', label: '0.95' },
        ],
      },
      {
        key: 'training_gate_min_map',
        label: 'mAP/准确率下限',
        hint: '低于该值时质量门禁标记为未通过',
        type: 'select',
        options: [
          { value: '0.4', label: '0.40' },
          { value: '0.5', label: '0.50' },
          { value: '0.6', label: '0.60' },
        ],
      },
      {
        key: 'training_pdf_enabled',
        label: '生成PDF报告',
        hint: '关闭后仅提供HTML在线查看与下载',
        type: 'switch',
      },
      {
        key: 'training_compare_baseline',
        label: '与线上版本对比',
        hint: '报告中展示与当前线上模型版本的指标差异',
        type: 'switch',
      },
      {
        key: 'training_auto_register_model',
        label: '训练完成后自动登记模型',
        hint: '生成草稿模型版本，审批通过后才可发布',
        type: 'switch',
      },
    ],
  },
  {
    title: '声学质量配置',
    icon: Zap,
    items: [
      {
        key: 'audio_vad_backend',
        label: 'VAD 后端',
        hint: 'energy 为能量检测，silero 为神经网络检测',
        type: 'select',
        options: [
          { value: 'energy', label: 'energy' },
          { value: 'silero', label: 'silero' },
        ],
      },
      {
        key: 'audio_vad_saturation_ratio',
        label: 'VAD 占比饱和阈值',
        hint: '有效声段占比达到此值即得满分',
        type: 'select',
        options: [
          { value: '0.2', label: '0.2' },
          { value: '0.3', label: '0.3' },
          { value: '0.4', label: '0.4' },
          { value: '0.5', label: '0.5' },
        ],
      },
      {
        key: 'audio_min_snr_db',
        label: '最低信噪比',
        hint: '低于此值标记为高噪声',
        type: 'select',
        options: [
          { value: '3', label: '3 dB' },
          { value: '5', label: '5 dB' },
          { value: '8', label: '8 dB' },
          { value: '10', label: '10 dB' },
        ],
      },
      {
        key: 'audio_min_vad_ratio',
        label: '最低有效声段占比',
        hint: '低于此值标记为有效声段不足',
        type: 'select',
        options: [
          { value: '0.03', label: '3%' },
          { value: '0.05', label: '5%' },
          { value: '0.1', label: '10%' },
          { value: '0.2', label: '20%' },
        ],
      },
      {
        key: 'audio_min_separation',
        label: '最低声源分离质量',
        hint: '低于此值标记为分离不可靠',
        type: 'select',
        options: [
          { value: '0.3', label: '0.3' },
          { value: '0.4', label: '0.4' },
          { value: '0.5', label: '0.5' },
          { value: '0.6', label: '0.6' },
        ],
      },
      {
        key: 'audio_max_overlap',
        label: '最大声源重叠占比',
        hint: '高于此值标记为重叠严重',
        type: 'select',
        options: [
          { value: '0.4', label: '0.4' },
          { value: '0.5', label: '0.5' },
          { value: '0.6', label: '0.6' },
          { value: '0.8', label: '0.8' },
        ],
      },
      {
        key: 'audio_reliability_threshold',
        label: '可靠度分级下限',
        hint: '综合得分低于此值判为不可靠',
        type: 'select',
        options: [
          { value: '0.4', label: '0.4' },
          { value: '0.5', label: '0.5' },
          { value: '0.6', label: '0.6' },
        ],
      },
      {
        key: 'audio_degraded_threshold',
        label: '可靠等级分界',
        hint: '介于下限与此值之间判为降级',
        type: 'select',
        options: [
          { value: '0.65', label: '0.65' },
          { value: '0.75', label: '0.75' },
          { value: '0.85', label: '0.85' },
        ],
      },
      {
        key: 'audio_separation_mode',
        label: '声源分离来源',
        hint: 'provider 沿用推理服务返回值，http/local 走独立分离模型',
        type: 'select',
        options: [
          { value: 'provider', label: 'provider' },
          { value: 'http', label: 'http' },
          { value: 'local', label: 'local' },
        ],
      },
    ],
  },
  {
    title: '证据融合配置',
    icon: GitMerge,
    items: [
      {
        key: 'fusion_enabled',
        label: '启用证据融合',
        hint: '关闭后周期任务停止重建证据簇',
        type: 'select',
        options: [
          { value: 'true', label: '启用' },
          { value: 'false', label: '停用' },
        ],
      },
      {
        key: 'fusion_review_integration_enabled',
        label: '复核结果接入融合',
        hint: '已驳回记录剔除，已纠正记录按修正类别分组，已确认/纠正记录提升可靠性',
        type: 'select',
        options: [
          { value: 'true', label: '启用' },
          { value: 'false', label: '停用' },
        ],
      },
      {
        key: 'fusion_reviewed_boost',
        label: '已复核记录提权系数',
        hint: '已确认/已纠正记录的可靠性乘以此系数，上限 1.0',
        type: 'select',
        options: [
          { value: '1.0', label: '1.0' },
          { value: '1.1', label: '1.1' },
          { value: '1.2', label: '1.2' },
          { value: '1.5', label: '1.5' },
        ],
      },
      {
        key: 'fusion_weight_video',
        label: '视频证据权重',
        hint: '视频单独计算，图像权重另行配置',
        type: 'select',
        options: [
          { value: '0.5', label: '0.5' },
          { value: '0.8', label: '0.8' },
          { value: '1.0', label: '1.0' },
          { value: '1.2', label: '1.2' },
        ],
      },
      {
        key: 'fusion_rebuild_interval_minutes',
        label: '周期重建间隔',
        hint: '周期任务按此间隔执行，最小 1 分钟',
        type: 'select',
        options: [
          { value: '1', label: '1分钟' },
          { value: '5', label: '5分钟' },
          { value: '10', label: '10分钟' },
          { value: '15', label: '15分钟' },
          { value: '30', label: '30分钟' },
          { value: '60', label: '60分钟' },
        ],
      },
      {
        key: 'fusion_auto_alert_enabled',
        label: '强证据自动预警',
        hint: '高风险/虫害类别的强证据自动生成预警',
        type: 'select',
        options: [
          { value: 'true', label: '启用' },
          { value: 'false', label: '停用' },
        ],
      },
      {
        key: 'fusion_window_hours',
        label: '融合时间窗',
        hint: '同一类别在该窗口内聚合证据',
        type: 'select',
        options: [
          { value: '6', label: '6小时' },
          { value: '12', label: '12小时' },
          { value: '24', label: '24小时' },
          { value: '48', label: '48小时' },
        ],
      },
      {
        key: 'fusion_min_modalities',
        label: '最少模态数',
        hint: '低于此值判为模态不足',
        type: 'select',
        options: [
          { value: '1', label: '1' },
          { value: '2', label: '2' },
          { value: '3', label: '3' },
        ],
      },
      {
        key: 'fusion_confidence_threshold',
        label: '强证据阈值',
        hint: '融合置信度达到此值判为强证据',
        type: 'select',
        options: [
          { value: '0.7', label: '0.7' },
          { value: '0.8', label: '0.8' },
          { value: '0.9', label: '0.9' },
        ],
      },
      {
        key: 'fusion_review_threshold',
        label: '中等证据阈值',
        hint: '低于强证据阈值且达到此值判为中等',
        type: 'select',
        options: [
          { value: '0.5', label: '0.5' },
          { value: '0.6', label: '0.6' },
          { value: '0.7', label: '0.7' },
        ],
      },
      {
        key: 'fusion_time_decay_enabled',
        label: '时间衰减',
        hint: '距时间窗中心越远权重越低',
        type: 'select',
        options: [
          { value: 'true', label: '启用' },
          { value: 'false', label: '停用' },
        ],
      },
      {
        key: 'fusion_time_decay_half_life_hours',
        label: '衰减半衰期',
        hint: '权重衰减至一半所需小时数',
        type: 'select',
        options: [
          { value: '12', label: '12小时' },
          { value: '24', label: '24小时' },
          { value: '48', label: '48小时' },
          { value: '72', label: '72小时' },
        ],
      },
      {
        key: 'fusion_spatial_enabled',
        label: '空间核降权',
        hint: '证据坐标偏离样区中心越远权重越低',
        type: 'select',
        options: [
          { value: 'true', label: '启用' },
          { value: 'false', label: '停用' },
        ],
      },
      {
        key: 'fusion_spatial_radius_km',
        label: '空间核半径',
        hint: '高斯核标准差，单位公里',
        type: 'select',
        options: [
          { value: '1', label: '1km' },
          { value: '3', label: '3km' },
          { value: '5', label: '5km' },
          { value: '10', label: '10km' },
        ],
      },
      {
        key: 'fusion_edna_negative_enabled',
        label: 'eDNA阴性反向证据',
        hint: '阴性结果参与融合并降低存在概率',
        type: 'select',
        options: [
          { value: 'true', label: '启用' },
          { value: 'false', label: '停用' },
        ],
      },
      {
        key: 'fusion_negative_penalty',
        label: '阴性证据权重惩罚',
        hint: '阴性证据基础权重折扣系数',
        type: 'select',
        options: [
          { value: '0.3', label: '0.3' },
          { value: '0.5', label: '0.5' },
          { value: '0.8', label: '0.8' },
        ],
      },
      {
        key: 'fusion_conflict_margin',
        label: '冲突判定置信度差',
        hint: '同区域同时段高置信类别差值达到此值提示冲突',
        type: 'select',
        options: [
          { value: '0.1', label: '0.1' },
          { value: '0.2', label: '0.2' },
          { value: '0.3', label: '0.3' },
        ],
      },
    ],
  },
  {
    title: '两级调度配置',
    icon: Cpu,
    items: [
      {
        key: 'edge_enabled',
        label: '启用边缘先行',
        hint: '关闭后全部数据直接送云端大模型',
        type: 'select',
        options: [
          { value: 'true', label: '启用' },
          { value: 'false', label: '停用' },
        ],
      },
      {
        key: 'edge_scope',
        label: '调度范围',
        hint: '仅边缘设备：设备档案需开启边缘推理能力',
        type: 'select',
        options: [
          { value: 'device', label: '仅边缘设备' },
          { value: 'all', label: '全部数据' },
        ],
      },
      {
        key: 'edge_accept_threshold',
        label: '边缘直判阈值',
        hint: '边缘置信度达到此值且无其它风险项时直判',
        type: 'select',
        options: [
          { value: '0.75', label: '0.75' },
          { value: '0.8', label: '0.8' },
          { value: '0.85', label: '0.85' },
          { value: '0.9', label: '0.9' },
        ],
      },
      {
        key: 'edge_ambiguous_margin',
        label: '候选歧义阈值',
        hint: 'Top1 与 Top2 置信度差小于此值时上云',
        type: 'select',
        options: [
          { value: '0.05', label: '0.05' },
          { value: '0.1', label: '0.1' },
          { value: '0.15', label: '0.15' },
          { value: '0.2', label: '0.2' },
        ],
      },
      {
        key: 'edge_protected_escalate',
        label: '高风险病虫害强制上云',
        hint: '高风险类别即便边缘高置信也交由云端复核',
        type: 'select',
        options: [
          { value: 'true', label: '启用' },
          { value: 'false', label: '停用' },
        ],
      },
      {
        key: 'edge_quality_escalate',
        label: '质量异常强制上云',
        hint: '噪声/分离质量异常时上云复核',
        type: 'select',
        options: [
          { value: 'true', label: '启用' },
          { value: 'false', label: '停用' },
        ],
      },
      {
        key: 'edge_fallback_to_cloud',
        label: '边缘异常降级云端',
        hint: '边缘推理超时或异常时自动切换到云端',
        type: 'select',
        options: [
          { value: 'true', label: '启用' },
          { value: 'false', label: '停用' },
        ],
      },
      {
        key: 'edge_cloud_daily_budget',
        label: '云端每日调用上限',
        hint: '0 表示不限；超出后高置信边缘结果降级直判',
        type: 'select',
        options: [
          { value: '0', label: '不限' },
          { value: '100', label: '100次' },
          { value: '300', label: '300次' },
          { value: '500', label: '500次' },
        ],
      },
      {
        key: 'edge_budget_accept_floor',
        label: '预算耗尽降级阈值',
        hint: '预算用尽时，边缘置信度达到此值才允许降级直判',
        type: 'select',
        options: [
          { value: '0.5', label: '0.5' },
          { value: '0.6', label: '0.6' },
          { value: '0.7', label: '0.7' },
        ],
      },
      {
        key: 'edge_protected_exceptions',
        label: '高风险强制上云例外(类别ID)',
        hint: '逗号分隔的类别ID，这些类别不强制上云，按普通阈值判定',
        type: 'text',
        placeholder: '如: 12,45,78',
      },
    ],
  },
  {
    title: '边缘推理服务配置',
    icon: Cpu,
    items: [
      {
        key: 'edge_provider_type',
        label: '边缘推理后端',
        hint: '平台调用边缘推理服务的方式',
        type: 'select',
        options: [
          { value: 'mock', label: '本地模拟(Mock)' },
          { value: 'http', label: '远程HTTP服务' },
        ],
      },
      {
        key: 'edge_http_url',
        label: '边缘服务地址',
        hint: '远程边缘推理服务HTTP地址，如 http://edge-gw:8080',
        type: 'text',
        placeholder: 'http://edge-gw:8080',
      },
      {
        key: 'edge_http_token',
        label: '边缘服务鉴权Token',
        hint: '边缘推理服务的Bearer Token(可选)',
        type: 'password',
        placeholder: '留空表示无需鉴权',
      },
      {
        key: 'edge_input_mode',
        label: '文件传递方式',
        hint: 'file=直传文件 / url=传媒体URL / path=传本地路径(共享存储)',
        type: 'select',
        options: [
          { value: 'file', label: 'file 直传' },
          { value: 'url', label: 'url 媒体URL' },
          { value: 'path', label: 'path 本地路径' },
        ],
      },
      {
        key: 'edge_model_version',
        label: '边缘模型版本号',
        hint: '部署在边缘侧的轻量模型版本，与云端病虫害类别集一致',
        type: 'text',
        placeholder: '如 edge-yolov8n-v1.2',
      },
    ],
  },
];

function SettingsTab() {
  const searchParams = useSearchParams();
  const targetGroup = searchParams.get('group');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.systemConfig.get();
      setConfig(data.config || {});
    } catch (e: any) {
      toastError( errText(e, '加载配置失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, []);

  // 从其他页面跳转过来时，自动滚动到目标配置分组
  useEffect(() => {
    if (!targetGroup || loading) return;
    const id = targetGroup.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-');
    // 映射：URL 参数 → CONFIG_GROUPS title 关键字
    const titleMap: Record<string, string> = {
      scheduling: '两级调度配置',
      dispatch: '两级调度配置',
      edge: '边缘推理服务配置',
      fusion: '证据融合配置',
      audio: '声学质量配置',
      ai: 'AI识别配置',
      training: '模型训练与审批配置',
      approval: '模型训练与审批配置',
      security: '安全设置',
      data: '数据管理',
    };
    const groupTitle = titleMap[id] || titleMap[targetGroup] || targetGroup;
    // 等待 DOM 渲染完成
    const t = setTimeout(() => {
      const el = document.getElementById(`cfg-group-${encodeURIComponent(groupTitle)}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // 短暂高亮提示
        el.classList.add('ring-2', 'ring-ring');
        setTimeout(() => el.classList.remove('ring-2', 'ring-ring'), 2000);
      }
    }, 100);
    return () => clearTimeout(t);
  }, [targetGroup, loading]);

  async function handleSave() {
    setSaving(true);
    try {
      const data = await api.systemConfig.update(config);
      setConfig(data.config || config);
      toastSuccess( '系统配置已保存');
    } catch (e: any) {
      toastError( errText(e, '保存配置失败'));
    } finally {
      setSaving(false);
    }
  }

  function set(key: string, value: string) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {CONFIG_GROUPS.filter((g) => g.title !== 'AI识别配置' && g.title !== '声学质量配置' && g.title !== '证据融合配置' && g.title !== '两级调度配置' && g.title !== '边缘推理服务配置' && g.title !== '模型训练与审批配置').map((group) => {
          const GroupIcon = group.icon;
          return (
            <Card key={group.title} id={`cfg-group-${encodeURIComponent(group.title)}`}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <GroupIcon className="h-4 w-4" />
                  {group.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {group.items.map((item, idx) => (
                  <div key={item.key}>
                    {idx > 0 && <Separator className="mb-4" />}
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>{item.label}</Label>
                        <p className="text-xs text-muted-foreground">{item.hint}</p>
                      </div>
                      {item.type === 'switch' ? (
                        <Switch
                          checked={config[item.key] === 'true'}
                          onCheckedChange={(v) => set(item.key, v ? 'true' : 'false')}
                        />
                      ) : item.type === 'select' ? (
                        <Select value={config[item.key]} onValueChange={(v) => set(item.key, v)}>
                          <SelectTrigger className="w-[110px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {item.options?.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={item.type === 'password' ? 'password' : 'text'}
                          value={config[item.key] || ''}
                          placeholder={item.placeholder}
                          onChange={(e) => set(item.key, e.target.value)}
                          className="w-[160px]"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {CONFIG_GROUPS.filter((g) => g.title === 'AI识别配置' || g.title === '声学质量配置' || g.title === '证据融合配置' || g.title === '两级调度配置' || g.title === '边缘推理服务配置' || g.title === '模型训练与审批配置').map((group) => {
        const GroupIcon = group.icon;
        return (
          <Card key={group.title}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <GroupIcon className="h-4 w-4" />
                {group.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                {group.items.map((item) => (
                  <div key={item.key} className="space-y-2">
                    <Label>{item.label}</Label>
                    <p className="text-xs text-muted-foreground">{item.hint}</p>
                    {item.type === 'select' ? (
                      <Select value={config[item.key]} onValueChange={(v) => set(item.key, v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {item.options?.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={item.type === 'password' ? 'password' : 'text'}
                        value={config[item.key] || ''}
                        placeholder={item.placeholder}
                        onChange={(e) => set(item.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={load} disabled={saving}>
          重新加载
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          保存配置
        </Button>
      </div>
    </div>
  );
}
