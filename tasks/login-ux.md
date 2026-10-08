# Login and subject-selection UI

Owner: desktop fs-platform-access; High Risk because optional password persistence
uses the existing native OS-protected secret service. User requests: centered
login/subject forms, FutureStaff Agent login title, subject-selection title only,
subject actions on one row, and a remember-password option.

No schema or platform API change. Tenant choice remains server-authorized and
opens the existing environment/tenant/user workspace. Private loopback password
route gains optional rememberPassword; a guarded GET/DELETE route exposes only
availability, remembered state and the account identifier. Saved passwords never
return to the Renderer, HTML, snapshots, browser preferences or logs. Empty password
submission can use the protected value only with explicit remember opt-in and an
exact matching account. Only verified authentication can store it. Uncheck deletes
only the remembered credential, not sessions. DEV/PROD have distinct keys; unavailable
protection never falls back to plaintext. Concurrent delete wins over pending save.

UI uses a centered single-column logo/title/form in the existing login gate.
Subject actions use one flex row. Login hints update without discarding typed drafts;
saved passwords use a placeholder rather than a decrypted input value. Older Hosts
remain compatible: without the new metadata route, the checkbox is disabled and
password submissions retain their old request shape.

Validation: product build/typecheck; 124 focused package tests (before additional
HTTP integration test), plus real Host login/remember/reuse/forget HTTP regression
with fake credentials; metadata-header refusal and no Renderer secret return;
browser screenshots and measured card/form center at viewport center (640,360),
subject button tops equal. User credentials were never entered/read by Codex.

Local custom inference integration is preserved by a reviewed task-only code overlay;
source release candidate excludes unrelated inference, Douyin and window work.
User separately authorized commit, push and publication as 2.0.17. Current status:
implemented and validated; release validation and signing/publication in progress.

Release validation: 125 access tests passed including HTTP integration, desktop
1095 tests passed (13 existing skips), build/typechecks/runtime closure and two
Profile staging tests passed. Browser bundle excludes Host password-store code.
Only fixture credentials were used. The local six-file overlay has code backups
and retains the original custom inference and market services; it needs app restart.
