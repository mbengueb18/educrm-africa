"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
  getUserGoogleIntegration,
} from "@/lib/google-calendar";

// ─── Check if user has Google Calendar connected ───
export async function checkGoogleCalendar() {
  var session = await auth();
  if (!session?.user) return { connected: false, email: null };

  var integration = await getUserGoogleIntegration(session.user.id);

  if (!integration || !integration.isActive) {
    return { connected: false, email: null };
  }

  return { connected: true, email: integration.accountEmail };
}

// ─── Sync appointment to Google Calendar ───
export async function syncAppointmentToGoogle(appointmentId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, organizationId: session.user.organizationId },
    include: {
      lead: { select: { firstName: true, lastName: true, email: true } },
    },
  });

  if (!appointment) throw new Error("Rendez-vous introuvable");

  var generateMeet = appointment.type === "VIDEO_CALL" && (!appointment.meetingUrl || appointment.meetingProvider === "google_meet");

  var result = await createGoogleEvent(appointment.assignedToId, {
    title: appointment.title,
    description: appointment.description || undefined,
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    location: appointment.location || undefined,
    meetingProvider: generateMeet ? "google_meet" : undefined,
    attendeeEmail: appointment.lead?.email || undefined,
  });

  if (!result) throw new Error("Impossible de synchroniser avec Google Calendar. Vérifiez votre connexion.");

  // Update appointment with Google event ID and meeting URL
  var updateData: any = { googleEventId: result.eventId };
  if (result.meetingUrl) {
    updateData.meetingUrl = result.meetingUrl;
    updateData.meetingProvider = "google_meet";
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: updateData,
  });

  return {
    success: true,
    eventId: result.eventId,
    meetingUrl: result.meetingUrl || null,
  };
}

// ─── Update synced Google event ───
export async function updateGoogleSync(appointmentId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, organizationId: session.user.organizationId },
  });

  if (!appointment || !appointment.googleEventId) return { success: false };

  var updated = await updateGoogleEvent(appointment.assignedToId, appointment.googleEventId, {
    title: appointment.title,
    description: appointment.description || undefined,
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    location: appointment.location || undefined,
  });

  return { success: updated };
}

// ─── Delete synced Google event ───
export async function deleteGoogleSync(appointmentId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, organizationId: session.user.organizationId },
  });

  if (!appointment || !appointment.googleEventId) return { success: false };

  var deleted = await deleteGoogleEvent(appointment.assignedToId, appointment.googleEventId);

  if (deleted) {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { googleEventId: null },
    });
  }

  return { success: deleted };
}