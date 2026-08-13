alter table public.sponsor_offers
  add column if not exists generation_version smallint not null default 1;

alter table public.sponsor_offers
  drop constraint if exists sponsor_offers_generation_version_positive;

alter table public.sponsor_offers
  add constraint sponsor_offers_generation_version_positive
  check (generation_version >= 1);

comment on column public.sponsor_offers.generation_version is
  'Version des r?gles de prestige et de ciblage national utilis?es pour g?n?rer l''offre.';
