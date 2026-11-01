# AGENTS.md - 生物多样性智慧监测平台

## 项目概览

天空地一体化生物多样性智慧监测平台前端，实现监测数据展示、AI识别复核、统计分析、预警通知等功能。后端使用 mock 数据。

## 技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI**: shadcn/ui (Radix UI)
- **Styling**: Tailwind CSS 4
- **Charts**: Recharts 2.15
- **Icons**: Lucide React

## 目录结构

```
src/
├── app/
│   ├── layout.tsx          # 全局布局 (SidebarProvider + Header)
│   ├── page.tsx            # Dashboard 监测看板
│   ├── globals.css         # 全局样式与设计变量
│   ├── survey-areas/       # 样区管理
│   ├── devices/            # 设备管理
│   ├── species/            # 物种档案
│   ├── records/            # 监测记录
│   ├── review/             # AI识别复核
│   ├── analytics/          # 统计分析
│   ├── alerts/             # 预警通知
│   └── system/             # 系统管理
├── components/
│   ├── app-sidebar.tsx     # 侧边栏导航
│   ├── header.tsx          # 顶栏 (搜索+通知+用户)
│   └── ui/                 # shadcn/ui 组件
├── lib/
│   ├── api.ts              # 后端 API 封装
│   └── utils.ts            # 工具函数
└── hooks/
    └── use-mobile.ts       # 移动端检测
```

## 开发命令

- `pnpm run dev` - 启动开发服务
- `pnpm run build` - 构建生产版本
- `pnpm run start` - 启动生产服务
- `pnpm ts-check` - TypeScript 类型检查
- `pnpm lint` - ESLint 检查

## 设计规范

- 主色: 深橄榄绿 oklch(0.38 0.08 130)
- 强调色: 麦穗琥珀 oklch(0.72 0.14 75)
- 侧边栏: 深橄榄黑 oklch(0.21 0.03 130)
- 详见 DESIGN.md

## 数据来源

所有数据均来自 Django 后端 API（`src/lib/api.ts` 统一封装），类别体系为作物-病虫害（PlantVillage 38 类），后端 seed 命令负责初始化演示数据。
