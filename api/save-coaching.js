const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_API_KEY });

function heading2(text) {
  return { object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: text } }] } };
}
function heading3(text) {
  return { object: 'block', type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: text } }] } };
}
function bullet(text) {
  return { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: text } }] } };
}
function paragraph(text) {
  return { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: text } }] } };
}
function divider() {
  return { object: 'block', type: 'divider', divider: {} };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { memberId, result } = req.body;
    const today = new Date();
    const dateStr = `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getDate()).padStart(2,'0')}`;
    const pageTitle = `${dateStr} 코칭 플랜`;

    const { calc, missions, workout, mealPlan, memberInfo } = result;

    // 블록 구성 (100개 제한 주의 — 두 번에 나눠서 저장)
    const blocks1 = [
      heading2('📊 칼로리 & 탄단지'),
      bullet(`BMR: ${calc.bmr} kcal`),
      bullet(`TDEE: ${calc.tdee} kcal`),
      bullet(`목표 칼로리: ${calc.targetCal} kcal`),
      bullet(`단백질: ${calc.protein}g`),
      bullet(`탄수화물: ${calc.carb}g`),
      bullet(`지방: ${calc.fat}g`),
      bullet(`회원 유형: ${calc.userType}`),
      divider(),

      heading2('📋 4주 미션표'),
      heading3('1주차 — ' + (missions.week1.theme || '')),
      bullet('주간미션 1: ' + missions.week1.mission1),
      bullet('주간미션 2: ' + missions.week1.mission2),
      bullet('데일리 고정: ' + missions.week1.dailyFix),
      heading3('2주차 — ' + (missions.week2.theme || '')),
      bullet('주간미션 1: ' + missions.week2.mission1),
      bullet('주간미션 2: ' + missions.week2.mission2),
      bullet('데일리 고정: ' + missions.week2.dailyFix),
      heading3('3주차 — ' + (missions.week3.theme || '')),
      bullet('주간미션 1: ' + missions.week3.mission1),
      bullet('주간미션 2: ' + missions.week3.mission2),
      bullet('데일리 고정: ' + missions.week3.dailyFix),
      heading3('4주차 — ' + (missions.week4.theme || '')),
      bullet('주간미션 1: ' + missions.week4.mission1),
      bullet('주간미션 2: ' + missions.week4.mission2),
      bullet('데일리 고정: ' + missions.week4.dailyFix),
      divider(),

      heading2('🥗 7일 식단 (반복)'),
      paragraph(`목표 칼로리 ${calc.targetCal}kcal 기준`),
    ];

    // 식단 블록 추가
    const mealBlocks = [];
    (mealPlan || []).forEach((day, i) => {
      mealBlocks.push(heading3(`Day ${i+1}`));
      (day.meals || []).forEach(m => {
        mealBlocks.push(bullet(`${m.type}: ${m.foods} (${m.kcal}kcal)`));
      });
    });
    mealBlocks.push(divider());

    const blocks2 = [
      heading2('🏋️ 28일 운동 배치'),
      bullet(`운동 레벨: ${workout.level}`),
      heading3('1주차'),
      bullet(`월: ${workout.week1.mon}`), bullet(`화: ${workout.week1.tue}`),
      bullet(`수: ${workout.week1.wed}`), bullet(`목: ${workout.week1.thu}`),
      bullet(`금: ${workout.week1.fri}`), bullet(`토: ${workout.week1.sat}`),
      bullet(`일: ${workout.week1.sun}`),
      heading3('2주차'),
      bullet(`월: ${workout.week2.mon}`), bullet(`화: ${workout.week2.tue}`),
      bullet(`수: ${workout.week2.wed}`), bullet(`목: ${workout.week2.thu}`),
      bullet(`금: ${workout.week2.fri}`), bullet(`토: ${workout.week2.sat}`),
      bullet(`일: ${workout.week2.sun}`),
      heading3('3주차'),
      bullet(`월: ${workout.week3.mon}`), bullet(`화: ${workout.week3.tue}`),
      bullet(`수: ${workout.week3.wed}`), bullet(`목: ${workout.week3.thu}`),
      bullet(`금: ${workout.week3.fri}`), bullet(`토: ${workout.week3.sat}`),
      bullet(`일: ${workout.week3.sun}`),
      heading3('4주차'),
      bullet(`월: ${workout.week4.mon}`), bullet(`화: ${workout.week4.tue}`),
      bullet(`수: ${workout.week4.wed}`), bullet(`목: ${workout.week4.thu}`),
      bullet(`금: ${workout.week4.fri}`), bullet(`토: ${workout.week4.sat}`),
      bullet(`일: ${workout.week4.sun}`),
    ];

    // 코칭 페이지 생성
    const page = await notion.pages.create({
      parent: { page_id: memberId },
      properties: { title: { title: [{ type: 'text', text: { content: pageTitle } }] } },
      children: blocks1.slice(0, 100)
    });

    // 식단 블록 추가 (100개 제한으로 나눠서)
    if (mealBlocks.length > 0) {
      await notion.blocks.children.append({ block_id: page.id, children: mealBlocks.slice(0, 50) });
    }
    await notion.blocks.children.append({ block_id: page.id, children: blocks2 });

    return res.status(200).json({ success: true, pageId: page.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
