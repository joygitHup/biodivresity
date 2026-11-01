import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api", "/_next", "/favicon.ico", "/public"];

// 需要登录才能访问的受保护路由（前端 SPA 内部也会二次校验）
const PROTECTED_PREFIXES = [
  "/survey-areas",
  "/devices",
  "/species",
  "/records",
  "/recognize",
  "/review",
  "/analytics",
  "/alerts",
  "/system",
  "/fusion",
  "/scheduling",
  "/training",
  "/audit-logs",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公开路径直接放行
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  // 根路径（/）默认需要登录，让 AppShell 自己处理
  if (pathname === "/") {
    return NextResponse.next();
  }

  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!needsAuth) {
    return NextResponse.next();
  }

  // 从 cookie 或 Authorization header 取 token
  const token =
    request.cookies.get("token")?.value ||
    request.headers.get("Authorization")?.replace("Bearer ", "");

  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
