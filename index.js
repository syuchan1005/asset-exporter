import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import playwright from 'playwright-core';

import { mfLogin, mfMetric, mtLogin, mtMetric } from './scraper.js';

const moneyForwardEmail = process.env.MONEYFORWARD_EMAIL || '';
const moneyForwardPassword = process.env.MONEYFORWARD_PASSWORD || '';
const isMoneyForwardAvailable = moneyForwardEmail !== '' && moneyForwardPassword !== '';
if (!isMoneyForwardAvailable) {
    console.warn('Please set MONEYFORWARD_EMAIL and MONEYFORWARD_PASSWORD');
}
const moneyTreeEmail = process.env.MONEYTREE_EMAIL || '';
const moneyTreePassword = process.env.MONEYTREE_PASSWORD || '';
const isMoneyTreeAvailable = moneyTreeEmail !== '' && moneyTreePassword !== '';
if (!isMoneyTreeAvailable) {
    console.warn('Please set MONEYTREE_EMAIL and MONEYTREE_PASSWORD');
}

if (!isMoneyForwardAvailable && !isMoneyTreeAvailable) {
    console.error('No scraping target');
    process.exit(1);
}

const app = new Hono();
app.get('/', (c) => c.html('<h1>Asset Exporter</h1><a href="/metrics">Metrics</a>'));
app.get('/metrics', async (c) => {
    const lines = [];
    let browser;
    let page;
    try {
        try {
            browser = await playwright.chromium.launch();
        } catch (e) {
            browser = await playwright.chromium.launch({ channel: 'chrome' });
        }

        const context = await browser.newContext({
            locale: 'ja-JP',
            timezoneId: 'Asia/Tokyo',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            bypassCSP: true,
        });

        if (isMoneyForwardAvailable) {
            page = await context.newPage();
            await mfLogin(page, moneyForwardEmail, moneyForwardPassword);
            lines.push('# MoneyForward');
            lines.push(await mfMetric(page));
        }

        if (isMoneyTreeAvailable) {
            page = await context.newPage();
            await mtLogin(page, moneyTreeEmail, moneyTreePassword);
            lines.push('# MoneyTree');
            lines.push(await mtMetric(page));
        }
    } catch (e) {
        console.error(e);
        await page.screenshot({ path: 'error.png' });
    } finally {
        await browser.close();
    }
    return c.text(lines.join('\n'), 200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
});

serve({ fetch: app.fetch, port: process.env.PORT || 8080 }, (info) => {
    console.log(`🚀 Server listening on http://localhost:${info.port}`)
});
