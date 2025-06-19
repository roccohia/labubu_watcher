#!/usr/bin/env ts-node
import { chromium } from 'playwright'
import fs from 'fs'
import { sendTelegramMessage } from '../utils/sendTelegramMessage'

interface Logger {
  info: (msg: string) => void
  success: (msg: string) => void
}

// 淘宝商品页面链接
const TAOBAO_URL = 'https://detail.tmall.com/item.htm?id=820704313108&scene=taobao_shop&sku_properties=134942334%3A16301649857&spm=a312a.7700824.w21034790-25036845630.3.ad887371V91Wgl'
const COOKIES_PATH = 'taobao-cookies.json'

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
          '--disable-gpu'
        ]
      })

      // 创建上下文，设置 viewport 和 userAgent
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
        ignoreHTTPSErrors: true,
        // 添加更多的浏览器特征
        javaScriptEnabled: true,
        locale: 'zh-CN',
        timezoneId: 'Asia/Shanghai',
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false
      })

      // 创建新页面
      const page = await context.newPage()

      // 如果存在 cookies，加载它们
      if (fs.existsSync(COOKIES_PATH)) {
        const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'))
        await context.addCookies(cookies)
      }

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
      await page.mouse.wheel({ deltaY: 400 })
      await page.waitForTimeout(1000)

      // 检查按钮文本
      const buttonSelector = '#purchasePanel > div._4nNipe17pV--footWrap--_5db9b8b > div > div._4nNipe17pV--LeftButtonList--_21fe567 > button:nth-child(1)'
      const buttonText = await page.textContent(buttonSelector) || ''
      const hasStock = buttonText.includes('立即购买')

      // 关闭浏览器
      await browser.close()

      return { hasStock, buttonText }
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

export async function runTaobaoLabubuJob(logger: Logger, debugMode = false) {
  let hasStock = false
  let buttonText = ''

  if (debugMode) {
    hasStock = true
    buttonText = '立即购买'
    logger.info('[DEBUG] 使用模拟淘宝商品数据')
  } else {
    try {
      if (fs.existsSync(COOKIES_PATH)) {
        logger.info('[DEBUG] 已加载 cookies，模拟登录淘宝')
      }
      
      logger.info('打开淘宝商品页...')
      const result = await tryNavigate(TAOBAO_URL)
      hasStock = result.hasStock
      buttonText = result.buttonText
    } catch (error: any) {
      logger.info(`发生错误: ${error.message}`)
      throw error
    }
  }

  if (hasStock) {
    const msg = `⚠️ [淘宝] Labubu补货/可购买！\n按钮：${buttonText}\n推送时间：${new Date().toLocaleString()}`
    logger.success(msg)
    await sendTelegramMessage(msg)
  } else {
    logger.info('淘宝 Labubu 暂无补货/可购买')
  }
}

if (require.main === module) {
  const logger = {
    info: console.log,
    success: console.log,
  }
  const debugMode = process.argv.includes('--debug') || process.env.DEBUG_MODE === 'true'
  runTaobaoLabubuJob(logger, debugMode)
} 