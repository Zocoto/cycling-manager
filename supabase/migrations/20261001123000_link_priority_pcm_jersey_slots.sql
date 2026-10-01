-- Reuse seven PCM26 jersey slots that already exist in the WorldDB asset
-- registry. The team ids stay permanent: a future sponsor rename therefore
-- keeps pointing at the same graphical slot.
update public.teams
set pcm_asset_code = mapping.pcm_asset_code
from (
  values
    ('f2e292c0-0c9e-41a2-8cd8-ed2a6bf83b57'::uuid, 'mov'::text),
    ('96b66063-c5f7-4115-8be6-807c68a184bf'::uuid, 'dct'::text),
    ('6d29ce14-c55f-4e3e-bd73-59f410484210'::uuid, 'gfc'::text),
    ('0ceb562b-737c-4650-8e70-5570a915dc41'::uuid, 'soq'::text),
    ('caea0559-e3a6-408b-9e2f-4a7755859dd6'::uuid, 'apt'::text),
    ('cb8d8f3b-65c7-44c5-a3f6-8bf108a4bf2e'::uuid, 'uex'::text),
    ('a81d26fc-5b1f-4267-8c60-073d53389733'::uuid, 'tvl'::text)
) as mapping(team_id, pcm_asset_code)
where teams.id = mapping.team_id
  and teams.pcm_asset_code is distinct from mapping.pcm_asset_code;

