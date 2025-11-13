import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import CONSTANTS from "./constants.js";

// --- Configuration ---
const AEM_HOST = CONSTANTS.AEM_HOST;
const AEM_USER = CONSTANTS.AEM_USER;
const AEM_PASS = CONSTANTS.AEM_PASS;
const OUTPUT_DIR = CONSTANTS.OUTPUT_DIR;

// This is the AEM QueryBuilder query
const QUERY_PARAMS = {
  'path': '/content/my-site/en', // The content path to start searching from
  'type': 'cq:Page',           // We are looking for pages
  'p.limit': -1                  // Get all results, not just the first 10
};
// ---------------------

// Create a pre-configured axios instance for AEM requests
const aemClient = axios.create({
  baseURL: AEM_HOST,
  auth: {
    username: AEM_USER,
    password: AEM_PASS
  }
});

/**
 * Creates a clean, safe filename from an AEM path.
 * Example: /content/my-site/en/blog/my-post -> blog_my-post
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
 * Main export function
 */
async function exportAemContent() {
  console.log('--- Starting AEM Content Export ---');

  // 1. Create the output directory if it doesn't exist
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`Output directory created at ${OUTPUT_DIR}`);
  } catch (error) {
    console.error('Error creating output directory:', error.message);
    return;
  }

  // 2. Fetch the list of all pages from QueryBuilder
  let pages;
  try {
    console.log(`Fetching page list from ${AEM_HOST} using path ${QUERY_PARAMS.path}...`);
    const response = await aemClient.get('/bin/querybuilder.json', { params: QUERY_PARAMS });
    pages = response.data.hits;

    if (!pages || pages.length === 0) {
      console.log('No pages found for the query. Check your QUERY_PARAMS.');
      return;
    }
    console.log(`Found ${pages.length} pages to export.`);
  } catch (error) {
    if (error.response?.status === 401) {
      console.error('Authentication failed. Check AEM_USER and AEM_PASS.');
    } else {
      console.error('Error fetching page list:', error.message);
    }
    return;
  }

  // 3. Loop through each page and fetch its .model.json
  for (const page of pages) {
    const pagePath = page.path;
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
      
    } catch (error) {
      console.error(`Failed to export ${pagePath}: ${error.message}`);
    }
  }

  console.log('---');
  console.log(`AEM Export Complete! All files are in ${OUTPUT_DIR}`);
}

// Run the main function
exportAemContent();