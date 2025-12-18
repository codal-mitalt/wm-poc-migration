# Data Migration Scripts

This folder contains scripts to migrate data into the Sanity dataset. Each script is designed to handle a specific type of data import. Follow the instructions below to set up and run the migration scripts.

## Prerequisites for Export

1. **AEM Dataset Configuration**: Update the constants in the `constants/constant.js` file with your AEM project details:

  - AEM_HOST
  - AEM_USER
  - AEM_PASS
  - OUTPUT_DIR


2. **Dependencies**: Install the required dependencies by running:
   ```sh
   npm install
   ```

## Running Migration Scripts

1. Navigate to Terminal 
- node export-assets.js
- node export-content.js

## Notes
- Make Sure You have access for downloading assets / Content in AEM HOST


## Prerequisites for Mapping & Migration

- Small Leaves Need to be Migrated First so those references need to give to parent Leaves / Rootes
 ```sh
node qaImport.js
```
