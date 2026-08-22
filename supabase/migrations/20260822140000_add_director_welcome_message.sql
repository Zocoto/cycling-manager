begin;

-- Plusieurs raccourcis internes peuvent accompagner un courrier, sans
-- interpréter de HTML ou de Markdown stocké en base.
alter table public.sporting_director_messages
  add column action_links jsonb not null default '[]'::jsonb;

alter table public.sporting_director_messages
  add constraint sporting_director_messages_action_links_array
    check (
      jsonb_typeof(action_links) = 'array'
      and jsonb_array_length(action_links) <= 16
    );

comment on column public.sporting_director_messages.action_links is
  'Liste structurée de raccourcis internes affichés sous le corps du courrier.';

create or replace function private.ensure_sporting_director_welcome_message(
  p_sporting_director_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message_id uuid;
begin
  if not exists (
    select 1
    from public.sporting_directors as director
    where director.id = p_sporting_director_id
  ) then
    return null;
  end if;

  insert into public.sporting_director_messages (
    sporting_director_id,
    message_type,
    sender_name,
    subject,
    preview,
    body,
    action_href,
    action_label,
    action_links,
    source_reference,
    is_important
  ) values (
    p_sporting_director_id,
    'system',
    'Direction de Cyclo Stratège',
    'Bienvenue dans Cyclo Stratège !',
    'Trois premières étapes pour lancer votre carrière de Directeur Sportif.',
    E'Bienvenue dans Cyclo Stratège !\n\nVotre équipe est prête : voici les trois premières étapes que nous vous conseillons.\n\n1. Marché des transferts\nRegardez les coureurs disponibles, recrutez de nouveaux profils et étoffez votre effectif.\n\n2. Calendrier et préparation des courses\nInscrivez votre équipe aux épreuves accessibles. La préparation est facultative, mais elle permet aux joueurs les plus chevronnés d’affiner les rôles, les choix tactiques et le matériel.\n\n3. Staff\nCommencez à recruter des membres du staff pour renforcer l’entraînement, les soins, le recrutement, les infrastructures et plusieurs autres aspects de votre équipe.\n\nPour aller plus loin\n• Entraînement : programmez la progression et le repos de vos coureurs.\n• Centre de soin : suivez la forme, les blessures et les affectations du personnel médical.\n• Centre de formation : développez vos juniors et votre Development Team.\n• Matériel : équipez vos coureurs et préparez les montages adaptés.\n• Infrastructures : construisez les installations qui feront progresser durablement votre club.\n• Finances : gardez un œil sur votre trésorerie, vos revenus et vos dépenses.\n• Objectifs et trophées : suivez les défis qui rythment votre carrière et leurs récompenses.\n\nBesoin d’aide ? Utilisez l’icône « ? » présente dans l’en-tête. Elle ouvre un didacticiel contextuel qui vous accompagne dans chaque rubrique.',
    '/jeu/equipe',
    'Découvrir mon équipe',
    jsonb_build_array(
      jsonb_build_object('label', 'Marché des transferts', 'href', '/jeu/transferts'),
      jsonb_build_object('label', 'Calendrier des courses', 'href', '/jeu/calendrier'),
      jsonb_build_object('label', 'Préparation des courses', 'href', '/jeu/preparation-course'),
      jsonb_build_object('label', 'Recruter du staff', 'href', '/jeu/staff'),
      jsonb_build_object('label', 'Entraînement', 'href', '/jeu/entrainement'),
      jsonb_build_object('label', 'Centre de soin', 'href', '/jeu/centre-de-soin'),
      jsonb_build_object('label', 'Centre de formation', 'href', '/jeu/centre-de-formation'),
      jsonb_build_object('label', 'Matériel', 'href', '/jeu/materiel'),
      jsonb_build_object('label', 'Infrastructures', 'href', '/jeu/infrastructures'),
      jsonb_build_object('label', 'Finances', 'href', '/jeu/finances'),
      jsonb_build_object('label', 'Objectifs et trophées', 'href', '/jeu/objectifs')
    ),
    'system:welcome',
    true
  )
  on conflict (sporting_director_id, source_reference) do nothing
  returning id into v_message_id;

  if v_message_id is null then
    select message.id
    into v_message_id
    from public.sporting_director_messages as message
    where message.sporting_director_id = p_sporting_director_id
      and message.source_reference = 'system:welcome';
  end if;

  return v_message_id;
end;
$$;

create or replace function private.send_welcome_message_after_director_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.ensure_sporting_director_welcome_message(new.id);
  return new;
end;
$$;

revoke all
  on function private.ensure_sporting_director_welcome_message(uuid)
  from public, anon, authenticated;
revoke all
  on function private.send_welcome_message_after_director_signup()
  from public, anon, authenticated;

drop trigger if exists send_welcome_message_after_director_signup
  on public.sporting_directors;
create trigger send_welcome_message_after_director_signup
after insert on public.sporting_directors
for each row
execute function private.send_welcome_message_after_director_signup();

-- Exemplaire demandé pour valider le rendu avec Max Lamenace. La contrainte
-- d'unicité rend ce bloc rejouable sans jamais créer un deuxième courrier.
do $$
declare
  v_test_director_id uuid;
begin
  select director.id
  into v_test_director_id
  from public.sporting_directors as director
  where lower(director.display_name) = lower('Max Lamenace')
  order by director.id
  limit 1;

  if v_test_director_id is not null then
    perform private.ensure_sporting_director_welcome_message(v_test_director_id);
  end if;
end;
$$;

commit;
