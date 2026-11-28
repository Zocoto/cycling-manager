begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- The draw uses importance. Keep the care payload intact so existing
-- consumables keep their effect and group with equivalent items.
update public.daily_reward_catalog as reward
set importance = level.importance
from (values
  ('golden-ticket', 'wildcard', 6),
  ('injury-care-cryotherapy-pack', 'injury_care', 1),
  ('injury-care-recovery-kit', 'injury_care', 2),
  ('injury-care-physiotherapy-session', 'injury_care', 3),
  ('injury-care-anti-inflammatory-protocol', 'injury_care', 4)
) as level(reward_key, effect_kind, importance)
where reward.reward_key = level.reward_key
  and reward.effect_kind = level.effect_kind
  and reward.importance <> level.importance;

commit;
