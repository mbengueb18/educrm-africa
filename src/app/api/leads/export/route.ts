import { NextResponse } from "next/server";
import { exportLeadsCSV } from "@/app/(dashboard)/pipeline/actions";

export async function GET() {
  try {
    var csv = await exportLeadsCSV();

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="leads-educrm-' + new Date().toISOString().split("T")[0] + '.csv"',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}