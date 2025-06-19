#!/usr/bin/env ts-node
import { chromium, devices } from 'playwright'
import { sendTelegramMessage } from '../utils/sendTelegramMessage'

interface Logger {
  info: (msg: string) => void
  success: (msg: string) => void
}

// 抖音泡泡玛特官方账号主页链接
const DOUYIN_URL = 'https://www.douyin.com/user/MS4wLjABAAAAAA...'

// 判断是否为新视频
function isRecentDouyinPost(timeText: string): boolean {
  if (!timeText) return false
  if (timeText.includes('今天')) return true
  if (/^\d+小时前$/.test(timeText)) return true
  return false
}

// 提取视频描述和发布时间
async function extractDouyinPosts(page: any) {
  // 假设视频卡片为 .video-card，描述为 .desc，时间为 .time
  // 实际抖音页面结构可能需要根据真实 DOM 调整
  return await page.evaluate(() => {
    const posts: {desc: string, time: string}[] = []
    const cards = document.querySelectorAll('.video-card')
    cards.forEach(card => {
      const desc = (card.querySelector('.desc') as HTMLElement)?.innerText || ''
      const time = (card.querySelector('.time') as HTMLElement)?.innerText || ''
      posts.push({ desc, time })
    })
    return posts
  })
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
]

async function tryNavigate(url: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    let browser = null
    try {
      // 使用 Playwright 的 chromium
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-site-isolation-trials'
        ]
      })

      // 使用预定义的设备配置
      const device = devices['Desktop Chrome']

      // 创建上下文，设置 viewport 和 userAgent
      const context = await browser.newContext({
        ...device,
        viewport: { width: 1920, height: 1080 },
        userAgent: USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
        ignoreHTTPSErrors: true,
        // 添加更多的浏览器特征
        javaScriptEnabled: true,
        locale: 'zh-CN',
        timezoneId: 'Asia/Shanghai',
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false,
        permissions: ['geolocation']
      })

      // 创建新页面
      const page = await context.newPage()

      // 设置额外的请求头
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0',
        'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-User': '?1',
        'Sec-Fetch-Dest': 'document'
      })

      // 导航到页面
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      })

      // 等待一段时间
      await page.waitForTimeout(5000)

      // 模拟真实用户行为
      await page.mouse.move(Math.random() * 1000, Math.random() * 1000)
      await page.mouse.wheel(0, 400)
      await page.waitForTimeout(1000)

      // 提取数据
      const result = await extractDouyinPosts(page)

      // 关闭浏览器
      await browser.close()

      return result
    } catch (error: any) {
      console.log(`Navigation attempt ${i + 1} failed:`, error.message)
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

export async function runDouyinLabubuJob(logger: Logger, debugMode = false) {
  let posts: {desc: string, time: string}[] = []

  if (debugMode) {
    posts = [
      { desc: 'Labubu 补货开售啦！', time: '今天' },
      { desc: 'Labubu 新品发售', time: '2天前' },
      { desc: 'Labubu 突击补货', time: '3小时前' },
    ]
    logger.info('[DEBUG] 使用模拟抖音视频数据')
  } else {
    try {
      logger.info('打开抖音泡泡玛特官方账号主页...')
      posts = await tryNavigate(DOUYIN_URL)
    } catch (error: any) {
      logger.info(`发生错误: ${error.message}`)
      throw error
    }
  }

  // 优先判断"补货"，其次"突击""发售"，并且必须是新视频
  let found = false
  for (const post of posts) {
    if (isRecentDouyinPost(post.time)) {
      if (post.desc.includes('补货')) {
        logger.success('⚠️ 抖音 Labubu 补货新视频！描述：' + post.desc + ' 时间：' + post.time)
        found = true
        break
      } else if (post.desc.includes('突击') || post.desc.includes('发售')) {
        logger.success('⚠️ 抖音 Labubu 突击/发售新视频！描述：' + post.desc + ' 时间：' + post.time)
        found = true
        break
      }
    }
  }
  if (!found) {
    logger.info('抖音 Labubu 暂无补货/突击/发售相关新视频')
  }
}

if (require.main === module) {
  const logger = {
    info: console.log,
    success: console.log,
  }
  const debugMode = process.argv.includes('--debug') || process.env.DEBUG_MODE === 'true'
  runDouyinLabubuJob(logger, debugMode)
} 