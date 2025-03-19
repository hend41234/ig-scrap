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
  .option('-p, --password <password>', 'Your Instagram password');

program.parse(process.argv);
const options = program.opts();

const COOKIES_PATH = path.join(__dirname, 'cookies.json');

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

async function getPostsLinks(page, username) {
  await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('article a');
  const links = new Set();

  let prevHeight = 0;
  while (true) {
    const newLinks = await page.evaluate(() => 
      Array.from(document.querySelectorAll('article a')).map(a => a.href)
    );
    newLinks.forEach(link => links.add(link));
    
    if (options.quantity && links.size >= options.quantity) break;
    
    prevHeight = await page.evaluate('document.body.scrollHeight');
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await page.waitForTimeout(2000 + Math.floor(Math.random() * 1000));
    const newHeight = await page.evaluate('document.body.scrollHeight');
    if (newHeight === prevHeight) break;
  }
  
  return Array.from(links).slice(0, options.quantity || links.length);
}

(async () => {
  const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  await page.setViewport({ width: 1280, height: 800 });

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

  const posts = await getPostsLinks(page, options.username);
  const outputPath = path.join(__dirname, `${options.save}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(posts, null, 2));
  console.log(`Saved ${posts.length} posts to ${outputPath}`);
  const cookies = await page.cookies();
  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
  console.log('Updated cookies saved.');
  await browser.close();
})();
