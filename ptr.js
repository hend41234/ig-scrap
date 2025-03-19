const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const yargs = require('yargs');
const fs = require('fs');
const path = require('path');
const { parse } = require('json2csv');

puppeteer.use(StealthPlugin());

const COOKIES_PATH = "cookies_ptr.json";

async function saveCookies(page) {
    const cookies = await page.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
}

async function loadCookies(page) {
    if (fs.existsSync(COOKIES_PATH)) {
        const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH));
        await page.setCookie(...cookies);
    }
}

const argv = yargs
    .option('u', { alias: 'username', type: 'string', demandOption: true })
    .option('q', { alias: 'quantity', type: 'number' })
    .option('sv', { alias: 'save', type: 'string' })
    .option('t', { alias: 'type', type: 'string', choices: ['json', 'csv'], default: 'json' })
    .check(argv => {
        if (!argv.q) throw new Error('Use -q for quantity');
        return true;
    })
    .help()
    .argv;

async function sleep(time = 2000) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

async function humanScroll(page) {
    for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, 500));
        await sleep(2000 + Math.random() * 1000);
    }
}

async function detectAndClosePopup(page) {
    try {
        // Cek apakah popup login muncul
        const popupSelector = 'div[role="dialog"]';
        const closeButtonSelector = 'div[role="button"]'; // Biasanya tombol X

        const popupExists = await page.waitForSelector(popupSelector, { timeout: 5000 }).catch(() => null);
        if (popupExists) {
            console.log("Popup login detected!");

            // Coba cari tombol X untuk menutup
            const closeButton = await page.$(closeButtonSelector);
            if (closeButton) {
                console.log("Menutup popup login...");
                await closeButton.click();
                await sleep(3000);
                return true; // Berhasil ditutup
            } else {
                console.log("Popup login cant be closed. Stopped scraping.");
                return false; // Tidak ada tombol untuk menutup
            }
        }
    } catch (err) {
        console.error("Error while checking for popup:", err);
    }
    return true; // Lanjutkan scraping jika tidak ada popup
}

async function scrapeInstagram(username, postCount) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await loadCookies(page);
    await page.goto(`https://www.instagram.com/${username}/reels`, { waitUntil: 'domcontentloaded' });

    const popupHandled = await detectAndClosePopup(page);
    if (!popupHandled) {
        await browser.close();
        return;
    }

    await page.waitForSelector('a[href*="/p/"], a[href*="/reel/"]', { timeout: 30000 });


    let postUrls = new Set();
    let lastHeight = 0;

    while (postUrls.size < postCount) {
        let newPosts = await page.evaluate(() =>
            Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'))
                .map(post => post.href)
        );
        newPosts.forEach(url => postUrls.add(url));

        console.log(`Total posts collected: ${postUrls.size}`);

        if (postUrls.size >= postCount) break;

        lastHeight = await page.evaluate(() => document.body.scrollHeight);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        // await page.waitForTimeout(2000);
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 4000)));
        let newHeight = await page.evaluate(() => document.body.scrollHeight);
        if (newHeight === lastHeight) break;
        await sleep(3000 + Math.random() * 3000);
    }
    await sleep(3000 + Math.random() * 4000);
    await saveCookies(page);
    await browser.close();
    return Array.from(postUrls).slice(0, postCount);
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

    console.log(`Results saved to: ${filePath}`);
}

const username = argv.u;
if (argv.q) {
    result = scrapeInstagram(username, argv.q);
    result.then(data => {
        saveResults(data, argv.sv, argv.type);
    });
}