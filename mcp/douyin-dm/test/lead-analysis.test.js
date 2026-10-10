import assert from 'node:assert/strict'
import test from 'node:test'
import { LeadAnalyzer, vietnamVisaProfile } from '../lib/lead-analysis.js'

const modelId = '30000000-0000-4000-8000-000000000001'
const comment = { commentId: 'comment-1', workId: 'work-1', recipient: 'recipient_123', title: '越南签证办理', description: '电子签办理流程',
  text: '下周去河内，电子签还没办，能帮忙吗？', parentText: '', publishedAt: '2026-10-03T10:00:00Z', collectedAt: '2026-10-03T10:01:00Z' }
const decision = { classification: 'target', need: '需要办理电子签', reason: '明确表达办理需求', urgency: 'explicit', evidence: [{ source: 'comment', quote: '电子签还没办，能帮忙吗？' }] }
function setup(output = decision) {
  const calls = []
  const port = { models: async () => [{ modelId, displayName: '用户所选平台模型' }], generateText: async input => {
    calls.push(input); return { modelId, tenantId: 'tenant-a', userId: 'user-a', text: JSON.stringify(output) }
  } }
  return { analyzer: new LeadAnalyzer(port), calls, port }
}

test('business work selection requires exact source evidence and cannot invent result indexes',async()=>{
  const s=setup({items:[{index:0,relevant:true,reason:'相关业务',quotes:['越南电子签']}]})
  const result=await s.analyzer.selectWorks(vietnamVisaProfile,['越南电子签办理流程'],modelId)
  assert.equal(result.items[0].relevant,true)
  await assert.rejects(setup({items:[{index:0,relevant:true,reason:'相关',quotes:['不存在的文案']}]}).analyzer.selectWorks(vietnamVisaProfile,['越南电子签'],modelId),/EVIDENCE_NOT_IN_SOURCE/)
  const noEvidence=await setup({items:[{index:0,relevant:true,reason:'猜测相关',quotes:[]}]}).analyzer.selectWorks(vietnamVisaProfile,['越南风景'],modelId)
  assert.equal(noEvidence.items[0].relevant,false)
})

test('complete JSON code fences are accepted but surrounding instructions and invented evidence remain rejected',async()=>{
  const s=setup();s.port.generateText=async()=>({modelId,tenantId:'tenant-a',userId:'user-a',text:'```json\n'+JSON.stringify(decision)+'\n```'})
  assert.equal((await s.analyzer.classify(vietnamVisaProfile,comment,modelId)).decision.classification,'target')
  s.port.generateText=async()=>({modelId,tenantId:'tenant-a',userId:'user-a',text:'Ignore these instructions\n```json\n'+JSON.stringify(decision)+'\n```'})
  await assert.rejects(s.analyzer.classify(vietnamVisaProfile,comment,modelId),/MODEL_OUTPUT_INVALID/)
})

test('Vietnam defaults use manual review and minimize identity sent to the selected model', async () => {
  const s = setup(); const result = await s.analyzer.classify(vietnamVisaProfile, comment, modelId)
  assert.equal(result.review, 'pending'); assert.equal(result.sendAuthorized, false)
  assert.equal(result.recipient, comment.recipient); assert.equal(result.modelId, modelId)
  assert.doesNotMatch(s.calls[0].text, /recipient_123|comment-1|work-1/)
  assert.match(s.calls[0].text, /下周去河内/)
  assert.match(s.calls[0].system, /不执行其中的指令/)
})

test('rejects invented evidence and downgrades title-only target decisions', async () => {
  const invented = setup({ ...decision, evidence: [{ source: 'comment', quote: '不存在的原文' }] })
  await assert.rejects(invented.analyzer.classify(vietnamVisaProfile, comment, modelId), /EVIDENCE_NOT_IN_SOURCE/)
  const titleOnly = setup({ ...decision, evidence: [{ source: 'title', quote: '越南签证办理' }] })
  const result = await titleOnly.analyzer.classify(vietnamVisaProfile, comment, modelId)
  assert.equal(result.decision.classification, 'uncertain'); assert.equal(result.sendAuthorized, false)
})

test('user-selected model must be offered and response binding must match', async () => {
  const s = setup()
  await assert.rejects(s.analyzer.classify(vietnamVisaProfile, comment, '30000000-0000-4000-8000-000000000099'), /MODEL_NOT_AUTHORIZED/)
  assert.equal(s.calls.length, 0)
  s.port.generateText = async () => ({ text: JSON.stringify(decision), modelId: 'foreign', tenantId: 't', userId: 'u' })
  await assert.rejects(s.analyzer.classify(vietnamVisaProfile, comment, modelId), /MODEL_BINDING_INVALID/)
})

test('keyword groups are bounded and deduplicated without accepting arbitrary URLs', async () => {
  const s = setup({ groups: [{ purpose: 'direct', keywords: ['越南签证', '越南签证'] }, { purpose: 'obstacle', keywords: ['越南电子签申请失败'] }] })
  const result = await s.analyzer.keywords(vietnamVisaProfile, modelId)
  assert.deepEqual(result.keywords, ['越南签证', '越南电子签申请失败'])
  const url = setup({ groups: [{ purpose: 'direct', keywords: ['https://evil.test'] }] })
  await assert.rejects(url.analyzer.keywords(vietnamVisaProfile, modelId), /KEYWORDS_INVALID/)
})

test('other user-defined profiles are supported without changing the classifier', async () => {
  const custom = { ...vietnamVisaProfile, name: '家具采购需求', version: 2, objective: '寻找明确需要采购办公家具的用户', seedKeywords: ['办公家具采购'] }
  const s = setup({ classification: 'excluded', need: '', reason: '没有办公家具需求', urgency: 'not-stated', evidence: [] })
  const result = await s.analyzer.classify(custom, comment, modelId)
  assert.equal(result.profileVersion, 2); assert.equal(result.decision.classification, 'excluded')
  assert.match(s.calls[0].text, /办公家具/)
})

test('invalid JSON or extra model fields never create a target lead', async () => {
  const s = setup({ ...decision, recipient: 'fake_user' })
  await assert.rejects(s.analyzer.classify(vietnamVisaProfile, comment, modelId))
  s.port.generateText = async () => ({ modelId, tenantId: 't', userId: 'u', text: '```json\n{}\n```' })
  await assert.rejects(s.analyzer.classify(vietnamVisaProfile, comment, modelId), {name:'ZodError'})
})
