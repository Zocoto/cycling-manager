begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
insert into public.halloween_catalog(id,name,kind,price,max_obtained,draw_pool,effect) values
('lord-vlad','Tenue Lord Vlad','cosmetic',40,1,'cosmetic','{"slot":"outfit","exclusive":false}'::jsonb),
('halloween-background','Fond Halloween','cosmetic',24,1,'cosmetic','{"slot":"background","exclusive":false}'::jsonb),
('devil-trident','Trident du supporter','cosmetic',18,1,'cosmetic','{"exclusive":false}'::jsonb),
('pumpkin-cap','Casquette citrouille','cosmetic',10,1,'cosmetic','{"slot":"hat","exclusive":false}'::jsonb),
('pocket-bat','Chauve-souris de poche','cosmetic',6,1,'cosmetic','{"slot":"pin","exclusive":false}'::jsonb),
('spectral-wheel','Cadre Roue spectrale','cosmetic',12,1,'cosmetic','{"slot":"frame","exclusive":false}'::jsonb),
('cobweb-frame','Cadre Toile d’araignée','cosmetic',10,1,'cosmetic','{"slot":"frame","exclusive":false}'::jsonb),
('ghost-scarf','Écharpe du fantôme','cosmetic',16,1,'cosmetic','{"slot":"neck","exclusive":false}'::jsonb),
('pumpkin-juice','Jus de citrouille','consumable',6,30,'consumable','{"exclusive":false}'::jsonb),
('mummy-bandage','Bandage de momie','consumable',8,30,'consumable','{"exclusive":false}'::jsonb),
('scouts-candy','Bonbon de clairvoyance','consumable',10,30,'consumable','{"exclusive":false}'::jsonb),
('gravediggers-hourglass','Sablier du fossoyeur','consumable',12,30,'consumable','{"exclusive":false}'::jsonb),
('midnight-chocolate','Chocolat de minuit','consumable',8,30,'consumable','{"exclusive":false}'::jsonb),
('spectres-tea','Tisane du spectre','consumable',25,30,'consumable','{"exclusive":false}'::jsonb),
('giants-syrup','Sirop du géant','consumable',25,30,'consumable','{"exclusive":false}'::jsonb),
('immortality-pact','Pacte d’immortalité','consumable',900,1,null,'{"exclusive":false}'::jsonb),
('mummy-resurrection','Résurrection de la momie','consumable',360,1,null,'{"exclusive":false}'::jsonb),
('full-moon-elixir','Élixir de pleine lune','consumable',280,1,null,'{"exclusive":false}'::jsonb),
('cursed-builders-seal','Sceau du bâtisseur maudit','consumable',450,1,null,'{"exclusive":false}'::jsonb),
('witches-star','Étoile de la sorcière','consumable',1800,1,'rare','{"exclusive":false}'::jsonb),
('youth-fountain','Fontaine de jouvence','consumable',3000,1,null,'{"exclusive":false}'::jsonb),
('vampire-kiss','Baiser du vampire','transformation',14,10,null,'{"exclusive":false}'::jsonb),
('mummy-curse','Malédiction de la momie','transformation',12,10,null,'{"exclusive":false}'::jsonb);
-- A podium gift is additional to the single paid relic purchase. The star is
-- the exception: its quota is shared between purchases and rare candy draws.
update public.halloween_catalog set max_obtained=2 where price>=180 and id<>'witches-star';
insert into public.halloween_catalog(id,name,kind,price,max_obtained,effect) values
('headless-skin','Équipier sans tête · tenue du vainqueur','cosmetic',0,1,'{"slot":"outfit","exclusive":true}');
commit;
