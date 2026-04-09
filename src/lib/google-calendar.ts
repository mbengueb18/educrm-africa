import { prisma } from "@/lib/prisma";

// ─── Refresh token if expired ───
async function getValidToken(integrationId: string): Promise<string | null> {
  var integration = await prisma.userIntegration.findUnique({
    where: { id: integrationId },
  });

  if (!integration || !integration.isActive) return null;

  // Check if token is still valid (with 5 min buffer)
  if (integration.tokenExpiry && integration.tokenExpiry > new Date(Date.now() + 5 * 60 * 1000)) {
    return integration.accessToken;
  }

  // Need to refresh
  if (!integration.refreshToken) {
    await prisma.userIntegration.update({
      where: { id: integrationId },
      data: { isActive: false },
    });
    return null;
  }

  var res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: integration.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    console.error("Google token refresh failed:", await res.text());
    await prisma.userIntegration.update({
      where: { id: integrationId },
      data: { isActive: false },
    });
    return null;
  }

  var tokens = await res.json();
  var tokenExpiry = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null;

  await prisma.userIntegration.update({
    where: { id: integrationId },
    data: {
      accessToken: tokens.access_token,
      tokenExpiry,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
    },
  });

  return tokens.access_token;
}

// ─── Get user's Google integration ───
export async function getUserGoogleIntegration(userId: string) {
  return prisma.userIntegration.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: "google_calendar",
      },
    },
  });
}

// ─── Create Google Calendar event ───
export async function createGoogleEvent(userId: string, event: {
  title: string;
  description?: string;
  startAt: Date;
  endAt: Date;
  location?: string;
  meetingProvider?: string;
  attendeeEmail?: string;
}): Promise<{ eventId: string; meetingUrl?: string } | null> {
  var integration = await getUserGoogleIntegration(userId);
  if (!integration) return null;

  var token = await getValidToken(integration.id);
  if (!token) return null;

  var calendarId = integration.calendarId || "primary";

  var body: any = {
    summary: event.title,
    description: event.description || "",
    start: {
      dateTime: event.startAt.toISOString(),
      timeZone: "Africa/Dakar",
    },
    end: {
      dateTime: event.endAt.toISOString(),
      timeZone: "Africa/Dakar",
    },
  };

  if (event.location) body.location = event.location;

  // Request Google Meet link
  if (event.meetingProvider === "google_meet") {
    body.conferenceData = {
      createRequest: {
        requestId: "educrm-" + Date.now(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  // Add attendee
  if (event.attendeeEmail) {
    body.attendees = [{ email: event.attendeeEmail }];
  }

  var url = "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(calendarId) + "/events";
  if (event.meetingProvider === "google_meet") {
    url += "?conferenceDataVersion=1";
  }

  var res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("Google Calendar create event failed:", await res.text());
    return null;
  }

  var data = await res.json();

  var meetingUrl: string | undefined;
  if (data.conferenceData?.entryPoints) {
    var videoEntry = data.conferenceData.entryPoints.find(function(ep: any) {
      return ep.entryPointType === "video";
    });
    if (videoEntry) meetingUrl = videoEntry.uri;
  }

  return { eventId: data.id, meetingUrl };
}

// ─── Update Google Calendar event ───
export async function updateGoogleEvent(userId: string, eventId: string, event: {
  title?: string;
  description?: string;
  startAt?: Date;
  endAt?: Date;
  location?: string;
}): Promise<boolean> {
  var integration = await getUserGoogleIntegration(userId);
  if (!integration) return false;

  var token = await getValidToken(integration.id);
  if (!token) return false;

  var calendarId = integration.calendarId || "primary";

  var body: any = {};
  if (event.title) body.summary = event.title;
  if (event.description !== undefined) body.description = event.description;
  if (event.startAt) body.start = { dateTime: event.startAt.toISOString(), timeZone: "Africa/Dakar" };
  if (event.endAt) body.end = { dateTime: event.endAt.toISOString(), timeZone: "Africa/Dakar" };
  if (event.location !== undefined) body.location = event.location;

  var res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(calendarId) + "/events/" + eventId,
    {
      method: "PATCH",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    console.error("Google Calendar update event failed:", await res.text());
    return false;
  }

  return true;
}

// ─── Delete Google Calendar event ───
export async function deleteGoogleEvent(userId: string, eventId: string): Promise<boolean> {
  var integration = await getUserGoogleIntegration(userId);
  if (!integration) return false;

  var token = await getValidToken(integration.id);
  if (!token) return false;

  var calendarId = integration.calendarId || "primary";

  var res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(calendarId) + "/events/" + eventId,
    {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    }
  );

  return res.ok || res.status === 404;
}