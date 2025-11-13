// export-assets.js

import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import CONSTANTS from "./constants.js";

// Do not process the contents of these well-known AEM system folders
const SKIP_FOLDERS = ['/content/dam/appdata', '/content/dam/projects', '/content/dam/_CSS', '/content/dam/_DMSAMPLE' ];

/**
 * Determine if the folder should be processed based on the entity and AEM path.
 *
 * @param {Object} entity the AEM entity that should represent a folder returned from AEM Assets HTTP API
 * @param {String} aemPath the path in AEM of this source
 * @returns true if the entity should be processed, false otherwise
 */
function isValidFolder(entity, aemPath) {
    if (aemPath === '/content/dam') {
        return true;
    } else if (!entity.class.includes('assets/folder')) {
        return false;
    } else if (SKIP_FOLDERS.find((path) => path === aemPath)) {
        return false;
    } else if (entity.properties.hidden) {
        return false;
    }

    return true;
}

/**
 * Determine if the entity is downloadable.
 * @param {Object} entity the AEM entity that should represent an asset returned from AEM Assets HTTP API
 * @returns true if the entity is downloadable, false otherwise
 */
function isDownloadable(entity) {
    if (entity.class.includes('assets/folder')) {
        return false;
    } else if (entity.properties.contentFragment) {
        return false;
    }
    return true;
}

/**
 * Helper function to get the link from the entity based on the relationship name.
 * @param {Object} entity the entity from the AEM Assets HTTP API
 * @param {String} rel the relationship name
 * @returns {String} link URL
 */
function getLink(entity, rel) {
    return entity.links.find(link => link.rel.includes(rel));
}

/**
 * Helper function to fetch JSON data from the AEM Assets HTTP API.
 * @param {String} url the AEM Assets HTTP API URL to fetch data from
 * @returns {Object} the JSON response
 */
async function fetchJSON(url) {
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${AEM_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`Error fetching ${url}: ${response.status}`);
    }

    return response.json();
}

/**
 * Helper function to download a file from AEM Assets.
 * @param {String} url the URL of the asset rendition to download
 * @param {String} outputPath the local path to save the downloaded file
 */
async function downloadFile(url, outputPath) {
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${AEM_ACCESS_TOKEN}`,
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    await fs.writeFile(outputPath, Buffer.from(arrayBuffer));

    console.log(`Downloaded asset: ${outputPath}`);
}

/**
 * Main entry point to download assets from AEM.
 *
 * @param {Object} options
 * @param {String} options.apiUrl (optional) the direct AEM Assets HTTP API URL
 * @param {String} options.localPath local filesystem path to save the assets
 * @param {String} options.aemPath AEM folder path
 */
async function downloadAssets({ apiUrl, localPath = LOCAL_DOWNLOAD_FOLDER, aemPath = '/content/dam' }) {
    if (!apiUrl) {
        const prefix = "/content/dam/";
        let apiPath = aemPath.startsWith(prefix) ? aemPath.substring(prefix.length) : aemPath;

        if (!apiPath.startsWith('/')) {
            apiPath = '/' + apiPath;
        }

        apiUrl = `${AEM_HOST}/api/assets.json${apiPath}`;
    }

    const data = await fetchJSON(apiUrl);
    const entities = data.entities || [];

    // First, process folders
    for (const folder of entities.filter(entity => entity.class.includes('assets/folder'))) {
        const newLocalPath = path.join(localPath, folder.properties.name);
        const newAemPath = path.join(aemPath, folder.properties.name);

        if (!isValidFolder(folder, newAemPath)) {
            continue;
        }

        await fs.mkdir(newLocalPath, { recursive: true });

        await downloadAssets({
            apiUrl: getLink(folder, 'self')?.href,
            localPath: newLocalPath,
            aemPath: newAemPath
        });
    }

    // Now, process assets with concurrency limit
    const limit = pLimit(MAX_CONCURRENT_DOWNLOADS);
    const downloads = [];

    for (const asset of entities.filter(entity => entity.class.includes('assets/asset'))) {
        const assetLocalPath = path.join(localPath, asset.properties.name);
        if (isDownloadable(asset)) {
            downloads.push(limit(() => downloadFile(getLink(asset, 'content')?.href, assetLocalPath)));
        }
    }

    await Promise.all(downloads);

    // Handle pagination
    const nextUrl = getLink(data, 'next');
    if (nextUrl) {
        await downloadAssets({
            apiUrl: nextUrl?.href,
            localPath,
            aemPath
        });
    }
}

/***** SCRIPT CONFIGURATION *****/

// AEM host is the URL of the AEM environment to download the assets from
const AEM_HOST = CONSTANTS.AEM_HOST;

// AEM access token used to access the AEM host.
// This access token must have read access to the folders and assets to download.
const AEM_ACCESS_TOKEN = CONSTANTS.AEM_ACCESS_TOKEN;

// The root folder in AEM to download assets from.
const AEM_ASSETS_FOLDER = CONSTANTS.AEM_ASSETS_FOLDER;

// The local folder to save the downloaded assets.
const LOCAL_DOWNLOAD_FOLDER = CONSTANTS.LOCAL_DOWNLOAD_FOLDER;

// The number of maximum concurrent downloads to avoid overwhelming the client or server.
const MAX_CONCURRENT_DOWNLOADS = CONSTANTS.MAX_CONCURRENT_DOWNLOADS;

/***** SCRIPT ENTRY POINT *****/

console.time('Download AEM assets');

await downloadAssets({
    aemPath: AEM_ASSETS_FOLDER,
    localPath: LOCAL_DOWNLOAD_FOLDER
}).catch(console.error);

console.timeEnd('Download AEM assets');
