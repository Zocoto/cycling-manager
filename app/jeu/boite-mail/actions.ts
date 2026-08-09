"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";

export async function markManagerMailReadAction(formData: FormData) {
  const key = formData.get("messageKey");
  if (typeof key !== "string" || !key) return;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await getAuthenticatedUser(supabase);
  if (!user) return;
  await supabase.from("manager_mail_read_states").upsert({ auth_user_id: user.id, message_key: key });
  revalidatePath("/jeu");
  revalidatePath("/jeu/boite-mail");
}

export async function markAllManagerMailReadAction(formData: FormData) {
  const keys = formData.getAll("messageKey").filter((key): key is string => typeof key === "string" && key.length > 0);
  if (!keys.length) return;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await getAuthenticatedUser(supabase);
  if (!user) return;
  await supabase.from("manager_mail_read_states").upsert(keys.map((message_key) => ({ auth_user_id: user.id, message_key })));
  revalidatePath("/jeu");
  revalidatePath("/jeu/boite-mail");
}
