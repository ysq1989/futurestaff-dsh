-- Dormant delivery ledger. No production HTTP enqueue route or daemon is enabled.
begin;
create table geo_delivery_jobs (
 id uuid primary key, tenant_id uuid not null, project_id uuid not null,
 article_id uuid not null, version integer not null, account_id uuid not null,
 scheduled_at timestamptz not null, idempotency_key text not null, request_hash text not null,
 state text not null check(state in ('PLANNED','RUNNING','SUBMITTED','PUBLISHED','FAILED','UNKNOWN')),
 lease_token uuid, lease_expires_at timestamptz, result jsonb, created_at timestamptz not null default now(),
 unique(tenant_id,project_id,id), unique(tenant_id,idempotency_key),
 foreign key(tenant_id,project_id,article_id,version) references geo_article_versions(tenant_id,project_id,article_id,version),
 foreign key(tenant_id,project_id,account_id) references geo_publication_accounts(tenant_id,project_id,id)
);
create index geo_delivery_due on geo_delivery_jobs(tenant_id,project_id,state,scheduled_at,id);
create index geo_delivery_article on geo_delivery_jobs(tenant_id,project_id,article_id,version);
create index geo_delivery_account on geo_delivery_jobs(tenant_id,project_id,account_id,state);
create unique index geo_delivery_one_running_account on geo_delivery_jobs(tenant_id,project_id,account_id) where state='RUNNING';
alter table geo_delivery_jobs enable row level security;
alter table geo_delivery_jobs force row level security;
create policy tenant_isolation on geo_delivery_jobs for all to geo_runtime
 using(tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid)
 with check(tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);
grant select,insert,update on geo_delivery_jobs to geo_runtime;
insert into geo_schema_versions(version) values(3);
commit;
