begin;

-- The welcome boost used the retired relational rider-name catalog. Name
-- libraries have lived in server-side JSON files since 20260717075900, so a
-- database trigger must not depend on that former relation. Reuse one of the
-- seven riders already created in the same transaction instead.
--
-- The campaign is an optional bonus. Its trigger must fail open so a future
-- issue in the gift itself can never roll back the player's whole career.
create or replace function private.grant_new_director_welcome_boost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign private.new_director_welcome_campaigns%rowtype;
  v_auth_user_id uuid;
  v_registered_at timestamptz;
  v_team_country_id uuid;
  v_currency_code text;
  v_first_name text;
  v_last_name text;
  v_talent_code text;
  v_scout_member_id uuid;
  v_scout_contract_id uuid;
begin
  begin
    select campaign.* into v_campaign
    from private.new_director_welcome_campaigns as campaign
    where campaign.code = 'welcome_week_2026_09';

    if not found then
      return new;
    end if;

    select director.auth_user_id, account.created_at, team.home_country_id,
      team_season.currency_code
    into v_auth_user_id, v_registered_at, v_team_country_id,
      v_currency_code
    from public.sporting_directors as director
    join auth.users as account on account.id = director.auth_user_id
    join public.teams as team on team.id = new.team_id
    join public.team_seasons as team_season
      on team_season.team_id = new.team_id
     and team_season.season_id = new.season_id
    where director.id = new.sporting_director_id;

    if not found
      or v_registered_at < v_campaign.starts_at
      or v_registered_at >= v_campaign.ends_at
    then
      return new;
    end if;

    if exists (
      select 1 from private.new_director_welcome_grants as award
      where award.generation_id = new.id
        or award.auth_user_id = v_auth_user_id
        or award.team_id = new.team_id
    ) then
      return new;
    end if;

    -- The initial roster is complete before initial_career_generations is
    -- inserted. It therefore supplies a country-appropriate name without a
    -- database copy of the JSON name catalog.
    select rider.first_name, rider.last_name
    into v_first_name, v_last_name
    from public.rider_contracts as contract
    join public.riders as rider on rider.id = contract.rider_id
    where contract.team_id = new.team_id
      and contract.start_season_id = new.season_id
    order by random()
    limit 1;

    -- This fallback should never be needed because career creation validates
    -- that seven riders were inserted. It keeps the optional gift harmless if
    -- the creation order evolves later.
    v_first_name := coalesce(nullif(btrim(v_first_name), ''), 'Alex');
    v_last_name := coalesce(nullif(btrim(v_last_name), ''), 'Martin');

    select talent.code into v_talent_code
    from public.staff_talent_catalog as talent
    where talent.role = 'scout'
      and talent.is_active
    order by random()
    limit 1;

    if v_talent_code is null then
      raise exception 'Impossible de générer le scout de bienvenue pour cette équipe.';
    end if;

    insert into private.new_director_welcome_grants (
      generation_id, auth_user_id, team_id, season_id, campaign_code,
      extra_starting_cash
    ) values (
      new.id, v_auth_user_id, new.team_id, new.season_id, v_campaign.code,
      v_campaign.extra_starting_cash
    );

    update public.team_seasons as team_season
    set opening_cash_balance = team_season.opening_cash_balance + v_campaign.extra_starting_cash,
        cash_balance = team_season.cash_balance + v_campaign.extra_starting_cash
    where team_season.team_id = new.team_id
      and team_season.season_id = new.season_id;

    if not found then
      raise exception 'La saison de l’équipe initiale est introuvable pour le bonus de bienvenue.';
    end if;

    insert into public.staff_members (
      country_id, first_name, last_name, role, level
    ) values (
      v_team_country_id, v_first_name, v_last_name, 'scout', v_campaign.scout_level
    ) returning id into v_scout_member_id;

    insert into public.staff_member_talents (
      staff_member_id, slot_number, talent_code, unlocked_by
    ) values (
      v_scout_member_id, 1, v_talent_code, 'generation'
    );

    insert into public.staff_contracts (
      staff_member_id, team_id, start_season_id, salary_per_season,
      currency_code, signing_fee, status
    ) values (
      v_scout_member_id, new.team_id, new.season_id,
      public.calculate_staff_salary('scout', v_campaign.scout_level),
      v_currency_code, 0, 'active'
    ) returning id into v_scout_contract_id;

    update private.new_director_welcome_grants
    set scout_member_id = v_scout_member_id,
        scout_contract_id = v_scout_contract_id
    where generation_id = new.id;
  exception
    when others then
      -- All bonus writes in the protected block are rolled back together,
      -- while the initial team creation transaction remains valid.
      raise warning 'Bonus de bienvenue ignoré pour la génération % [%]: %',
        new.id, sqlstate, sqlerrm;
      return new;
  end;

  return new;
end;
$$;

comment on function private.grant_new_director_welcome_boost() is
  'Attribue le bonus de bienvenue sans jamais pouvoir bloquer la création de carrière.';

commit;
