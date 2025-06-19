#!/usr/bin/env ts-node
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import fs from 'fs'
import { sendTelegramMessage } from '../utils/sendTelegramMessage'

puppeteer.use(StealthPlugin())

interface Logger {
  info: (msg: string) => void
  success: (msg: string) => void
}

// 淘宝商品页面链接
const TAOBAO_URL = 'https://detail.tmall.com/item.htm?id=820704313108&scene=taobao_shop&sku_properties=134942334%3A16301649857&spm=a312a.7700824.w21034790-25036845630.3.ad887371V91Wgl'
const COOKIES_PATH = 'taobao-cookies.json'

export async function runTaobaoLabubuJob(logger: Logger, debugMode = false) {
  let hasStock = false
  let buttonText = ''

  if (debugMode) {
    hasStock = true
    buttonText = '立即购买'
    logger.info('[DEBUG] 使用模拟淘宝商品数据')
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

        if (fs.existsSync(COOKIES_PATH)) {
          const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'))
          await page.setCookie(...cookies)
          logger.info('[DEBUG] 已加载 cookies，模拟登录淘宝')
        }

        logger.info(`(第 ${i + 1} 次尝试) 打开淘宝商品页...`)
        
        // 使用最保守的导航策略
        await page.goto(TAOBAO_URL, { 
          waitUntil: 'load', // 使用最基本的等待条件
          timeout: 60000 
        })

        // 模拟真实用户行为
        await page.mouse.move(Math.random() * 1000, Math.random() * 1000)
        await page.mouse.wheel({ deltaY: 400 })
        
        // 增加更多的等待时间
        await new Promise(resolve => setTimeout(resolve, 12000))

        const buttonSelector = '#purchasePanel > div._4nNipe17pV--footWrap--_5db9b8b > div > div._4nNipe17pV--LeftButtonList--_21fe567 > button:nth-child(1)'
        const btn = await page.$(buttonSelector)
        if (btn) {
          buttonText = await page.evaluate(el => (el as HTMLElement).innerText, btn)
        }
        hasStock = buttonText.includes('立即购买')
        logger.info('成功获取页面内容。')
        await browser.close()
        break;
      } catch (error: any) {
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