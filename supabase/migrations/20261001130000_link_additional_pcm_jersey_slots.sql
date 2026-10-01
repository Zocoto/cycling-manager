-- Link the latest four validated S4 sponsor jerseys to stable PCM26 WorldDB
-- slots. Permanent team ids keep the graphical link across sponsor renames.
update public.teams
set pcm_asset_code = mapping.pcm_asset_code
from (
  values
    ('20bcbcf8-7f09-42b7-b4be-ce77d4aade10'::uuid, 'igd'::text),
    ('ac9c6a66-e4ee-404e-bf9d-0665a6515640'::uuid, 'dft'::text),
    ('ac3691bf-5539-4243-b0f1-69385f340391'::uuid, 'nsn'::text),
    ('ad506cc8-91ff-4306-a30f-b1397e2154a5'::uuid, 'vbg'::text)
) as mapping(team_id, pcm_asset_code)
where teams.id = mapping.team_id
  and teams.pcm_asset_code is distinct from mapping.pcm_asset_code;
