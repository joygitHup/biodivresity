/** Next.js API client — wraps fetch with JWT auth, unified response handling. */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

interface PageData<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export class ApiError extends Error {
  code: number;
  errors?: Record<string, string[]>;

  constructor(message: string, code: number, errors?: Record<string, string[]>) {
    super(message);
    this.code = code;
    this.errors = errors;
  }
}

// middleware 通过 cookie 判断登录态，写 localStorage 时同步一份到 cookie
const TOKEN_COOKIE = "token";
const TOKEN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 天，与 refresh token 生命周期对齐

function syncTokenCookie(token: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; SameSite=Lax; max-age=${TOKEN_COOKIE_MAX_AGE}`;
}

function clearTokenCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${TOKEN_COOKIE}=; path=/; SameSite=Lax; max-age=0`;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function setToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("token", token);
  syncTokenCookie(token);
}

/** 老会话迁移：localStorage 有 token 但 cookie 缺失时补写，避免 middleware 误判未登录 */
export function ensureTokenCookie() {
  const t = getToken();
  if (t) syncTokenCookie(t);
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("refresh_token");
}

function setRefreshToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("refresh_token", token);
}

function removeToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("refresh_token");
  clearTokenCookie();
}

/** 正在进行中的 refresh 请求 — 避免并发刷新风暴 */
let refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  const rt = getRefreshToken();
  if (!rt) return null;

  // 多个并发请求碰到 401 时，复用同一个 refresh 请求
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: rt }),
      });
      if (!res.ok) {
        removeToken();
        return null;
      }
      const json = await res.json();
      if (json.code !== 0 || !json.data?.access) {
        removeToken();
        return null;
      }
      setToken(json.data.access);
      if (json.data.refresh) setRefreshToken(json.data.refresh); // ROTATE_REFRESH_TOKENS=True
      return json.data.access;
    } catch {
      removeToken();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = true
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: Record<string, string> = {
    // FormData 由浏览器自动带 multipart boundary，不能手动指定 Content-Type
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string> | undefined),
  };

  if (auth) {
    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const res = await fetch(url, { ...options, headers });

  // 仅对带鉴权的请求把 401 视为 token 过期 → 尝试静默 refresh → 失败再登出
  if (!res.ok && res.status === 401 && auth) {
    const newAccess = await tryRefresh();
    if (newAccess) {
      // 用新 access token 重试原请求（仅 retry 一次）
      headers["Authorization"] = `Bearer ${newAccess}`;
      const retry = await fetch(url, { ...options, headers });
      if (retry.ok) {
        return parseOk<T>(retry, path);
      }
      // retry 也 401 → 彻底登出
    }
    removeToken();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth:expired"));
    }
    throw new ApiError("登录已过期，请重新登录", 401);
  }

  return parseOk<T>(res, path);
}

async function parseOk<T>(res: Response, _path: string): Promise<T> {
  const text = await res.text();

  // 空响应体（如 DELETE 返回 204 No Content）视为成功
  if (!text) {
    return undefined as T;
  }

  let payload: ApiResponse<T> & { detail?: string };
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ApiError("响应格式错误", res.status);
  }

  if (payload.code !== 0) {
    throw new ApiError(
      payload.message || payload.detail || "请求失败",
      payload.code,
      (payload as any).errors
    );
  }

  return payload.data;
}

async function requestPage<T>(
  path: string,
  params: Record<string, any> = {},
  auth = true
): Promise<PageData<T>> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
  });
  const sep = path.includes("?") ? "&" : "?";
  return request<PageData<T>>(`${path}${sep}${qs.toString()}`, undefined, auth);
}

async function requestFile(
  path: string,
  file: File,
  extra?: Record<string, string>
): Promise<any> {
  const token = getToken();
  const form = new FormData();
  form.append("image", file);
  if (extra) Object.entries(extra).forEach(([k, v]) => form.append(k, v));

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: form,
  });

  const text = await res.text();
  const payload = JSON.parse(text);
  if (payload.code !== 0) {
    throw new ApiError(payload.message || "请求失败", payload.code);
  }
  return payload.data;
}

/** 带鉴权获取文本内容（训练报告 HTML 在线预览等） */
async function requestText(path: string): Promise<string> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) {
    if (res.status === 401) {
      removeToken();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:expired"));
      }
      throw new ApiError("登录已过期，请重新登录", 401);
    }
    let message = "加载失败";
    try {
      const payload = await res.json();
      message = payload.message || payload.detail || message;
    } catch {
      /* 忽略非 JSON 响应 */
    }
    throw new ApiError(message, res.status);
  }
  return res.text();
}

/** 带鉴权下载文件（CSV/Excel 等），返回 Blob 并触发浏览器保存 */
async function downloadFile(
  path: string,
  params: Record<string, any> = {},
  fallbackName = "download"
): Promise<void> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
  });
  const query = qs.toString();
  const url = `${BASE_URL}${path}${query ? `?${query}` : ""}`;

  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { headers });

  if (!res.ok) {
    if (res.status === 401) {
      removeToken();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:expired"));
      }
      throw new ApiError("登录已过期，请重新登录", 401);
    }
    // 失败时后端返回 JSON 错误体
    let message = "导出失败";
    try {
      const payload = await res.json();
      message = payload.message || payload.detail || message;
    } catch {
      /* 忽略非 JSON 响应 */
    }
    throw new ApiError(message, res.status);
  }

  // 优先使用后端 Content-Disposition 中的文件名
  let filename = fallbackName;
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/);
  if (match) filename = match[1];

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

// ── Auth ──────────────────────────────────────────────────────
export const api = {
  auth: {
    async login(username: string, password: string) {
      const data = await request<any>(
        "/api/v1/auth/login/",
        {
          method: "POST",
          body: JSON.stringify({ username, password }),
        },
        false
      );
      setToken(data.access);
      if (data.refresh) setRefreshToken(data.refresh);
      return data;
    },
    async register(username: string, email: string, password: string, password2: string, phone?: string) {
      return request<any>(
        "/api/v1/auth/register/",
        {
          method: "POST",
          body: JSON.stringify({ username, email, password, password2, phone }),
        },
        false
      );
    },
    async profile() {
      return request<any>("/api/v1/auth/profile/");
    },
    async updateProfile(payload: Record<string, any>) {
      return request<any>("/api/v1/auth/profile/", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    async changePassword(old_password: string, new_password: string) {
      return request<any>("/api/v1/auth/change-password/", {
        method: "POST",
        body: JSON.stringify({ old_password, new_password }),
      });
    },
    logout() {
      removeToken();
    },
  },

  // ── Analytics ─────────────────────────────────────────────
  analytics: {
    dashboard: () => request<any>("/api/v1/analytics/dashboard/"),
    monthlyTrend: () => request<any[]>("/api/v1/analytics/monthly-trend/"),
    speciesCategory: () => request<any[]>("/api/v1/analytics/species-category/"),
    recentRecords: (limit = 10) => request<any[]>(`/api/v1/analytics/recent-records/?limit=${limit}`),
    recentAlerts: (limit = 10) => request<any[]>(`/api/v1/analytics/recent-alerts/?limit=${limit}`),
    devices: () => request<any>("/api/v1/analytics/devices/"),
    rai: (days = 7, top = 6) => request<any[]>(`/api/v1/analytics/rai/?days=${days}&top=${top}`),
    rhythm: (days = 7) => request<any[]>(`/api/v1/analytics/rhythm/?days=${days}`),
  },

  auditLog: {
    list: (params?: Record<string, any>) => requestPage<any>("/api/v1/auth/audit-logs/", params),
    stats: (params?: Record<string, any>) =>
      request<any>("/api/v1/auth/audit-logs/stats/", params),
  },

  // ── Survey Areas ───────────────────────────────────────────
  surveyAreas: {
    list: (params?: Record<string, any>) => requestPage<any>("/api/v1/survey-areas/", params),
    // 后端 list 为分页结构 {list, total, page, pageSize}，all() 解包后直接返回数组
    all: async () => (await requestPage<any>("/api/v1/survey-areas/", { pageSize: 200 })).list,
    detail: (id: number) => request<any>(`/api/v1/survey-areas/${id}/`),
    create: (data: any) => request<any>(`/api/v1/survey-areas/`, { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/api/v1/survey-areas/${id}/`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => request<any>(`/api/v1/survey-areas/${id}/`, { method: "DELETE" }),
  },

  // ── Devices ────────────────────────────────────────────────
  devices: {
    list: (params?: Record<string, any>) => requestPage<any>("/api/v1/devices/", params),
    detail: (id: number) => request<any>(`/api/v1/devices/${id}/`),
    create: (data: any) => request<any>(`/api/v1/devices/`, { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/api/v1/devices/${id}/`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => request<any>(`/api/v1/devices/${id}/`, { method: "DELETE" }),
    stats: () => request<any>("/api/v1/devices/stats/"),
    generateEdgeToken: (id: number) =>
      request<any>(`/api/v1/devices/${id}/edge_token/`, { method: "POST" }),
    revokeEdgeToken: (id: number) =>
      request<any>(`/api/v1/devices/${id}/edge_token/`, { method: "DELETE" }),
  },

  // ── Species ────────────────────────────────────────────────
  species: {
    list: (params?: Record<string, any>) => requestPage<any>("/api/v1/species/", params),
    detail: (id: number) => request<any>(`/api/v1/species/${id}/`),
    create: (data: any) => request<any>(`/api/v1/species/`, { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/api/v1/species/${id}/`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => request<any>(`/api/v1/species/${id}/`, { method: "DELETE" }),
    // 上传类别照片（文件存入 MinIO）
    uploadPhoto: (id: number, file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return request<any>(`/api/v1/species/${id}/photo/`, { method: "POST", body: fd });
    },
  },

  // ── Records ────────────────────────────────────────────────
  records: {
    list: (params?: Record<string, any>) => requestPage<any>("/api/v1/records/", params),
    detail: (id: number) => request<any>(`/api/v1/records/${id}/`),
    // 导出 CSV：后端按当前筛选条件生成文件，前端触发下载
    export: (params?: Record<string, any>) =>
      downloadFile("/api/v1/records/export/", params, "monitor_records.csv"),
    // 复核队列（按风险优先级排序）
    reviewQueue: (params?: Record<string, any>) =>
      requestPage<any>("/api/v1/records/review_queue/", params),
    reviewStats: () => request<any>("/api/v1/records/review_stats/"),
    // 复核：确认 / 修正(corrected 需传 corrected_species) / 否定
    review: (id: number, status: string, options?: { remark?: string; correctedSpecies?: number }) =>
      request<any>(`/api/v1/records/${id}/review/`, {
        method: "POST",
        body: JSON.stringify({
          status,
          remark: options?.remark,
          corrected_species: options?.correctedSpecies,
        }),
      }),
    // 批量复核：仅支持确认 / 否定
    batchReview: (ids: number[], status: string) =>
      request<any>("/api/v1/records/batch_review/", {
        method: "POST",
        body: JSON.stringify({ ids, status }),
      }),
    // 导出复核确认数据为训练集
    exportTraining: (params?: Record<string, any>) =>
      downloadFile("/api/v1/records/export_training/", params, "training_set.csv"),
    // 导出训练包 ZIP：原始文件 + YOLO/COCO 标签 + AI 识别结果
    exportPackage: (params?: Record<string, any>) =>
      downloadFile("/api/v1/records/export_package/", params, "training_package.zip"),
    // 训练样本池：列表 / 统计 / 清单导出
    trainingSamples: (params?: Record<string, any>) =>
      requestPage<any>("/api/v1/records/training_samples/", params),
    trainingStats: () => request<any>("/api/v1/records/training_stats/"),
    trainingSamplesCsv: (params?: Record<string, any>) =>
      downloadFile("/api/v1/records/training_samples_csv/", params, "training_samples.csv"),
  },

  // ── Alerts ────────────────────────────────────────────────
  alerts: {
    list: (params?: Record<string, any>) => requestPage<any>("/api/v1/alerts/", params),
    detail: (id: number) => request<any>(`/api/v1/alerts/${id}/`),
    markRead: (id: number) => request<any>(`/api/v1/alerts/${id}/mark_read/`, { method: "POST" }),
    markAllRead: () => request<any>(`/api/v1/alerts/mark_all_read/`, { method: "POST" }),
    stats: () => request<any>("/api/v1/alerts/stats/"),
  },

  // ── Recognize ───────────────────────────────────────────────
  recognize: {
    upload: (file: File, cropId?: string) => requestFile("/api/v1/recognize/", file, cropId ? { crop_id: cropId } : undefined),
    history: (params?: Record<string, any>) => requestPage<any>("/api/v1/recognize/records/", params),
    historyDetail: (id: number) => request<any>(`/api/v1/recognize/records/${id}/`),
  },

  // ── Categories ─────────────────────────────────────────────
  categories: {
    list: (params?: Record<string, any>) => requestPage<any>("/api/v1/categories/", params),
    tree: () => request<any[]>("/api/v1/categories/tree/"),
    detail: (id: number) => request<any>(`/api/v1/categories/${id}/`),
    create: (data: any) => request<any>(`/api/v1/categories/`, { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/api/v1/categories/${id}/`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => request<any>(`/api/v1/categories/${id}/`, { method: "DELETE" }),
  },

  // ── Models ─────────────────────────────────────────────────
  models: {
    list: (params?: Record<string, any>) => requestPage<any>("/api/v1/models/", params),
    detail: (id: number) => request<any>(`/api/v1/models/${id}/`),
    create: (data: any) => request<any>(`/api/v1/models/`, { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/api/v1/models/${id}/`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => request<any>(`/api/v1/models/${id}/`, { method: "DELETE" }),
    activate: (id: number) => request<any>(`/api/v1/models/${id}/activate/`, { method: "POST" }),
    rollback: () => request<any>(`/api/v1/models/rollback/`, { method: "POST" }),
  },

  // ── Users (admin) ──────────────────────────────────────────
  users: {
    list: (params?: Record<string, any>) => requestPage<any>("/api/v1/users/", params),
    create: (data: any) => request<any>(`/api/v1/users/`, { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/api/v1/users/${id}/`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => request<any>(`/api/v1/users/${id}/`, { method: "DELETE" }),
    resetPassword: (id: number, password: string) =>
      request<any>(`/api/v1/users/${id}/reset_password/`, { method: "POST", body: JSON.stringify({ password }) }),
  },

  // ── Cross-modal Fusion ─────────────────────────────────────
  fusion: {
    // 证据簇列表（支持 species/survey_area/status/fused_grade/has_* 等筛选）
    clusters: (params?: Record<string, any>) =>
      requestPage<any>("/api/v1/fusion/clusters/", params),
    detail: (id: number) => request<any>(`/api/v1/fusion/clusters/${id}/`),
    // 复核：confirmed / rejected，保留操作人、时间与备注
    review: (id: number, status: string, remark?: string) =>
      request<any>(`/api/v1/fusion/clusters/${id}/review/`, {
        method: "POST",
        body: JSON.stringify({ status, remark }),
      }),
    // 重建指定天数范围内的证据簇
    rebuild: (days = 30) =>
      request<any>("/api/v1/fusion/clusters/rebuild/", {
        method: "POST",
        body: JSON.stringify({ days }),
      }),
    stats: () => request<any>("/api/v1/fusion/clusters/stats/"),
    edna: {
      list: (params?: Record<string, any>) =>
        requestPage<any>("/api/v1/fusion/edna/", params),
      create: (data: any) =>
        request<any>("/api/v1/fusion/edna/", {
          method: "POST",
          body: JSON.stringify(data),
        }),
      delete: (id: number) =>
        request<any>(`/api/v1/fusion/edna/${id}/`, { method: "DELETE" }),
    },
  },

  // ── Inference / Two-tier scheduling ────────────────────────
  inference: {
    tasks: (params?: Record<string, any>) =>
      requestPage<any>("/api/v1/inference/tasks/", params),
    taskDetail: (id: number) => request<any>(`/api/v1/inference/tasks/${id}/`),
    retry: (id: number) =>
      request<any>(`/api/v1/inference/tasks/${id}/retry/`, { method: "POST" }),
    stats: () => request<any>("/api/v1/inference/stats/"),
    schedulingStats: (days = 7) =>
      request<any>(`/api/v1/inference/scheduling/stats/?days=${days}`),
    providerHealth: () => request<any>("/api/v1/inference/provider-health/"),
    edgeReport: (data: any) =>
      request<any>("/api/v1/inference/edge/report/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  // ── Model Training / Report Approval ───────────────────────
  training: {
    stats: () => request<any>("/api/v1/training/runs/stats/"),
    runs: (params?: Record<string, any>) =>
      requestPage<any>("/api/v1/training/runs/", params),
    runDetail: (id: number) => request<any>(`/api/v1/training/runs/${id}/`),
    createRun: (data: any) =>
      request<any>("/api/v1/training/runs/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    retryRun: (id: number) =>
      request<any>(`/api/v1/training/runs/${id}/retry/`, { method: "POST" }),
    cancelRun: (id: number) =>
      request<any>(`/api/v1/training/runs/${id}/cancel/`, { method: "POST" }),
    reports: (params?: Record<string, any>) =>
      requestPage<any>("/api/v1/training/reports/", params),
    reportDetail: (id: number) => request<any>(`/api/v1/training/reports/${id}/`),
    submitReport: (id: number, remark?: string) =>
      request<any>(`/api/v1/training/reports/${id}/submit/`, {
        method: "POST",
        body: JSON.stringify({ remark }),
      }),
    reviewReport: (id: number, comment?: string) =>
      request<any>(`/api/v1/training/reports/${id}/review/`, {
        method: "POST",
        body: JSON.stringify({ comment }),
      }),
    approveReport: (id: number, comment?: string) =>
      request<any>(`/api/v1/training/reports/${id}/approve/`, {
        method: "POST",
        body: JSON.stringify({ comment }),
      }),
    rejectReport: (id: number, comment?: string) =>
      request<any>(`/api/v1/training/reports/${id}/reject/`, {
        method: "POST",
        body: JSON.stringify({ comment }),
      }),
    reportHtml: (id: number) => requestText(`/api/v1/training/reports/${id}/html/`),
    reportPdf: (id: number) =>
      downloadFile(`/api/v1/training/reports/${id}/pdf/`, {}, "training_report.pdf"),
  },

  // ── System Config ──────────────────────────────────────────
  systemConfig: {
    get: () => request<{ config: Record<string, string>; descriptions: Record<string, string> }>("/api/v1/system-config/"),
    update: (config: Record<string, string>) =>
      request<any>(`/api/v1/system-config/`, { method: "PUT", body: JSON.stringify({ config }) }),
  },

  // ── Feedback ───────────────────────────────────────────────
  feedback: {
    list: (params?: Record<string, any>) => requestPage<any>("/api/v1/feedback/", params),
    submit: (data: any) => request<any>("/api/v1/feedback/", { method: "POST", body: JSON.stringify(data) }),
    review: (id: number, reviewStatus: string, comment?: string) =>
      request<any>(`/api/v1/feedback/${id}/review/`, {
        method: "POST",
        body: JSON.stringify({ review_status: reviewStatus, comment }),
      }),
  },
};
