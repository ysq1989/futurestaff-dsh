-- GEO owns business data only. No Platform identity or model-secret tables.
begin;
create table if not exists geo_schema_versions(version integer primary key, applied_at timestamptz not null default now());
do $$ begin
  if not exists (select from pg_roles where rolname='geo_runtime') then
    create role geo_runtime nologin nosuperuser nobypassrls;
  end if;
end $$;
create table geo_projects (
  id uuid primary key, tenant_id uuid not null, name text not null, brand text not null,
  aliases jsonb not null default '[]', domains jsonb not null default '[]', competitors jsonb not null default '[]',
  created_by uuid not null, created_at timestamptz not null default now(), unique(tenant_id,id)
);
create index geo_projects_tenant_time on geo_projects(tenant_id,created_at,id);
create table geo_prompts (
  id uuid primary key, tenant_id uuid not null, project_id uuid not null, question text not null,
  branded boolean not null, created_at timestamptz not null default now(), unique(tenant_id,project_id,id),
  foreign key(tenant_id,project_id) references geo_projects(tenant_id,id)
);
create index geo_prompts_project on geo_prompts(tenant_id,project_id,created_at,id);
create table geo_runs (
  id uuid primary key, tenant_id uuid not null, project_id uuid not null, prompt_id uuid not null,
  model text not null, idempotency_key text not null, request_hash text not null,
  state text not null check(state in ('RUNNING','SUCCEEDED','UNKNOWN')),
  error_code text, actor_id uuid not null, raw_response jsonb,
  created_at timestamptz not null default now(), finished_at timestamptz,
  unique(tenant_id,idempotency_key), unique(tenant_id,project_id,id),
  foreign key(tenant_id,project_id,prompt_id) references geo_prompts(tenant_id,project_id,id)
);
create index geo_runs_prompt on geo_runs(tenant_id,project_id,prompt_id);
create table geo_evidence (
  id uuid primary key, tenant_id uuid not null, project_id uuid not null, prompt_id uuid not null,
  product_id text not null, model text not null, channel text not null check(channel in ('MODEL_API','PRODUCT_WEB','THIRD_PARTY')),
  provenance text not null check(provenance in ('MANUAL_IMPORT','COLLECTED','FIXTURE')), search_state text not null check(search_state in ('ENABLED','DISABLED','UNKNOWN')),
  run_id uuid,
  state text not null check(state in ('SUCCEEDED','FAILED','UNKNOWN')), citation_state text not null check(citation_state in ('COMPLETE','UNSUPPORTED','UNKNOWN')),
  answer text not null, citations jsonb not null default '[]', raw_response jsonb not null, sha256 text not null,
  collected_at timestamptz not null, imported_by uuid not null, created_at timestamptz not null default now(),
  foreign key(tenant_id,project_id,prompt_id) references geo_prompts(tenant_id,project_id,id),
  foreign key(tenant_id,project_id,run_id) references geo_runs(tenant_id,project_id,id)
);
create unique index geo_evidence_run on geo_evidence(tenant_id,run_id) where run_id is not null;
create index geo_evidence_project on geo_evidence(tenant_id,project_id,created_at,id);
create index geo_evidence_prompt on geo_evidence(tenant_id,project_id,prompt_id);
create table geo_audit (
  id uuid primary key, tenant_id uuid not null, actor_id uuid not null, event text not null,
  resource_id uuid not null, created_at timestamptz not null default now()
);
create index geo_audit_tenant on geo_audit(tenant_id,created_at,id);
do $$ declare t text; begin
  foreach t in array array['geo_projects','geo_prompts','geo_evidence','geo_audit','geo_runs'] loop
    execute format('alter table %I enable row level security',t);
    execute format('alter table %I force row level security',t);
    execute format('create policy tenant_isolation on %I for all to geo_runtime using (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid) with check (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
    execute format('grant select,insert on %I to geo_runtime',t);
  end loop;
end $$;
grant update on geo_runs to geo_runtime;
insert into geo_schema_versions(version) values(1);
commit;
