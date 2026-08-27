import { startSelectionCenterMock } from './mock.js'

const apiKey = process.env.SELECTION_CENTER_API_KEY?.trim() || 'futurestaff-local-mock'
const port = process.env.SELECTION_CENTER_MOCK_PORT ? Number(process.env.SELECTION_CENTER_MOCK_PORT) : 3301
const mock = await startSelectionCenterMock({ apiKey, port })
process.stderr.write(`${JSON.stringify({ event: 'selection_center_mock_started', baseUrl: mock.baseUrl })}\n`)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void mock.close().then(() => { process.exitCode = 0 }))
}
