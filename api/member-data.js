const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_API_KEY });

function extractText(block) {
  const rt = block[block.type]?.rich_text || [];
  return rt.map(r => r.plain_text).join('');
}

function parseVal(text) {
  const match = text.match(/:\s*(.+)/);
  return match ? match[1].trim() : '';
}

function parseNum(text) {
  const val = parseVal(text);
  const match = val.match(/[-\d.]+/);
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
    const children = await notion.blocks.children.list({ block_id: memberId });

    // 설문 포함된 페이지만 찾기 (코칭플랜 제외)
    const surveyPage = children.results
      .filter(b => b.type === 'child_page')
      .filter(b => {
        const title = b.child_page?.title || '';
        return title.includes('설문') || title.includes('사전');
      })
      .sort((a, b) => new Date(b.created_time) - new Date(a.created_time))[0];

    if (!surveyPage) return res.status(404).json({ error: '설문 데이터 없음' });

    const blocks = await notion.blocks.children.list({
      block_id: surveyPage.id,
      page_size: 200
    });

    const lines = blocks.results
      .filter(b => b.type === 'bulleted_list_item')
      .map(b => extractText(b));

    const get = (keyword) => {
      const line = lines.find(l => l.startsWith(keyword));
      return line ? parseVal(line) : '';
    };
    const getNum = (keyword) => {
      const line = lines.find(l => l.startsWith(keyword));
      return line ? parseNum(line) : null;
    };

    const data = {
      // 기본 정보
      이름:               get('이름'),
      성별:               get('성별'),
      나이:               getNum('나이'),
      키:                 getNum('키'),
      현재체중:           getNum('현재 체중'),
      목표체중:           getNum('목표 체중'),
      연락처:             get('연락처'),

      // 체성분
      골격근량:           getNum('골격근량'),
      체지방량:           getNum('체지방량'),
      체지방률:           getNum('체지방률'),
      기초대사량_인바디:  getNum('기초대사량(인바디)'),
      인바디여부:         get('인바디 여부'),

      // 목표
      목표:               get('다이어트 목적'),
      목표기간:           get('목표 기간'),
      목표감량증량:       get('목표 감량/증량'),

      // 운동
      운동여부:           get('운동 여부'),
      운동종류:           get('운동 종류'),
      운동빈도:           get('운동 빈도'),
      운동시간:           get('1회 운동 시간'),
      헬스장이용:         get('헬스장 이용'),
      홈트가능:           get('홈트 가능'),
      운동강도:           get('운동 강도'),

      // 활동량
      평소활동량:         get('평소 활동량'),
      걸음수:             get('하루 평균 걸음수'),
      앉아있는시간:       get('하루 앉아있는 시간'),

      // 식습관
      식사횟수:           get('하루 식사 횟수'),
      아침식사:           get('아침 식사 여부'),
      외식빈도:           get('외식 빈도'),
      야식:               get('야식'),
      야식시간대:         get('야식 시간대'),
      폭식:               get('폭식'),
      물섭취량:           get('물 섭취량'),
      식사속도:           get('식사 속도'),
      단백질섭취빈도:     get('단백질 섭취 빈도'),
      채소섭취빈도:       get('채소 섭취 빈도'),
      탄수화물유형:       get('탄수화물 유형'),
      가공식품빈도:       get('가공식품 섭취 빈도'),
      간식빈도:           get('간식 빈도'),
      간식종류:           get('간식 종류'),
      디저트빈도:         get('디저트 / 단 음식 빈도'),
      끼니거르는빈도:     get('끼니 거르는 빈도'),
      과식빈도:           get('과식 빈도'),
      배달음식빈도:       get('배달음식 빈도'),

      // 식단 환경
      식사준비가능:       get('식사 준비 가능'),
      가족식사:           get('가족 식사 여부'),
      자유식허용:         get('자유식 허용'),

      // 음식 선호도
      좋아하는음식:       get('좋아하는 음식'),
      싫어하는음식:       get('싫어하는 음식'),
      알레르기:           get('알레르기'),
      소화불편음식:       get('소화 불편 음식'),

      // 건강
      질환:               get('질환 여부'),
      복용약:             get('복용 약'),
      호르몬:             get('호르몬 질환'),

      // 여성 호르몬 — 생리주기 3개 필드 포함
      생리주기규칙성:     get('생리 주기 규칙성'),
      마지막생리시작일:   get('마지막 생리 시작일'),
      생리주기일수:       getNum('평균 주기'),
      생리기간일수:       getNum('생리 기간'),
      생리통:             getNum('생리통 정도'),
      PMS:                get('PMS'),
      PMS증상:            get('PMS 증상'),
      생리중운동:         get('생리 중 운동'),
      저탄수반응:         get('저탄수 반응'),
      붓기:               get('붓기'),
      피임약:             get('피임약'),

      // 수면 & 스트레스
      수면시간:           get('수면 시간'),
      수면질:             getNum('수면 질'),
      스트레스:           getNum('스트레스 정도'),
      피로도:             getNum('피로도'),
      스트레스원인:       get('스트레스 원인'),
      음주빈도:           get('음주 빈도'),
      카페인:             get('카페인 섭취'),

      // 자율신경
      기상어지러움:       get('기상 직후 어지러움'),
      기상후개운함:       get('기상 후 개운함'),
      아침심박불안:       get('아침 심박·불안감'),
      기상직후스마트폰:   get('기상 직후 스마트폰'),

      // 생활 패턴
      기상시간:           get('기상 시간'),
      취침시간:           get('취침 시간'),
      직장형태:           get('직장 형태'),

      // 프로그램
      프로그램:           get('프로그램'),
    };

    return res.status(200).json({ data, surveyTitle: surveyPage.child_page?.title });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}; error: err.message });
  }
};
