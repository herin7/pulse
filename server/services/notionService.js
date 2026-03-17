import { Client } from '@notionhq/client';

import { appendNotionDebugEntry } from '../utils/notionDebugLog.js';
import { logger } from '../utils/logger.js';

const notion = new Client({ auth: process.env.NOTION_API_KEY, notionVersion: process.env.NOTION_VERSION || '2022-06-28' });
const ENABLED = process.env.NOTION_ENABLED === 'true' && Boolean(process.env.NOTION_API_KEY);
const PROFILE_QUERIES = ['about me', 'founder profile', 'goals', 'startup vision', 'north star'];

function trimContent(text, max = 1800) {
  if (!text) return '';
  const value = String(text);
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function extractText(richTextArray) {
  return Array.isArray(richTextArray) ? richTextArray.map((item) => item.plain_text || '').join('') : '';
}

function pageToText(page) {
  const props = page.properties || {};
  const parts = [];
  Object.entries(props).forEach(([key, value]) => {
    if (value.type === 'title') parts.push(extractText(value.title));
    if (value.type === 'rich_text') parts.push(`${key}: ${extractText(value.rich_text)}`);
    if (value.type === 'select') parts.push(`${key}: ${value.select?.name || ''}`);
    if (value.type === 'multi_select') parts.push(`${key}: ${value.multi_select?.map((item) => item.name).join(', ') || ''}`);
    if (value.type === 'date') parts.push(`${key}: ${value.date?.start || ''}`);
    if (value.type === 'checkbox') parts.push(`${key}: ${value.checkbox}`);
  });
  return parts.filter(Boolean).join(' | ');
}

function getPageTitle(page) {
  const props = page?.properties || {};
  const titleProp = Object.values(props).find((value) => value?.type === 'title');
  return extractText(titleProp?.title) || 'Untitled';
}

function isEnabled() { return ENABLED; }

async function searchPages(query) {
  if (!isEnabled()) return [];
  try {
    const result = await notion.search({ query, filter: { value: 'page', property: 'object' }, sort: { direction: 'descending', timestamp: 'last_edited_time' }, page_size: 5 });
    return result.results.map((page) => ({ id: page.id, lastEdited: page.last_edited_time, text: pageToText(page), title: getPageTitle(page), url: page.url }));
  } catch (error) {
    logger.warn('Notion search failed', { error: error.message, query });
    return [];
  }
}

async function listDatabases() {
  if (!isEnabled()) return [];
  try {
    const result = await notion.search({ filter: { value: 'database', property: 'object' }, page_size: 10 });
    return result.results.map((database) => ({ id: database.id, title: extractText(database.title), url: database.url }));
  } catch (error) {
    logger.warn('Notion list databases failed', { error: error.message });
    return [];
  }
}

async function queryDatabase(databaseId, filter = undefined) {
  if (!isEnabled()) return [];
  try {
    const result = await notion.databases.query({ database_id: databaseId, filter, page_size: 10 });
    return result.results.map((page) => ({ id: page.id, text: pageToText(page), url: page.url }));
  } catch (error) {
    logger.warn('Notion query database failed', { databaseId, error: error.message });
    return [];
  }
}

async function getPageContent(pageId) {
  if (!isEnabled()) return null;
  try {
    const [page, blocks] = await Promise.all([notion.pages.retrieve({ page_id: pageId }), notion.blocks.children.list({ block_id: pageId, page_size: 50 })]);
    const content = trimContent(
      blocks.results.map((block) => block[block.type]?.rich_text ? extractText(block[block.type].rich_text) : '').filter(Boolean).join('\n'),
      3000,
    );
    const result = { content, id: page.id, properties: pageToText(page), title: getPageTitle(page), url: page.url };
    await appendNotionDebugEntry({
      mode: 'sdk-page-read',
      pageId: result.id,
      query: page.url,
      text: trimContent(`${result.properties}\n${result.content}`.trim(), 3000),
      title: result.title,
    });
    return result;
  } catch (error) {
    logger.warn('Notion get page content failed', { error: error.message, pageId });
    return null;
  }
}

async function createPage({ title, content, parentPageId, parentDatabaseId, tags = [] }) {
  if (!isEnabled()) return null;
  const parent = parentDatabaseId ? { database_id: parentDatabaseId } : { page_id: parentPageId || process.env.NOTION_DEFAULT_PARENT_PAGE_ID };
  if (!parent.database_id && !parent.page_id) {
    logger.warn('Notion createPage skipped because no parent was available');
    return null;
  }
  const properties = parentDatabaseId ? { Name: { title: [{ text: { content: title } }] } } : { title: [{ type: 'text', text: { content: title } }] };
  if (tags.length && parentDatabaseId) properties.Tags = { multi_select: tags.map((tag) => ({ name: tag })) };
  const children = content ? [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content } }] } }] : [];
  try {
    const page = await notion.pages.create({ parent, properties, children });
    return { id: page.id, url: page.url };
  } catch (error) {
    logger.warn('Notion createPage failed', { error: error.message, title });
    return null;
  }
}

async function updatePage(pageId, properties) {
  if (!isEnabled()) return null;
  try {
    const page = await notion.pages.update({ page_id: pageId, properties });
    return { id: page.id, url: page.url };
  } catch (error) {
    logger.warn('Notion updatePage failed', { error: error.message, pageId });
    return null;
  }
}

async function appendBlocks(pageId, textContent) {
  if (!isEnabled()) return null;
  try {
    await notion.blocks.children.append({ block_id: pageId, children: [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: textContent } }] } }] });
    return true;
  } catch (error) {
    logger.warn('Notion appendBlocks failed', { error: error.message, pageId });
    return null;
  }
}

async function deletePage(pageId) {
  if (!isEnabled()) return null;
  try {
    await notion.pages.update({ page_id: pageId, archived: true });
    return true;
  } catch (error) {
    logger.warn('Notion deletePage failed', { error: error.message, pageId });
    return null;
  }
}

async function fetchFounderProfile() {
  if (!isEnabled()) return null;
  const searchResults = await Promise.allSettled(PROFILE_QUERIES.map((query) => searchPages(query)));
  const pages = searchResults.filter((item) => item.status === 'fulfilled').flatMap((item) => item.value).filter((page, index, list) => list.findIndex((candidate) => candidate.id === page.id) === index).slice(0, 5);
  const contentResults = await Promise.allSettled(pages.map((page) => getPageContent(page.id)));
  return contentResults.filter((item) => item.status === 'fulfilled' && item.value).map((item) => item.value);
}

export { appendBlocks, createPage, deletePage, fetchFounderProfile, getPageContent, isEnabled, listDatabases, queryDatabase, searchPages, updatePage };
