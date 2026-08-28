import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

export const dependencyManifest = Object.freeze({
  node: Object.freeze({
    version: '22.23.0',
    fileName: 'node-v22.23.0-win-x64.zip',
    url: 'https://nodejs.org/dist/v22.23.0/node-v22.23.0-win-x64.zip',
    sha256: '425a5bd68cc95e8eb16bcccd0a75081b48983fc6a26f67126bd4d6c7198231e8',
  }),
  winSw: Object.freeze({
    version: '2.12.0',
    fileName: 'WinSW.NET461.exe',
    url: 'https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW.NET461.exe',
    sha256: 'b5066b7bbdfba1293e5d15cda3caaea88fbeab35bd5b38c41c913d492aadfc4f',
  }),
})

const forbiddenConfiguration = /(?:RUNNER_DEVICE_TOKEN|RUNNER_TENANT_ID|RUNNER_USER_ID|RUNNER_ENROLLMENT_CODE|DEEPSEEK_API_KEY)\s*=/i

export function assertSecretFreePayload(files) {
  for (const file of files) {
    if (forbiddenConfiguration.test(file.content)) {
      throw new Error(`payload contains forbidden configuration: ${file.path}`)
    }
  }
}

export async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex')
}

export function renderServiceConfig() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<service>
  <id>FutureStaffLocalRunner</id>
  <name>FutureStaff Local Runner</name>
  <description>Connects this computer to FutureStaff for approved local actions.</description>
  <executable>%BASE%\\runtime\\node.exe</executable>
  <arguments>--enable-source-maps &quot;%BASE%\\app\\runner.mjs&quot;</arguments>
  <workingdirectory>%BASE%</workingdirectory>
  <env name="FUTURESTAFF_RUNNER_CONFIG" value="%ProgramData%\\FutureStaff\\LocalRunner\\runner.json" />
  <serviceaccount>
    <username>NT AUTHORITY\\LocalService</username>
  </serviceaccount>
  <startmode>Automatic</startmode>
  <stoptimeout>15 sec</stoptimeout>
  <onfailure action="restart" delay="10 sec"/>
  <resetfailure>1 hour</resetfailure>
  <logpath>%ProgramData%\\FutureStaff\\LocalRunner\\logs</logpath>
  <log mode="roll-by-size">
    <sizeThreshold>10485760</sizeThreshold>
    <keepFiles>5</keepFiles>
  </log>
</service>
`
}
