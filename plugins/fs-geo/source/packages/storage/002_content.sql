begin;
create table geo_brand_profiles (
 tenant_id uuid not null, project_id uuid not null, version integer not null check(version>0),
 business text not null, audience text not null, facts text not null, tone text not null,
 primary key(tenant_id,project_id), foreign key(tenant_id,project_id) references geo_projects(tenant_id,id)
);
create table geo_topics (
 id uuid primary key, tenant_id uuid not null, project_id uuid not null, title text not null, prompt_id uuid,
 created_at timestamptz not null default now(), unique(tenant_id,project_id,id),
 foreign key(tenant_id,project_id) references geo_projects(tenant_id,id),
 foreign key(tenant_id,project_id,prompt_id) references geo_prompts(tenant_id,project_id,id)
);
create table geo_articles (
 id uuid primary key, tenant_id uuid not null, project_id uuid not null, version integer not null check(version>0),
 state text not null check(state in ('DRAFT','IN_REVIEW','APPROVED')), created_at timestamptz not null default now(),
 unique(tenant_id,project_id,id), foreign key(tenant_id,project_id) references geo_projects(tenant_id,id)
);
create table geo_article_versions (
 tenant_id uuid not null, project_id uuid not null, article_id uuid not null, version integer not null check(version>0),
 title text not null, body text not null, summary text not null, topic_id uuid, sources jsonb not null default '[]',
 created_by uuid not null, created_at timestamptz not null default now(),
 primary key(tenant_id,project_id,article_id,version),
 foreign key(tenant_id,project_id,article_id) references geo_articles(tenant_id,project_id,id),
 foreign key(tenant_id,project_id,topic_id) references geo_topics(tenant_id,project_id,id)
);
create table geo_article_reviews (
 id uuid primary key, tenant_id uuid not null, project_id uuid not null, article_id uuid not null, version integer not null,
 action text not null check(action in ('SUBMIT','APPROVE','REJECT')), comment text not null, actor_id uuid not null,
 created_at timestamptz not null default now(),
 foreign key(tenant_id,project_id,article_id,version) references geo_article_versions(tenant_id,project_id,article_id,version)
);
create table geo_publication_accounts (
 id uuid primary key, tenant_id uuid not null, project_id uuid not null, platform text not null check(platform in ('toutiao','baijiahao','sohu','zhihu','wechat','website')),
 label text not null, mode text not null default 'MANUAL' check(mode='MANUAL'), created_at timestamptz not null default now(),
 unique(tenant_id,project_id,id), foreign key(tenant_id,project_id) references geo_projects(tenant_id,id)
);
create table geo_publication_plans (
 id uuid primary key, tenant_id uuid not null, project_id uuid not null, article_id uuid not null, version integer not null,
 account_id uuid not null, scheduled_at timestamptz not null, mode text not null check(mode='MANUAL'),
 state text not null check(state in ('PLANNED','PUBLISHED','CANCELLED')), created_at timestamptz not null default now(),
 unique(tenant_id,project_id,id), unique(tenant_id,project_id,article_id,version,account_id,scheduled_at),
 foreign key(tenant_id,project_id,article_id,version) references geo_article_versions(tenant_id,project_id,article_id,version),
 foreign key(tenant_id,project_id,account_id) references geo_publication_accounts(tenant_id,project_id,id)
);
create table geo_publication_records (
 id uuid primary key, tenant_id uuid not null, project_id uuid not null, plan_id uuid not null,
 url text not null, published_at timestamptz not null, note text not null, provenance text not null check(provenance='MANUAL_REPORT'),
 created_by uuid not null, created_at timestamptz not null default now(), unique(tenant_id,project_id,plan_id),
 foreign key(tenant_id,project_id,plan_id) references geo_publication_plans(tenant_id,project_id,id)
);
create index geo_topics_project_time on geo_topics(tenant_id,project_id,created_at,id);
create index geo_topics_prompt on geo_topics(tenant_id,project_id,prompt_id);
create index geo_articles_project_time on geo_articles(tenant_id,project_id,created_at,id);
create index geo_versions_topic on geo_article_versions(tenant_id,project_id,topic_id);
create index geo_reviews_article on geo_article_reviews(tenant_id,project_id,article_id,version,created_at);
create index geo_accounts_project_time on geo_publication_accounts(tenant_id,project_id,created_at,id);
create index geo_plans_due on geo_publication_plans(tenant_id,project_id,state,scheduled_at,id);
create index geo_plans_version on geo_publication_plans(tenant_id,project_id,article_id,version);
create index geo_plans_account on geo_publication_plans(tenant_id,project_id,account_id);
create index geo_records_project_time on geo_publication_records(tenant_id,project_id,created_at,id);
do $$ declare t text; begin
 foreach t in array array['geo_brand_profiles','geo_topics','geo_articles','geo_article_versions','geo_article_reviews','geo_publication_accounts','geo_publication_plans','geo_publication_records'] loop
  execute format('alter table %I enable row level security',t);
  execute format('alter table %I force row level security',t);
  execute format('create policy tenant_isolation on %I for all to geo_runtime using (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid) with check (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
  execute format('grant select,insert on %I to geo_runtime',t);
 end loop;
end $$;
grant update on geo_brand_profiles,geo_articles,geo_publication_plans to geo_runtime;
insert into geo_schema_versions(version) values(2);
commit;
