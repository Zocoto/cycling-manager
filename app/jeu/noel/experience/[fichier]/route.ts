import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";
export const runtime = "nodejs";
const types: Record<string,string> = { html:"text/html; charset=utf-8",js:"text/javascript; charset=utf-8",css:"text/css; charset=utf-8",png:"image/png",webp:"image/webp",jpg:"image/jpeg" };
const files = new Set(["index.html","tournee.html","noel.js","tournee.js","noel.css","production.css","sapin.css","sapin.js","catalogue.js","portrait.js","avent.js","rules.js","flight-physics.js","logo.png","rudolphe-lanterne-rouge.webp","village-hiver.jpg"]);
const overrides = new Set(["index.html","noel.js","tournee.js","sapin.js","production.css","catalogue.js"]);
const loaded = new Map<string,Promise<Buffer>>();
export async function GET(_request: Request, context: {params: Promise<{fichier:string}>}) {
  const { fichier } = await context.params;
  if (!files.has(fichier)) notFound();
  if (!loaded.has(fichier)) loaded.set(fichier, readFile(join(process.cwd(),"assets",overrides.has(fichier)?"christmas-production":"christmas-preview",fichier)).catch(error=>{loaded.delete(fichier);throw error;}));
  const data = await loaded.get(fichier)!;
  return new Response(new Uint8Array(data),{headers:{"Content-Type":types[fichier.split(".").at(-1)!],"Cache-Control":fichier.endsWith(".html")?"no-store":"public, max-age=3600, must-revalidate","X-Robots-Tag":"noindex, nofollow","X-Content-Type-Options":"nosniff"}});
}
