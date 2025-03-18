const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const yargs = require('yargs');
const fs = require('fs');
const path = require('path');
const { parse } = require('json2csv');
const { time } = require('console');

puppeteer.use(StealthPlugin());
process.loadEnvFile();
const xIgAppId = process.env.X_IG_APP_ID
const Cookie = process.env.COOKIE
const argv = yargs
    .option('u', { alias: 'username', type: 'string', demandOption: true })
    .option('q', { alias: 'quantity', type: 'number' })
    .option('s', { alias: 'since', type: 'string' })
    .option('sv', { alias: 'save', type: 'string' })
    .option('t', { alias: 'type', type: 'string', choices: ['json', 'csv'], default: 'json' })
    .conflicts('q', 's')
    .check(argv => {
        if (!argv.q && !argv.s) throw new Error('Gunakan -q atau -s');
        return true;
    })
    .help()
    .argv;

function sleep(time = 2000) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

async function scrapeInstagramByQuantity(username, postCount) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'domcontentloaded' });
    await page.setExtraHTTPHeaders(
        {
            "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
            "X-IG-App-ID": xIgAppId,
            "X-Fb-Lsd": "-iD--QFPNXFv0VPZEPRRf7",
            "X-Asbd-Id": "359341",
            "Set-Fetch-Site":"same-origin",
            "sec-ch-ua-mobile":"?0",
            // "Cookie":Cookie
        }
    )
    await page.waitForSelector('article a', { timeout: 60000 }).catch(() => {
        console.error("Elemen postingan tidak ditemukan atau akun private!");
        process.exit(1);
    });

    let postUrls = new Set();

    while (postUrls.size < postCount) {
        let newPosts = await page.evaluate(() => {
            return [...document.querySelectorAll('article a')].map(post => ({ link: post.href }));
        });
        await sleep(3000);

        newPosts.forEach(urlObj => postUrls.add(urlObj.link));

        if (postUrls.size < postCount) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(3000);
        }
    }

    const result = Array.from(postUrls).slice(0, postCount).map(url => ({ link: url }));
    saveResults(result, argv.sv, argv.t);

    console.log("Final Post URLs:", result);

    await browser.close();
}

function saveResults(data, filename, type) {
    if (!filename) return;
    const filePath = path.resolve(`${filename}.${type}`);

    if (type === 'json') {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } else {
        const csvData = parse(data, { fields: ['link'] });
        fs.writeFileSync(filePath, csvData, 'utf8');
    }

    console.log(`Hasil disimpan di: ${filePath}`);
}

const username = argv.u;
if (argv.q) scrapeInstagramByQuantity(username, argv.q);
