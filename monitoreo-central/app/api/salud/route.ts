import { infoColector } from "@/lib/colector";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return Response.json({ ok: true, colector: infoColector() }, { headers: { "Cache-Control": "no-store" } });
}
