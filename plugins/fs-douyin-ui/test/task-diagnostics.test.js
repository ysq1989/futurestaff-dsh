import test from 'node:test'
import assert from 'node:assert/strict'
import { diagnosed } from '../lib/task-diagnostics.js'
const signal=new AbortController().signal
test('provider codes and task stages survive without reflecting sensitive messages',async()=>{
  const error=Object.assign(Error('private-token-and-model-output'),{code:'FUTURESTAFF_PROVIDER'})
  await assert.rejects(diagnosed('KEYWORDS',signal,async()=>{throw error}),{message:'MODEL_PROVIDER_UNAVAILABLE'})
  await assert.rejects(diagnosed('SEARCH',signal,async()=>{throw Error('private-local-path')}),{message:'SEARCH_FAILED'})
  await assert.rejects(diagnosed('SELECTION',signal,async()=>{throw Object.assign(Error('raw-output'),{name:'ZodError'})}),{message:'SELECTION_RESPONSE_INVALID'})
})
test('validation and evidence errors remain fixed diagnostics rather than a generic task failure',async()=>{
  await assert.rejects(diagnosed('KEYWORDS',signal,async()=>{throw Error('MODEL_OUTPUT_INVALID')}),{message:'MODEL_OUTPUT_INVALID'})
  await assert.rejects(diagnosed('SELECTION',signal,async()=>{throw Error('EVIDENCE_NOT_IN_SOURCE')}),{message:'EVIDENCE_NOT_IN_SOURCE'})
})
