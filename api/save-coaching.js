const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// ── 블록 헬퍼 ──────────────────────────────
function heading2(text) {
  return { object:'block', type:'heading_2', heading_2:{ rich_text:[{ type:'text', text:{ content: text } }] } };
}
function heading3(text) {
  return { object:'block', type:'heading_3', heading_3:{ rich_text:[{ type:'text', text:{ content: text } }] } };
}
function bullet(text) {
  return { object:'block', type:'bulleted_list_item', bulleted_list_item:{ rich_text:[{ type:'text', text:{ content: text } }] } };
}
function bulletLink(text, url) {
  return {
    object:'block', type:'bulleted_list_item',
    bulleted_list_item:{ rich_text:[
      { type:'text', text:{ content: text + '  ' } },
      { type:'text', text:{ content:'▶ 영상 바로가기', link:{ url } }, annotations:{ color:'blue', underline:true, bold:true } }
    ]}
  };
}
function paragraph(text) {
  return { object:'block', type:'paragraph', paragraph:{ rich_text:[{ type:'text', text:{ content: text } }] } };
}
function callout(text, emoji) {
  return {
    object:'block', type:'callout',
    callout:{ rich_text:[{ type:'text', text:{ content: text } }], icon:{ type:'emoji', emoji: emoji||'📌' } }
  };
}
function divider() {
  return { object:'block', type:'divider', divider:{} };
}
function toggle(title, children) {
  return {
    object:'block', type:'toggle',
    toggle:{ rich_text:[{ type:'text', text:{ content: title } }], children }
  };
}

// ── HTML 태그 제거 ──────────────────────────
function stripHtml(text) {
  return (text || '').replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── 미션 텍스트 → Notion 블록 (링크 포함) ──
function missionBullet(prefix, text) {
  const urlMatch = (text || '').match(/href="([^"]+)"/);
  const clean = stripHtml(text || '');

  if (urlMatch) {
    const url = urlMatch[1];
    const parts = clean.split('👉');
    const before = (parts[0] || clean).trim();
    const linkLabel = parts[1] ? ('👉' + parts[1]).trim() : '▶ 영상 보기';
    return {
      object:'block', type:'bulleted_list_item',
      bulleted_list_item:{ rich_text:[
        { type:'text', text:{ content: prefix + before + '  ' } },
        { type:'text', text:{ content: linkLabel, link:{ url } }, annotations:{ color:'pink', bold:true } }
      ]}
    };
  }
  return bullet(prefix + clean);
}

// ── 청크 분할 (Notion API 100개 제한) ───────
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
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
    const allDaily = missions._allDaily || [];
    const dayLabels = ['월','화','수','목','금','토','일'];
    const dayKeys   = ['mon','tue','wed','thu','fri','sat','sun'];

    // ── 1. 칼로리 & 탄단지 ──────────────────
    const calcBlocks = [
      callout(
        ``🎯 목표 칼로리: ${calc.targetCal} kcal  |  목표유형: ${calc.goalType}  |  탄단지: ${calc.macroLabel}  |  회원 유형: ${calc.userType}  |  Safety Flag: ${calc.safetyFlag ? 'ON ⚠️' : 'OFF ✅'}`,
        '📊'
      ),
      heading2('📊 칼로리 & 탄단지'),
      bullet(`기초대사량 (BMR): ${calc.bmr} kcal`),
      bullet(`활동대사량 (TDEE): ${calc.tdee} kcal`),
      bullet(`목표 섭취 칼로리: ${calc.targetCal} kcal`),
      bullet(`단백질: ${calc.protein}g  |  탄수화물: ${calc.carb}g  |  지방: ${calc.fat}g`),
      bullet(`활동계수: ${calc.totalFactor}  |  식습관 위험: ${calc.dietRisk}/2  |  회복 위험: ${calc.recoveryRisk}/2  |  호르몬 위험: ${calc.hormoneRisk}/2  |  위험합계: ${calc.riskSum}/6  |  위험도 보정: +${calc.riskAdjust}kcal`),
      divider(),
    ];

    // ── 2. 4주 미션표 ────────────────────────
    const weekKeys   = ['week1','week2','week3','week4'];
    const weekLabels = ['1주차','2주차','3주차','4주차'];

    const missionBlocks = [heading2('📋 4주 미션표')];

    weekKeys.forEach((wk, wi) => {
      const m = missions[wk];
      const weekDailyStart = wi * 7;
      const weekDays = allDaily.slice(weekDailyStart, weekDailyStart + 7);

      const weekChildren = [
        missionBullet('🏆 주간미션 1: ', m.weekly1 || ''),
        missionBullet('🏆 주간미션 2: ', m.weekly2 || ''),
        bullet(`✅ 데일리 고정: ${stripHtml(m.dailyFixed || '')}`),
        paragraph(''),
        paragraph('📅 데일리 미션 (날마다 다름):'),
      ];

      weekDays.forEach((dm, di) => {
        weekChildren.push(bullet(`${dayLabels[di]} · Day${weekDailyStart + di + 1}: ${dm}`));
      });

      missionBlocks.push(toggle(`${weekLabels[wi]} — ${m.theme || ''}`, weekChildren));
    });
    missionBlocks.push(divider());

    // ── 3. 7일 식단 ─────────────────────────
    const mealBlocks = [
      heading2('🥗 7일 식단'),
      callout(`목표 칼로리 ${calc.targetCal}kcal 기준 · 1-2주차, 3-4주차 반복`, '🍽'),
    ];

    // ✅ 수정: mealPlan이 배열이든 객체든 배열로 변환
    const mealPlanArray = Array.isArray(mealPlan)
      ? mealPlan
      : Object.values(mealPlan || {});

    mealPlanArray.forEach((day, i) => {
      const dayTotal = day.total || (day.meals || []).reduce((s, m) => s + m.kcal, 0);
      const mealChildren = (day.meals || []).map(m =>
        bullet(`${m.type}: ${stripHtml(m.foods)}  (${m.kcal}kcal)`)
      );
      mealBlocks.push(toggle(`Day ${i+1} (${day.day}) — ${dayTotal}kcal`, mealChildren));
    });

    mealBlocks.push(
      paragraph(''),
      callout(
        '🟡 자유식 가이드 (주 1회, 1끼)\n1. 단백질 메뉴 먼저 — 고기·생선·두부 중 하나 필수\n2. 음료는 물 또는 제로음료\n3. 탄수화물 + 지방 과다 조합 피하기\n4. 다음 끼니 굶지 않기 — 정상식 복귀\n5. 추천: 샤브샤브, 초밥, 삼겹살+밥 반공기',
        '🟡'
      ),
      divider(),
    );

    // ── 4. 28일 운동 (영상 링크 포함) ────────
    const workoutBlocks = [
      heading2('🏋️ 28일 운동 배치'),
      callout(`운동 레벨: ${workout.level}  |  주 5회 운동 + 2회 스트레칭/휴식`, '💪'),
    ];

    weekKeys.forEach((wk, wi) => {
      const w = workout[wk];
      if (!w) return;

      const wChildren = dayKeys.map((dk, di) => {
        const entry = w[dk] || '휴식';
        if (entry === '휴식') return bullet(`${dayLabels[di]}: 휴식`);

        const parts = entry.split('||');
        const label = parts[0] || entry;
        const url   = parts[1];

        if (url && url.startsWith('http')) {
          return bulletLink(`${dayLabels[di]}: ${label}`, url);
        }
        return bullet(`${dayLabels[di]}: ${label}`);
      });

      workoutBlocks.push(toggle(`${weekLabels[wi]}`, wChildren));
    });

    // ── 페이지 생성 ──────────────────────────
    const page = await notion.pages.create({
      parent: { page_id: memberId },
      properties: { title: { title: [{ type:'text', text:{ content: pageTitle } }] } },
      children: calcBlocks,
    });

    for (const chunk of chunkArray(missionBlocks, 40)) {
      await notion.blocks.children.append({ block_id: page.id, children: chunk });
    }
    for (const chunk of chunkArray(mealBlocks, 40)) {
      await notion.blocks.children.append({ block_id: page.id, children: chunk });
    }
    for (const chunk of chunkArray(workoutBlocks, 40)) {
      await notion.blocks.children.append({ block_id: page.id, children: chunk });
    }

    return res.status(200).json({
      success: true,
      pageId: page.id,
      memberId: memberId,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
