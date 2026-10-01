begin;

update public.teams as teams
set pcm_asset_code = mapping.pcm_asset_code
from (
  values
    ('e8e4d1f4-84cd-4bf7-a0d6-c8015372cad3'::uuid, 'adr'::text),
    ('a55c21a5-135e-40dc-b8f6-497c5258b411'::uuid, 'kcr'::text),
    ('89df3cc9-9e81-4c36-8882-c19abb49ea0e'::uuid, 'vrr'::text),
    ('392ac09a-b638-401f-904c-f18bc46be3e1'::uuid, 'aub'::text),
    ('21f9b80f-5edd-488a-8fc0-3f30da77be55'::uuid, 'tfb'::text),
    ('e3af168e-ea5b-433c-83b3-680429ad0162'::uuid, 'ekp'::text),
    ('817db772-6373-4b4a-bb01-a78b1107d546'::uuid, 'bcs'::text),
    ('61c5aac7-4917-48ed-b861-ebf5eea2d754'::uuid, 'bbh'::text)
) as mapping(team_id, pcm_asset_code)
where teams.id = mapping.team_id
  and teams.pcm_asset_code is distinct from mapping.pcm_asset_code;

commit;
