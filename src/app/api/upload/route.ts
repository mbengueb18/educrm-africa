import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
var supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Supabase non configure" },
        { status: 500 }
      );
    }

    var supabase = createClient(supabaseUrl, supabaseServiceKey);

    var formData = await request.formData();
    var file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });
    }

    // Validate file type
    var allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Type de fichier non supporte. Utilisez JPG, PNG, GIF, WebP ou SVG." },
        { status: 400 }
      );
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Le fichier est trop volumineux (max 5 Mo)" },
        { status: 400 }
      );
    }

    // Generate unique filename
    var ext = file.name.split(".").pop() || "jpg";
    var filename = Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
    var path = "campaigns/" + filename;

    // Convert to buffer
    var arrayBuffer = await file.arrayBuffer();
    var buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    var { data, error } = await supabase.storage
      .from("email-assets")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("[Upload]", error);
      return NextResponse.json(
        { error: "Erreur upload: " + error.message },
        { status: 500 }
      );
    }

    // Get public URL
    var { data: urlData } = supabase.storage
      .from("email-assets")
      .getPublicUrl(path);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      filename: filename,
      size: file.size,
    });
  } catch (error: any) {
    console.error("[Upload Error]", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
