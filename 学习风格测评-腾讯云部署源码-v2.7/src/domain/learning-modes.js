export const MODE_ORDER = Object.freeze(["V", "A", "R", "K"]);

export const PRIMARY_MODES = Object.freeze({
  V: Object.freeze({ code: "V", label: "视觉模式", description: "先把内容变得看得见，再继续往下学。" }),
  A: Object.freeze({ code: "A", label: "听觉模式", description: "先听一听别人怎么讲，把思路理顺。" }),
  R: Object.freeze({ code: "R", label: "读写模式", description: "先把文字读清，再留下真正要用的提示。" }),
  K: Object.freeze({ code: "K", label: "动觉模式", description: "先做一点或拿例子试一试，再根据结果往下走。" })
});

export const SPECIFIC_MODES = Object.freeze({
  image_association: Object.freeze({ id: "image_association", primary: "V", label: "看成图", definition: "把文字、概念变成图、符号或画面来理解和记忆。" }),
  structure_mapping: Object.freeze({ id: "structure_mapping", primary: "V", label: "理关系", definition: "看清知识之间的连接、比较、分类和对应。" }),
  spatial_relationship: Object.freeze({ id: "spatial_relationship", primary: "V", label: "排顺序", definition: "借助位置、排列和先后顺序组织信息。" }),
  interactive_clarification: Object.freeze({ id: "interactive_clarification", primary: "A", label: "问清楚", definition: "通过提问和一问一答，把疑惑弄明白。" }),
  spoken_explanation: Object.freeze({ id: "spoken_explanation", primary: "A", label: "听讲解", definition: "通过听别人解释，把新内容听明白。" }),
  sound_cues: Object.freeze({ id: "sound_cues", primary: "A", label: "念几遍", definition: "通过朗读、重复和声音节奏帮助记忆。" }),
  reading_comprehension: Object.freeze({ id: "reading_comprehension", primary: "R", label: "读明白", definition: "通过课本、笔记、说明和解析理解内容。" }),
  note_organization: Object.freeze({ id: "note_organization", primary: "R", label: "记重点", definition: "把关键词、条件和重要信息记录下来。" }),
  written_synthesis: Object.freeze({ id: "written_synthesis", primary: "R", label: "写总结", definition: "用自己的文字重新整理和表达学到的内容。" }),
  process_rehearsal: Object.freeze({ id: "process_rehearsal", primary: "K", label: "做一遍", definition: "按完整过程亲自完成一次，检验是否真正会做。" }),
  hands_on_operation: Object.freeze({ id: "hands_on_operation", primary: "K", label: "先试做", definition: "先动手尝试，再根据结果和反馈调整。" }),
  contextual_immersion: Object.freeze({ id: "contextual_immersion", primary: "K", label: "用例子", definition: "放进具体题目、案例或情境中理解抽象内容。" })
});

export function specificModesFor(primaryCode) {
  if (!Object.hasOwn(PRIMARY_MODES, primaryCode)) throw new RangeError("未知的学习模式");
  return Object.values(SPECIFIC_MODES).filter(({ primary }) => primary === primaryCode);
}
