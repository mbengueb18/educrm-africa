import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Add CORS headers to API responses
export function withCors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, x-api-key, Authorization");
  return response;
}
