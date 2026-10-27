import { timingSafeEqual } from "node:crypto";
import { armarVista } from "@/lib/colector";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function claveValida(dada: string | null): boolean {
  const clave = process.env.CENTRAL_CLAVE || "";
  if (!clave || !dada) return false;
  const a = Buffer.from(dada);
  const b = Buffer.from(clave);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!claveValida(req.headers.get("x-clave"))) {
    return Response.json({ message: "Clave requerida" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json(armarVista(), { headers: { "Cache-Control": "no-store" } });
}
