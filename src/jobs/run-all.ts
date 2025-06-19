#!/usr/bin/env ts-node
import { runLabubuJob as runXhsLabubuJob } from './xhs-labubu'
import { runTaobaoLabubuJob } from './taobao-labubu'

const logger = {
  info: (msg: string) => console.log('[INFO]', msg),
  success: (msg: string) => console.log('[SUCCESS]', msg),
}

async function main() {
  const debugMode = process.argv.includes('--debug') || process.env.DEBUG_MODE === 'true'
  console.log('=== 运行小红书 Labubu 监控 ===')
  await runXhsLabubuJob(logger, debugMode)
  console.log('=== 运行淘宝 Labubu 监控 ===')
  await runTaobaoLabubuJob(logger, debugMode)
}

if (require.main === module) {
  main()
} 