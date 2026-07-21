begin;

alter table public.teams
drop constraint if exists teams_amateur_jersey_pattern_allowed;

alter table public.teams
add constraint teams_amateur_jersey_pattern_allowed
check (
  amateur_jersey_pattern in (
    'classic',
    'diagonal',
    'hoops',
    'split',
    'vertical',
    'chevron',
    'quarters',
    'cross',
    'shoulders',
    'checkerboard',
    'wave',
    'pinstripes'
  )
);

create or replace function public.update_current_team_amateur_jersey(
  p_jersey_pattern text,
  p_jersey_primary_color text,
  p_jersey_secondary_color text,
  p_jersey_accent_color text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_team public.teams%rowtype;
  v_pattern text := lower(btrim(coalesce(p_jersey_pattern, '')));
  v_primary text := upper(btrim(coalesce(p_jersey_primary_color, '')));
  v_secondary text := upper(btrim(coalesce(p_jersey_secondary_color, '')));
  v_accent text := upper(btrim(coalesce(p_jersey_accent_color, '')));
begin
  if v_auth_user_id is null then
    raise exception 'Vous devez être authentifié pour modifier le maillot.';
  end if;

  if v_pattern not in (
    'classic',
    'diagonal',
    'hoops',
    'split',
    'vertical',
    'chevron',
    'quarters',
    'cross',
    'shoulders',
    'checkerboard',
    'wave',
    'pinstripes'
  ) then
    raise exception 'Le motif du maillot amateur est invalide.';
  end if;

  if v_primary !~ '^#[0-9A-F]{6}$'
    or v_secondary !~ '^#[0-9A-F]{6}$'
    or v_accent !~ '^#[0-9A-F]{6}$'
  then
    raise exception 'Une ou plusieurs couleurs du maillot sont invalides.';
  end if;

  if v_primary = v_secondary and v_secondary = v_accent then
    raise exception 'Le maillot doit utiliser au moins deux couleurs différentes.';
  end if;

  select team.*
  into v_team
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.teams as team
    on team.id = assignment.team_id
   and team.status = 'active'
  where director.auth_user_id = v_auth_user_id
    and director.status = 'active'
  order by assignment.created_at desc
  limit 1
  for update of team;

  if not found then
    raise exception 'Aucune équipe active ne peut recevoir ce maillot.';
  end if;

  if v_team.amateur_identity_configured_at is null
    or nullif(btrim(v_team.amateur_name), '') is null
  then
    raise exception 'Fondez d abord l identité amateur de l équipe.';
  end if;

  update public.teams
  set
    amateur_jersey_pattern = v_pattern,
    amateur_jersey_primary_color = v_primary,
    amateur_jersey_secondary_color = v_secondary,
    amateur_jersey_accent_color = v_accent
  where id = v_team.id;

  return jsonb_build_object(
    'team_id', v_team.id,
    'pattern', v_pattern,
    'primary_color', v_primary,
    'secondary_color', v_secondary,
    'accent_color', v_accent
  );
end;
$$;

revoke all
on function public.update_current_team_amateur_jersey(text, text, text, text)
from public, anon;

grant execute
on function public.update_current_team_amateur_jersey(text, text, text, text)
to authenticated;

comment on function public.update_current_team_amateur_jersey(text, text, text, text) is
  'Permet au Directeur Sportif actif de modifier le maillot amateur permanent de son équipe.';

create or replace function public.initialize_sporting_director_career_v2(
  p_rider_identities jsonb,
  p_team_name text,
  p_team_country_id uuid,
  p_jersey_pattern text,
  p_jersey_primary_color text,
  p_jersey_secondary_color text,
  p_jersey_accent_color text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  v_result := public.initialize_sporting_director_career(
    p_rider_identities,
    p_team_name,
    p_team_country_id,
    case
      when lower(btrim(coalesce(p_jersey_pattern, ''))) in (
        'classic', 'diagonal', 'hoops', 'split'
      ) then p_jersey_pattern
      else 'classic'
    end,
    p_jersey_primary_color,
    p_jersey_secondary_color,
    p_jersey_accent_color
  );

  perform public.update_current_team_amateur_jersey(
    p_jersey_pattern,
    p_jersey_primary_color,
    p_jersey_secondary_color,
    p_jersey_accent_color
  );

  return v_result;
end;
$$;

revoke all
on function public.initialize_sporting_director_career_v2(jsonb, text, uuid, text, text, text, text)
from public, anon;

grant execute
on function public.initialize_sporting_director_career_v2(jsonb, text, uuid, text, text, text, text)
to authenticated;

comment on function public.initialize_sporting_director_career_v2(jsonb, text, uuid, text, text, text, text) is
  'Fonde la carrière puis applique l un des douze motifs de maillot disponibles.';

commit;
