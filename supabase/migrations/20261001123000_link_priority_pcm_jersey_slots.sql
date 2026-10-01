-- Reuse seventeen PCM26 jersey slots that already exist in the WorldDB asset
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
    ('a81d26fc-5b1f-4267-8c60-073d53389733'::uuid, 'tvl'::text),
    ('7ba5ff3b-d8cf-46ac-b82b-a53b34fed827'::uuid, 'jay'::text),
    ('34026dd0-77b0-46d8-94ba-fd3256c8df79'::uuid, 'ten'::text),
    ('35061203-aa19-4986-83e1-b227cea4ecb5'::uuid, 'nci'::text),
    ('b5fd7b9a-a254-4e41-9428-3cd1b2bf90fc'::uuid, 'efe'::text),
    ('c9db310c-1a90-4df5-9f78-fd48c8147425'::uuid, 'tbv'::text),
    ('69b20e97-b88b-4c8c-b98b-b0fd28939913'::uuid, 'xat'::text),
    ('8de6e531-3cd5-4d5e-beba-34fd54dc5ea1'::uuid, 'ltk'::text),
    ('12277621-b716-4b0c-934a-f1a0b52364ba'::uuid, 'tpp'::text),
    ('bb7c87bd-a474-4260-8f85-f349849683f3'::uuid, 'pqt'::text),
    ('52cf9278-cb70-4ed1-9c76-ae7263be8d70'::uuid, 'loi'::text)
) as mapping(team_id, pcm_asset_code)
where teams.id = mapping.team_id
  and teams.pcm_asset_code is distinct from mapping.pcm_asset_code;
