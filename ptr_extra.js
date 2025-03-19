const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const readlineSync = require('readline-sync');
const { program } = require('commander');

puppeteer.use(StealthPlugin());

program
    .requiredOption('-u, --username <username>', 'Target Instagram username')
    .option('-q, --quantity <quantity>', 'Number of posts to fetch', parseInt)
    .option('-s, --since <date>', 'Fetch posts since a specific date (yyyy-mm-dd)')
    .option('--sv, --save <filename>', 'Save output to file (without extension)', 'output')
    .option('-e, --email <email>', 'Your Instagram email/username')
    .option('-p, --password <password>', 'Your Instagram password')
    .help();

program.parse(process.argv);
const options = program.opts();

const COOKIES_PATH = path.join(__dirname, 'cookies.json');

function sleep(time = 2000) {
    return new Promise((resolve) => setTimeout(resolve, time));
}
async function login(page) {
    if (options.email && !options.password) {
        console.error('Error: If you specify -e (email), you must also specify -p (password).');
        process.exit(1);
    }

    console.log('Logging in...');
    const email = options.email || readlineSync.question('Enter your Instagram email/username: ');
    const password = options.password || readlineSync.question('Enter your Instagram password: ', { hideEchoBack: true });

    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[name=username]');
    await page.type('input[name=username]', email, { delay: 100 });
    await page.type('input[name=password]', password, { delay: 100 });
    await page.click('button[type=submit]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    const isLoggedIn = await page.evaluate(() => !document.querySelector('input[name=username]'));
    if (!isLoggedIn) {
        console.error('Error: Login failed. Please check your credentials.');
        process.exit(1);
    }

    const cookies = await page.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
}

async function scrapeByQuantity(page, username, postCount) {
    await sleep(2000 + Math.random() * 2000);
    await page.goto(`https://www.instagram.com/${username}/reels`, { waitUntil: 'networkidle2' });
    // await page.waitForSelector('article a', { timeout: 30000 });
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
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));
        let newHeight = await page.evaluate(() => document.body.scrollHeight);
        if (newHeight === lastHeight) break;
        await sleep(3000 + Math.random() * 3000);
    }
    await sleep(3000 + Math.random() * 4000);
    return Array.from(postUrls).slice(0, postCount);
}

async function scrapeByDate(page, username, sinceDate) {
    await page.goto(`https://www.instagram.com/${username}/reels/`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('a[href*="/p/"], a[href*="/reel/"]', { timeout: 30000 });

    let postUrls = new Set();
    let keepScrolling = true;
    let lastPostCount = 0; // Jumlah post yang sudah ditemukan sebelumnya

    while (keepScrolling) {
        console.log("Mengumpulkan post dari halaman profil...");

        // Ambil semua post saat ini
        let allPosts = await page.evaluate(() =>
            Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'))
                .map(post => post.href)
        );

        // **Ambil hanya post yang baru muncul setelah scroll**
        let newPosts = allPosts.slice(lastPostCount);
        lastPostCount = allPosts.length; // Update jumlah total post yang telah diambil

        console.log(`Ditemukan ${newPosts.length} post baru`);

        if (newPosts.length === 0) {
            console.log("Tidak ada post baru setelah scroll, menghentikan pencarian.");
            break;
        }

        let foundOlderPost = false;

        for (let postUrl of newPosts) {
            if (!postUrls.has(postUrl)) {
                postUrls.add(postUrl);
                console.log(`Mengecek tanggal dari post: ${postUrl}`);

                try {
                    // **Buka tab baru untuk memeriksa tanggal**
                    const newTab = await page.browser().newPage();
                    await newTab.goto(postUrl, { waitUntil: 'domcontentloaded' });

                    // Tunggu elemen waktu muncul
                    await newTab.waitForSelector('time', { timeout: 5000 });

                    let postDate = await newTab.evaluate(() => {
                        const timeElement = document.querySelector('time');
                        return timeElement ? new Date(timeElement.getAttribute('datetime')) : null;
                    });

                    await newTab.close(); // Tutup tab setelah mendapatkan data

                    if (postDate) {
                        console.log(`Tanggal post: ${postDate}`);

                        if (postDate < new Date(sinceDate)) {
                            console.log("Ditemukan post lebih lama dari batas tanggal.");
                            foundOlderPost = true;
                        }
                    } else {
                        console.log("Gagal mendapatkan tanggal post, lanjut ke post berikutnya.");
                    }
                } catch (err) {
                    console.error(`Gagal mendapatkan tanggal dari ${postUrl}:`, err.message);
                }
            }
            await sleep(3000 + Math.random() * 3000);
        }

        if (foundOlderPost) {
            console.log("Post lama ditemukan, menghentikan scroll.");
            break;
        }

        // **Pastikan scrolling tetap di halaman profil**
        let lastHeight = await page.evaluate(() => document.body.scrollHeight);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(resolve => setTimeout(resolve, 2000));
        let newHeight = await page.evaluate(() => document.body.scrollHeight);

        if (newHeight === lastHeight) {
            console.log("Tidak ada post baru setelah scroll, menghentikan pencarian.");
            break;
        }
    }

    return Array.from(postUrls);
}







(async () => {
    hdls = false;
    const browser = await puppeteer.launch({ headless: hdls, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    if (!hdls) await page.setViewport({ width: 1280, height: 800 });

    let cookiesValid = false;
    if (!options.email && !options.password && fs.existsSync(COOKIES_PATH) && fs.statSync(COOKIES_PATH).size > 0) {
        try {
            const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH));
            await page.setCookie(...cookies);
            await page.goto(`https://www.instagram.com/${options.username}/`, { waitUntil: 'networkidle2' });
            cookiesValid = await page.evaluate(() => !document.querySelector('input[name=username]'));
        } catch (error) {
            console.error('Invalid cookies file, logging in again...');
        }
    }

    if (!cookiesValid) {
        await login(page);
    }

    let posts;
    if (options.quantity) {
        posts = await scrapeByQuantity(page, options.username, options.quantity);
    } else if (options.since) {
        posts = await scrapeByDate(page, options.username, options.since);
    }

    if (options.save) {
        const outputPath = path.join(__dirname, `${options.save}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(posts, null, 2));
        console.log(`Saved ${posts.length} posts to ${outputPath}`);
    } else {
        console.log('Post URLs:', posts);
    }

    const cookies = await page.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    console.log('Updated cookies saved.');
    await browser.close();
})();