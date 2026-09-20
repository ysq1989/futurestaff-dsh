# Current Atomic Task

## B02r: Prepare the versioned Windows acceptance candidate

- Status: source ready for a clean 2.0.7 build; shared desktop login state and client error mapping repaired. Updated-source `npm run check` passed on 2026-09-20 (platform-access 61; stable and Beta desktop 1,029 passed + 13 skipped each; market 261; root 55). Installer build/verification follows the authorized source commit; see the exported acceptance record for artifact results.
- Goal: preserve the historical 2.0.6 diagnostic artifact and prepare a distinct 2.0.7 Windows candidate containing the platform-login diagnostics and automatic first-launch defaults.
- Acceptance: the stable desktop package is versioned 2.0.7, installer export refuses to overwrite an existing artifact, the complete repository gate passes, and a clean committed source tree can produce one verified 2.0.7 x64 installer plus matching SHA-256 sidecar.
- Authorization: user explicitly approved local commits and generation of the 2.0.7 installer on 2026-09-20. No push, deployment, signing, installer execution, real-account or DEV request is authorized by this approval.
- Client repair: account settings and login gate share one controller; focus reconciliation is non-flickering and cannot supersede account actions; missing Host routes do not fall back to Mock; transport failures are not mislabeled as password errors.
- Chat follow-up: Platform model discovery is present, but no desktop inference route/adapter is wired. Do not claim chat-ready acceptance from the model list or installer build. Agree the tenant-authorized inference contract before modifying Platform or handling model credentials.
