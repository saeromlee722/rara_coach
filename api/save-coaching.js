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
  return { object:'block', type:'bulleted_list_item', bulleted_list_item:{ rich_text:[{ type:'text', text:{ content: String(text||'') } }] } };
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
  return { object:'block', type:'paragraph', paragraph:{ rich_text:[{ type:'text', text:{ content: String(text||'') } }] } };
}
function callout(text, emoji) {
  return {
    object:'block', type:'callout',
    callout:{ rich_text:[{ type:'text', text:{ content: String(text||'') } }], icon:{ type:'emoji', emoji: emoji||'📌' } }
  };
}
function divider() {
  return { object:'block', type:'divider', divider:{} };
}
function toggle(title, children) {
  return {
    object:'block', type:'toggle',
    toggle:{ rich_text:[{ type:'text', text:{ content: String(title||'') } }], children }
  };
}

// ── HTML 태그 제거 ──────────────────────────
function stripHtml(text) {
  return (text || '').replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
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
    // body 파싱 안전 처리
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { return res.status(400).json({ error: 'Invalid JSON body' }); }
    }

    const { memberId, result } = body;
    if (!memberId || !result) return res.status(400).json({ error: 'memberId와 result가 필요합니다' });

    const today = new Date();
    const dateStr = `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getDate()).padStart(2,'0')}`;
    const pageTitle = `${dateStr} 코칭 플랜`;

    const { calc, missions, workout, mealPlan, memberInfo } = result;
    const dayLabels = ['월','화','수','목','금','토','일'];
    const dayKeys   = ['mon','tue','wed','thu','fri','sat','sun'];
    const weekLabels = ['1주차','2주차','3주차','4주차'];

    // ── 1. 칼로리 & 탄단지 ──────────────────
    const calcBlocks = [
      callout(
        `🎯 목표 칼로리: ${calc.targetCal} kcal  |  목표유형: ${calc.goalType}  |  탄단지: ${calc.macroLabel}  |  회원 유형: ${calc.userType}  |  Safety Flag: ${calc.safetyFlag ? 'ON ⚠️' : 'OFF ✅'}`,
        '📊'
      ),
      heading2('📊 칼로리 & 탄단지'),
      bullet(`기초대사량 (BMR): ${calc.bmr} kcal`),
      bullet(`활동대사량 (TDEE): ${calc.tdee} kcal`),
      bullet(`목표 섭취 칼로리: ${calc.targetCal} kcal`),
      bullet(`단백질: ${calc.protein}g  |  탄수화물: ${calc.carb}g  |  지방: ${calc.fat}g`),
      bullet(`활동계수: ${calc.totalFactor}  |  식습관 위험: ${calc.dietRisk}  |  회복 위험: ${calc.recoveryRisk}  |  호르몬 위험: ${calc.hormoneRisk}  |  위험합계: ${calc.riskSum}  |  위험도 보정: +${calc.riskAdjust}kcal`),
      divider(),
    ];

    // ── 2. 4주 미션표 (v2 구조) ──────────────
    // missions.weeks[] 배열 구조
    // 각 week: { weekNum, theme, mission1:{emoji,label,text}, mission2:{...}, dailyMissions:[{dayNum,dayLabel,theme,isBodyCheck,text}] }
    const missionBlocks = [heading2('📋 4주 미션표')];

    // 도메인 위험도 순위 추가
    if (missions.rankedDomains && missions.domainScores) {
      const rankText = missions.rankedDomains.slice(0,4).map((dk, i) => `${i+1}위: ${dk}(${missions.domainScores[dk]}점)`).join('  |  ');
      missionBlocks.push(callout(`위험 도메인 순위: ${rankText}`, '⚠️'));
    }

    const weeks = missions.weeks || [];
    weeks.forEach((w) => {
      const m1 = w.mission1 || {};
      const m2 = w.mission2 || {};
      const dailies = w.dailyMissions || [];

      const weekChildren = [
        bullet(`🏆 주간미션 1 [${m1.emoji||''} ${m1.label||''}]: ${m1.text||''}`),
        bullet(`🏆 주간미션 2 [${m2.emoji||''} ${m2.label||''}]: ${m2.text||''}`),
        paragraph(''),
        paragraph('📅 데일리 미션:'),
      ];

      dailies.forEach((dm) => {
        const prefix = dm.isBodyCheck ? '⭐ ' : '';
        weekChildren.push(bullet(`${dm.dayLabel} · Day${dm.dayNum}: ${prefix}${dm.text||''}`));
      });

      missionBlocks.push(toggle(`${w.weekNum}주차 — ${w.theme||''}`, weekChildren));
    });
    missionBlocks.push(divider());

    // ── 3. 7일 식단 ─────────────────────────
    const mealBlocks = [
      heading2('🥗 7일 식단'),
      callout(`목표 칼로리 ${calc.targetCal}kcal 기준 · 1-2주차, 3-4주차 반복`, '🍽'),
    ];

    // mealPlan 구조: { weekPlan:[], targetCal, mealTypes }
    // 또는 구형: 배열 [{day, meals:[{type,foods,kcal}]}]
    let weekPlanArray = [];
    if (mealPlan && mealPlan.weekPlan) {
      weekPlanArray = mealPlan.weekPlan;
    } else if (Array.isArray(mealPlan)) {
      weekPlanArray = mealPlan;
    } else if (mealPlan && typeof mealPlan === 'object') {
      weekPlanArray = Object.values(mealPlan);
    }

    weekPlanArray.forEach((day, i) => {
      const dayLabel = day.day || dayLabels[i] || `Day${i+1}`;
      let mealChildren = [];
      let dayTotal = 0;

      if (day.meals && typeof day.meals === 'object' && !Array.isArray(day.meals)) {
        // 신형: meals = { 아침:{portions,totalKcal}, 점심:{...}, ... }
        const mealTypes = day.mealTypes || Object.keys(day.meals);
        mealTypes.forEach(mt => {
          const meal = day.meals[mt];
          if (!meal) return;
          dayTotal += meal.totalKcal || 0;

          if (meal.isGeneralMeal) {
            const p = (meal.portions || [])[0] || {};
            mealChildren.push(bullet(`${mt}: 🍱 일반식  탄수 ${p.carb||0}g · 단백 ${p.protein||0}g · 지방 ${p.fat||0}g  (${meal.totalKcal||0}kcal)`));
          } else {
            const foods = (meal.portions || [])
              .filter(p => !p.isEmpty && p.foodName)
              .map(p => `${p.foodName} ${p.grams||0}g`)
              .join(' + ');
            mealChildren.push(bullet(`${mt}: ${foods || '-'}  (${meal.totalKcal||0}kcal)`));
          }
        });
      } else if (Array.isArray(day.meals)) {
        // 구형: meals = [{type, foods, kcal}]
        day.meals.forEach(m => {
          dayTotal += m.kcal || 0;
          mealChildren.push(bullet(`${m.type}: ${stripHtml(m.foods)}  (${m.kcal}kcal)`));
        });
      }

      mealBlocks.push(toggle(`Day ${day.dayIndex||i+1} (${dayLabel}) — ${dayTotal}kcal`, mealChildren));
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

    const weekKeys = ['week1','week2','week3','week4'];
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

    // ── JSON 데이터 블록 (member.html 읽기용) ──
    const planJsonStr = '__PLAN_DATA__' + JSON.stringify({ calc, missions, mealPlan, workout });
    const jsonDataBlock = [{
      object: 'block', type: 'code',
      code: { language: 'json', rich_text: [{ type: 'text', text: { content: planJsonStr } }] }
    }];

    // ── 페이지 생성 ──────────────────────────
    const page = await notion.pages.create({
      parent: { page_id: memberId },
      properties: { title: { title: [{ type:'text', text:{ content: pageTitle } }] } },
      children: calcBlocks,
    });

    // JSON 데이터 블록 저장 (get-plan.js가 읽을 수 있도록)
    await notion.blocks.children.append({ block_id: page.id, children: jsonDataBlock });

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
    console.error('save-coaching error:', err);
    return res.status(500).json({ error: err.message });
  }
};
