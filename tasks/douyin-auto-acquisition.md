# Automatic Douyin acquisition

User requests business analysis → relevant account/work discovery → periodic
comment monitoring → qualified private messages. This replaces manual-only
discovery as the active objective. Owning module: local Douyin Host/workspace;
main baseline d9456cb7a451b2acd35c0da1a7b109ed8b034930. Preserve prior dirty work.

Boundaries: principal/namespace/model authorization remain Host-derived. Public
source URLs and comments only from the owned browser, validated before storage.
Models classify text with verbatim evidence; they never provide URLs/recipient
IDs or browser code. Private sends require an explicit runtime policy approval
with actual message template, interval, daily count and scope shown before start.
No live search, inference, private send, deployment, commit or push during source
development. Existing schema namespaces can store bounded discovery/policy
state; no platform database or credentials change.

Work: business-specific search and evidence-based work selection; scheduled
discovery and comment scans; reusable owned-browser sender with verified receiver
and success acknowledgement; bounded approved outreach queue, deduplication,
daily cap and opt-out/revocation. Test each boundary and actual user flow; do not
claim the overall capability ready merely because source controllers exist.
User confirmed continued use of the Vietnam visa profile.

Implemented the discovery port/parser, literal-evidence work selection, owned-
browser sender guard, explicit automatic-policy UI and orchestration, periodic
search/comment processing, persisted daily attempt budget, denial/contact dedup,
approval revocation and readable errors. Model withdrawal and model changes
invalidate old approvals; refreshed UI displays the actual approved policy.
New logs preserve the legacy namespace for rollback.

Validation: 76 Node module + 19 React + 42 core tests passed, including business
discovery→comment decision→one approved private send with a fake adapter, daily
cap, cancellation of in-flight sends, contact-list/receiver mismatch rejection,
unknown result blocking, source/evidence spoofing, scope/model changes and log
rollback. Build/typecheck pass; isolated-browser light UI visually inspected.
See docs/specs/douyin-auto-acquisition-v0.7.0.md for contracts/limits.

Local pilot deployed under the standing user instruction “部署，我来测试”:
backup, complete candidate import in installed Electron, exact hash comparison,
graceful application restart. Receipt at
D:/项目/.codex-build/auto-acquisition-deploy-20261009/receipt.json.
No manual config/database modification, commit, push, public release or real
external search/inference/message execution. Default send remains unchecked.
Real-site acceptance and receiver/receipt markup calibration remain required;
do not mark the whole business workflow production-verified merely from tests.
