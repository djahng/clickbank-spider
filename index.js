const puppeteer = require('puppeteer');
const fs = require('fs');

const url = 'https://accounts.clickbank.com/marketplace.htm';

const getProductDetails = async (page) => {
  const data = await parseTableData(page);

  const zipped = [];

  for (i = 0; i < data.length; i += 3) {
    zipped.push({
      result: data[i],
      marketplaceStats: data[i+1],
      icons: data[i+2]
    });
  }

  return zipped;
}

const parseTableData = async (page) => {
  const data = await page.evaluate(() => {
    const trs = Array.from(document.querySelectorAll('#results > table > tbody:nth-child(1) > tbody > tr'))

    return trs.map(tr => tr.innerHTML.trim());
  });

  return data;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false
  });

  // Set browser properties and go to base url
  const page = await browser.newPage();
  await page.emulate({
    viewport: {
      width: 1460,
      height: 1070,
      isMobile: false
    },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.131 Safari/537.36'
  });

  // Don't load image (improves speed)
  await page.setRequestInterception(true);
  page.on('request', (request) => {
     if (request.resourceType() === 'image') {
         request.abort();
     } else {
         request.continue();
     }
  });

  await page.goto(url, { waitUntil: 'networkidle2' });

  debugger;

  // Go to Clickbank Marketplace
  await page.type('#includeKeywords', '');
  await page.keyboard.press('Enter');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  // Maximize results shown per page
  await page.select('#resultsPerPage', '50');
  await page.waitForFunction(() => document.querySelectorAll("#results > table > tbody:nth-child(1) > tbody").length === 150,
    {
      polling: 'mutation'
    }
  );

  // Sort results by Gravity
  await page.select('#sortField', 'GRAVITY');
  await page.waitForFunction(() => document.querySelectorAll("#results > table > tbody:nth-child(1) > tbody").length === 150,
    {
      polling: 'mutation'
    }
  );

  debugger;

  // Start pagination
  let pagination = await page.evaluate(() => {
    return document.querySelector('td.futurePage > a.nextPage') ? true : false;
  });

  let productDetails = [];

  const totalPages = await page.evaluate(() => {
    return document.querySelector('div.paginationSummary').innerText.split(' ')[2];
  });

  while (pagination) {
    // Get the results table data
    const details = await getProductDetails(page);
    productDetails = productDetails.concat(details);

    await page.click('td.futurePage > a.nextPage');
    await page.waitForSelector('td.current');

    const currentPage = await page.evaluate(() => {
      return document.querySelector('td.current').innerText;
    });

    pagination = currentPage !== totalPages ? true : false;
  }

  const detailsJSON = JSON.stringify(productDetails, null, 2);

  fs.writeFile('clickbank.json', detailsJSON, err => console.log(err));

  debugger;

  // Close browser
  await browser.close();
})();
