import { createClient } from "@sanity/client";
import { fetchByKey } from "../utils /fetchByKey.js";
import {fetchBySubCategory}  from "../utils /fetchBySubCategory.js";
import CONSTANTS from "../../../constants.js";

const client = createClient({
  projectId: CONSTANTS.SANITY_STUDIO_PROJECT_ID,
  dataset: CONSTANTS.SANITY_STUDIO_DATASET,
  useCdn: false,
  token: CONSTANTS.SANITY_STUDIO_API_TOKEN,
  apiVersion: CONSTANTS.SANITY_STUDIO_API_VERSION,
});


const buildSlugSegment = (source) => {
  if (!source) return '';
  return source
    .toString()
    .replace(/^\/+/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};


async function getSanityQuestionIdByUrl(url) {
  // Query Sanity for a QA document with the given URL
  const query = '*[_type == "qa" && slug.current == $url][0]{_id}';
  const params = { url };
  const result = await client.fetch(query, params);
  return result ? result._id : null;
}

function groupBySubCategory(dataArray) {
  const groupedData = {};
  dataArray.forEach(item => {
    if (item.subCategoryTags && Array.isArray(item.subCategoryTags)) {
      item.subCategoryTags.forEach(tag => {
        if (!groupedData[tag]) groupedData[tag] = [];
        groupedData[tag].push(item);
      });
    }
  });
  return groupedData;
}

const createParentDocument = async () => {
  const data = await fetchByKey(
    "support",
    "../../data/aem_support/sample-qa.json"
  );
  console.log("Support data Count for Import", data?.length);
  const tempData = data.slice(0, 50);
  const grouped = groupBySubCategory(tempData);


  for (const [subCategory, questions] of Object.entries(grouped)) {
    const primaryUrl = questions.find((item) => item.url)?.url || '';
    // Build topics array of references
    const topics = [];
    for (const q of questions) {
      if (q.url) {
        const id = await getSanityQuestionIdByUrl(q.url);
        if (id) {
          topics.push({
            _key: id,
            _ref: id,
            _type: "reference"
          });
        }
      }
    }
    if (topics.length > 0) {
      const slugSegment = buildSlugSegment(primaryUrl) || buildSlugSegment(subCategory) || 'subcategory';
      const subCategoryDocument = {
        _id: `subcategory-${slugSegment}`,
        _type: "subcategoryOfSupport",
        region: "US-EN",
        title: subCategory,
        slug: {
          _type: "slug",
          current: slugSegment,
        },
        topics,
      };
      await client.createOrReplace(subCategoryDocument);
      console.log(`Created/updated subcategory: ${subCategory}`);
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
