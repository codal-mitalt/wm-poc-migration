import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import https from 'https';
import CONSTANTS from "./constants.js";
import fsStandard from 'fs';

// --- Configuration ---
const AEM_HOST = CONSTANTS.AEM_HOST;
const AEM_USER = CONSTANTS.AEM_USER;
const AEM_PASS = CONSTANTS.AEM_PASS;
const ASSET_OUTPUT_DIR = 'aem_export_assets'; // New dedicated folder for assets
const CONCURRENCY_LIMIT = 5; 

// This QueryBuilder query targets DAM assets
const ASSET_QUERY_PARAMS = {
  // ⬅️ Set this to your project's Asset Root
  'path': '/content/dam/wm', 
  // ⬅️ The primary node type for AEM Assets
  'type': 'dam:Asset',           
  'p.limit': -1,                 
  // ⬅️ We need full metadata for transformation and file names
  'p.hits': 'full'              
};
// ---------------------

// Initialize the concurrency limiter
const limit = pLimit(CONCURRENCY_LIMIT);

// Create a pre-configured axios instance for AEM requests
const aemClient = axios.create({
  baseURL: AEM_HOST,
  auth: {
    username: AEM_USER,
    password: AEM_PASS
  },
  // Ignore self-signed certs (if using HTTPS)
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
});

/**
 * Executes the download for a single asset binary file.
 */
/**
 * Executes the download for a single asset binary file.
 */
async function downloadAssetBinary(assetMetadata) {
    
    // ⬅️ CRITICAL FIX: Ensure assetMetadata.path exists and is a string
    const assetPath = assetMetadata["jcr:path"];
    if (!assetPath || typeof assetPath !== 'string') {
        console.error(`Skipping invalid asset record: Path is missing or invalid. Record:`, assetMetadata);
        // Return success=true so Promise.all does not fail, but log the skip
        return { success: true, path: 'Skipped Invalid Record', skipped: true }; 
    }
    
    // In AEM, the original binary is usually accessible via a selector on the jcr:content/renditions/original node
    const downloadUrl = `${assetPath}/_jcr_content/renditions/original`; 
    
    // ⬅️ The point where the original error occurred
    const fileName = path.basename(assetPath);
    const outputFile = path.join(ASSET_OUTPUT_DIR, fileName);

    try {
        console.log(`Downloading ${fileName} from ${assetPath}...`);
        
        // Fetch the binary data, setting responseType to 'stream' for efficiency
        const response = await aemClient.get(downloadUrl, { 
            responseType: 'stream' 
        });
        
        // Pipe the response stream directly to a file
        const writer = fsStandard.createWriteStream(outputFile);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        
        assetMetadata.localFilePath = outputFile;
        
        return { success: true, path: assetPath };
        
    } catch (error) {
        console.error(`❌ Failed to download binary for ${assetPath}. Error: ${error.message}`);
        // If download fails (e.g., 404), return failure
        return { success: false, path: assetPath, error: error.message };
    }
}


/**
 * Main asset export function
 */
async function exportAemAssets() {
  console.log('--- Starting AEM Asset Export ---');
  
  try {
    await fs.mkdir(ASSET_OUTPUT_DIR, { recursive: true });
    console.log(`✅ Output directory created at ${ASSET_OUTPUT_DIR}`);
  } catch (error) {
    console.error('Error creating asset directory:', error.message);
    return;
  }

  // 1. Fetch the list of all asset metadata using QueryBuilder
  let assets;
  try {
    console.log(`🔎 Fetching asset metadata from ${ASSET_QUERY_PARAMS.path}...`);
    
    const response = await aemClient.get('/bin/querybuilder.json', { params: ASSET_QUERY_PARAMS });
    assets = response.data.hits; // The hits array contains full metadata

    if (!assets || assets.length === 0) {
      console.log('No assets found for the query. Check your ASSET_QUERY_PARAMS.');
      return;
    }
    console.log(`✅ Found ${assets.length} assets. Starting concurrent downloads...`);
  } catch (error) {
    console.error('🛑 Error fetching asset metadata:', error.message);
    return;
  }

  // 2. Loop through each asset and submit the download task to the concurrency limiter
  const downloadPromises = assets.map(asset => {
    // We use the limit function to control concurrency
    return limit(() => downloadAssetBinary(asset));
  });

  // Wait for all downloads to finish
  const results = await Promise.all(downloadPromises);

  // 3. Save the consolidated metadata for the Sanity ingestion step
  const metadataOutputPath = path.join(ASSET_OUTPUT_DIR, 'assets_metadata.json');
  try {
      await fs.writeFile(metadataOutputPath, JSON.stringify(assets, null, 2));
      console.log(`✅ Asset metadata saved to ${metadataOutputPath}`);
  } catch (e) {
      console.error('Failed to save metadata file:', e.message);
  }

  // 4. Summarize results
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('\n--- Asset Export Summary ---');
  console.log(`✅ Total assets downloaded successfully: ${successful}`);
  console.log(`🛑 Total assets failed to download: ${failed}`);
  console.log('---');
}

// Run the main function
exportAemAssets();