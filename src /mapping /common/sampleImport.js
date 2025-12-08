const { createClient } = require("@sanity/client");
const fetchByKey = require("../utils /fetchByKey.js");
const CONSTANTS = require("../../../constants.js");

const client = createClient({
  projectId: CONSTANTS.SANITY_STUDIO_PROJECT_ID,
  dataset: CONSTANTS.SANITY_STUDIO_DATASET,
  useCdn: false,
  token: CONSTANTS.SANITY_STUDIO_API_TOKEN,
  apiVersion: CONSTANTS.SANITY_STUDIO_API_VERSION,
});

const createParentDocument = async () => {
  const data = await fetchByKey("author");
  console.log("Author data Count for Import", data?.length);

  // Temporary Code
  // const tempData = data.slice(0, 2);
  // console.log("tempData here", tempData);

  const tempData = data;

  if (tempData && tempData.length > 0) {
    for (const element of tempData) {
      const { _key, authorName } = element;

      // Skip creation if data is invalid
      if (!_key) {
        console.error("Invalid Author", element);
        continue;
      }

      // Skip creating Author Document Exist
      const existingDocument = await client.fetch(`*[_id == $id][0]`, {
        id: _key,
      });

      if (existingDocument) {
        console.log(
          `Author document with ID ${_key} already exists. Skipping creation.`
        );
        continue;
      }

      const authorDocument = {
        _id: _key,
        _type: "team",
        editorTitle: `Migrated ${authorName}`,
        name: authorName,
        //  TODO Create in Production  One Entry in Prod & Change Reference
        //  Required Fields
        avatar: {
          _type: "customImage",
          alt: authorName,
          image: {
            _type: "image",
            asset: CONSTANTS?.REFERENCES?.AUTHOR_IMAGE,
          },
          priority: false,
        },
        bio: {
          _type: "localeText",
          enUS: authorName,
        },
        designation: authorName,
      };

      await client.createOrReplace(authorDocument);
    }
  }
};

const importData = async () => {
  try {
    console.log("Starting data import for Author Card...");
    await createParentDocument();
    console.log("Data import completed successfully.");
  } catch (error) {
    console.error("Error during data import:", error);
  }
};

importData();
