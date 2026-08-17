import { SPECIFIC_MODES } from "./learning-modes.js";

const LEVELS = Object.freeze({
  基础巩固: Object.freeze({
    quantity: "每天处理2至3个小任务，先把老师讲过的基础内容做稳",
    dailyMinimum: "至少完成2个基础小任务",
    finalMinimum: "至少独立完成2个基础任务",
    check: "隔一天不看答案再做，基础任务至少独立完成2个"
  }),
  稳定提升: Object.freeze({
    quantity: "每天处理3至4个同类任务，其中至少1个来自最近错题",
    dailyMinimum: "至少完成3个同类任务，其中1个来自错题",
    finalMinimum: "至少独立完成3个同类任务",
    check: "最后独立完成3个同类任务，至少做对2个并说清错因"
  }),
  冲刺提高: Object.freeze({
    quantity: "每天完成1组限时任务，并留出5分钟检查表达和易错点",
    dailyMinimum: "至少完成1组限时任务，并记录用时",
    finalMinimum: "至少独立完成1组新的限时任务",
    check: "第7天按考试时间完成一组新任务，正确率和用时都不低于本周最好一次"
  })
});

const SUBJECTS = Object.freeze({
  语文: Object.freeze({
    focus: "阅读材料的依据提取和答案组织",
    scene: "段落、人物、观点和材料依据",
    materials: Object.freeze({
      基础巩固: "课本篇目、老师讲过的阅读例题和对应答案",
      稳定提升: "最近3道阅读错题和一篇中档真题",
      冲刺提高: "近三年真题中的阅读或作文任务和评分要求"
    })
  }),
  数学: Object.freeze({
    focus: "当前薄弱题型的条件识别和完整解题",
    scene: "已知条件、所求内容、公式条件和解题步骤",
    materials: Object.freeze({
      基础巩固: "课本例题、老师讲过的基础题和最近的基础错题",
      稳定提升: "最近错题、专题中档题和对应解析",
      冲刺提高: "近三年真题、限时综合题和规范解答"
    })
  }),
  英语: Object.freeze({
    focus: "词句在语境中的理解、恢复和使用",
    scene: "场景、关键词句、语篇关系和表达任务",
    materials: Object.freeze({
      基础巩固: "课本单元词汇、短例句和老师讲过的基础阅读",
      稳定提升: "最近的阅读错题、核心词组和带原文的短听力",
      冲刺提高: "近三年阅读真题、写作任务和30秒至1分钟原声材料"
    })
  }),
  日语: Object.freeze({
    focus: "词句、助词和语法在语境中的准确使用",
    scene: "会话场景、关键词句、助词和语法连接",
    materials: Object.freeze({
      基础巩固: "课本词汇、基础句型和老师讲过的短课文",
      稳定提升: "最近的语法错题、短阅读和带原文的听力片段",
      冲刺提高: "近三年阅读真题、翻译表达和短篇原声材料"
    })
  }),
  物理: Object.freeze({
    focus: "研究对象、物理过程和条件关系",
    scene: "研究对象、受力或运动过程、已知量和公式条件",
    materials: Object.freeze({
      基础巩固: "课本例题、老师讲过的基础模型和对应示意图",
      稳定提升: "最近错题、典型模型题和一组条件变化题",
      冲刺提高: "近三年真题、限时综合题和规范过程答案"
    })
  }),
  化学: Object.freeze({
    focus: "物质、条件、现象和变化之间的对应",
    scene: "物质、反应条件、实验现象和化学表达",
    materials: Object.freeze({
      基础巩固: "课本反应示例、基础方程式和老师讲过的实验题",
      稳定提升: "最近错题、反应专题题和实验材料题",
      冲刺提高: "近三年综合真题、限时实验题和规范表达清单"
    })
  }),
  生物: Object.freeze({
    focus: "结构、生命过程和材料证据之间的联系",
    scene: "结构、过程、变量、条件和结果",
    materials: Object.freeze({
      基础巩固: "课本结构图、基础概念题和老师讲过的过程题",
      稳定提升: "最近错题、实验专题题和资料分析题",
      冲刺提高: "近三年综合真题、限时资料题和术语检查表"
    })
  }),
  政治: Object.freeze({
    focus: "概念、材料事实和观点表达的对应",
    scene: "设问、概念条件、材料事实和答案层次",
    materials: Object.freeze({
      基础巩固: "课本核心概念、老师讲过的材料例题和基础设问",
      稳定提升: "最近主观题错题、专题材料和评分答案",
      冲刺提高: "近三年材料真题、限时主观题和规范表达清单"
    })
  }),
  历史: Object.freeze({
    focus: "时间、事件、背景、影响和材料证据的联系",
    scene: "时间线、事件关系、背景、影响和材料出处",
    materials: Object.freeze({
      基础巩固: "课本时间线、老师讲过的事件例题和基础材料",
      稳定提升: "最近材料题错题、专题时间线和中档真题",
      冲刺提高: "近三年材料真题、限时论述题和评分答案"
    })
  }),
  地理: Object.freeze({
    focus: "空间位置、图表证据和地理过程的联系",
    scene: "位置、方向、地形、数据、过程和产业结果",
    materials: Object.freeze({
      基础巩固: "课本地图、老师讲过的区域例题和基础图表题",
      稳定提升: "最近区域错题、专题地图和中档图表题",
      冲刺提高: "近三年区域真题、限时综合题和规范答案"
    })
  })
});

const ACTIONS = Object.freeze({
  image_association: ({ subject, scene }) => `用“图像联想”进入：把${subject}里的${scene}变成一张小图、场景图或图表，再遮住文字看图回想。`,
  structure_mapping: ({ scene }) => `用“结构梳理”进入：把${scene}放进同一张框架，用方框、层级或箭头标出条件和关系。`,
  spatial_relationship: ({ subject, scene }) => `用“空间关系”进入：在${subject}图、空白图或过程线上标出${scene}的位置、方向和先后变化。`,
  spoken_explanation: ({ subject, scene }) => `用“听讲解”进入：选一段${subject}讲解，每听完一个步骤就暂停，想想它和${scene}有什么关系。`,
  sound_cues: ({ subject }) => `用“声音线索”进入：选30秒左右带原文的${subject}音频或把关键词读出声，圈出重音和容易漏掉的提示词。`,
  interactive_clarification: ({ scene }) => `用“交流澄清”进入：先说清“题目给了什么、要解决什么、第一步为什么这样做”，说不清的地方再问或再讲一次。`,
  reading_comprehension: ({ subject, scene }) => `用“阅读理解”进入：先读${subject}材料和例题，圈出${scene}中的定义、限制和依据，再用一句话复述。`,
  note_organization: ({ scene }) => `用“记录整理”进入：边学边记${scene}，每项只留关键词、条件和一个步骤，不整段抄答案。`,
  written_synthesis: ({ scene }) => `用“书面归纳”进入：合上材料，用自己的话写出${scene}的规律和判断方法，再回原文补漏。`,
  hands_on_operation: ({ subject }) => `用“动手操作”进入：马上亲手画、算、补全或操作一个${subject}小任务，卡住时只看下一步提示。`,
  contextual_immersion: ({ subject, scene }) => `用“情境代入”进入：把${scene}放回一道${subject}真题、生活案例或具体使用场景中再判断。`,
  process_rehearsal: ({ subject }) => `用“过程演练”进入：遮住答案完整完成一遍${subject}任务，隔一天再重做，记录第二次仍然卡住的步骤。`
});

function requireRule(table, key, label) {
  const value = table[key];
  if (!value) throw new RangeError(`未知的${label}`);
  return value;
}

export function buildModeAdvice({ subject, learningLevel, primarySpecific, supportingSpecific }) {
  const subjectRule = requireRule(SUBJECTS, subject, "学科");
  const levelRule = requireRule(LEVELS, learningLevel, "学习阶段");
  const primaryMode = requireRule(SPECIFIC_MODES, primarySpecific, "具体学习模式");
  const supportingMode = requireRule(SPECIFIC_MODES, supportingSpecific, "具体学习模式");
  if (primarySpecific === supportingSpecific) throw new RangeError("主要和辅助具体模式需要不同");
  const context = { subject, scene: subjectRule.scene };
  return Object.freeze({
    subject,
    learningLevel,
    primarySpecific,
    supportingSpecific,
    material: subjectRule.materials[learningLevel],
    entryAction: ACTIONS[primarySpecific](context),
    supportAction: ACTIONS[supportingSpecific](context).replace("进入：", "辅助检查："),
    quantity: levelRule.quantity,
    dailyMinimum: levelRule.dailyMinimum,
    finalMinimum: levelRule.finalMinimum,
    check: levelRule.check,
    weeklyFocus: `本周只先解决${subject}里的“${subjectRule.focus}”，不同时铺开多个章节。`
  });
}
