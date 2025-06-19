#!/usr/bin/env ts-node
import puppeteer from 'puppeteer'
import { sendTelegramMessage } from '../utils/sendTelegramMessage'

// Logger 类型补丁
interface Logger {
  info: (msg: string) => void
  success: (msg: string) => void
}

// 新增：判断是否为"新帖"
function isRecentPost(timeText: string): boolean {
  if (!timeText) return false
  if (timeText.includes('刚刚')) return true
  if (/^\d+分钟前$/.test(timeText)) return true
  if (timeText === '1小时前') return true
  return false
}

// 新增：提取所有帖子内容和时间
async function extractPosts(page: any) {
  // 这里假设帖子内容在 .note-card .content，时间在 .note-card .time
  // 实际小红书页面结构可能需要根据真实 DOM 调整
  return await page.evaluate(() => {
    const posts: {content: string, time: string}[] = []
    const noteCards = document.querySelectorAll('.note-card')
    noteCards.forEach(card => {
      const content = (card.querySelector('.content') as HTMLElement)?.innerText || ''
      const time = (card.querySelector('.time') as HTMLElement)?.innerText || ''
      posts.push({ content, time })
    })
    return posts
  })
}

export async function runLabubuJob(logger: Logger, debugMode = false) {
  let posts: {content: string, time: string}[] = []

  if (debugMode) {
    // 模拟一条含"补货"+"刚刚"的新帖
    posts = [
      { content: 'Labubu 补货啦！速来', time: '刚刚' },
      { content: 'Labubu 突击发售', time: '2小时前' },
      { content: 'Labubu 发售', time: '10分钟前' },
    ]
    logger.info('[DEBUG] 使用模拟帖子数据')
  } else {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    const page = await browser.newPage()

    logger.info('打开小红书搜索页...')
    await page.goto('https://www.xiaohongshu.com/search_result?keyword=labubu', {
      waitUntil: 'domcontentloaded',
    })

    await new Promise(resolve => setTimeout(resolve, 3000)) // 等待页面内容加载

    posts = await extractPosts(page)
    await browser.close()
  }

  // 优先判断"补货"，其次"突击"+"发售"，并且必须是新帖
  let found = false
  for (const post of posts) {
    if (isRecentPost(post.time)) {
      let msg = ''
      if (post.content.includes('补货')) {
        msg = `⚠️ [小红书] Labubu补货新帖！\n内容：${post.content}\n时间：${post.time}\n推送时间：${new Date().toLocaleString()}`
      } else if (post.content.includes('突击') || post.content.includes('发售')) {
        msg = `⚠️ [小红书] Labubu突击/发售新帖！\n内容：${post.content}\n时间：${post.time}\n推送时间：${new Date().toLocaleString()}`
      }
      if (msg) {
        logger.success(msg)
        await sendTelegramMessage(msg)
        found = true
        break
      }
    }
  }
  if (!found) {
    logger.info('暂无补货/突击/发售相关新帖')
  }
}

// CLI 入口
if (require.main === module) {
  const logger = {
    info: console.log,
    success: console.log,
  }
  const debugMode = process.argv.includes('--debug') || process.env.DEBUG_MODE === 'true'
  runLabubuJob(logger, debugMode)
}
