#!/usr/bin/env ts-node
import puppeteer from 'puppeteer'

interface Logger {
  info: (msg: string) => void
  success: (msg: string) => void
}

// 抖音泡泡玛特官方账号主页链接（示例）
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
    // 模拟一条含"补货"+"今天"的新视频
    posts = [
      { desc: 'Labubu 补货开售啦！', time: '今天' },
      { desc: 'Labubu 新品发售', time: '2天前' },
      { desc: 'Labubu 突击补货', time: '3小时前' },
    ]
    logger.info('[DEBUG] 使用模拟抖音视频数据')
  } else {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    const page = await browser.newPage()
    logger.info('打开抖音泡泡玛特官方账号主页...')
    await page.goto(DOUYIN_URL, { waitUntil: 'domcontentloaded' })
    await new Promise(resolve => setTimeout(resolve, 3000))
    posts = await extractDouyinPosts(page)
    await browser.close()
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