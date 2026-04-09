import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  var searchParams = request.nextUrl.searchParams;
  var code = searchParams.get("code");
  var state = searchParams.get("state");
  var error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/settings/integrations?google=error&reason=" + error, request.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/settings/integrations?google=error&reason=missing_params", request.url));
  }

  var stateData: { userId: string };
  try {
    stateData = JSON.parse(Buffer.from(state, "base64").toString());
  } catch {
    return NextResponse.redirect(new URL("/settings/integrations?google=error&reason=invalid_state", request.url));
  }

  var clientId = process.env.GOOGLE_CLIENT_ID!;
  var clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  var redirectUri = process.env.GOOGLE_REDIRECT_URI!;

  var tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    var errBody = await tokenRes.text();
    console.error("Google token exchange failed:", errBody);
    return NextResponse.redirect(new URL("/settings/integrations?google=error&reason=token_exchange", request.url));
  }

  var tokens = await tokenRes.json();

  var userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: "Bearer " + tokens.access_token },
  });

  var userInfo = userInfoRes.ok ? await userInfoRes.json() : { email: null };

  var tokenExpiry = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null;

  await prisma.userIntegration.upsert({
    where: {
      userId_provider: {
        userId: stateData.userId,
        provider: "google_calendar",
      },
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      tokenExpiry,
      accountEmail: userInfo.email || undefined,
      isActive: true,
    },
    create: {
      userId: stateData.userId,
      provider: "google_calendar",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      tokenExpiry,
      accountEmail: userInfo.email || null,
      calendarId: "primary",
      isActive: true,
    },
  });

  return NextResponse.redirect(new URL("/settings/integrations?google=success", request.url));
}