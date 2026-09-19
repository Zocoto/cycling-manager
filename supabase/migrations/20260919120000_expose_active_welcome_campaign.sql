begin;

create or replace function public.get_active_public_welcome_campaign()
returns table (
  campaign_code text,
  starts_at timestamptz,
  ends_at timestamptz,
  extra_starting_cash numeric,
  scout_level smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    campaign.code,
    campaign.starts_at,
    campaign.ends_at,
    campaign.extra_starting_cash,
    campaign.scout_level
  from private.new_director_welcome_campaigns as campaign
  where statement_timestamp() >= campaign.starts_at
    and statement_timestamp() < campaign.ends_at
  order by campaign.ends_at asc
  limit 1;
$$;

revoke all on function public.get_active_public_welcome_campaign()
from public, anon, authenticated;

grant execute on function public.get_active_public_welcome_campaign()
to service_role;

comment on function public.get_active_public_welcome_campaign() is
  'Expose au serveur web uniquement la campagne de bienvenue actuellement active, sans ouvrir les tables privées.';

commit;
