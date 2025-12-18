import { createClient } from "@sanity/client";
import { fetchByKey } from "../utils /fetchByKey.js";
import {fetchBySubCategory}  from "../utils /fetchBySubCategory.js";
import CONSTANTS from "../../../constants.js";
import { randomBytes } from "crypto";

const client = createClient({
  projectId: CONSTANTS.SANITY_STUDIO_PROJECT_ID,
  dataset: CONSTANTS.SANITY_STUDIO_DATASET,
  useCdn: false,
  token: CONSTANTS.SANITY_STUDIO_API_TOKEN,
  apiVersion: CONSTANTS.SANITY_STUDIO_API_VERSION,
});


function groupBySubCategory(dataArray) {
  // Initialize the result object
  const groupedData = {};

  // Loop through every item in your data array
  dataArray.forEach(item => {
    // Check if subCategoryTags exists and is an array
    if (item.subCategoryTags && Array.isArray(item.subCategoryTags)) {
      
      // Loop through each tag in the subCategoryTags array
      item.subCategoryTags.forEach(tag => {
        
        // If this tag key doesn't exist in our result yet, initialize it as an empty array
        if (!groupedData[tag]) {
          groupedData[tag] = [];
        }

        // Push the current item into the array for this tag
        groupedData[tag].push(item);
      });
    }
  });

  return groupedData;
}

function mapSubcategoriesToReferences(dataArray, refMapperFn) {
  const referenceMap = {};

  dataArray.forEach(item => {
    // Ensure the item has tags and a URL
    if (item.subCategoryTags && Array.isArray(item.subCategoryTags) && item.url) {
      
      // Get the Sanity reference (or ID) for this specific item using your function
      const sanityReference = refMapperFn(item.url);

      // Add this reference to every category listed in subCategoryTags
      item.subCategoryTags.forEach(tag => {
        
        // Initialize the array if the tag doesn't exist yet
        if (!referenceMap[tag]) {
          referenceMap[tag] = [];
        }

        // Push the result of your function call into the array
        referenceMap[tag].push(sanityReference);
      });
    }
  });

  return referenceMap;
}
const createParentDocument = async () => {
  const data = await fetchByKey(
    "support",
    "../../data/aem_support/sample-qa.json"
  );
  console.log("Support data Count for Import", data?.length);
 const tempData = data.slice(0, 50);
const temp = groupBySubCategory(tempData);

 const migrationMap = mapSubcategoriesToReferences(temp, getsanityQuestionusingURL);
console.log("Grouped Data by SubCategory^^^", migrationMap);
  return;
  //TODO Temporary Code
//   const tempData = data.slice(0, 10);
  // const tempData= data
  if (tempData && tempData.length > 0) {
    for (const element of tempData) {
      const {
       subCategoryTags,
       url
      } = element;
      // Generate a secure random ID if _key is not present
      const generateSecureId = () => "qa-" + randomBytes(9).toString("hex");

      const questionArray = await fetchBySubCategory(
                subCategoryTags[0],
            );;

            console.log("Question Array Length^^^", questionArray);

            return;
    
      const subCategoryDocument = {
        _id: generateSecureId(),
        _type: "subcategoryOfSupport",
        region: "US-EN",
        // slug: {
        //   _type: "slug",
        //   current: 
        // },
        // Todo Array check and assign to multiple 
        title: subCategoryTags[0] ,
        // Attach Questions Here
        topics: [
          {
            _key: generateSecureId(),
            _ref:sds,
            _type: "reference",
          },
        ],
      };
    await client.createOrReplace(subCategoryDocument);
    }
  }
};

const importData = async () => {
  try {
    console.log("Starting data import for sub Category...");
    await createParentDocument();
    console.log("Data import completed successfully.");
  } catch (error) {
    console.error("Error during data import:", error);
  }
};

importData();
