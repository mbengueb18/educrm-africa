import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getUserGoogleIntegration } from "@/lib/google-calendar";
import { GoogleCalendarSettingsClient } from "./google-calendar-settings-client";

export const metadata: Metadata = {
  title: "Google Calendar",
};

export const dynamic = "force-dynamic";

export default async function GoogleCalendarSettingsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const integration = await getUserGoogleIntegration(session.user.id);

  return (
    <GoogleCalendarSettingsClient
      initialConnected={!!integration?.isActive}
      initialEmail={integration?.accountEmail || null}
    />
  );
}