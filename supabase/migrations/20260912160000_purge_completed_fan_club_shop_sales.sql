-- Keep only the current season's detailed Fan Club shop sales.
-- Career-objective progress is retained as one compact row per standard product.

begin;

create table public.fan_club_shop_product_milestones (
  team_id uuid not null references public.teams(id) on delete cascade,
  product_code text not null,
  first_sold_at timestamptz not null default now(),
  primary key (team_id, product_code),
  constraint fan_club_shop_product_milestone_allowed check (
    product_code in (
      'team-jersey',
      'bottle',
      'pennant',
      'cap',
      'supporter-balloon'
    )
  )
);

alter table public.fan_club_shop_product_milestones enable row level security;

grant all privileges on table public.fan_club_shop_product_milestones
  to service_role;

insert into public.fan_club_shop_product_milestones (
  team_id,
  product_code,
  first_sold_at
)
select
  sale.team_id,
  sale.product_code,
  min(sale.created_at)
from public.fan_club_shop_sales as sale
where sale.product_code in (
  'team-jersey',
  'bottle',
  'pennant',
  'cap',
  'supporter-balloon'
)
group by sale.team_id, sale.product_code
on conflict (team_id, product_code) do nothing;

create or replace function private.remember_fan_club_shop_product_sale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.product_code in (
    'team-jersey',
    'bottle',
    'pennant',
    'cap',
    'supporter-balloon'
  ) then
    insert into public.fan_club_shop_product_milestones (
      team_id,
      product_code,
      first_sold_at
    )
    values (new.team_id, new.product_code, new.created_at)
    on conflict (team_id, product_code) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists remember_fan_club_shop_product_sale
  on public.fan_club_shop_sales;
create trigger remember_fan_club_shop_product_sale
after insert on public.fan_club_shop_sales
for each row execute function private.remember_fan_club_shop_product_sale();

alter function public.calculate_game_objective_progress(
  text,
  uuid,
  uuid,
  numeric
)
rename to calculate_game_objective_progress_pre_fan_club_sales_retention;

create function public.calculate_game_objective_progress(
  p_metric_key text,
  p_director_id uuid,
  p_current_team_id uuid,
  p_experience_points numeric
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_metric_key = 'fan_club_products_sold' then
    return (
      select count(*)::integer
      from public.fan_club_shop_product_milestones as milestone
      where milestone.team_id = p_current_team_id
    );
  end if;

  return public.calculate_game_objective_progress_pre_fan_club_sales_retention(
    p_metric_key,
    p_director_id,
    p_current_team_id,
    p_experience_points
  );
end;
$$;

revoke all on function public.calculate_game_objective_progress_pre_fan_club_sales_retention(
  text,
  uuid,
  uuid,
  numeric
) from public, anon, authenticated;
grant execute on function public.calculate_game_objective_progress_pre_fan_club_sales_retention(
  text,
  uuid,
  uuid,
  numeric
) to service_role;

revoke all on function public.calculate_game_objective_progress(
  text,
  uuid,
  uuid,
  numeric
) from public, anon;
grant execute on function public.calculate_game_objective_progress(
  text,
  uuid,
  uuid,
  numeric
) to authenticated, service_role;

create index fan_club_shop_sales_season_idx
  on public.fan_club_shop_sales (season_id);

create or replace function private.purge_completed_fan_club_shop_sales()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed'
     and old.status is distinct from 'completed' then
    delete from public.fan_club_shop_sales as sale
    where sale.season_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists zzz_purge_completed_fan_club_shop_sales
  on public.seasons;
create trigger zzz_purge_completed_fan_club_shop_sales
after update of status on public.seasons
for each row execute function private.purge_completed_fan_club_shop_sales();

do $cleanup_completed_fan_club_shop_sales$
declare
  v_deleted_rows integer;
begin
  delete from public.fan_club_shop_sales as sale
  using public.seasons as season
  where season.id = sale.season_id
    and season.status = 'completed';

  get diagnostics v_deleted_rows = row_count;
  raise notice
    'Purged % detailed Fan Club shop sale row(s) from completed seasons.',
    v_deleted_rows;
end;
$cleanup_completed_fan_club_shop_sales$;

comment on table public.fan_club_shop_product_milestones is
  'Compact career progress for the five standard Fan Club shop product families; detailed sales remain seasonal.';

comment on function private.purge_completed_fan_club_shop_sales() is
  'Deletes detailed Fan Club shop sales once their season is completed; financial transactions and compact product milestones are retained.';

commit;
