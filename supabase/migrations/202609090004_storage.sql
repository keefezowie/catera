-- Public food photography; application uploads require an authenticated seller owner.
-- Service credentials stay on the API server. No broad client write policy is installed.
do $$ begin if to_regclass('storage.buckets') is not null then
 insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('catera-v1-food','catera-v1-food',true,8388608,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
end if;end $$;
