"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "../../../lib/supabase/server";
import type { LoginState } from "./login-state";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Saisis une adresse e-mail valide."),

  password: z
    .string()
    .min(1, "Saisis ton mot de passe.")
    .max(72, "Le mot de passe ne peut pas dépasser 72 caractères."),
});

export async function loginAccount(
  _previousState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = getFormValue(formData, "email")
    .trim()
    .toLowerCase();

  const password = getFormValue(formData, "password");

  const validationResult = loginSchema.safeParse({
    email,
    password,
  });

  if (!validationResult.success) {
    return {
      status: "error",
      message: "Certains champs doivent être corrigés.",
      fieldErrors: validationResult.error.flatten().fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: validationResult.data.email,
    password: validationResult.data.password,
  });

  if (error) {
    if (error.code === "invalid_credentials") {
      return {
        status: "error",
        message:
          "L’adresse e-mail ou le mot de passe est incorrect.",
        fieldErrors: {},
      };
    }

    if (error.code === "email_not_confirmed") {
      return {
        status: "error",
        message:
          "Ton adresse e-mail n’a pas encore été confirmée. Consulte le message envoyé lors de ton inscription.",
        fieldErrors: {},
      };
    }

    if (error.code === "over_request_rate_limit") {
      return {
        status: "error",
        message:
          "Trop de tentatives ont été effectuées. Attends quelques minutes avant de réessayer.",
        fieldErrors: {},
      };
    }

    if (error.code === "user_banned") {
      return {
        status: "error",
        message:
          "Ce compte est temporairement indisponible.",
        fieldErrors: {},
      };
    }

    console.error("Échec de la connexion Supabase :", {
      code: error.code,
      status: error.status,
      message: error.message,
    });

    return {
      status: "error",
      message:
        "La connexion est temporairement indisponible. Réessaie dans quelques instants.",
      fieldErrors: {},
    };
  }

  redirect("/jeu");
}

function getFormValue(
  formData: FormData,
  fieldName: string
): string {
  const value = formData.get(fieldName);

  return typeof value === "string" ? value : "";
}