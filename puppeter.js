const puppeteer = require('puppeteer');

async function scrapeInstagram(username) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'networkidle2' });

    // Tunggu sampai elemen postingan muncul
    await page.waitForSelector('article a');

    // Ambil semua postingan yang terlihat di halaman
    const postUrls = await page.evaluate(() => {
        return [...document.querySelectorAll('article a')].map(post => post.href);
    });

    console.log("Post URLs:", postUrls);

    await browser.close();
}

scrapeInstagram('ast_ranime_'); // Ganti dengan username yang ingin diambil
