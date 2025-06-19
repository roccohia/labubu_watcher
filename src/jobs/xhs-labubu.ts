#!/usr/bin/env ts-node
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { sendTelegramMessage } from '../utils/sendTelegramMessage'

puppeteer.use(StealthPlugin())

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

async function createBrowser() {
  return await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--window-size=1920,1080',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      '--disable-extensions',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--mute-audio'
    ]
  })
}

async function tryNavigate(url: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    let browser = null
    let page = null
    try {
      browser = await createBrowser()
      page = await browser.newPage()
      
      // 随机选择一个 User-Agent
      const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
      await page.setUserAgent(userAgent)
      
      // 设置视窗大小
      await page.setViewport({ width: 1920, height: 1080 })
      
      // 设置请求超时
      await page.setDefaultNavigationTimeout(30000)
      
      // 设置额外的请求头
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0'
      })

      // 简化的导航策略
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      })

      // 等待一段时间
      await new Promise(resolve => setTimeout(resolve, 5000))

      // 模拟滚动
      await page.evaluate(() => {
        window.scrollBy(0, 500)
      })

      await new Promise(resolve => setTimeout(resolve, 2000))

      const result = await extractPosts(page)
      return result
    } catch (error: any) {
      console.log(`Navigation attempt ${i + 1} failed:`, error.message)
      if (page) {
        await page.close().catch(() => {})
      }
      if (browser) {
        await browser.close().catch(() => {})
      }
      if (i === maxRetries - 1) {
        throw error
      }
      await new Promise(resolve => setTimeout(resolve, 10000))
    }
  }
  throw new Error('Navigation failed after all retries')
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
]

export async function runLabubuJob(logger: Logger, debugMode = false) {
  let posts: {content: string, time: string}[] = []

  if (debugMode) {
    posts = [
      { content: 'Labubu 补货啦！速来', time: '刚刚' },
      { content: 'Labubu 突击发售', time: '2小时前' },
      { content: 'Labubu 发售', time: '10分钟前' },
    ]
    logger.info('[DEBUG] 使用模拟帖子数据')
  } else {
    try {
      logger.info('打开小红书搜索页...')
      posts = await tryNavigate('https://www.xiaohongshu.com/search_result?keyword=labubu')
    } catch (error: any) {
      logger.info(`发生错误: ${error.message}`)
      throw error
    }
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
