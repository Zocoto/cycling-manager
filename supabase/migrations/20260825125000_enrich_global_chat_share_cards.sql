begin;

alter table public.global_chat_messages
  add column preview_public_identifier text,
  add column preview_country_name text,
  add column preview_country_code text,
  add column preview_age smallint,
  add column preview_avatar_profile_key text,
  add column preview_avatar_seed bigint,
  add column preview_avatar_key text,
  add column preview_avatar_frame_key text,
  add column preview_team_id uuid references public.teams(id) on delete set null,
  add column preview_team_primary_color text,
  add column preview_team_secondary_color text,
  add column preview_team_accent_color text,
  add column preview_jersey_pattern text,
  add column preview_jersey_status text;

alter table public.global_chat_messages
  drop constraint global_chat_messages_preview_complete,
  add constraint global_chat_messages_preview_complete
    check (
      (
        preview_type is null
        and preview_entity_id is null
        and preview_title is null
        and preview_subtitle is null
      )
      or (
        preview_type in ('team', 'rider', 'director')
        and preview_entity_id is not null
        and preview_title is not null
        and preview_subtitle is not null
        and btrim(preview_title) <> ''
        and btrim(preview_subtitle) <> ''
      )
    ),
  add constraint global_chat_messages_preview_age_valid
    check (preview_age is null or preview_age between 15 and 80),
  add constraint global_chat_messages_preview_country_code_valid
    check (
      preview_country_code is null
      or preview_country_code ~ '^[A-Z]{2}$'
    ),
  add constraint global_chat_messages_preview_public_identifier_valid
    check (
      preview_public_identifier is null
      or btrim(preview_public_identifier) <> ''
    ),
  add constraint global_chat_messages_preview_team_colors_valid
    check (
      (preview_team_primary_color is null or preview_team_primary_color ~ '^#[0-9A-F]{6}$')
      and (preview_team_secondary_color is null or preview_team_secondary_color ~ '^#[0-9A-F]{6}$')
      and (preview_team_accent_color is null or preview_team_accent_color ~ '^#[0-9A-F]{6}$')
    ),
  add constraint global_chat_messages_preview_jersey_pattern_valid
    check (
      preview_jersey_pattern is null
      or preview_jersey_pattern in (
        'center', 'diagonal', 'hoops', 'solid', 'split', 'vertical',
        'chevron', 'quarters', 'cross', 'shoulders', 'checkerboard',
        'wave', 'pinstripes'
      )
    ),
  add constraint global_chat_messages_preview_jersey_status_valid
    check (
      preview_jersey_status is null
      or preview_jersey_status in ('amateur', 'free-agent', 'sponsored')
    );

-- Les fiches publiques de Directeurs Sportifs rejoignent les deux types de
-- liens internes déjà autorisés. Tous les autres domaines restent bloqués.
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
    '((https://(www\.)?|www\.)?cyclostratege\.fr)?/jeu/((equipes|coureurs)/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|directeurs-sportifs/[^[:space:]<]+)([^[:space:]<]*)?',
    ' ',
    'gi'
  );

  if v_without_allowed_links ~* '(https?://|www\.)'
    or v_without_allowed_links ~* '(^|[[:space:]<(])([[:alnum:]-]+\.)+[[:alpha:]]{2,}(/[^[:space:]<]*)?'
  then
    raise exception
      'Seuls les liens Cyclo Stratège vers une fiche coureur, équipe ou DS sont autorisés.';
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
    '((https://(www\.)?|www\.)?cyclostratege\.fr)?/jeu/((equipes|coureurs)/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|directeurs-sportifs/[^[:space:]<]+)([^[:space:]<]*)?',
    ' ',
    'gi'
  );

  if v_without_allowed_links ~* '(https?://|www\.)'
    or v_without_allowed_links ~* '(^|[[:space:]<(])([[:alnum:]-]+\.)+[[:alpha:]]{2,}(/[^[:space:]<]*)?'
  then
    raise exception
      'Seuls les liens Cyclo Stratège vers une fiche coureur, équipe ou DS sont autorisés.';
  end if;

  return new;
end;
$$;

-- La version 4 conserve un instantané graphique dans le message. Le coût de
-- résolution est payé une seule fois à l’envoi, jamais pendant le défilement.
create or replace function public.post_global_chat_message_v4(
  p_message text,
  p_preview_type text default null,
  p_preview_entity_identifier text default null,
  p_reply_to_message_id uuid default null,
  p_mentioned_sporting_director_ids uuid[] default array[]::uuid[],
  p_preview_team_primary_color text default null,
  p_preview_team_secondary_color text default null,
  p_preview_team_accent_color text default null,
  p_preview_jersey_pattern text default null,
  p_preview_jersey_status text default null
)
returns public.global_chat_messages
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_preview_uuid uuid;
  v_result public.global_chat_messages;
  v_director_id uuid;
  v_director_username text;
  v_director_display_name text;
  v_director_avatar_key text;
  v_director_avatar_frame_key text;
  v_team_id uuid;
  v_team_name text;
  v_country_name text;
  v_country_code text;
  v_age smallint;
  v_avatar_profile_key text;
  v_avatar_seed bigint;
  v_fallback_primary text;
  v_fallback_secondary text;
  v_fallback_accent text;
  v_fallback_pattern text;
begin
  if p_preview_type in ('team', 'rider')
    and coalesce(p_preview_entity_identifier, '')
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    v_preview_uuid := p_preview_entity_identifier::uuid;
  end if;

  v_result := public.post_global_chat_message_v3(
    p_message,
    case when v_preview_uuid is not null then p_preview_type else null end,
    v_preview_uuid,
    p_reply_to_message_id,
    p_mentioned_sporting_director_ids
  );

  if v_result.preview_type = 'rider' then
    select
      country.name,
      upper(country.iso_alpha2),
      active_rating.age,
      rider.avatar_profile_key,
      rider.avatar_seed,
      rider_contract.team_id,
      coalesce(current_team.amateur_jersey_primary_color, '#6B7280'),
      coalesce(current_team.amateur_jersey_secondary_color, '#D1D5DB'),
      coalesce(current_team.amateur_jersey_accent_color, '#F3F4F6'),
      case
        when current_team.amateur_jersey_pattern = 'classic' then 'center'
        else coalesce(current_team.amateur_jersey_pattern, 'solid')
      end
    into
      v_country_name,
      v_country_code,
      v_age,
      v_avatar_profile_key,
      v_avatar_seed,
      v_team_id,
      v_fallback_primary,
      v_fallback_secondary,
      v_fallback_accent,
      v_fallback_pattern
    from public.riders as rider
    join public.countries as country on country.id = rider.country_id
    left join public.rider_contracts as rider_contract
      on rider_contract.rider_id = rider.id
     and rider_contract.status = 'active'
    left join public.teams as current_team on current_team.id = rider_contract.team_id
    left join lateral (
      select rating.age
      from public.rider_season_ratings as rating
      join public.seasons as season
        on season.id = rating.season_id
       and season.status = 'active'
      where rating.rider_id = rider.id
      limit 1
    ) as active_rating on true
    where rider.id = v_result.preview_entity_id;

    update public.global_chat_messages
    set
      preview_public_identifier = v_result.preview_entity_id::text,
      preview_country_name = v_country_name,
      preview_country_code = v_country_code,
      preview_age = v_age,
      preview_avatar_profile_key = v_avatar_profile_key,
      preview_avatar_seed = v_avatar_seed,
      preview_team_id = v_team_id,
      preview_team_primary_color = case
        when coalesce(p_preview_team_primary_color, '') ~ '^#[0-9A-Fa-f]{6}$'
          then upper(p_preview_team_primary_color)
        else v_fallback_primary
      end,
      preview_team_secondary_color = case
        when coalesce(p_preview_team_secondary_color, '') ~ '^#[0-9A-Fa-f]{6}$'
          then upper(p_preview_team_secondary_color)
        else v_fallback_secondary
      end,
      preview_team_accent_color = case
        when coalesce(p_preview_team_accent_color, '') ~ '^#[0-9A-Fa-f]{6}$'
          then upper(p_preview_team_accent_color)
        else v_fallback_accent
      end,
      preview_jersey_pattern = case
        when p_preview_jersey_pattern in (
          'center', 'diagonal', 'hoops', 'solid', 'split', 'vertical',
          'chevron', 'quarters', 'cross', 'shoulders', 'checkerboard',
          'wave', 'pinstripes'
        ) then p_preview_jersey_pattern
        else v_fallback_pattern
      end,
      preview_jersey_status = case
        when v_team_id is null then 'free-agent'
        when p_preview_jersey_status in ('amateur', 'sponsored')
          then p_preview_jersey_status
        else 'amateur'
      end
    where id = v_result.id
    returning * into v_result;

  elsif v_result.preview_type = 'team' then
    select
      country.name,
      upper(country.iso_alpha2),
      team.id,
      manager.avatar_key,
      manager.avatar_frame_key,
      team.amateur_jersey_primary_color,
      team.amateur_jersey_secondary_color,
      team.amateur_jersey_accent_color,
      case
        when team.amateur_jersey_pattern = 'classic' then 'center'
        else team.amateur_jersey_pattern
      end
    into
      v_country_name,
      v_country_code,
      v_team_id,
      v_director_avatar_key,
      v_director_avatar_frame_key,
      v_fallback_primary,
      v_fallback_secondary,
      v_fallback_accent,
      v_fallback_pattern
    from public.teams as team
    join public.countries as country on country.id = team.home_country_id
    left join public.team_manager_assignments as assignment
      on assignment.team_id = team.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    left join public.sporting_directors as manager
      on manager.id = assignment.sporting_director_id
    where team.id = v_result.preview_entity_id;

    update public.global_chat_messages
    set
      preview_public_identifier = v_result.preview_entity_id::text,
      preview_country_name = v_country_name,
      preview_country_code = v_country_code,
      preview_avatar_key = v_director_avatar_key,
      preview_avatar_frame_key = v_director_avatar_frame_key,
      preview_team_id = v_team_id,
      preview_team_primary_color = case
        when coalesce(p_preview_team_primary_color, '') ~ '^#[0-9A-Fa-f]{6}$'
          then upper(p_preview_team_primary_color)
        else v_fallback_primary
      end,
      preview_team_secondary_color = case
        when coalesce(p_preview_team_secondary_color, '') ~ '^#[0-9A-Fa-f]{6}$'
          then upper(p_preview_team_secondary_color)
        else v_fallback_secondary
      end,
      preview_team_accent_color = case
        when coalesce(p_preview_team_accent_color, '') ~ '^#[0-9A-Fa-f]{6}$'
          then upper(p_preview_team_accent_color)
        else v_fallback_accent
      end,
      preview_jersey_pattern = case
        when p_preview_jersey_pattern in (
          'center', 'diagonal', 'hoops', 'solid', 'split', 'vertical',
          'chevron', 'quarters', 'cross', 'shoulders', 'checkerboard',
          'wave', 'pinstripes'
        ) then p_preview_jersey_pattern
        else v_fallback_pattern
      end,
      preview_jersey_status = case
        when p_preview_jersey_status in ('amateur', 'sponsored')
          then p_preview_jersey_status
        else 'amateur'
      end
    where id = v_result.id
    returning * into v_result;

  elsif p_preview_type = 'director'
    and coalesce(btrim(p_preview_entity_identifier), '') <> ''
    and lower(v_result.message) like '%/jeu/directeurs-sportifs/%'
  then
    select
      director.id,
      director.username,
      director.display_name,
      director.avatar_key,
      director.avatar_frame_key,
      assignment.team_id,
      coalesce(
        current_team_season.display_name,
        nullif(btrim(team.amateur_name), ''),
        team.internal_name
      ),
      country.name,
      upper(country.iso_alpha2),
      coalesce(team.amateur_jersey_primary_color, '#6B7280'),
      coalesce(team.amateur_jersey_secondary_color, '#D1D5DB'),
      coalesce(team.amateur_jersey_accent_color, '#F3F4F6'),
      case
        when team.amateur_jersey_pattern = 'classic' then 'center'
        else coalesce(team.amateur_jersey_pattern, 'solid')
      end
    into
      v_director_id,
      v_director_username,
      v_director_display_name,
      v_director_avatar_key,
      v_director_avatar_frame_key,
      v_team_id,
      v_team_name,
      v_country_name,
      v_country_code,
      v_fallback_primary,
      v_fallback_secondary,
      v_fallback_accent,
      v_fallback_pattern
    from public.sporting_directors as director
    left join public.countries as country on country.id = director.country_id
    left join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    left join public.teams as team on team.id = assignment.team_id
    left join lateral (
      select team_season.display_name
      from public.team_seasons as team_season
      where team_season.team_id = team.id
        and team_season.status in ('planned', 'active')
      order by
        case when team_season.status = 'active' then 0 else 1 end,
        team_season.created_at desc
      limit 1
    ) as current_team_season on true
    where director.status = 'active'
      and (
        lower(director.username) = lower(btrim(p_preview_entity_identifier))
        or director.id::text = lower(btrim(p_preview_entity_identifier))
      )
    order by
      case
        when lower(director.username) = lower(btrim(p_preview_entity_identifier))
          then 0
        else 1
      end
    limit 1;

    if v_director_id is not null then
      update public.global_chat_messages
      set
        preview_type = 'director',
        preview_entity_id = v_director_id,
        preview_public_identifier = v_director_username,
        preview_title = v_director_display_name,
        preview_subtitle = case
          when v_team_name is not null
            then '@' || v_director_username || ' · ' || v_team_name
          else '@' || v_director_username
        end,
        preview_country_name = v_country_name,
        preview_country_code = v_country_code,
        preview_avatar_key = v_director_avatar_key,
        preview_avatar_frame_key = v_director_avatar_frame_key,
        preview_team_id = v_team_id,
        preview_team_primary_color = case
          when coalesce(p_preview_team_primary_color, '') ~ '^#[0-9A-Fa-f]{6}$'
            then upper(p_preview_team_primary_color)
          else v_fallback_primary
        end,
        preview_team_secondary_color = case
          when coalesce(p_preview_team_secondary_color, '') ~ '^#[0-9A-Fa-f]{6}$'
            then upper(p_preview_team_secondary_color)
          else v_fallback_secondary
        end,
        preview_team_accent_color = case
          when coalesce(p_preview_team_accent_color, '') ~ '^#[0-9A-Fa-f]{6}$'
            then upper(p_preview_team_accent_color)
          else v_fallback_accent
        end,
        preview_jersey_pattern = case
          when p_preview_jersey_pattern in (
            'center', 'diagonal', 'hoops', 'solid', 'split', 'vertical',
            'chevron', 'quarters', 'cross', 'shoulders', 'checkerboard',
            'wave', 'pinstripes'
          ) then p_preview_jersey_pattern
          else v_fallback_pattern
        end,
        preview_jersey_status = case
          when p_preview_jersey_status in ('amateur', 'sponsored')
            then p_preview_jersey_status
          else 'amateur'
        end
      where id = v_result.id
      returning * into v_result;
    end if;
  end if;

  return v_result;
end;
$$;

-- Les messages historiques bénéficient immédiatement du portrait et de la
-- nationalité. Leur palette retombe sur le maillot d’équipe conservé en base.
update public.global_chat_messages as message
set
  preview_public_identifier = rider.id::text,
  preview_country_name = country.name,
  preview_country_code = upper(country.iso_alpha2),
  preview_age = active_rating.age,
  preview_avatar_profile_key = rider.avatar_profile_key,
  preview_avatar_seed = rider.avatar_seed,
  preview_team_id = rider_contract.team_id,
  preview_team_primary_color = coalesce(team.amateur_jersey_primary_color, '#6B7280'),
  preview_team_secondary_color = coalesce(team.amateur_jersey_secondary_color, '#D1D5DB'),
  preview_team_accent_color = coalesce(team.amateur_jersey_accent_color, '#F3F4F6'),
  preview_jersey_pattern = case
    when team.amateur_jersey_pattern = 'classic' then 'center'
    else coalesce(team.amateur_jersey_pattern, 'solid')
  end,
  preview_jersey_status = case
    when rider_contract.team_id is null then 'free-agent'
    else 'amateur'
  end
from public.riders as rider
join public.countries as country on country.id = rider.country_id
left join public.rider_contracts as rider_contract
  on rider_contract.rider_id = rider.id
 and rider_contract.status = 'active'
left join public.teams as team on team.id = rider_contract.team_id
left join lateral (
  select rating.age
  from public.rider_season_ratings as rating
  join public.seasons as season
    on season.id = rating.season_id
   and season.status = 'active'
  where rating.rider_id = rider.id
  limit 1
) as active_rating on true
where message.preview_type = 'rider'
  and message.preview_entity_id = rider.id;

update public.global_chat_messages as message
set
  preview_public_identifier = team.id::text,
  preview_country_name = country.name,
  preview_country_code = upper(country.iso_alpha2),
  preview_avatar_key = manager.avatar_key,
  preview_avatar_frame_key = manager.avatar_frame_key,
  preview_team_id = team.id,
  preview_team_primary_color = team.amateur_jersey_primary_color,
  preview_team_secondary_color = team.amateur_jersey_secondary_color,
  preview_team_accent_color = team.amateur_jersey_accent_color,
  preview_jersey_pattern = case
    when team.amateur_jersey_pattern = 'classic' then 'center'
    else team.amateur_jersey_pattern
  end,
  preview_jersey_status = 'amateur'
from public.teams as team
join public.countries as country on country.id = team.home_country_id
left join public.team_manager_assignments as assignment
  on assignment.team_id = team.id
 and assignment.role = 'general_manager'
 and assignment.status = 'active'
left join public.sporting_directors as manager
  on manager.id = assignment.sporting_director_id
where message.preview_type = 'team'
  and message.preview_entity_id = team.id;

revoke all on function public.post_global_chat_message_v4(
  text, text, text, uuid, uuid[], text, text, text, text, text
)
from public, anon;

grant execute on function public.post_global_chat_message_v4(
  text, text, text, uuid, uuid[], text, text, text, text, text
)
to authenticated, service_role;

comment on function public.post_global_chat_message_v4(
  text, text, text, uuid, uuid[], text, text, text, text, text
) is
  'Publie un message global et conserve une mini-fiche visuelle autonome pour les coureurs, équipes et Directeurs Sportifs partagés.';

notify pgrst, 'reload schema';

commit;
