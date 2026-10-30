import { NextRequest, NextResponse } from "next/server";
import { workspaceReturnPath } from "./lib/return-path";
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const auth = path === "/login" || path === "/register";
  if (!auth && !request.cookies.has("romhub_session")) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", workspaceReturnPath(path, "/dashboard"));
    return NextResponse.redirect(login);
  }
  const headers = new Headers(request.headers);
  headers.set("x-nexos-path", workspaceReturnPath(path, "/dashboard"));
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/((?!api/v1(?:/|$)|_next/|favicon.ico|icon.svg|robots.txt|THIRD_PARTY_NOTICES.txt).*)",
  ],
};
