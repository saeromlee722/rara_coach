const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_API_KEY });

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const rootPageId = process.env.NOTION_ROOT_PAGE_ID;
    const children = await notion.blocks.children.list({ block_id: rootPageId, page_size: 100 });

    const members = children.results
      .filter(b => b.type === 'child_page')
      .map(b => ({ id: b.id, name: b.child_page.title }))
      .filter(m => m.name !== '이름없음');

    return res.status(200).json({ members });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
