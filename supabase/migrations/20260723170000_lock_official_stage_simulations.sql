begin;

create table public.official_stage_simulations (
  stage_id uuid primary key
    references public.stages(id) on delete cascade,
  race_edition_id uuid not null
    references public.race_editions(id) on delete cascade,
  engine_version text not null,
  seed text not null,
  input_data jsonb not null,
  simulation_data jsonb not null,
  created_at timestamptz not null default now(),
  constraint official_stage_simulations_engine_version_not_blank
    check (btrim(engine_version) <> ''),
  constraint official_stage_simulations_seed_not_blank
    check (btrim(seed) <> '')
);

create index official_stage_simulations_edition_idx
  on public.official_stage_simulations (race_edition_id, stage_id);

alter table public.official_stage_simulations enable row level security;

create policy official_stage_simulations_read_authenticated
on public.official_stage_simulations
for select
to authenticated
using (true);

grant select on table public.official_stage_simulations to authenticated;
grant all privileges on table public.official_stage_simulations to service_role;

comment on table public.official_stage_simulations is
  'Scénario officiel immuable de chaque étape, partagé par tous les spectateurs et réutilisé pour les résultats.';
comment on column public.official_stage_simulations.simulation_data is
  'Chronologie, incidents, primes et classement produits une seule fois par la version enregistrée du moteur.';

commit;
