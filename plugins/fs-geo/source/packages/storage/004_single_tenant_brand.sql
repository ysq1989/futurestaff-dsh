begin;
-- Stop before touching data when legacy projects disagree on the tenant's brand.
do $$ begin
 if exists(select tenant_id from geo_projects group by tenant_id having count(distinct lower(normalize(btrim(brand),NFKC)))>1) then
  raise exception 'GEO_BRAND_MIGRATION_CONFLICT: multiple brands in one tenant; review legacy projects before migration';
 end if;
 if exists(select tenant_id from geo_brand_profiles where concat(business,audience,facts,tone)<>'' group by tenant_id having count(distinct jsonb_build_array(business,audience,facts,tone))>1) then
  raise exception 'GEO_PROFILE_MIGRATION_CONFLICT: project brand profiles disagree; review before migration';
 end if;
end $$;
create table geo_tenant_brands (
 tenant_id uuid primary key, brand text not null check(length(btrim(brand))>0), version integer not null check(version>0),
 aliases jsonb not null default '[]', domains jsonb not null default '[]', competitors jsonb not null default '[]',
 business text not null default '', audience text not null default '', facts text not null default '', tone text not null default '',
 unique(tenant_id,brand)
);
create table geo_project_brand_legacy (
 tenant_id uuid not null, project_id uuid not null, data jsonb not null,
 primary key(tenant_id,project_id), foreign key(tenant_id,project_id) references geo_projects(tenant_id,id)
);
insert into geo_project_brand_legacy(tenant_id,project_id,data)
 select p.tenant_id,p.id,jsonb_build_object('brand',p.brand,'aliases',p.aliases,'domains',p.domains,'competitors',p.competitors,'profile',to_jsonb(b))
 from geo_projects p left join geo_brand_profiles b on (p.tenant_id,p.id)=(b.tenant_id,b.project_id);
insert into geo_tenant_brands(tenant_id,brand,version,aliases,domains,competitors,business,audience,facts,tone)
 select p.tenant_id,p.brand,coalesce((select max(version) from geo_brand_profiles where tenant_id=p.tenant_id),1),
 coalesce((select jsonb_agg(distinct item) from geo_projects x cross join lateral jsonb_array_elements_text(x.aliases) item where x.tenant_id=p.tenant_id),'[]'),
 coalesce((select jsonb_agg(distinct item) from geo_projects x cross join lateral jsonb_array_elements_text(x.domains) item where x.tenant_id=p.tenant_id),'[]'),
 coalesce((select jsonb_agg(distinct item) from geo_projects x cross join lateral jsonb_array_elements_text(x.competitors) item where x.tenant_id=p.tenant_id and lower(normalize(btrim(item),NFKC))<>lower(normalize(btrim(p.brand),NFKC))),'[]'),
 coalesce(b.business,''),coalesce(b.audience,''),coalesce(b.facts,''),coalesce(b.tone,'')
 from (select distinct on(tenant_id) * from geo_projects order by tenant_id,created_at,id) p
 left join lateral(select * from geo_brand_profiles where tenant_id=p.tenant_id order by (concat(business,audience,facts,tone)<>'') desc,version desc,project_id limit 1) b on true;
-- Original metadata is archived above. Keep project IDs and every evidence/content relation.
update geo_projects p set brand=b.brand from geo_tenant_brands b where p.tenant_id=b.tenant_id;
alter table geo_projects add constraint geo_projects_one_tenant_brand foreign key(tenant_id,brand) references geo_tenant_brands(tenant_id,brand);
do $$ declare t text; begin
 foreach t in array array['geo_tenant_brands','geo_project_brand_legacy'] loop
  execute format('alter table %I enable row level security',t);
  execute format('alter table %I force row level security',t);
  execute format('create policy tenant_isolation on %I for all to geo_runtime using(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) with check(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
  execute format('grant select on %I to geo_runtime',t);
 end loop;
end $$;
grant insert,update on geo_tenant_brands to geo_runtime;
revoke insert,update on geo_brand_profiles from geo_runtime;
insert into geo_schema_versions(version) values(4);
commit;
