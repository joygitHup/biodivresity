'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SimplePaginationProps {
  /** 总记录数 */
  total: number;
  /** 每页条数 */
  pageSize: number;
  /** 当前页（1-based） */
  page: number;
  /** 页码变更回调 */
  onPageChange: (page: number) => void;
  /** 是否显示（数据为空时隐藏） */
  hideOnEmpty?: boolean;
  className?: string;
}

/**
 * 全系统统一的分页组件。
 * 风格：简洁的「上一页 / 下一页」 + 「共 X 条，第 Y / Z 页」
 */
export function SimplePagination({
  total,
  pageSize,
  page,
  onPageChange,
  hideOnEmpty = true,
  className = '',
}: SimplePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // 仅在完全无数据时隐藏；即使只有 1 页也显示（让用户感知总数和当前位置）
  if (hideOnEmpty && total === 0) return null;

  return (
    <div
      className={`flex items-center justify-between border-t pt-4 ${className}`}
    >
      <p className="text-sm text-muted-foreground">
        共 <span className="font-medium text-foreground">{total}</span> 条，第{' '}
        <span className="font-medium text-foreground">{page}</span> /{' '}
        <span className="font-medium text-foreground">{totalPages}</span> 页
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon className="h-4 w-4 mr-1" />
          上一页
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          下一页
          <ChevronRightIcon className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
