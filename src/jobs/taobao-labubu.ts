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

// 淘宝商品页面链接（请替换为实际 Labubu 商品链接）
const TAOBAO_URL = 'https://detail.tmall.com/item.htm?id=820704313108&scene=taobao_shop&sku_properties=134942334%3A16301649857&spm=a312a.7700824.w21034790-25036845630.3.ad887371V91Wgl'
const COOKIES_PATH = 'taobao-cookies.json' // 需提前导出

export async function runTaobaoLabubuJob(logger: Logger, debugMode = false) {
  let hasStock = false
  let buttonText = ''

  if (debugMode) {
    hasStock = true
    buttonText = '立即购买'
    logger.info('[DEBUG] 使用模拟淘宝商品数据')
  } else {
    const browser = await puppeteer.launch({ headless: false })
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36')
    await page.setViewport({ width: 1280, height: 800 })

    // 加载登录 cookies
    if (fs.existsSync(COOKIES_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'))
      await page.setCookie(...cookies)
      logger.info('[DEBUG] 已加载 cookies，模拟登录淘宝')
    } else {
      logger.info('[WARN] 未找到 taobao-cookies.json，请先用 Chrome 登录淘宝并导出 cookies')
    }

    logger.info('打开淘宝商品页...')
    await page.goto(TAOBAO_URL, { waitUntil: 'domcontentloaded' })
    await new Promise(resolve => setTimeout(resolve, 3000))

    // 检查按钮文本（用 CSS 选择器）
    const btn = await page.$('#purchasePanel > div._4nNipe17pV--footWrap--_5db9b8b > div > div._4nNipe17pV--LeftButtonList--_21fe567 > button:nth-child(1)');
    let btnText = '';
    if (btn) {
      btnText = await page.evaluate(el => (el as HTMLElement).innerText, btn);
    }
    hasStock = btnText.includes('立即购买');
    buttonText = btnText;
    await browser.close()
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