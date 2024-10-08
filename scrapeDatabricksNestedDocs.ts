import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import { URL } from 'url';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Define __filename and __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Interface to represent each URL node in the hierarchy
interface UrlNode {
    url: string;
    children: UrlNode[];
    externalLinks: string[];
}

// Configuration
//const baseDomain = 'docs.databricks.com'; // Base domain to identify internal links
//const startUrl = 'https://docs.databricks.com/en/getting-started/index.html'; // Starting URL
//const outputFilePath = path.join(__dirname, 'databricks-docs-urls-hierarchical.txt'); // Output file
// Configuration
//const baseDomain = 'docs.huggingface.co'; // Updated base domain for Hugging Face
//const startUrl = 'https://huggingface.co/docs/transformers/en/index'; // Updated starting URL
//const outputFilePath = path.join(__dirname, 'huggingface-transformers-docs-urls-hierarchical.txt'); // Updated output file
//const startUrl = 'https://huggingface.co/docs/tokenizers/index'; // Updated starting URL
//const outputFilePath = path.join(__dirname, 'huggingface-tokenizers-docs-urls-hierarchical.txt'); // Updated output file
const baseDomain = 'api.python.langchain.com'; // Updated base domain for LangChain API
const startUrl = 'https://api.python.langchain.com/en/latest/core_api_reference.html'; // Updated starting URL
const outputFilePath = path.join(__dirname, 'langchain-api-docs-urls-hierarchical.txt'); // Updated output file

// Set to keep track of visited URLs to prevent infinite loops
const visitedUrls = new Set<string>();

// Global Set to track URLs that have been written to the file to prevent duplication
const writtenUrls = new Set<string>();

// Function to scrape a single URL and build its UrlNode
async function scrapeUrl(url: string, depth: number = 0, maxDepth: number = 3): Promise<UrlNode> {
    // Check if the URL has already been visited
    if (visitedUrls.has(url)) {
        return { url, children: [], externalLinks: [] };
    }

    // Mark the URL as visited
    visitedUrls.add(url);
    console.log(`${'  '.repeat(depth)}Scraping: ${url}`);

    const node: UrlNode = { url, children: [], externalLinks: [] };

    // Limit the recursion depth to prevent excessive scraping
    if (depth > maxDepth) {
        return node;
    }

    try {
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);

        // Extract all anchor tags
        const links = $('a');
        
        for (let i = 0; i < links.length; i++) {
            const element = links[i];
            let href = $(element).attr('href');

            if (!href) continue;

            // Ignore mailto:, javascript:, and fragment links
            if (href.startsWith('mailto:') || href.startsWith('javascript:') || href.startsWith('#')) {
                continue;
            }

            try {
                // Resolve relative URLs
                const fullUrl = new URL(href, url).href;
                const urlObj = new URL(fullUrl);

                if (urlObj.hostname.endsWith(baseDomain)) {
                    // Internal link
                    node.children.push(await scrapeUrl(fullUrl, depth + 1, maxDepth));
                } else {
                    // External link
                    node.externalLinks.push(fullUrl);
                }
            } catch (error) {
                // Invalid URL, skip
                continue;
            }
        }

    } catch (error) {
        console.error(`Error scraping ${url}:`);
    }

    return node;
}

// Function to deduplicate external links within a UrlNode
function deduplicateExternalLinks(node: UrlNode): void {
    node.externalLinks = Array.from(new Set(node.externalLinks));
    for (const child of node.children) {
        deduplicateExternalLinks(child);
    }
}

// Function to write the hierarchical UrlNode structure to a file with deduplication
function writeUrlsToFile(node: UrlNode, stream: fs.WriteStream, indent: string = ''): void {
    if (!writtenUrls.has(node.url)) {
        stream.write(`${indent}${node.url}\n`);
        writtenUrls.add(node.url);
    }

    const childIndent = indent + '  '; // Increase indentation for child links

    // Write internal child links
    for (const child of node.children) {
        writeUrlsToFile(child, stream, childIndent);
    }

    // Write external links
    for (const extLink of node.externalLinks) {
        if (!writtenUrls.has(extLink)) {
            stream.write(`${childIndent}${extLink}\n`);
            writtenUrls.add(extLink);
        }
    }
}

// Main function to initiate scraping and writing to file
async function scrapeDatabricksDocs() {
    console.log(`Starting to scrape from: ${startUrl}`);

    const rootNode = await scrapeUrl(startUrl);

    // Deduplicate external links within the UrlNode tree
    deduplicateExternalLinks(rootNode);

    // Create a write stream to the output file
    const writeStream = fs.createWriteStream(outputFilePath, { encoding: 'utf8' });
    
    // Write the hierarchical structure to the file
    writeUrlsToFile(rootNode, writeStream);

    // Close the stream after writing
    writeStream.end();

    console.log(`Scraping completed. Hierarchical URLs saved to ${outputFilePath}`);
}

// Execute the scraping process
scrapeDatabricksDocs();
