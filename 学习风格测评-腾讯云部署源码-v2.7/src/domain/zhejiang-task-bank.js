import { fullScoreForSubject, scoreLevelFor } from "./score-levels.js";
import { selectKnowledgeTarget } from "./knowledge-map.js";

const LEARNING_FOCUSES = Object.freeze(["learning", "memory", "practice", "improve"]);
const SUBJECT_CODES = Object.freeze({
  语文: "chinese",
  数学: "math",
  英语: "english",
  日语: "japanese",
  物理: "physics",
  化学: "chemistry",
  生物: "biology",
  历史: "history",
  政治: "politics",
  地理: "geography",
  技术: "technology"
});

const EXAM_SYSTEM_LABELS = Object.freeze({
  "national-paper-1": "新高考Ⅰ卷同类任务",
  "gaokao-japanese": "高考日语同类任务",
  "zhejiang-selective": "浙江选考同类任务"
});

const SOURCE_GUIDES = Object.freeze({
  "national-paper-1": "从近三年新高考Ⅰ卷、模拟卷或老师提供的练习中，选择2道同类题。",
  "gaokao-japanese": "从近三年高考日语卷、模拟卷或老师提供的练习中，选择2道同类题。",
  "zhejiang-selective": "从近三年浙江选考卷、模拟卷或老师提供的练习中，选择2道同类题。"
});

export const DIFFICULTY_MODIFIERS = Object.freeze({
  foundation: Object.freeze({
    material: "选1道基础题，保留例题或步骤提示",
    actions: Object.freeze(["先按提示找出{focus}", "自己完成{work}", "对照答案只改第一个{issue}"]),
    success: "撤掉一半提示后，仍能独立完成{work}"
  }),
  core: Object.freeze({
    material: "选1道常考题和1道同类题",
    actions: Object.freeze(["先自己完成{work}", "根据反馈只改一个{issue}", "不看答案再做一道{repeat}"]),
    success: "不看答案能完成{work}，并说清{focus}"
  }),
  integrated: Object.freeze({
    material: "选1道中档题和1道条件变化题",
    actions: Object.freeze(["独立找出{focus}", "根据反馈练同一个{issue}", "完成一道{change}变化题"]),
    success: "能根据{change}变化调整做法，并完成{work}"
  }),
  advanced: Object.freeze({
    material: "选1道综合题和1道限时变化题",
    actions: Object.freeze(["限时完成并标出{doubt}", "只修正最影响结果的{issue}", "撤掉提示完成{change}变化题"]),
    success: "限定时间内完成{work}，并解释关键调整"
  })
});

const FOCUS_DIFFICULTY_MODIFIERS = Object.freeze({
  learning: Object.freeze({
    foundation: Object.freeze({
      material: "选1个基础概念或例题，保留图示、例子或讲解提示",
      actions: Object.freeze(["先借助提示看清{focus}", "撤掉提示，用自己的话完成{work}", "对照材料，只补一个{issue}"]),
      success: "撤掉一半提示后，仍能说清{focus}"
    }),
    core: Object.freeze({
      material: "选1个常考概念和1个对应例题",
      actions: Object.freeze(["先自己找出{focus}", "用自己的话完成{work}", "对照材料补一个{issue}，再说一遍"]),
      success: "不看材料能完成{work}，并说清{focus}"
    }),
    integrated: Object.freeze({
      material: "选1个综合概念和1个情境变化任务",
      actions: Object.freeze(["独立找出{focus}", "用自己的话完成{work}", "换一个{change}再解释一次"]),
      success: "面对{change}变化，仍能说清{focus}"
    }),
    advanced: Object.freeze({
      material: "选1个复杂概念和1个限时综合任务",
      actions: Object.freeze(["限时找出{focus}", "不看提示完成{work}", "换一个{change}说明调整"]),
      success: "限定时间内完成{work}，并说清调整"
    })
  }),
  memory: Object.freeze({
    foundation: Object.freeze({
      material: "选1组基础知识，保留关键词、图表或提纲提示",
      actions: Object.freeze(["先借助提示记住{focus}", "合上材料，自己完成{work}", "对照材料补漏，再回想一次"]),
      success: "合上材料后，能完成{work}并写出关键内容"
    }),
    core: Object.freeze({
      material: "选1组常考知识和1道对应基础题",
      actions: Object.freeze(["先整理{focus}", "合上材料，自己完成{work}", "对照材料补漏，隔一会儿再回想"]),
      success: "不看材料能完成{work}，并说清{focus}"
    }),
    integrated: Object.freeze({
      material: "选1组易混知识和1道情境变化题",
      actions: Object.freeze(["先比较并记住{focus}", "合上材料，自己完成{work}", "换一个{change}再回想一次"]),
      success: "换一个{change}，仍能完成{work}"
    }),
    advanced: Object.freeze({
      material: "选1组综合知识和1道陌生情境题",
      actions: Object.freeze(["限时回想{focus}", "不看材料完成{work}", "换一个{change}再验证一次"]),
      success: "限定时间内完成{work}，并适应{change}"
    })
  }),
  improve: Object.freeze({
    foundation: Object.freeze({
      material: "选1道做错的基础题，保留原答案和反馈提示",
      actions: Object.freeze(["对照反馈找到{issue}", "遮住答案，重新完成{work}", "再做一道{repeat}检查"]),
      success: "遮住答案后，能独立完成{work}"
    }),
    core: Object.freeze({
      material: "选1道常见错题和1道同类题",
      actions: Object.freeze(["先找到{issue}", "根据反馈重新完成{work}", "不看原答案再做{repeat}"]),
      success: "能说清{issue}，并独立完成{work}"
    }),
    integrated: Object.freeze({
      material: "选1道中档错题和1道条件变化题",
      actions: Object.freeze(["先找到{issue}", "根据反馈重新完成{work}", "完成一道{change}变化题"]),
      success: "修正{issue}后，能完成{change}变化题"
    }),
    advanced: Object.freeze({
      material: "选1道综合错题和1道限时变化题",
      actions: Object.freeze(["限时找到{issue}", "只修正最影响结果的一处", "撤掉提示完成{change}变化题"]),
      success: "限定时间内修正{issue}，并完成{work}"
    })
  })
});

const FOCUS_TASK_VERBS = Object.freeze({
  learning: "理解",
  memory: "复习",
  practice: "练",
  improve: "订正"
});

function prototype(examSystem, taskFamily, terms) {
  return Object.freeze({
    examSystem,
    taskFamily,
    title: taskFamily,
    sourceGuide: SOURCE_GUIDES[examSystem],
    materialRule: `从${taskFamily}中选一道原型题，再选一道只改一个${terms.change}的题`,
    commonGoal: `独立找出${terms.focus}，完成${terms.work}并说明依据`,
    baseEvidence: `一份保留${terms.focus}标记、${terms.work}和修改说明的完成稿`,
    substituteRule: "可换成同题型、同难度、同考查过程的题目",
    terms: Object.freeze(terms)
  });
}

function subjectPrototypes(examSystem, rows) {
  return Object.freeze(
    Object.fromEntries(
      LEARNING_FOCUSES.map((learningFocus, index) => [
        learningFocus,
        prototype(examSystem, rows[index][0], rows[index][1])
      ])
    )
  );
}

export const TASK_PROTOTYPES = Object.freeze({
  语文: subjectPrototypes("national-paper-1", [
    ["现代文段落关系", { focus: "段落作用和原文句子", work: "段落关系说明", issue: "原文依据遗漏", repeat: "段落关系题", change: "设问", doubt: "拿不准的原文依据" }],
    ["古诗文理解性默写", { focus: "语境提示和关键字", work: "背写答案", issue: "关键字错误", repeat: "理解性默写", change: "语境", doubt: "记不准的关键字" }],
    ["现代文主观题", { focus: "设问和原文依据", work: "阅读答案", issue: "答案依据", repeat: "主观题", change: "设问", doubt: "拿不准的答案依据" }],
    ["阅读答案订正", { focus: "原答案和反馈", work: "修订答案", issue: "阅读错因", repeat: "订正题", change: "设问", doubt: "犹豫的错因" }]
  ]),
  数学: subjectPrototypes("national-paper-1", [
    ["函数与导数概念", { focus: "条件、关系和概念", work: "关系说明", issue: "条件理解", repeat: "函数概念题", change: "条件", doubt: "拿不准的关系" }],
    ["公式条件恢复", { focus: "公式、条件和单位", work: "公式恢复", issue: "公式条件", repeat: "公式应用题", change: "条件", doubt: "记不准的公式条件" }],
    ["函数与导数解答题", { focus: "条件、关系和设问", work: "解题步骤", issue: "关系或步骤问题", repeat: "函数与导数题", change: "条件", doubt: "拿不准的解题步骤" }],
    ["数学首错点重做", { focus: "首错步骤和条件", work: "重做过程", issue: "首错步骤", repeat: "首错点重做题", change: "条件", doubt: "犹豫的首错步骤" }]
  ]),
  英语: subjectPrototypes("national-paper-1", [
    ["阅读长难句", { focus: "句子结构和上下文", work: "句意说明", issue: "句子理解", repeat: "长难句", change: "上下文", doubt: "读不准的句子关系" }],
    ["词汇与词块", { focus: "词义、搭配和语境", work: "词句恢复", issue: "词汇搭配", repeat: "词块题", change: "语境", doubt: "记不准的词块" }],
    ["阅读理解", { focus: "题干、原文句子和选项", work: "阅读作答", issue: "原文定位", repeat: "阅读理解题", change: "设问", doubt: "拿不准的原文句子" }],
    ["阅读错因订正", { focus: "错题选项和原文", work: "订正答案", issue: "阅读错因", repeat: "阅读订正题", change: "设问", doubt: "犹豫的错因" }]
  ]),
  日语: subjectPrototypes("gaokao-japanese", [
    ["句型与语境", { focus: "句型连接和语境", work: "句型说明", issue: "句型连接", repeat: "句型题", change: "语境", doubt: "读不准的句型" }],
    ["词汇假名与助词", { focus: "假名、词义和助词", work: "词句恢复", issue: "助词或词义", repeat: "词汇助词题", change: "语境", doubt: "记不准的假名或助词" }],
    ["阅读理解", { focus: "语境、关键词和选项", work: "阅读作答", issue: "语境判断", repeat: "阅读理解题", change: "语境", doubt: "拿不准的语境" }],
    ["语境选择订正", { focus: "错题语境和选项", work: "订正答案", issue: "语境错因", repeat: "语境订正题", change: "语境", doubt: "犹豫的语境判断" }]
  ]),
  物理: subjectPrototypes("zhejiang-selective", [
    ["运动与受力关系", { focus: "研究对象、受力和运动", work: "受力关系说明", issue: "受力判断", repeat: "运动受力题", change: "受力条件", doubt: "拿不准的受力关系" }],
    ["公式条件与单位", { focus: "物理量、单位和条件", work: "公式恢复", issue: "单位或条件", repeat: "公式单位题", change: "物理条件", doubt: "记不准的单位或条件" }],
    ["力学综合题", { focus: "受力、过程和关系式", work: "力学步骤", issue: "受力或步骤问题", repeat: "力学综合题", change: "受力条件", doubt: "拿不准的受力过程" }],
    ["物理首错点重做", { focus: "首错关系式和过程图", work: "重做过程", issue: "物理首错点", repeat: "物理重做题", change: "受力条件", doubt: "犹豫的首错点" }]
  ]),
  化学: subjectPrototypes("zhejiang-selective", [
    ["物质变化与条件", { focus: "物质、现象和反应条件", work: "变化关系说明", issue: "反应条件", repeat: "物质变化题", change: "反应条件", doubt: "拿不准的变化条件" }],
    ["化学用语与反应条件", { focus: "化学用语、现象和条件", work: "化学用语恢复", issue: "化学用语", repeat: "用语条件题", change: "反应条件", doubt: "记不准的化学用语" }],
    ["实验与反应材料题", { focus: "物质、现象和材料", work: "实验作答", issue: "现象依据", repeat: "实验材料题", change: "反应条件", doubt: "拿不准的实验现象" }],
    ["化学表达订正", { focus: "原答案、用语和条件", work: "修订答案", issue: "化学表达", repeat: "化学订正题", change: "反应条件", doubt: "犹豫的表达问题" }]
  ]),
  生物: subjectPrototypes("zhejiang-selective", [
    ["结构、过程与功能", { focus: "结构、过程和功能", work: "关系说明", issue: "结构过程关系", repeat: "结构功能题", change: "过程条件", doubt: "拿不准的结构关系" }],
    ["术语与过程顺序", { focus: "术语、顺序和条件", work: "过程恢复", issue: "术语或顺序", repeat: "过程顺序题", change: "过程条件", doubt: "记不准的过程顺序" }],
    ["实验与资料分析", { focus: "变量、数据和材料", work: "资料分析", issue: "变量判断", repeat: "实验分析题", change: "实验条件", doubt: "拿不准的变量关系" }],
    ["生物证据订正", { focus: "原答案、材料和变量", work: "修订答案", issue: "材料依据", repeat: "生物订正题", change: "实验条件", doubt: "犹豫的材料依据" }]
  ]),
  历史: subjectPrototypes("zhejiang-selective", [
    ["时间、事件与联系", { focus: "时间、事件和联系", work: "历史联系说明", issue: "时间联系", repeat: "时间事件题", change: "材料时间", doubt: "拿不准的事件联系" }],
    ["事件链与影响", { focus: "事件顺序、背景和影响", work: "事件链恢复", issue: "事件顺序", repeat: "事件链题", change: "历史背景", doubt: "记不准的事件链" }],
    ["历史材料题", { focus: "设问、史料和时间", work: "材料作答", issue: "史料依据", repeat: "历史材料题", change: "史料角度", doubt: "拿不准的史料依据" }],
    ["史料依据订正", { focus: "原答案、史料和设问", work: "修订答案", issue: "史料错配", repeat: "史料订正题", change: "史料角度", doubt: "犹豫的史料依据" }]
  ]),
  政治: subjectPrototypes("zhejiang-selective", [
    ["概念、观点与材料", { focus: "概念、观点和材料", work: "观点说明", issue: "概念理解", repeat: "概念材料题", change: "材料条件", doubt: "拿不准的观点依据" }],
    ["观点层次与关键词", { focus: "观点层次、关键词和条件", work: "观点恢复", issue: "观点层次", repeat: "关键词题", change: "材料条件", doubt: "记不准的关键词" }],
    ["政治材料题", { focus: "设问、材料和观点", work: "材料作答", issue: "观点依据", repeat: "政治材料题", change: "材料条件", doubt: "拿不准的材料依据" }],
    ["观点材料订正", { focus: "原答案、观点和材料", work: "修订答案", issue: "观点错配", repeat: "政治订正题", change: "材料条件", doubt: "犹豫的观点依据" }]
  ]),
  地理: subjectPrototypes("zhejiang-selective", [
    ["图表、区域与过程", { focus: "图表、区域和过程", work: "区域过程说明", issue: "图表判断", repeat: "区域图表题", change: "区域条件", doubt: "拿不准的图表信息" }],
    ["地理概念与过程复习", { focus: "位置、特点和形成过程", work: "写出位置、特点和形成过程", issue: "遗漏的关键词", repeat: "概念过程复习题", change: "区域或情境", doubt: "记不准的关键内容" }],
    ["地理图表材料题", { focus: "图表、区域和材料", work: "图表作答", issue: "图表依据", repeat: "地理图表题", change: "区域条件", doubt: "拿不准的图表依据" }],
    ["图表证据订正", { focus: "原答案、图表和材料", work: "修订答案", issue: "图表错因", repeat: "图表订正题", change: "区域条件", doubt: "犹豫的图表依据" }]
  ]),
  技术: subjectPrototypes("zhejiang-selective", [
    ["技术设计与流程", { focus: "设计要求、步骤和工具", work: "流程说明", issue: "要求理解", repeat: "设计流程题", change: "使用条件", doubt: "拿不准的设计要求" }],
    ["技术概念与规则", { focus: "概念、步骤和使用条件", work: "规则恢复", issue: "步骤或条件", repeat: "技术规则题", change: "使用条件", doubt: "记不准的步骤或条件" }],
    ["技术设计与分析", { focus: "设计要求、材料和步骤", work: "技术作答", issue: "设计依据", repeat: "技术分析题", change: "设计条件", doubt: "拿不准的设计依据" }],
    ["技术方案订正", { focus: "原答案、设计要求和步骤", work: "修订答案", issue: "技术错因", repeat: "技术订正题", change: "设计条件", doubt: "犹豫的设计问题" }]
  ])
});

function renderTemplate(template, terms) {
  return template.replace(/\{(focus|work|issue|repeat|change|doubt)\}/g, (_, key) => terms[key]);
}

function examSystemForSubject(subject) {
  if (subject === "日语") return "gaokao-japanese";
  return fullScoreForSubject(subject) === 150 ? "national-paper-1" : "zhejiang-selective";
}

function compileUnit(subject, learningFocus, scoreLevel) {
  const prototypeData = TASK_PROTOTYPES[subject][learningFocus];
  const knowledgeTarget = selectKnowledgeTarget({ subject, learningFocus, scoreLevel });
  const modifier = FOCUS_DIFFICULTY_MODIFIERS[learningFocus]?.[scoreLevel]
    ?? DIFFICULTY_MODIFIERS[scoreLevel];
  const examSystem = examSystemForSubject(subject);

  return Object.freeze({
    id: `${SUBJECT_CODES[subject]}-${learningFocus}-${scoreLevel}`,
    examSystem,
    examSystemLabel: EXAM_SYSTEM_LABELS[examSystem],
    subject,
    learningFocus,
    scoreLevel,
    taskFamily: prototypeData.taskFamily,
    focusPrompt: prototypeData.terms.focus,
    workPrompt: prototypeData.terms.work,
    issuePrompt: prototypeData.terms.issue,
    title: prototypeData.title,
    taskLabel: `${modifier.material}，${FOCUS_TASK_VERBS[learningFocus]}${prototypeData.taskFamily}`,
    sourceGuide: prototypeData.sourceGuide,
    materialRule: prototypeData.materialRule,
    commonGoal: prototypeData.commonGoal,
    actions: Object.freeze(modifier.actions.map((template) => renderTemplate(template, prototypeData.terms))),
    evidence: prototypeData.baseEvidence,
    successCriterion: renderTemplate(modifier.success, prototypeData.terms),
    substituteRule: prototypeData.substituteRule,
    contentSource: knowledgeTarget ? "knowledge-map" : "generic-task-bank",
    knowledgeTarget
  });
}

const SCORE_LEVEL_IDS = Object.freeze(Object.keys(DIFFICULTY_MODIFIERS));
const TASK_UNITS = Object.freeze(
  Object.entries(TASK_PROTOTYPES).flatMap(([subject, focuses]) =>
    Object.keys(focuses).flatMap((learningFocus) =>
      SCORE_LEVEL_IDS.map((scoreLevel) => compileUnit(subject, learningFocus, scoreLevel))
    )
  )
);

export function compileTaskUnits() {
  return TASK_UNITS;
}

export function selectTaskUnit({ subject, learningFocus, score }) {
  const scoreLevel = scoreLevelFor(subject, score).id;
  if (!LEARNING_FOCUSES.includes(learningFocus)) {
    throw new RangeError(`Unknown learning focus: ${learningFocus}`);
  }
  return TASK_UNITS.find(
    (unit) =>
      unit.subject === subject && unit.learningFocus === learningFocus && unit.scoreLevel === scoreLevel
  );
}
