import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserGoogleIntegration } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  var session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  var integration = await getUserGoogleIntegration(session.user.id);

  if (!integration || !integration.isActive) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    email: integration.accountEmail,
    calendarId: integration.calendarId,
  });
}