-- Link Kilimanjaro SkyLink's selected S4 Kigali SafeRide jersey to a stable
-- PCM26 WorldDB graphical slot. The permanent team id keeps that link when a
-- later sponsor changes the team's display name.
update public.teams
set pcm_asset_code = 'ges'
where id = '27948dd4-0dac-416d-8f6c-118771bcb6eb'::uuid
  and pcm_asset_code is distinct from 'ges';
