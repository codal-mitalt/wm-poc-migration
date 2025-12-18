import { readFile } from 'fs/promises';

export async function fetchBySubCategory(subCategoryName) {
  const jsonText = await readFile(new URL(filePath, import.meta.url), 'utf8');
  const data = JSON.parse(jsonText);

  return data;
}