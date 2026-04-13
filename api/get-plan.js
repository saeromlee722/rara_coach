const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_API_KEY });

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { memberId } = req.query;
  if (!memberId) return res.status(400).json({ error: 'memberId 필요' });

  try {
    // 회원 루트 페이지의 자식 페이지 목록
    const children = await notion.blocks.children.list({
      block_id: memberId,
      page_size: 20,
    });

    // 제목에 "코칭 플랜"이 포함된 페이지 중 가장 최근 것
    const planPages = [];
    for (const block of children.results) {
      if (block.type === 'child_page') {
        const title = block.child_page?.title || '';
        if (title.includes('코칭 플랜')) {
          planPages.push({ id: block.id, title });
        }
      }
    }

    if (planPages.length === 0) {
      return res.status(404).json({ error: '저장된 코칭 플랜 없음' });
    }

    // 마지막 (가장 최근) 플랜 페이지
    const latestPlan = planPages[planPages.length - 1];

    // 해당 페이지의 블록 읽기
    const blocks = await notion.blocks.children.list({
      block_id: latestPlan.id,
      page_size: 100,
    });

    // JSON 데이터 블록 찾기 (code 블록 중 language가 'json'이고 내용이 __PLAN_DATA__ 로 시작)
    for (const block of blocks.results) {
      if (block.type === 'code') {
        const lang = block.code?.language || '';
        const text = (block.code?.rich_text || []).map(t => t.plain_text || t.text?.content || '').join('');
        if (lang === 'json' && text.startsWith('__PLAN_DATA__')) {
          try {
            const json = JSON.parse(text.replace('__PLAN_DATA__', '').trim());
            return res.status(200).json({ success: true, plan: json, pageTitle: latestPlan.title });
          } catch(e) {
            return res.status(500).json({ error: 'JSON 파싱 실패: ' + e.message });
          }
        }
      }
    }

    return res.status(404).json({ error: '플랜 데이터 블록 없음 (구버전 저장 플랜)' });

  } catch (err) {
    console.error('get-plan error:', err);
    return res.status(500).json({ error: err.message });
  }
};
