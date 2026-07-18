import { ImageResponse } from "next/og";
import { getSocialNet } from "@/lib/social-icons";

// Rend le glyphe d'un réseau social en PNG (transparent) — email-safe (Gmail,
// Outlook…). Le cercle coloré est fourni par le HTML de l'email (CSS), ici on
// ne produit que le glyphe blanc/noir pour une dégradation gracieuse si les
// images sont bloquées (le cercle reste visible).
export const runtime = "edge";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ network: string }> }
) {
  const { network } = await params;
  const net = getSocialNet(network);
  if (!net) return new Response("Not found", { status: 404 });

  const url = new URL(req.url);
  const size = Math.min(Math.max(parseInt(url.searchParams.get("s") || "48", 10) || 48, 16), 240);
  const color = net.iconColor || "#ffffff";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <path d={net.path} />
        </svg>
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
      },
    }
  );
}
