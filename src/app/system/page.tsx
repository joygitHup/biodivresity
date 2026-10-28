'use client';

import { useState } from 'react';
import {
  Users,
  Shield,
  FileText,
  Settings,
  Plus,
  Search,
  Edit,
  Trash2,
  Clock,
  Key,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';

const mockUsers = [
  { id: 'u-001', name: '张明', email: 'zhangming@bio-monitor.cn', role: '系统管理员', lastLogin: '2026-10-28 09:15', status: 'active' },
  { id: 'u-002', name: '李华', email: 'lihua@bio-monitor.cn', role: '监测管理员', lastLogin: '2026-10-28 08:30', status: 'active' },
  { id: 'u-003', name: '王芳', email: 'wangfang@bio-monitor.cn', role: '科研人员', lastLogin: '2026-10-27 16:45', status: 'active' },
  { id: 'u-004', name: '赵强', email: 'zhaoqiang@bio-monitor.cn', role: '巡护/复核人员', lastLogin: '2026-10-28 07:00', status: 'active' },
  { id: 'u-005', name: '陈伟', email: 'chenwei@bio-monitor.cn', role: '科研人员', lastLogin: '2026-10-25 14:20', status: 'inactive' },
];

const mockLogs = [
  { id: 'l-001', user: '张明', action: '登录系统', detail: 'IP: 192.168.1.100', time: '2026-10-28 09:15:23' },
  { id: 'l-002', user: '李华', action: '审核监测记录', detail: '确认记录 rec-001 物种为黑麂', time: '2026-10-28 09:10:45' },
  { id: 'l-003', user: '王芳', action: '导出数据', detail: '导出凤阳山北麓样区监测数据 CSV', time: '2026-10-28 08:55:12' },
  { id: 'l-004', user: '张明', action: '修改设备配置', detail: '更新红外相机-A01采集频率为30分钟', time: '2026-10-28 08:30:00' },
  { id: 'l-005', user: '赵强', action: '复核AI识别', detail: '确认记录 rec-004 物种为黄腹角雉', time: '2026-10-28 08:15:30' },
  { id: 'l-006', user: '李华', action: '生成报表', detail: '生成2026年9月月报', time: '2026-10-28 08:00:00' },
  { id: 'l-007', user: '张明', action: '新增用户', detail: '创建用户 陈伟(chenwei@bio-monitor.cn)', time: '2026-10-27 17:30:00' },
  { id: 'l-008', user: '王芳', action: '修改物种档案', detail: '更新物种 sp-002 黑麂描述信息', time: '2026-10-27 16:45:00' },
];

const roleColors: Record<string, string> = {
  '系统管理员': 'bg-red-50 text-red-700 border-red-200',
  '监测管理员': 'bg-amber-50 text-amber-700 border-amber-200',
  '科研人员': 'bg-sky-50 text-sky-700 border-sky-200',
  '巡护/复核人员': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '公众/访客': 'bg-gray-50 text-gray-600 border-gray-200',
};

export default function SystemPage() {
  const [userSearch, setUserSearch] = useState('');

  const filteredUsers = mockUsers.filter(
    (u) => u.name.includes(userSearch) || u.email.includes(userSearch)
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">系统管理</h1>
        <p className="text-muted-foreground text-sm mt-1">
          用户权限管理、操作日志与系统配置
        </p>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">
            <Users className="h-4 w-4 mr-1.5" />
            用户管理
          </TabsTrigger>
          <TabsTrigger value="logs">
            <FileText className="h-4 w-4 mr-1.5" />
            操作日志
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-1.5" />
            系统配置
          </TabsTrigger>
        </TabsList>

        {/* User Management */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索用户..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  新增用户
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>新增用户</DialogTitle>
                  <DialogDescription>创建新的系统用户账号</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>姓名</Label>
                    <Input placeholder="用户姓名" />
                  </div>
                  <div className="space-y-2">
                    <Label>邮箱</Label>
                    <Input type="email" placeholder="user@bio-monitor.cn" />
                  </div>
                  <div className="space-y-2">
                    <Label>角色</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="选择角色" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">系统管理员</SelectItem>
                        <SelectItem value="manager">监测管理员</SelectItem>
                        <SelectItem value="researcher">科研人员</SelectItem>
                        <SelectItem value="reviewer">巡护/复核人员</SelectItem>
                        <SelectItem value="visitor">公众/访客</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full">确认创建</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
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
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${roleColors[user.role] || ''}`}
                        >
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {user.lastLogin}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.status === 'active' ? 'default' : 'secondary'}
                          className="text-[10px]"
                        >
                          {user.status === 'active' ? '活跃' : '停用'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Key className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Operation Logs */}
        <TabsContent value="logs" className="space-y-4">
          <div className="flex items-center gap-3">
            <Input placeholder="搜索日志..." className="max-w-sm" />
            <Select defaultValue="all">
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="操作类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部操作</SelectItem>
                <SelectItem value="login">登录</SelectItem>
                <SelectItem value="data">数据操作</SelectItem>
                <SelectItem value="config">配置变更</SelectItem>
                <SelectItem value="export">导出</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>操作</TableHead>
                    <TableHead>详情</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs font-mono">{log.time}</TableCell>
                      <TableCell className="text-sm">{log.user}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.detail}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Settings */}
        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  安全设置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>双因素认证</Label>
                    <p className="text-xs text-muted-foreground">
                      登录时需要额外验证
                    </p>
                  </div>
                  <Switch />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>敏感数据脱敏</Label>
                    <p className="text-xs text-muted-foreground">
                      对非授权用户隐藏精确坐标
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>操作日志保留</Label>
                    <p className="text-xs text-muted-foreground">
                      日志保留时长
                    </p>
                  </div>
                  <Select defaultValue="6">
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3个月</SelectItem>
                      <SelectItem value="6">6个月</SelectItem>
                      <SelectItem value="12">12个月</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  数据管理
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>自动备份</Label>
                    <p className="text-xs text-muted-foreground">
                      每日增量备份，每周全量备份
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>原始文件保留</Label>
                    <p className="text-xs text-muted-foreground">
                      音视频/图像至少保存3个月
                    </p>
                  </div>
                  <Select defaultValue="3">
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3个月</SelectItem>
                      <SelectItem value="6">6个月</SelectItem>
                      <SelectItem value="12">12个月</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>统计报告保留</Label>
                    <p className="text-xs text-muted-foreground">
                      识别结果与统计报告至少保存5年
                    </p>
                  </div>
                  <Select defaultValue="5">
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5年</SelectItem>
                      <SelectItem value="10">10年</SelectItem>
                      <SelectItem value="99">永久</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                AI识别配置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>人工复核阈值</Label>
                  <p className="text-xs text-muted-foreground">
                    置信度低于此值标记为待复核
                  </p>
                  <Select defaultValue="0.6">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.5">0.5</SelectItem>
                      <SelectItem value="0.6">0.6</SelectItem>
                      <SelectItem value="0.7">0.7</SelectItem>
                      <SelectItem value="0.8">0.8</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>数据异常阈值</Label>
                  <p className="text-xs text-muted-foreground">
                    单设备单日触发次数上限
                  </p>
                  <Select defaultValue="500">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="200">200次</SelectItem>
                      <SelectItem value="500">500次</SelectItem>
                      <SelectItem value="1000">1000次</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>保护物种异常周期</Label>
                  <p className="text-xs text-muted-foreground">
                    连续多少天未监测到触发预警
                  </p>
                  <Select defaultValue="30">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15天</SelectItem>
                      <SelectItem value="30">30天</SelectItem>
                      <SelectItem value="60">60天</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="w-full md:w-auto">保存配置</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
