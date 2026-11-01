import { toast } from 'sonner';

export { toast };

/** 统一的成功提示 */
export function toastSuccess(message: string, description?: string) {
  toast.success(message, { description });
}

/** 统一的错误提示 */
export function toastError(message: string, description?: string) {
  toast.error(message, { description });
}

/** 统一的加载提示 —— 返回 dismiss 函数用于完成时关闭 */
export function toastLoading(message: string) {
  const id = toast.loading(message);
  return {
    dismiss: () => toast.dismiss(id),
    success: (msg: string, desc?: string) => toast.success(msg, { id, description: desc }),
    error: (msg: string, desc?: string) => toast.error(msg, { id, description: desc }),
  };
}
