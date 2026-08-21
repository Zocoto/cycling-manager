-- ============================================================
-- Réactions négatives des DS sur les interviews de la Cyclogazette.
-- La validation SQL et le RPC partagent la même palette complète.
-- ============================================================

begin;

alter table public.post_race_interview_answer_reactions
  drop constraint post_race_interview_answer_reactions_emoji_allowed;

alter table public.post_race_interview_answer_reactions
  add constraint post_race_interview_answer_reactions_emoji_allowed
  check (emoji in ('😂', '👏', '🔥', '🤝', '❤️', '👎', '🙄', '😡', '🤡'));

create or replace function public.toggle_post_race_interview_answer_reaction(
  p_interview_id uuid,
  p_question_id text,
  p_emoji text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_director_id uuid;
  v_interview record;
  v_question_id text := btrim(coalesce(p_question_id, ''));
  v_changed_count integer := 0;
  v_reaction_count integer := 0;
  v_active boolean;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;

  if p_interview_id is null
    or char_length(v_question_id) not between 1 and 160
  then
    raise exception 'La réponse ciblée est invalide.';
  end if;

  if p_emoji is null
    or p_emoji not in ('😂', '👏', '🔥', '🤝', '❤️', '👎', '🙄', '😡', '🤡')
  then
    raise exception 'Cette réaction est invalide.';
  end if;

  select director.id
  into v_director_id
  from public.sporting_directors as director
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_director_id is null then
    raise exception 'Aucun Directeur Sportif actif ne correspond à ce compte.';
  end if;

  select
    interview.sporting_director_id,
    interview.status,
    interview.answers
  into v_interview
  from public.post_race_interviews as interview
  where interview.id = p_interview_id;

  if v_interview is null or v_interview.status <> 'submitted' then
    raise exception 'Cette interview publiée est introuvable.';
  end if;

  if v_interview.sporting_director_id = v_director_id then
    raise exception 'Vous ne pouvez pas réagir à votre propre interview.';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(v_interview.answers) as answer
    where answer ->> 'questionId' = v_question_id
      and btrim(coalesce(answer ->> 'answer', '')) <> ''
  ) then
    raise exception 'Cette réponse publiée est introuvable.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'interview-answer-reaction:'
        || p_interview_id::text || ':'
        || v_question_id || ':'
        || v_director_id::text || ':'
        || p_emoji,
      0
    )
  );

  delete from public.post_race_interview_answer_reactions
  where interview_id = p_interview_id
    and question_id = v_question_id
    and sporting_director_id = v_director_id
    and emoji = p_emoji;

  get diagnostics v_changed_count = row_count;
  v_active := v_changed_count = 0;

  if v_active then
    insert into public.post_race_interview_answer_reactions (
      interview_id,
      question_id,
      sporting_director_id,
      emoji
    )
    values (
      p_interview_id,
      v_question_id,
      v_director_id,
      p_emoji
    );
  end if;

  select count(*)::integer
  into v_reaction_count
  from public.post_race_interview_answer_reactions as reaction
  where reaction.interview_id = p_interview_id
    and reaction.question_id = v_question_id
    and reaction.emoji = p_emoji;

  return jsonb_build_object(
    'active', v_active,
    'count', v_reaction_count,
    'emoji', p_emoji,
    'questionId', v_question_id
  );
end;
$$;

revoke all
on function public.toggle_post_race_interview_answer_reaction(uuid, text, text)
from public, anon;

grant execute
on function public.toggle_post_race_interview_answer_reaction(uuid, text, text)
to authenticated;

comment on constraint post_race_interview_answer_reactions_emoji_allowed
on public.post_race_interview_answer_reactions is
  'Palette positive et négative des réactions de DS publiables dans la Cyclogazette.';

notify pgrst, 'reload schema';

commit;
