begin;
set local lock_timeout = '1s';
set local statement_timeout = '10s';

alter table public.media_center_articles
  add column content_blocks jsonb,
  drop constraint media_center_articles_body_check,
  add constraint media_center_articles_body_check
    check (char_length(btrim(body)) between 40 and 6000),
  add constraint media_center_articles_content_blocks_check
    check (content_blocks is null or jsonb_typeof(content_blocks) = 'array');

-- Keep the existing scheduling and rewards path shared by both publishing entry points.
do $migration$
declare
  v_definition text := pg_get_functiondef('public.publish_current_team_media_article(text,text,boolean)'::regprocedure);
  v_length_check constant text := 'char_length(btrim(p_body)) not between 40 and 1600';
  v_publication_day constant text := 'v_game_day := v_context.game_year * 28 + v_context.current_day_number - 1;';
begin
  if position(v_length_check in v_definition) = 0 or position(v_publication_day in v_definition) = 0 then
    raise exception 'Unexpected Media Center publication function';
  end if;
  v_definition := replace(v_definition, v_length_check, 'char_length(btrim(p_body)) not between 40 and 6000');
  v_definition := replace(v_definition, v_publication_day, v_publication_day || E'\n  '
    || 'perform pg_advisory_xact_lock(hashtextextended(''media-center-article:'' || v_context.team_id::text, 0));');
  execute v_definition;
end;
$migration$;

create function public.publish_current_team_rich_media_article(
  p_title text, p_blocks jsonb, p_include_sponsor boolean
)
returns uuid
language plpgsql security definer set search_path = ''
set lock_timeout = '2s'
as $$
declare
  v_block jsonb;
  v_run jsonb;
  v_text text;
  v_content jsonb;
  v_body_parts text[] := array[]::text[];
  v_total_text_length integer := 0;
  v_image_ids uuid[] := array[]::uuid[];
  v_asset_id uuid;
  v_asset public.media_center_article_images%rowtype;
  v_article public.media_center_articles%rowtype;
  v_article_id uuid;
  v_normalized jsonb := '[]'::jsonb;
  v_saved_blocks jsonb := '[]'::jsonb;
  v_layout_error constant text := 'La mise en page de la tribune est invalide.';
begin
  if jsonb_typeof(p_blocks) is distinct from 'array' or octet_length(p_blocks::text) > 160000 then
    raise exception '%', v_layout_error;
  end if;
  if jsonb_array_length(p_blocks) not between 1 and 20 then
    raise exception '%', v_layout_error;
  end if;

  for v_block in select value from jsonb_array_elements(p_blocks)
  loop
    case v_block->>'type'
      when 'text' then
        if coalesce(v_block->>'font', '') not in ('default', 'serif', 'sans', 'mono')
          or jsonb_typeof(v_block->'content') is distinct from 'array' then
          raise exception '%', v_layout_error;
        end if;
        if jsonb_array_length(v_block->'content') > 240 then
          raise exception '%', v_layout_error;
        end if;
        v_content := '[]'::jsonb;
        v_text := '';
        for v_run in select value from jsonb_array_elements(v_block->'content')
        loop
          if jsonb_typeof(v_run->'text') is distinct from 'string'
            or (v_run ? 'bold' and jsonb_typeof(v_run->'bold') is distinct from 'boolean')
            or (v_run ? 'italic' and jsonb_typeof(v_run->'italic') is distinct from 'boolean') then
            raise exception '%', v_layout_error;
          end if;
          v_total_text_length := v_total_text_length + char_length(v_run->>'text');
          if v_total_text_length > 6000 then
            raise exception '%', v_layout_error;
          end if;
          v_text := v_text || (v_run->>'text');
          v_content := v_content || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
            'text', v_run->'text',
            'bold', nullif(v_run->'bold', 'false'::jsonb),
            'italic', nullif(v_run->'italic', 'false'::jsonb)
          )));
        end loop;
        v_text := regexp_replace(v_text, '^[[:space:]]+|[[:space:]]+$', '', 'g');
        if v_text <> '' then
          v_body_parts := array_append(v_body_parts, v_text);
          v_normalized := v_normalized || jsonb_build_array(jsonb_build_object(
            'type', 'text', 'font', v_block->'font', 'content', v_content
          ));
        end if;
      when 'image' then
        if coalesce(v_block->>'assetId', '') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
          or coalesce(v_block->>'align', '') not in ('left', 'center', 'right', 'wide')
          or jsonb_typeof(v_block->'alt') is distinct from 'string'
          or char_length(v_block->>'alt') > 160
          or (v_block ? 'caption' and (jsonb_typeof(v_block->'caption') is distinct from 'string'
            or char_length(v_block->>'caption') > 200)) then
          raise exception '%', v_layout_error;
        end if;
        v_asset_id := (v_block->>'assetId')::uuid;
        if cardinality(v_image_ids) >= 4 or v_asset_id = any(v_image_ids) then
          raise exception '%', v_layout_error;
        end if;
        v_image_ids := array_append(v_image_ids, v_asset_id);
        v_normalized := v_normalized || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
          'type', 'image', 'assetId', v_asset_id, 'align', v_block->'align', 'alt', v_block->'alt',
          'caption', nullif(btrim(v_block->>'caption'), '')
        )));
      else
        raise exception '%', v_layout_error;
    end case;
  end loop;

  v_text := array_to_string(v_body_parts, E'\n\n');
  if p_title is null or char_length(v_text) not between 40 and 6000 then
    raise exception 'Le titre ou le contenu ne respecte pas la longueur demandée.';
  end if;
  v_article_id := public.publish_current_team_media_article(p_title, v_text, p_include_sponsor);
  select * into strict v_article from public.media_center_articles where id = v_article_id;

  for v_block in select value from jsonb_array_elements(v_normalized)
  loop
    if v_block->>'type' = 'image' then
      update public.media_center_article_images
      set article_id = v_article_id
      where id = (v_block->>'assetId')::uuid
        and team_id = v_article.team_id
        and sporting_director_id = v_article.sporting_director_id
        and article_id is null and cleanup_started_at is null
        and width between 1 and 2000 and height between 1 and 2000
      returning * into v_asset;
      if not found then
        raise exception 'Une illustration est indisponible. Importez-la de nouveau.';
      end if;
      v_block := v_block || jsonb_build_object(
        'src', '/api/game/media-center/images/' || v_asset.team_id::text || '/' || v_asset.id::text || '.webp',
        'width', v_asset.width, 'height', v_asset.height
      );
    end if;
    v_saved_blocks := v_saved_blocks || jsonb_build_array(v_block);
  end loop;

  update public.media_center_articles set content_blocks = v_saved_blocks where id = v_article_id;
  return v_article_id;
end;
$$;

revoke all on function public.publish_current_team_rich_media_article(text,jsonb,boolean)
  from public, anon, authenticated;
grant execute on function public.publish_current_team_rich_media_article(text,jsonb,boolean)
  to authenticated;

notify pgrst, 'reload schema';
commit;
