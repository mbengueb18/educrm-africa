import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  var { pathname } = request.nextUrl;
  var hostname = request.headers.get("host") || "";

  // Never intercept static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  var hostNoPort = hostname.split(":")[0];

  // ─── BACK-OFFICE PLATEFORME (admin.talibcrm.com ; admin.localhost en dev) ───
  var isAdminDomain = hostNoPort === "admin.talibcrm.com" || hostNoPort === "admin.localhost";
  if (isAdminDomain) {
    // Ce domaine ne sert QUE le back-office : on réécrit toute URL vers /backoffice/*
    if (pathname.startsWith("/api/")) return NextResponse.next();
    if (!pathname.startsWith("/backoffice")) {
      var rewritten = pathname === "/" ? "/backoffice" : "/backoffice" + pathname;
      return NextResponse.rewrite(new URL(rewritten, request.url));
    }
    return NextResponse.next();
  }

  // Sur les autres domaines, /backoffice n'est accessible qu'en dev local (pour tester)
  if (pathname.startsWith("/backoffice")) {
    if (hostNoPort !== "localhost" && hostNoPort !== "127.0.0.1") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // ─── MARKETING SITE (talibcrm.com) ───
  var isMarketingSite = hostname === "talibcrm.com" || hostname === "www.talibcrm.com";

  if (isMarketingSite) {
    // On the marketing site, only allow: /, /signup, /login, /api, /public
    var allowedOnMarketing =
      pathname === "/" ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/forgot-password") ||
      pathname.startsWith("/reset-password") ||
      pathname.startsWith("/legal") ||
      pathname.startsWith("/verify") ||
      pathname.startsWith("/api/") ||
      pathname.startsWith("/public") ||
      pathname.startsWith("/f/") ||
      pathname.startsWith("/_next");

    if (!allowedOnMarketing) {
      // Redirect CRM routes to app.talibcrm.com
      return NextResponse.redirect(new URL(pathname, "https://app.talibcrm.com"));
    }

    // If logged in and visiting /, redirect to app
    var token =
      request.cookies.get("authjs.session-token")?.value ||
      request.cookies.get("__Secure-authjs.session-token")?.value;

    if (pathname === "/" && token) {
      return NextResponse.redirect(new URL("/pipeline", "https://app.talibcrm.com"));
    }

    // After login/signup, redirect to app subdomain
    if (pathname.startsWith("/login") && token) {
      return NextResponse.redirect(new URL("/pipeline", "https://app.talibcrm.com"));
    }

    return NextResponse.next();
  }

  // ─── CRM APP (app.talibcrm.com or localhost) ───
  var isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/legal") ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/public") ||
    pathname.startsWith("/f/");

  var token =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  // On app subdomain, redirect / to /pipeline or /login
  if (pathname === "/") {
    if (token) {
      return NextResponse.redirect(new URL("/pipeline", request.url));
    } else {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // Redirect to login if not authenticated
  if (!isPublicRoute && !token) {
    var callbackUrl = encodeURIComponent(pathname);
    return NextResponse.redirect(
      new URL("/login?callbackUrl=" + callbackUrl, request.url)
    );
  }

  // Redirect to pipeline if already logged in and visiting login
  if (pathname.startsWith("/login") && token) {
    return NextResponse.redirect(new URL("/pipeline", request.url));
  }

  return NextResponse.next();
}

export var config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};