const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const yargs = require('yargs');
const fs = require('fs');
const path = require('path');
const { parse } = require('json2csv');

puppeteer.use(StealthPlugin());

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

async function scrapeInstagramByQuantity(username, postCount) {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('article a', { timeout: 60000 }).catch(() => {
        console.error("Elemen postingan tidak ditemukan atau akun private!");
        process.exit(1);
    });

    let postUrls = new Set();

    while (postUrls.size < postCount) {
        let newPosts = await page.evaluate(() => {
            return [...document.querySelectorAll('article a')].map(post => ({ link: post.href }));
        });

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
