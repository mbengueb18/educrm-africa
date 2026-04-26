import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

const BUCKET = "email-attachments";

export async function uploadAttachment(
  file: File | Blob,
  filename: string,
  organizationId: string,
  leadId: string
): Promise<{ path: string; url: string; size: number }> {
  const timestamp = Date.now();
  const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${organizationId}/${leadId}/${timestamp}-${cleanName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) throw new Error("Upload échoué : " + uploadError.message);

  const size = file instanceof File ? file.size : (file as any).size || 0;

  return { path, url: path, size };
}

export async function getAttachmentBuffer(path: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error("Téléchargement échoué : " + (error?.message || "no data"));
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function getAttachmentSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data) throw new Error("Erreur URL signée : " + (error?.message || "no data"));
  return data.signedUrl;
}

export async function deleteAttachment(path: string): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
  if (error) throw new Error("Suppression échouée : " + error.message);
}