  elsif action in('dish.save','dish.archive') then
   ident:=(a->>'id')::uuid;
   if ident is not null then
    select * into dish from v1.dishes where id=ident and caterer_id=cid for update;
    if not found then raise exception 'FORBIDDEN';end if;
    if jsonb_typeof(a->'version') is distinct from 'number' or (a->>'version')::numeric<>dish.version then raise exception 'CONFLICT';end if;
   end if;
   if action='dish.save' then
    if not v1.valid_dish(a->'details') then raise exception 'INVALID_INPUT';end if;
    if ident is null then insert into v1.dishes(caterer_id,details) values(cid,a->'details') returning * into dish;
    else update v1.dishes set details=a->'details',version=version+1,updated_at=now() where id=ident returning * into dish;end if;
   else
    if ident is null or jsonb_typeof(a->'archived') is distinct from 'boolean' then raise exception 'INVALID_INPUT';end if;
    update v1.dishes set archived=(a->>'archived')::boolean,version=version+1,updated_at=now() where id=ident returning * into dish;
   end if;
   ident:=dish.id;r:=v1.library_dish(dish);
