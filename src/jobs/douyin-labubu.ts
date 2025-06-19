#!/usr/bin/env ts-node
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { sendTelegramMessage } from '../utils/sendTelegramMessage'

puppeteer.use(StealthPlugin())

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
    for (let i = 0; i < 3; i++) {
      let browser = null
      try {
        browser = await puppeteer.launch({
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
            '--mute-audio',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection'
          ]
        })
        const page = await browser.newPage()
        
        // 设置更真实的浏览器特征
        await page.setViewport({ width: 1920, height: 1080 })
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36')
        
        // 设置额外的请求头
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'max-age=0'
        })

        logger.info(`(第 ${i + 1} 次尝试) 打开抖音泡泡玛特官方账号主页...`)
        
        // 使用最保守的导航策略
        await page.goto(DOUYIN_URL, { 
          waitUntil: 'load', // 使用最基本的等待条件
          timeout: 60000 
        })
        
        // 模拟真实用户行为
        await page.mouse.move(Math.random() * 1000, Math.random() * 1000)
        await page.mouse.wheel({ deltaY: 300 })
        
        // 增加更多的等待时间
        await new Promise(resolve => setTimeout(resolve, 12000))
        
        posts = await extractDouyinPosts(page)
        logger.info('成功获取页面内容。')
        await browser.close()
        break;
      }
      catch (error: any) {
        logger.info(`(第 ${i + 1} 次尝试) 发生错误: ${error.message}`)
        if (browser) {
          await browser.close()
        }
        if (i < 2) {
          logger.info('20 秒后重试...')
          await new Promise(resolve => setTimeout(resolve, 20000))
        } else {
          logger.info('所有尝试均失败。')
          throw error
        }
      }
    }
  }

  // 优先判断"补货"，其次"突击""发售"，并且必须是新视频
  let found = false
  for (const post of posts) {
    if (isRecentDouyinPost(post.time)) {
      let msg = ''
      if (post.desc.includes('补货')) {
        msg = `⚠️ 抖音 Labubu 补货新视频！\n描述：${post.desc}\n时间：${post.time}\n推送时间：${new Date().toLocaleString()}`
      } else if (post.desc.includes('突击') || post.desc.includes('发售')) {
        msg = `⚠️ 抖音 Labubu 突击/发售新视频！\n描述：${post.desc}\n时间：${post.time}\n推送时间：${new Date().toLocaleString()}`
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