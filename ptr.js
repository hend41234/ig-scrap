const puppeteer = require('puppeteer');
const yargs = require('yargs');
const fs = require('fs');
const path = require('path');
const { parse } = require('json2csv');
const { timeEnd } = require('console');

// Parsing command line arguments
const argv = yargs
    .option('u', {
        alias: 'username',
        type: 'string',
        description: 'Username Instagram target',
        demandOption: true,
    })
    .option('q', {
        alias: 'quantity',
        type: 'number',
        description: 'Jumlah postingan yang ingin diambil',
    })
    .option('s', {
        alias: 'since',
        type: 'string',
        description: 'Ambil postingan sejak tanggal tertentu (format: YYYY-MM-DD)',
    })
    .option('sv', {
        alias: 'save',
        type: 'string',
        description: 'Nama file untuk menyimpan hasil (tanpa ekstensi)',
    })
    .option('t', {
        alias: 'type',
        type: 'string',
        choices: ['json', 'csv'],
        description: 'Tipe file penyimpanan (json/csv), default: json',
        default: 'json',
    })
    .conflicts('q', 's')
    .check((argv) => {
        if (!argv.q && !argv.s) {
            throw new Error('Gunakan salah satu antara -q atau -s');
        }
        return true;
    })
    .help()
    .argv;


function sleep(time = 2000) {
    return new Promise((resolve) => setTimeout(resolve, time));
}
// Fungsi untuk menyimpan hasil
function saveResults(data, filename, type) {
    if (!filename) return;
    const filePath = path.resolve(`${filename}.${type}`);

    if (type === 'json') {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } else if (type === 'csv') {
        const csvData = parse(data, { fields: ['link'] });
        fs.writeFileSync(filePath, csvData, 'utf8');
    }

    console.log(`Hasil disimpan di: ${filePath}`);
}

// Fungsi untuk scrape berdasarkan jumlah postingan
async function scrapeInstagramByQuantity(username, postCount) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'networkidle2' });

    await page.waitForSelector('article a',{timeout: 60000}).catch(() => {
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

        console.log(`Total post terkumpul: ${postUrls.size}`);

        if (postUrls.size < postCount) {
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });
            await page.waitForTimeout(60000);
        }
    }

    const result = Array.from(postUrls).slice(0, postCount).map(url => ({ link: url }));

    saveResults(result, argv.sv, argv.t);

    console.log("Final Post URLs:", result);

    await browser.close();
}

// Fungsi untuk scrape berdasarkan tanggal
async function scrapeInstagramByDate(username, startDate) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'networkidle2' });

    await page.waitForSelector('article a');

    let postUrls = [];
    let keepScrolling = true;

    while (keepScrolling) {
        let newPosts = await page.evaluate(() => {
            return [...document.querySelectorAll('article a')].map(post => ({ link: post.href }));
        });

        for (let postObj of newPosts) {
            if (!postUrls.some(p => p.link === postObj.link)) {
                postUrls.push(postObj);

                await page.goto(postObj.link, { waitUntil: 'networkidle2' });
                let postDate = await page.evaluate(() => {
                    return document.querySelector('time')?.getAttribute('datetime');
                });

                if (postDate) {
                    postDate = new Date(postDate);
                    if (postDate < startDate) {
                        keepScrolling = false;
                        break;
                    }
                }
            }
        }

        if (keepScrolling) {
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });
            await page.waitForTimeout(2000);
        }
    }

    saveResults(postUrls, argv.sv, argv.t);

    console.log("Final Post URLs:", postUrls);

    await browser.close();
}

// Menjalankan script berdasarkan parameter yang diberikan
const username = argv.u;

if (argv.q) {
    scrapeInstagramByQuantity(username, argv.q);
} else if (argv.s) {
    const startDate = new Date(argv.s);
    if (isNaN(startDate)) {
        console.error("Format tanggal salah! Gunakan format YYYY-MM-DD.");
        process.exit(1);
    }
    scrapeInstagramByDate(username, startDate);
}
