import { createClient } from "@sanity/client";
import {fetchByKey}  from "../utils /fetchByKey.js";
import CONSTANTS from "../../../constants.js";
import { randomBytes } from "crypto";
import { htmlToBlocks } from '@sanity/block-tools';
import {JSDOM} from 'jsdom';
import {Schema} from '@sanity/schema';

const client = createClient({
  projectId: CONSTANTS.SANITY_STUDIO_PROJECT_ID,
  dataset: CONSTANTS.SANITY_STUDIO_DATASET,
  useCdn: false,
  token: CONSTANTS.SANITY_STUDIO_API_TOKEN,
  apiVersion: CONSTANTS.SANITY_STUDIO_API_VERSION,
});

const defaultSchema = Schema.compile({
  name: 'default',
  types: [
    {
      type: 'object',
      name: 'content',
      fields: [
        {
          title: 'Body',
          name: 'body',
          type: 'array',
          of: [{ type: 'block' }]
        }
      ]
    }
  ]
});

// Extract the specific block content type definition
const blockContentType = defaultSchema
  .get('content')
  .fields.find((field) => field.name === 'body').type;
function convertHtmlToPortableText(html) {
  if (!html) return [];

  return htmlToBlocks(html, blockContentType, {
    parseHtml: (htmlContent) => new JSDOM(htmlContent).window.document,
    // (Optional) rules for handling special HTML tags
    rules: [
      {
        deserialize(el, next, block) {
          // You can add custom logic here if you have specific HTML tags
          // that need to map to custom Sanity object types.
          return undefined; 
        }
      }
    ]
  });
}

const createParentDocument = async () => {
  const data = await fetchByKey("support", "../../data/aem_support/sample-qa.json");
  console.log("Support data Count for Import", data?.length);
  //TODO Temporary Code
  const tempData = data.slice(0, 2);
  // const tempData= data
  if (tempData && tempData.length > 0) {
    for (const element of tempData) {
      const { _key, summary,labelNames,hasFrenchContent, body ,title,urlPath,summaryTitle,url,sectionName,categoryTags,sectionTag,relatedArticle3,
        contentCallOut, inlineRequestUrl,topicName,relatedArticle2,relatedArticle1,subCategoryTags
      } = element;
      // Generate a secure random ID if _key is not present
      const generateSecureId = () => "qa-" + randomBytes(9).toString("hex");
      
      const supportDocument = {
        _id: _key || generateSecureId(),
        _type: "qa",
        title: title ,
        // TODO: Statics Value
        region: "US-EN",
        // TODO: Slug should be URL or URL Path from AEM
        slug: {
          _type: "slug",
          current: url || "generated-slug",
        },
        // TODO: HTML Content in AEM for Summary but in Sanity as String
        summary: summary || "",
        body: body
          ? convertHtmlToPortableText(body)
          : [],
          // TODO AEM having Summary Title field but Sanity not having. Most of data having same name "Summary" but can check
          // summaryTitle
      };
      await client.createOrReplace(supportDocument);
    }
  }
};

const importData = async () => {
  try {
    console.log("Starting data import for Support...");
    await createParentDocument();
    console.log("Data import completed successfully.");
  } catch (error) {
    console.error("Error during data import:", error);
  }
};

importData();
