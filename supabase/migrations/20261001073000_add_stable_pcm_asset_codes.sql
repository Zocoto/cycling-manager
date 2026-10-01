alter table public.teams
  add column if not exists pcm_asset_code text;

update public.teams
set pcm_asset_code = 'apt'
where id = 'caea0559-e3a6-408b-9e2f-4a7755859dd6'::uuid
  and pcm_asset_code is null;

alter table public.teams
  drop constraint if exists teams_pcm_asset_code_format;

alter table public.teams
  add constraint teams_pcm_asset_code_format
  check (pcm_asset_code is null or pcm_asset_code ~ '^[a-z]{3}$');

create unique index if not exists teams_pcm_asset_code_key
  on public.teams (pcm_asset_code)
  where pcm_asset_code is not null;

comment on column public.teams.pcm_asset_code is
  'Stable PCM graphical slot. It survives sponsor and display-name changes so every new export reconnects to the installed asset pack automatically.';
