import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

async function scrapeDatabricksDocs() {
    const url = 'https://docs.databricks.com/en/getting-started/index.html';
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        // Array to store all extracted URLs
        const urls: string[] = [];

        // Select all anchor tags in the left navigation (Adjust the selector as needed)
        $('nav a').each((_, element) => {
            const href = $(element).attr('href');
            if (href) {
                const fullUrl = new URL(href, url).href; // Resolve relative URLs
                urls.push(fullUrl);
            }
        });

        // Save the URLs to a file or use them directly
        fs.writeFileSync('databricks-docs-urls.txt', urls.join('\n'));
        console.log('Scraped URLs have been saved to databricks-docs-urls.txt');
    } catch (error) {
        console.error('Error scraping the documentation:', error);
    }
}

scrapeDatabricksDocs();
