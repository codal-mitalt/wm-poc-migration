import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import CONSTANTS from "../../constants.js";
import https from 'https';
// --- Configuration ---
const AEM_HOST = CONSTANTS.AEM_HOST;
const AEM_USER = CONSTANTS.AEM_USER;
const AEM_PASS = CONSTANTS.AEM_PASS;
const OUTPUT_DIR = CONSTANTS.OUTPUT_DIR;
const CONCURRENCY_LIMIT = 5; // ⬅️ CRITICAL: Max concurrent requests. Start with 5-10 and test.

// This is the AEM QueryBuilder query
const QUERY_PARAMS = {
  'path': '/content/wm/language-masters/en', // The content path to start searching from
  'type': 'cq:Page',           // We are looking for pages
  'p.limit': -1,                  // WARNING: Still relies on this for the path list. See note below.
  'p.hits': 'path'               // We only need the path, not the full JCR content, to reduce load.
};
// ---------------------

// Create a pre-configured axios instance for AEM requests
const aemClient = axios.create({
  baseURL: AEM_HOST,
  auth: {
    username: AEM_USER,
    password: AEM_PASS
  },
 httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
});

// Initialize the concurrency limiter
const limit = pLimit(CONCURRENCY_LIMIT);

/**
 * Creates a clean, safe filename from an AEM path.
 * Example: /content/my-site/en/blog/my-post -> blog_my-post.model.json
 */
function getFilenameFromPath(pagePath) {
  const basePath = QUERY_PARAMS.path;
  let relativePath = pagePath.replace(basePath, '');

  if (relativePath.startsWith('/')) {
    relativePath = relativePath.substring(1);
  }

  let filename = relativePath.replace(/\//g, '_'); // Replace all slashes with underscores

  if (filename === '') {
    filename = 'home'; // Handle the root page (e.g., /content/my-site/en)
  }
  
  return `${filename}.model.json`;
}

/**
 * Executes the export for a single page, managed by the concurrency limiter.
 */
async function exportSinglePage(pagePath) {
    const modelUrl = `${pagePath}.model.json`;
    const filename = getFilenameFromPath(pagePath);
    const outputFile = path.join(OUTPUT_DIR, filename);

    try {
        console.log(`Exporting ${pagePath} -> ${outputFile}`);
        
        // Fetch the individual page's model.json
        const modelResponse = await aemClient.get(modelUrl);
        
        // Stringify the JSON for saving (with nice formatting)
        const data = JSON.stringify(modelResponse.data, null, 2);
        
        // Save the file
        await fs.writeFile(outputFile, data);
        
        return { success: true, path: pagePath };
        
    } catch (error) {
        console.error(`❌ Failed to export ${pagePath}. Error: ${error.message}`);
        return { success: false, path: pagePath, error: error.message };
    }
}

/**
 * Main export function
 */
async function exportAemContent() {
  console.log('--- Starting AEM Content Export ---');
  console.log(`Max Concurrent Requests: ${CONCURRENCY_LIMIT}`);

  // 1. Create the output directory if it doesn't exist
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`✅ Output directory created at ${OUTPUT_DIR}`);
  } catch (error) {
    console.error('Error creating output directory:', error.message);
    return;
  }

  // 2. Fetch the list of all pages from QueryBuilder
  let pages;
  try {
    console.log(`🔎 Fetching page list from ${AEM_HOST} using path ${QUERY_PARAMS.path}...`);
    
    // NOTE: This initial call is still the highest risk point for large repos.
    const response = await aemClient.get('/bin/querybuilder.json', { params: QUERY_PARAMS });
    pages = response.data.hits; // The hits array contains { path: "..." } objects

    if (!pages || pages.length === 0) {
      console.log('No pages found for the query. Check your QUERY_PARAMS.');
      return;
    }
    console.log(`✅ Found ${pages.length} pages to export. Starting concurrent fetch...`);
  } catch (error) {
    if (error.response?.status === 401) {
      console.error('🛑 Authentication failed. Check AEM_USER and AEM_PASS.');
    } else {
      console.error('🛑 Error fetching page list:', error.message);
    }
    return;
  }

  // 3. Loop through each page and submit the export task to the concurrency limiter
  const exportPromises = pages.map(page => {
    // limit() will ensure only CONCURRENCY_LIMIT of these functions run at the same time
    return limit(() => exportSinglePage(page.path));
  });

  // Wait for all promises (concurrent tasks) to finish
  const results = await Promise.all(exportPromises);

  // 4. Summarize results
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success);

  console.log('\n--- AEM Export Summary ---');
  console.log(`✅ Total pages exported: ${successful}`);
  if (failed.length > 0) {
      console.log(`🛑 Total failed exports: ${failed.length}`);
      console.log('Failed pages (first 5):', failed.slice(0, 5).map(f => f.path));
      console.log('Check the console output for full error details.');
  }

  console.log('---');
  console.log(`Export Complete! All files are in ${OUTPUT_DIR}`);
}

// Run the main function
exportAemContent();