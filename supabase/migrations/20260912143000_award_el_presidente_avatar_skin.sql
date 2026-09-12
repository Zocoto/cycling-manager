begin;

create or replace function private.award_el_presidente_trophy(
  p_sporting_director_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trophy_id uuid;
begin
  if p_sporting_director_id is null then
    return false;
  end if;

  insert into public.sporting_director_trophies (
    sporting_director_id,
    trophy_key,
    available_at,
    claimed_at
  )
  select
    director.id,
    'el_presidente',
    now(),
    now()
  from public.sporting_directors as director
  where director.id = p_sporting_director_id
    and director.status = 'active'
    and director.auth_user_id is not null
    and not exists (
      select 1
      from public.alpha_bot_managers as bot
      where bot.sporting_director_id = director.id
    )
  on conflict (sporting_director_id, trophy_key) do update
  set claimed_at = coalesce(
    public.sporting_director_trophies.claimed_at,
    excluded.claimed_at
  )
  returning id into v_trophy_id;

  return v_trophy_id is not null;
end;
$$;

create or replace function private.award_el_presidente_after_term_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.president_director_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.president_director_id is not distinct from new.president_director_id
  then
    return new;
  end if;

  perform private.award_el_presidente_trophy(new.president_director_id);
  return new;
end;
$$;

drop trigger if exists award_el_presidente_after_term_change
  on public.national_federation_terms;

create trigger award_el_presidente_after_term_change
after insert or update of president_director_id
on public.national_federation_terms
for each row
execute function private.award_el_presidente_after_term_change();

create or replace function private.validate_el_presidente_avatar_outfit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_outfit_key text;
begin
  if new.avatar_key is null
     or new.avatar_key not like 'director_custom_v1:%'
  then
    return new;
  end if;

  v_outfit_key := split_part(
    substring(
      new.avatar_key
      from char_length('director_custom_v1:') + 1
    ),
    '.',
    14
  );

  if v_outfit_key <> 'el-presidente' then
    return new;
  end if;

  if not exists (
    select 1
    from public.sporting_director_trophies as trophy
    where trophy.sporting_director_id = new.id
      and trophy.trophy_key = 'el_presidente'
      and trophy.claimed_at is not null
  ) then
    raise exception
      'La distinction El Presidente est requise pour porter cette tenue.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_el_presidente_avatar_outfit_before_write
  on public.sporting_directors;

create trigger validate_el_presidente_avatar_outfit_before_write
before insert or update of avatar_key
on public.sporting_directors
for each row
execute function private.validate_el_presidente_avatar_outfit();

create or replace function private.notify_sporting_director_trophy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_kind text;
  v_detail text;
begin
  if new.claimed_at is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.claimed_at is not null then
    return new;
  end if;

  v_title := case new.trophy_key
    when 'alpha_tester' then 'Alphatesteur'
    when 'atlas_peloton' then 'Atlas du peloton'
    when 'campus_de_pointe' then 'Campus de pointe'
    when 'alchimiste_carbone' then 'Alchimiste du carbone'
    when 'triple_couronne_integrale' then 'Triple Couronne intégrale'
    when 'virage_cache' then 'Le Virage caché'
    when 'ambulancier' then 'Ambulancier'
    when 'medecin_urgentiste' then 'Médecin urgentiste'
    when 'peloton_eternel' then 'Le Peloton éternel'
    when 'joueur_inveter' then 'Joueur invétéré'
    when 'jusqu_au_bout_de_la_nuit' then 'Jusqu’au bout de la nuit'
    when 'el_presidente' then 'El Presidente'
    else initcap(replace(new.trophy_key, '_', ' '))
  end;
  v_kind := case
    when new.trophy_key in ('ambulancier', 'medecin_urgentiste') then 'medical'
    when new.trophy_key = 'alpha_tester' then 'special'
    else 'achievement'
  end;
  v_detail := case
    when new.trophy_key = 'peloton_eternel' then
      'Récompenses remises : 5 000 000 €, 5 000 XP, 500 points de réputation et 3 objets de niveau 10.'
    when new.trophy_key = 'joueur_inveter' then
      'Récompenses remises : 50 000 €, 250 XP, 15 points de réputation et les piles de jetons pour votre avatar.'
    when new.trophy_key = 'jusqu_au_bout_de_la_nuit' then
      'Récompenses remises : 50 000 €, 250 XP, 15 points de réputation et le skin Cernes pour votre avatar.'
    when new.trophy_key = 'el_presidente' then
      'Votre prise de fonction débloque définitivement la tenue officielle El Presidente dans l’éditeur d’avatar.'
    else
      'Cette distinction de carrière est désormais visible dans votre galerie.'
  end;

  perform private.create_trophy_notification(
    new.sporting_director_id,
    v_kind,
    new.trophy_key,
    v_title,
    'special:' || new.id::text,
    new.claimed_at,
    null,
    null,
    v_detail
  );

  return new;
end;
$$;

-- Rattrapage de tous les présidents actuellement en fonction.
do $$
declare
  v_president record;
begin
  for v_president in
    select distinct term.president_director_id
    from public.national_federation_terms as term
    join public.seasons as season
      on season.status = 'active'
     and season.game_year between term.start_game_year and term.end_game_year
    where term.president_director_id is not null
  loop
    perform private.award_el_presidente_trophy(
      v_president.president_director_id
    );
  end loop;
end;
$$;

revoke all on function private.award_el_presidente_trophy(uuid)
  from public, anon, authenticated;
revoke all on function private.award_el_presidente_after_term_change()
  from public, anon, authenticated;
revoke all on function private.validate_el_presidente_avatar_outfit()
  from public, anon, authenticated;
revoke all on function private.notify_sporting_director_trophy()
  from public, anon, authenticated;

comment on function private.award_el_presidente_trophy(uuid) is
  'Attribue définitivement la distinction et la tenue El Presidente à un DS humain dès sa prise de fonction fédérale.';

notify pgrst, 'reload schema';

commit;
