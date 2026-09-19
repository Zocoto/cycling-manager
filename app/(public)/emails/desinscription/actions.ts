"use server";

import { redirect } from "next/navigation";

import { isMarketingUnsubscribeToken } from "@/lib/marketing/email-preferences";
import { unsubscribeMarketingEmailToken } from "@/services/marketing-email-preferences";

export async function unsubscribeMarketingEmailAction(
  formData: FormData,
): Promise<never> {
  const token = readFormValue(formData, "token").trim();
  const locale = readFormValue(formData, "locale") === "en" ? "en" : "fr";

  if (!isMarketingUnsubscribeToken(token)) {
    redirect("/emails/desinscription?status=invalid&lang=" + locale);
  }

  const unsubscribed = await unsubscribeMarketingEmailToken(token);
  redirect(
    "/emails/desinscription?status=" +
      (unsubscribed ? "success" : "error") +
      "&lang=" +
      locale,
  );
}

function readFormValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
