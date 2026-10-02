-- Link Vss's selected S4 Mistralys Automobiles jersey to a stable PCM26
-- WorldDB graphical slot. The permanent team id keeps the link stable when
-- the sponsor changes the team's display name in the next season.
update public.teams
set pcm_asset_code = 'aar'
where id = '7eb41736-c414-4ac7-91ea-fb6c7e669f04'::uuid
  and pcm_asset_code is distinct from 'aar';
