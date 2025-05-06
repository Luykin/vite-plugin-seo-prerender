import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'
import { recursiveMkdir } from './utils'

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const seoPrerender = async (config: any) => {
  const browser = await puppeteer.launch(Object.assign({ headless: 'new' }, config.puppeteer || {}));
  const page = await browser.newPage()
  const logTip: string = '[vite-plugin-seo-prerender:routes]'
  let network = {}
  if (config.network) {
    network = { waitUntil: 'networkidle0' }
  }

  for (const item of config.routes) {
    let pageUrl: string = config.local + item
    if (config.hashHistory) {
      pageUrl = `${config.local}/#${item}`
    }

    await page.goto(pageUrl, network)
    await page.setViewport({ width: 1024, height: 768 })
    await page.waitForSelector('body')
    if (config.delay) {
      await delay(config.delay)
    }

    // 👇 注入脚本：添加 window.__PRERENDERED__ 标记
    if (config.injectScript) {
      await page.evaluate((scriptContent) => {
        const script = document.createElement('script');
        script.textContent = scriptContent;
        // 添加特殊属性标记
        script.setAttribute('data-prerender', 'true');
        document.head.appendChild(script);
      }, config.injectScript);
    }

    let content: string = await page.content()

    if (config.removeStyle !== false) {
      content = content.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
    }

    const regLocal = new RegExp(config.local, 'g')
    content = content.replace(regLocal, '')

    if (config.callback) {
      content = config.callback(content, item) || content
    }
    // ✅ 精准删除带 data-prerender 属性的 <script> 标签
    content = content.replace(/<script[^>]*data-prerender="true"[^>]*>[\s\S]*?<\/script>/gi, '');

    if (item.indexOf('?') !== -1) {
      console.log(`${logTip} ${item} is error, unexpected ?`)
    } else {
      const fullPath = path.join(config.outDir, item)
      recursiveMkdir(fullPath)
      const filePath = path.join(fullPath, 'index.html')
      fs.writeFileSync(filePath, content)
      console.log(`${logTip} ${filePath.replace(/\\/g, '/')} is success!`)
    }
  }

  await browser.close();
  console.log(`${logTip} is complete`)
}

export default seoPrerender
