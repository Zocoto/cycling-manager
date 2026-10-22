import { canAccessSeasonFourGala } from "@/lib/game/season-four-gala-access";
import { getGalaEvent } from "@/lib/game/season-four-gala";
import { GalaStartlistError } from "@/lib/game/season-four-gala-startlists";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateSeasonFourGalaStartlistExport } from "@/services/season-four-gala-startlists";

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

export async function POST(request:Request){
 const supabase=await createSupabaseServerClient();
 const {data:{user},error}=await getAuthenticatedUser(supabase);
 if(error||!user)return Response.json({error:'Authentification requise.'},{status:401});
 if(!canAccessSeasonFourGala(user.id))return Response.json({error:'Ressource introuvable.'},{status:404});
 if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('x-cs-requested-with')!=='gala-s4-export')return Response.json({error:'Requête d’export invalide.'},{status:403});
 const params=new URL(request.url).searchParams;const kind=params.get('kind')??'startlists';
 if(!['startlists','database'].includes(kind)||!['0','1'].includes(params.get('template')??'0'))return Response.json({error:'Paramètres d’export invalides.'},{status:400});
 const key=params.get('event');const event=key?getGalaEvent(key):null;
 if(key&&!event)return Response.json({error:'Course du gala inconnue.'},{status:400});
 try{
  if(kind==='database'){
   if(key||params.get('template')==='1')return Response.json({error:'Paramètres d’export invalides.'},{status:400});
   const {generatePcmExport}=await import('@/services/pcm-export');
   const result=await generatePcmExport(false,true);
   return new Response(new Uint8Array(result.archive),{headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="${result.filename}"`,'Cache-Control':'private, no-store, max-age=0','X-CS-Season':'4'}});
  }
  const result=await generateSeasonFourGalaStartlistExport(event?.key,params.get('template')==='1');
  return new Response(new Uint8Array(result.data),{headers:{'Content-Type':result.contentType,'Content-Disposition':`attachment; filename="${result.filename}"`,'Cache-Control':'private, no-store, max-age=0','X-CS-Teams':String(result.teamCount),'X-CS-Riders':String(result.riderCount),'X-CS-Template':String(result.template),'X-CS-Season':'4'}});
 }catch(error){
  if(error instanceof GalaStartlistError)return Response.json({error:error.message},{status:409,headers:{'Cache-Control':'private, no-store'}});
  console.error('Export privé du gala S4 indisponible.',error);
  return Response.json({error:'L’export du gala est indisponible. Aucune donnée n’a été modifiée.'},{status:500,headers:{'Cache-Control':'private, no-store'}});
 }
}
