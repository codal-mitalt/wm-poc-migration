const fs = require("fs");
const readline = require("readline");

const findNestedType = (obj, targetType) => {
  const visited = new Set();
  const results = [];

  const search = (current) => {
    if (!current || typeof current !== "object" || visited.has(current)) {
      return;
    }

    visited.add(current);

    if (current._type === targetType) {
      results.push(current);
    }

    if (Array.isArray(current)) {
      for (const item of current) {
        search(item);
      }
    } else {
      for (const key in current) {
        if (Object.prototype.hasOwnProperty.call(current, key)) {
          search(current[key]);
        }
      }
    }
  };

  search(obj);
  return results;
};

const fetchByKey = async (targetType, filePath = "../data/data.ndjson") => {
  const collected = [];
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    try {
      const parsed = JSON.parse(line);
      const matches = findNestedType(parsed, targetType);
      collected.push(...matches);
    } catch (err) {
      console.warn("Skipping invalid line:", line);
    }
  }

  return collected;
};

module.exports = fetchByKey;
