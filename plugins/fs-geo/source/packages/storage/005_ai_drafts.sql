begin;
create table geo_ai_drafts (
 id uuid primary key, tenant_id uuid not null, project_id uuid not null, actor_id uuid not null,
 idempotency_key text not null, request_hash text not null, model text not null,
 state text not null check(state in ('RUNNING','SUCCEEDED','UNKNOWN')),
 input jsonb not null, result jsonb, error_code text,
 created_at timestamptz not null default now(), finished_at timestamptz,
 unique(tenant_id,idempotency_key), foreign key(tenant_id,project_id) references geo_projects(tenant_id,id)
);
create index geo_ai_drafts_project_actor on geo_ai_drafts(tenant_id,project_id,actor_id,created_at desc,id);
alter table geo_ai_drafts enable row level security;
alter table geo_ai_drafts force row level security;
create policy tenant_isolation on geo_ai_drafts for all to geo_runtime
 using(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 with check(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
grant select,insert,update on geo_ai_drafts to geo_runtime;
insert into geo_schema_versions(version) values(5);
commit;
