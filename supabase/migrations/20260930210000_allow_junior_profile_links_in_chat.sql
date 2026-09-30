-- Les fiches publiques des juniors peuvent être partagées dans le chat
-- général et dans les conversations privées, sans ouvrir les liens externes.
create or replace function public.validate_global_chat_message_links()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_without_allowed_links text;
begin
  v_without_allowed_links := regexp_replace(
    new.message,
    '((https://(www\.)?|www\.)?cyclostratege\.fr)?/jeu/((equipes|coureurs)/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|directeurs-sportifs/[^[:space:]<]+|centre-de-formation/development/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})([^[:space:]<]*)?',
    ' ',
    'gi'
  );

  if v_without_allowed_links ~* '(https?://|www\.)'
    or v_without_allowed_links ~* '(^|[[:space:]<(])([[:alnum:]-]+\.)+[[:alpha:]]{2,}(/[^[:space:]<]*)?'
  then
    raise exception
      'Seuls les liens Cyclo Stratège vers une fiche coureur, junior, équipe ou DS sont autorisés.';
  end if;

  return new;
end;
$$;

create or replace function public.validate_direct_message_links()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_without_allowed_links text;
begin
  v_without_allowed_links := regexp_replace(
    new.body,
    '((https://(www\.)?|www\.)?cyclostratege\.fr)?/jeu/((equipes|coureurs)/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|directeurs-sportifs/[^[:space:]<]+|centre-de-formation/development/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})([^[:space:]<]*)?',
    ' ',
    'gi'
  );

  if v_without_allowed_links ~* '(https?://|www\.)'
    or v_without_allowed_links ~* '(^|[[:space:]<(])([[:alnum:]-]+\.)+[[:alpha:]]{2,}(/[^[:space:]<]*)?'
  then
    raise exception
      'Seuls les liens Cyclo Stratège vers une fiche coureur, junior, équipe ou DS sont autorisés.';
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
