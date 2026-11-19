begin;
set local lock_timeout = '1s';
set local statement_timeout = '10s';

create function public.update_current_team_rich_media_article(
  p_article_id uuid, p_title text, p_blocks jsonb, p_include_sponsor boolean
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
  select article.* into v_article
  from public.media_center_articles as article
  where article.id = p_article_id
    and public.current_user_manages_team(article.team_id)
  for update;
  if not found then
    raise exception 'Cette tribune est introuvable ou ne vous appartient pas.';
  end if;
  if v_article.status <> 'queued' or v_article.published_edition_id is not null then
    raise exception 'Cette tribune a déjà été publiée et ne peut plus être modifiée.';
  end if;
  v_article_id := v_article.id;
  if p_title is null or char_length(btrim(p_title)) not between 5 and 100 then
    raise exception 'Le titre doit contenir 5 à 100 caractères.';
  end if;
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


  for v_block in select value from jsonb_array_elements(v_normalized)
  loop
    if v_block->>'type' = 'image' then
      update public.media_center_article_images
      set article_id = v_article_id
      where id = (v_block->>'assetId')::uuid
        and team_id = v_article.team_id
        and (article_id is null or article_id = v_article_id) and cleanup_started_at is null
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

  update public.media_center_articles
  set title = btrim(p_title), body = v_text, content_blocks = v_saved_blocks,
    sponsor_name = case when p_include_sponsor and building_level >= 3 then (
      select sponsor.name
      from public.team_sponsor_contracts as contract
      join public.sponsors as sponsor on sponsor.id = contract.sponsor_id
      where contract.team_id = v_article.team_id and contract.status = 'active'
      limit 1
    ) else null end
  where id = v_article_id;

  update public.media_center_article_images
  set article_id = null
  where article_id = v_article_id and not (id = any(v_image_ids));
  return v_article_id;
end;
$$;

revoke all on function public.update_current_team_rich_media_article(uuid,text,jsonb,boolean) from public, anon;
grant execute on function public.update_current_team_rich_media_article(uuid,text,jsonb,boolean) to authenticated;

-- Lock the queued articles and freeze their latest saved content in the same
-- transaction as the edition. Edits and publication serialize on these rows.
create function public.freeze_cyclogazette_media_articles()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_article public.media_center_articles%rowtype;
  v_articles jsonb := '[]'::jsonb;
begin
  for v_article in
    select article.*
    from public.media_center_articles as article
    where article.season_id = new.season_id and article.status = 'queued'
      and article.published_edition_id is null
      and article.id::text in (
        select value->>'id'
        from jsonb_array_elements(coalesce(new.content->'mediaArticles', '[]'::jsonb))
      )
    order by article.created_at, article.id
    for update
  loop
    v_articles := v_articles || jsonb_build_array(jsonb_build_object(
      'id', v_article.id, 'title', v_article.title, 'body', v_article.body,
      'blocks', v_article.content_blocks, 'teamName', v_article.team_name,
      'sponsorName', v_article.sponsor_name, 'buildingLevel', v_article.building_level
    ));
  end loop;
  new.content := jsonb_set(new.content, '{mediaArticles}', v_articles);
  return new;
end;
$$;

create function public.complete_cyclogazette_media_articles()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.media_center_articles as article
  set status = 'published', published_edition_id = new.id
  where article.season_id = new.season_id and article.status = 'queued'
    and article.published_edition_id is null
    and article.id::text in (
      select value->>'id' from jsonb_array_elements(new.content->'mediaArticles')
    );
  return new;
end;
$$;

revoke all on function public.freeze_cyclogazette_media_articles() from public, anon, authenticated;
revoke all on function public.complete_cyclogazette_media_articles() from public, anon, authenticated;
create trigger cyclogazette_freeze_media_articles
before insert on public.cyclogazette_editions
for each row execute function public.freeze_cyclogazette_media_articles();
create trigger cyclogazette_complete_media_articles
after insert on public.cyclogazette_editions
for each row execute function public.complete_cyclogazette_media_articles();

notify pgrst, 'reload schema';
commit;
