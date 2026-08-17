import { buildTaskCard, LEVELS, SUBJECTS, subjectMechanismExample } from "./learning-task-cards.js";
import { MODE_ORDER, PRIMARY_MODES, SPECIFIC_MODES, specificModesFor } from "./learning-modes.js";

export const REPORT_FORMAT_VERSION = "scenario-report-v3";

function requireText(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${label}不能为空`);
  return value.trim();
}

function requireModeResult(modeResult) {
  if (!modeResult || typeof modeResult !== "object") throw new TypeError("学习模式结果不能为空");
  if (!Number.isInteger(modeResult.answeredCount) || modeResult.answeredCount < 0) throw new TypeError("有效作答数无效");
  if (!modeResult.scores || MODE_ORDER.some((code) => !Number.isInteger(modeResult.scores[code]) || modeResult.scores[code] < 0)) throw new TypeError("学习模式分数不完整");
  if (!modeResult.rates || MODE_ORDER.some((code) => !Number.isFinite(modeResult.rates[code]) || modeResult.rates[code] < 0 || modeResult.rates[code] > 1)) throw new TypeError("学习模式比例不完整");
  if (!modeResult.specificScores || Object.keys(SPECIFIC_MODES).some((id) => !Number.isInteger(modeResult.specificScores[id]) || modeResult.specificScores[id] < 0)) throw new TypeError("具体方式分数不完整");
  if (!modeResult.specificOpportunities || Object.keys(SPECIFIC_MODES).some((id) => !Number.isInteger(modeResult.specificOpportunities[id]) || modeResult.specificOpportunities[id] < 0)) throw new TypeError("具体方式机会数不完整");
  if (!modeResult.specificRates || Object.keys(SPECIFIC_MODES).some((id) => !Number.isFinite(modeResult.specificRates[id]) || modeResult.specificRates[id] < 0 || modeResult.specificRates[id] > 1)) throw new TypeError("具体方式比例不完整");
  const classification = modeResult.classification;
  if (!classification || !["clear", "primary_supporting", "parallel"].includes(classification.kind)) throw new TypeError("学习模式结论无效");
  if (classification.kind === "parallel") {
    if (classification.primary !== null || classification.supporting !== null || !Array.isArray(classification.candidates) || classification.candidates.length < 2) throw new TypeError("并列学习模式无效");
  } else {
    if (!Object.hasOwn(PRIMARY_MODES, classification.primary)) throw new TypeError("主要学习模式无效");
    if (classification.kind === "primary_supporting" && (!Object.hasOwn(PRIMARY_MODES, classification.supporting) || classification.primary === classification.supporting)) throw new TypeError("辅助学习模式无效");
  }
  return modeResult;
}

function mechanismStatus({ selected, opportunities, rate, highestReliableRate }) {
  if (selected === 0) return "这次暂未选到";
  if (opportunities >= 3 && rate === highestReliableRate) return "这次选得更多";
  return "这次也选到过";
}

function cardRole(code, classification, score) {
  const selectedRole = score > 0 ? "本次也选到过" : "本次未选到";
  if (classification.kind === "clear") return code === classification.primary ? "本次主要入口" : selectedRole;
  if (classification.kind === "primary_supporting") {
    if (code === classification.primary) return "本次主要入口";
    if (code === classification.supporting) return "本次辅助入口";
    return selectedRole;
  }
  if (score === 0) return "本次未选到";
  return classification.candidates.includes(code) ? "本次并列入口" : "本次也选到过";
}

const MODE_CARD_COPY = Object.freeze({
  V: "遇到一堆内容时，你会想先把它看清、画出来，眼睛一有画面，心里就不那么乱。",
  A: "你会先听一听、问一问。有人把理由讲清楚，思路就容易接上。",
  R: "你会先读清楚，再记下真正要用的部分。写在纸上，回头也找得到。",
  K: "你会想先试一下。做出第一步以后，才知道后面该怎么走。"
});

const MECHANISM_COACH_COPY = Object.freeze({
  image_association: "字太多时，你会想先画出来、标出来，一眼就能抓住意思。",
  structure_mapping: "你会想弄清：这些内容和谁有关，哪里不同，能不能放在一起看。",
  spatial_relationship: "步骤一多时，你会先把前后排好，免得做到一半乱掉。",
  interactive_clarification: "有一句没懂，你会把它问出来，不想含糊地往下走。",
  spoken_explanation: "有人把它从头讲一遍，你会更容易听懂它到底在说什么。",
  sound_cues: "读出声、多念几遍，词句会慢慢顺起来。",
  reading_comprehension: "你会把题目、课本或解析再读一遍，先弄明白它在说什么。",
  note_organization: "你会把以后要用的词、条件和提示记下来。",
  written_synthesis: "你会用自己的话写一写，看看自己到底懂没懂。",
  process_rehearsal: "光看还不够，你会从头走一遍，心里才有数。",
  hands_on_operation: "你会先试一步，看看能不能走通，再决定后面怎么做。",
  contextual_immersion: "把它放进一道题或具体例子里，才容易明白它怎么用。"
});

function modeCards(subject, modeResult) {
  const modeOrder = [...MODE_ORDER].sort((left, right) => {
    const rateDifference = modeResult.rates[right] - modeResult.rates[left];
    if (rateDifference !== 0) return rateDifference;
    const scoreDifference = modeResult.scores[right] - modeResult.scores[left];
    if (scoreDifference !== 0) return scoreDifference;
    return MODE_ORDER.indexOf(left) - MODE_ORDER.indexOf(right);
  });
  return Object.freeze(modeOrder.map((code) => {
    const mode = PRIMARY_MODES[code];
    const children = specificModesFor(code);
    const reliableRates = children
      .filter(({ id }) => modeResult.specificOpportunities[id] >= 3)
      .map(({ id }) => modeResult.specificRates[id]);
    const highestReliableRate = reliableRates.length > 0 ? Math.max(...reliableRates) : null;
    return Object.freeze({
      code,
      label: mode.label,
      role: cardRole(code, modeResult.classification, modeResult.scores[code]),
      description: MODE_CARD_COPY[code],
      mechanisms: Object.freeze([...children].sort((left, right) => {
        const rateDifference = modeResult.specificRates[right.id] - modeResult.specificRates[left.id];
        if (rateDifference !== 0) return rateDifference;
        const scoreDifference = modeResult.specificScores[right.id] - modeResult.specificScores[left.id];
        if (scoreDifference !== 0) return scoreDifference;
        return children.indexOf(left) - children.indexOf(right);
      }).map((specific) => {
        const selected = modeResult.specificScores[specific.id];
        const opportunities = modeResult.specificOpportunities[specific.id];
        const rate = modeResult.specificRates[specific.id];
        return Object.freeze({
          id: specific.id,
          label: specific.label,
          definition: MECHANISM_COACH_COPY[specific.id],
          subjectExample: subjectMechanismExample(subject, specific.id),
          selected,
          opportunities,
          rate,
          status: mechanismStatus({ selected, opportunities, rate, highestReliableRate })
        });
      }))
    });
  }));
}

const MODE_COACHING = Object.freeze({
  V: "这次作答里，你常会先把内容看清。重点、关系和顺序一明白，就知道从哪儿下手了。",
  A: "这次作答里，你常会先听一听。有人把理由讲清楚，思路就不容易乱。",
  R: "这次作答里，你常会先读清、写下。把要点变成自己的话，做题时心里会更踏实。",
  K: "这次作答里，你常会先动手。先试一小步，看看哪里能走通，心里就有数。"
});

const SUPPORT_COACHING = Object.freeze({
  V: "需要时再画一画、排一排，思路会更清楚。",
  A: "卡住时再听一遍关键理由，常常就通了。",
  R: "把关键内容记在纸上，回头更容易找到。",
  K: "再动手试一小步，能很快知道自己卡在哪。"
});

const SUBJECT_PATH_FOCUS = Object.freeze({
  语文: "原文句子、写法和答题依据",
  数学: "已知条件、公式和解题步骤",
  英语: "单词、短语和原文句子",
  日语: "助词、句型和课本短句",
  物理: "研究对象、受力和过程",
  化学: "物质、条件和现象",
  生物: "变量、过程和结果",
  政治: "材料事实、概念和观点",
  历史: "时间、事件和前后关系",
  地理: "位置条件、过程和结果"
});

const PRIMARY_PATH_ACTIONS = Object.freeze({
  V: (focus) => `把${focus}画清、排清`,
  A: (focus) => `听一小段讲${focus}的解释，把没懂的地方问出来`,
  R: (focus) => `把题目和${focus}读清，再圈出真正要用的信息`,
  K: (focus) => `围绕${focus}先做一个小问，看看自己卡在哪`
});

function conclusion(modeResult) {
  const { answeredCount, classification, rates, scores } = modeResult;
  const counts = Object.freeze(MODE_ORDER.map((code) => Object.freeze({
    code,
    label: PRIMARY_MODES[code].label,
    count: scores[code],
    answeredCount,
    rate: rates[code]
  })));
  if (classification.kind === "clear") {
    const mode = PRIMARY_MODES[classification.primary];
    return Object.freeze({
      kind: "clear",
      title: `本次你的主要学习入口：${mode.label}`,
      summary: MODE_COACHING[mode.code],
      primaryMode: Object.freeze({ code: mode.code, label: mode.label }),
      supportingMode: null,
      candidates: Object.freeze([mode.code]),
      counts
    });
  }
  if (classification.kind === "primary_supporting") {
    const primary = PRIMARY_MODES[classification.primary];
    const supporting = PRIMARY_MODES[classification.supporting];
    return Object.freeze({
      kind: "primary_supporting",
      title: `本次你的学习入口：${primary.label}为主，${supporting.label}为辅`,
      summary: `${MODE_COACHING[primary.code]} ${SUPPORT_COACHING[supporting.code]}`,
      primaryMode: Object.freeze({ code: primary.code, label: primary.label }),
      supportingMode: Object.freeze({ code: supporting.code, label: supporting.label }),
      candidates: Object.freeze([primary.code, supporting.code]),
      counts
    });
  }
  const summary = answeredCount < 10
    ? "这次留下的线索还不够，我们先不急着替你定一种模式。眼前这门课怎么学最顺，就先怎么开始；多做几次，你会慢慢看清自己的习惯。"
    : "这次没有哪一种入口一直领先。碰到不同任务，你会换不同的办法：有时先看清关系，有时听一段讲解，有时直接试一试。这很正常。";
  return Object.freeze({
    kind: "parallel",
    title: "多通道学习入口",
    summary,
    primaryMode: null,
    supportingMode: null,
    candidates: Object.freeze(classification.candidates),
    counts
  });
}

function primaryPathAction(subject, primaryCode) {
  const focus = SUBJECT_PATH_FOCUS[subject];
  if (!focus || !Object.hasOwn(PRIMARY_PATH_ACTIONS, primaryCode)) return "从最顺手的一步开始";
  return PRIMARY_PATH_ACTIONS[primaryCode](focus);
}

function learningPath(classification, taskCard) {
  const { subject } = taskCard;
  if (classification.kind === "clear") {
    const mode = PRIMARY_MODES[classification.primary];
    return Object.freeze({
      title: `学${subject}，先从${mode.label}进入`,
      copy: `不必一上来就把所有内容记住。先${primaryPathAction(subject, mode.code)}。这条路走顺了，再往下做题。`
    });
  }
  if (classification.kind === "primary_supporting") {
    const primary = PRIMARY_MODES[classification.primary];
    const supporting = PRIMARY_MODES[classification.supporting];
    return Object.freeze({
      title: `学${subject}，先用${primary.label}打头`,
      copy: `先${primaryPathAction(subject, primary.code)}。还觉得不顺时，再${primaryPathAction(subject, supporting.code)}。不用每次都两样全做，眼前哪一步最能帮上忙，就先做哪一步。`
    });
  }
  const candidates = classification.candidates.filter((code) => Object.hasOwn(PRIMARY_MODES, code));
  const first = taskCard.primarySpecific ? SPECIFIC_MODES[taskCard.primarySpecific].primary : candidates[0];
  const second = candidates.find((code) => code !== first) ?? candidates[1];
  return Object.freeze({
    title: `学${subject}，按任务换入口`,
    copy: `这次不用急着给自己定一种办法。遇到${subject}内容，可以先${primaryPathAction(subject, first)}。这条路不顺，再${primaryPathAction(subject, second)}。先挑一条做起来就好。`
  });
}

export function buildReport(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("报告数据不能为空");
  const targetSubject = requireText(input.targetSubject, "目标学科");
  const learningLevel = requireText(input.learningLevel, "学习阶段");
  if (!SUBJECTS.includes(targetSubject)) throw new RangeError(`未知的学科：${targetSubject}`);
  if (!LEVELS.includes(learningLevel)) throw new RangeError(`未知的学习阶段：${learningLevel}`);
  const modeResult = requireModeResult(input.modeResult);
  const taskCard = buildTaskCard({
    subject: targetSubject,
    learningLevel,
    classification: modeResult.classification,
    answeredCount: modeResult.answeredCount,
    specificScores: modeResult.specificScores,
    specificRates: modeResult.specificRates,
    specificOpportunities: modeResult.specificOpportunities
  });
  const cards = modeCards(targetSubject, modeResult);
  return Object.freeze({
    formatVersion: REPORT_FORMAT_VERSION,
    overview: Object.freeze({
      title: "学习模式定位报告",
      anonymousCode: requireText(input.anonymousCode, "匿名编号"),
      studentName: requireText(input.studentName, "姓名"),
      contact: requireText(input.contact, "联系方式"),
      grade: requireText(input.grade, "年级"),
      targetSubject,
      learningLevel
    }),
    conclusion: conclusion(modeResult),
    modeCards: cards,
    learningPath: learningPath(modeResult.classification, taskCard),
    taskCard
  });
}
