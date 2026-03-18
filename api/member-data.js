const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// 노션 블록에서 텍스트 추출
function extractText(block) {
  const rt = block[block.type]?.rich_text || [];
  return rt.map(r => r.plain_text).join('');
}

// "키: 163cm" → "163"
function parseVal(text) {
  const match = text.match(/:\s*(.+)/);
  return match ? match[1].trim() : '';
}

// 숫자만 추출
function parseNum(text) {
  const match = parseVal(text).match(/[\d.]+/);
  return match ? parseFloat(match[0]) : null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { memberId } = req.query;
  if (!memberId) return res.status(400).json({ error: 'memberId required' });

  try {
    // 회원 페이지의 하위 페이지(사전설문) 찾기
    const children = await notion.blocks.children.list({ block_id: memberId });
    const surveyPage = children.results
      .filter(b => b.type === 'child_page')
      .sort((a, b) => new Date(b.created_time) - new Date(a.created_time))[0];

    if (!surveyPage) return res.status(404).json({ error: '설문 데이터 없음' });

    // 설문 페이지 블록 전체 읽기
    const blocks = await notion.blocks.children.list({ block_id: surveyPage.id, page_size: 200 });
    const lines = blocks.results
      .filter(b => b.type === 'bulleted_list_item')
      .map(b => extractText(b));

    // 파싱
    const get = (keyword) => {
      const line = lines.find(l => l.startsWith(keyword));
      return line ? parseVal(line) : '';
    };
    const getNum = (keyword) => {
      const line = lines.find(l => l.startsWith(keyword));
      return line ? parseNum(line) : null;
    };

    const data = {
      이름: get('이름'),
      성별: get('성별'),
      나이: getNum('나이'),
      키: getNum('키'),
      현재체중: getNum('현재 체중'),
      목표체중: getNum('목표 체중'),
      골격근량: getNum('골격근량'),
      체지방량: getNum('체지방량'),
      체지방률: getNum('체지방률'),
      기초대사량_인바디: getNum('기초대사량(인바디)'),
      인바디여부: get('인바디 여부'),
      목표: get('다이어트 목적'),
      목표기간: get('목표 기간'),
      목표감량증량: get('목표 감량/증량'),
      운동여부: get('운동 여부'),
      운동종류: get('운동 종류'),
      운동빈도: get('운동 빈도'),
      운동시간: get('1회 운동 시간'),
      헬스장: get('헬스장 이용'),
      홈트가능: get('홈트 가능'),
      운동강도: get('운동 강도'),
      평소활동량: get('평소 활동량'),
      걸음수: get('하루 평균 걸음수'),
      앉아있는시간: get('하루 앉아있는 시간'),
      식사횟수: get('하루 식사 횟수'),
      아침식사: get('아침 식사 여부'),
      외식빈도: get('외식 빈도'),
      야식: get('야식'),
      폭식: get('폭식'),
      물섭취량: get('물 섭취량'),
      식사속도: get('식사 속도'),
      단백질섭취빈도: get('단백질 섭취 빈도'),
      채소섭취빈도: get('채소 섭취 빈도'),
      식사준비가능: get('식사 준비 가능'),
      가족식사: get('가족 식사 여부'),
      자유식허용: get('자유식 허용'),
      좋아하는음식: get('좋아하는 음식'),
      싫어하는음식: get('싫어하는 음식'),
      알레르기: get('알레르기'),
      질환: get('질환 여부'),
      호르몬: get('호르몬 질환'),
      생리주기규칙성: get('생리 주기 규칙성'),
      생리통: getNum('생리통 정도'),
      PMS: get('PMS'),
      PMS증상: get('PMS 증상'),
      생리중운동: get('생리 중 운동'),
      피임약: get('피임약'),
      수면시간: get('수면 시간'),
      수면질: getNum('수면 질'),
      스트레스: getNum('스트레스 정도'),
      스트레스원인: get('스트레스 원인'),
      음주빈도: get('음주 빈도'),
      카페인: get('카페인 섭취'),
      기상시간: get('기상 시간'),
      취침시간: get('취침 시간'),
      직장형태: get('직장 형태'),
      프로그램: get('프로그램'),
      연락처: get('연락처'),
    };

    return res.status(200).json({ data, surveyTitle: surveyPage.child_page?.title });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
