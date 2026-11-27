import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CHRISTMAS_ENDS_AT } from "@/lib/game/christmas-event";
export const maxDuration = 30;
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) return Response.json({error:"Unauthorized"},{status:401});
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return Response.json({skipped:true});
  const now=Date.now(), end=Date.parse(CHRISTMAS_ENDS_AT);
  if(now<end+5*60000) return Response.json({skipped:true});
  const {data,error}=await createSupabaseAdminClient().rpc("settle_christmas_event");
  if(error){console.error("Christmas settlement failed",error);return Response.json({error:"Settlement unavailable"},{status:500});}
  return Response.json(data);
}
