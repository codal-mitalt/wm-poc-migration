# Data Migration Scripts

This folder contains scripts to migrate data into the Sanity dataset. Each script is designed to handle a specific type of data import. Follow the instructions below to set up and run the migration scripts.

## Prerequisites

1. **AEM Dataset Configuration**: Update the constants in the `constants/constant.js` file with your AEM project details:

  - AEM_HOST
  - AEM_ACCESS_TOKEN
  - AEM_ASSETS_FOLDER
  - LOCAL_DOWNLOAD_FOLDER
  - MAX_CONCURRENT_DOWNLOADS

2. **Dependencies**: Install the required dependencies by running:
   ```sh
   npm install
   ```

## Running Migration Scripts

1. Navigate to Terminal 
- node export-assets.js

## Notes
- Make Sure You have access for downloading assets 
