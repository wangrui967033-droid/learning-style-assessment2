import test from "node:test";
import assert from "node:assert/strict";
import { MODE_ORDER, SPECIFIC_MODES, specificModesFor } from "../src/domain/learning-modes.js";
import { getScenarioQuestions, QUESTION_BANK_VERSION } from "../src/domain/learning-mode-bank.js";

const countBy = (items, key) => Object.fromEntries([...new Set(items.map((item) => item[key]))].map((value) => [value, items.filter((item) => item[key] === value).length]));

const EXPECTED_TEXT = [
  ["老师刚讲完一个新内容，你还没弄懂。你会——", ["画出几个重点怎么连。", "说出没懂的地方，去问清。", "回到笔记，把这一段再读一遍。", "找一道用到这个新内容的小题，看看它具体怎么用。"]],
  ["有几个新词要记。你会——", ["给每个词配一个记号或小图。", "读出来，读到顺口为止。", "每个只记一个关键词。", "用这个词自己造一句话。"]],
  ["一套方法有好几步，你想把顺序记清。你会——", ["用箭头把顺序排出来。", "按顺序把这些步骤念几遍。", "把每一步要做什么，写下来。", "找一道短题，照着步骤完整做一遍。"]],
  ["新学的内容和以前学过的很像，容易混。你会——", ["给新旧内容各配一个不同的小图或符号。", "问别人：“它们到底差在哪？”", "用自己的话写一句它们最关键的区别。", "各找一道小题，分别试一步。"]],
  ["看一张解题流程图时，有一步没看懂。你会——", ["指着这一步，请人讲讲。", "读这一步旁边的说明。", "在草稿上，照着前一步接着写。", "看看这一步该接在哪一步后面。"]],
  ["一条规则配着一道例题，你想知道规则怎么用。你会——", ["听别人讲这条规则怎么用。", "再读一遍规则和例题旁的说明。", "盖住例题，照着规则完整做一遍。", "用小图画出这条规则在例题里怎么用。"]],
  ["一个概念总记不住。你会——", ["听老师或同学讲讲，这个概念到底是什么意思。", "写下它的重要关键词。", "拿刚才的例题，看看这个概念怎么用。", "画一个和它有关的小图。"]],
  ["一道错题知道答案了，但不知道自己错在哪。你会——", ["说说自己当时怎么想，再问问错在哪。", "写下这次错的是哪一步。", "盖住答案，按正确方法完整做一遍。", "把自己的做法和正确做法放一起看。"]],
  ["做题时条件很多，不知道先用哪一个。你会——", ["重读题目，弄清每个条件的意思。", "挑一个条件，在草稿上试着用一用。", "看条件和问题怎么连。", "把判断说给同学听，问问有没有漏。"]],
  ["你要把一个重点讲给同学听。你会——", ["先用自己的话写下来。", "找一道老师讲过的例题来说明。", "先画一张关系图。", "先听老师或同学讲讲，这个重点怎么解释。"]],
  ["零散的内容很多，想整理好以后复习。你会——", ["用自己的话，把这些内容分成几条写下来。", "给每一类内容配一个具体例子。", "给每一类内容画一个不同记号。", "听同学把这些内容分成几类讲一讲。"]],
  ["老师教了一套检查答案的方法，你想下次自己也会用。你会——", ["给每一步记一个提醒词。", "拿一道做完的题，照着这套方法完整检查一遍。", "用箭头把几个检查步骤按先后连起来。", "把几个检查步骤按顺序念几遍。"]],
  ["准备课堂展示时，你想先把整个过程理清。你会——", ["从上台到结束，实际排练一遍。", "把展示的几部分按先后排在纸上。", "把开头和衔接的话小声念几遍。", "写下每一部分要说什么。"]],
  ["一道题有两种做法，不知道用哪一种。你会——", ["两种做法各试一步，看哪种接得上。", "看两种做法各适合哪些条件。", "问问两种做法各适合什么题。", "看笔记，找出两种做法各适合什么情况。"]],
  ["课本上有一段话比较抽象，你想把意思弄明白。你会——", ["找一个符合这段话的具体例子。", "把这段话画成一个简单的小图。", "听老师或同学讲讲，这段话在说什么。", "用自己的话，把这段话改写成一句好懂的话。"]],
  ["刚订正完一道题，你想记住这次错在哪里。你会——", ["不看答案，把这道题完整重做一遍。", "把“易错点”和“正确做法”连起来。", "把正确做法顺着念几遍。", "重读订正，找出自己这次漏了什么。"]],
  ["第一次去新考场或新教室，怕走错。你会——", ["看平面图，把沿路几个明显的位置按先后记住。", "问人怎么走，再听一遍。", "写下楼层、方向和教室号。", "提前走一遍，从门口找到教室。"]],
  ["老师示范了一道题的答案，你想下次自己也能写完整。你会——", ["把答案里的几个要点读出声。", "写下答案里必须写到的要点。", "照着这个答案，在草稿上写一遍。", "把答案的要点按顺序排在纸上。"]],
  ["几个知识点学完后，你想弄清它们怎么连。你会——", ["写下每个知识点，再写它们怎么连。", "给每个知识点配个例子，再看它们怎么连。", "用线把几个知识点连成一张图。", "听别人讲讲，几个知识点是怎么连起来的。"]],
  ["复习完一页内容，你想看看自己是不是真的懂了。你会——", ["找一道相关小题，先试着做。", "画出这页几个重点怎么连。", "找一段讲这页内容的讲解，听一遍。", "合上书，用自己的话写下这页内容。"]]
];

const EXPECTED_MAPPINGS = [
  [["V", "structure_mapping"], ["A", "interactive_clarification"], ["R", "reading_comprehension"], ["K", "contextual_immersion"]],
  [["V", "image_association"], ["A", "sound_cues"], ["R", "note_organization"], ["K", "contextual_immersion"]],
  [["V", "spatial_relationship"], ["A", "sound_cues"], ["R", "note_organization"], ["K", "process_rehearsal"]],
  [["V", "image_association"], ["A", "interactive_clarification"], ["R", "written_synthesis"], ["K", "hands_on_operation"]],
  [["A", "interactive_clarification"], ["R", "reading_comprehension"], ["K", "hands_on_operation"], ["V", "spatial_relationship"]],
  [["A", "spoken_explanation"], ["R", "reading_comprehension"], ["K", "process_rehearsal"], ["V", "image_association"]],
  [["A", "spoken_explanation"], ["R", "note_organization"], ["K", "contextual_immersion"], ["V", "image_association"]],
  [["A", "interactive_clarification"], ["R", "note_organization"], ["K", "process_rehearsal"], ["V", "structure_mapping"]],
  [["R", "reading_comprehension"], ["K", "hands_on_operation"], ["V", "structure_mapping"], ["A", "interactive_clarification"]],
  [["R", "written_synthesis"], ["K", "contextual_immersion"], ["V", "structure_mapping"], ["A", "spoken_explanation"]],
  [["R", "written_synthesis"], ["K", "contextual_immersion"], ["V", "image_association"], ["A", "spoken_explanation"]],
  [["R", "note_organization"], ["K", "process_rehearsal"], ["V", "spatial_relationship"], ["A", "sound_cues"]],
  [["K", "process_rehearsal"], ["V", "spatial_relationship"], ["A", "sound_cues"], ["R", "note_organization"]],
  [["K", "hands_on_operation"], ["V", "structure_mapping"], ["A", "interactive_clarification"], ["R", "reading_comprehension"]],
  [["K", "contextual_immersion"], ["V", "image_association"], ["A", "spoken_explanation"], ["R", "written_synthesis"]],
  [["K", "process_rehearsal"], ["V", "structure_mapping"], ["A", "sound_cues"], ["R", "reading_comprehension"]],
  [["V", "spatial_relationship"], ["A", "interactive_clarification"], ["R", "note_organization"], ["K", "process_rehearsal"]],
  [["A", "sound_cues"], ["R", "note_organization"], ["K", "hands_on_operation"], ["V", "spatial_relationship"]],
  [["R", "written_synthesis"], ["K", "contextual_immersion"], ["V", "structure_mapping"], ["A", "spoken_explanation"]],
  [["K", "hands_on_operation"], ["V", "structure_mapping"], ["A", "spoken_explanation"], ["R", "written_synthesis"]]
];

const EXPECTED_QUESTIONS = EXPECTED_TEXT.map(([prompt, texts], index) => ({
  id: `Q${String(index + 1).padStart(2, "0")}`,
  group: ["learn", "remember", "practice", "repair"][Math.floor(index / 5)],
  prompt,
  options: texts.map((text, optionIndex) => ({
    id: `Q${String(index + 1).padStart(2, "0")}-${"ABCD"[optionIndex]}`,
    mode: EXPECTED_MAPPINGS[index][optionIndex][0],
    specificMode: EXPECTED_MAPPINGS[index][optionIndex][1],
    text
  }))
}));

const EXPECTED_SPECIFIC_MODES = {
  image_association: { id: "image_association", primary: "V", label: "看成图", definition: "把文字、概念变成图、符号或画面来理解和记忆。" },
  structure_mapping: { id: "structure_mapping", primary: "V", label: "理关系", definition: "看清知识之间的连接、比较、分类和对应。" },
  spatial_relationship: { id: "spatial_relationship", primary: "V", label: "排顺序", definition: "借助位置、排列和先后顺序组织信息。" },
  interactive_clarification: { id: "interactive_clarification", primary: "A", label: "问清楚", definition: "通过提问和一问一答，把疑惑弄明白。" },
  spoken_explanation: { id: "spoken_explanation", primary: "A", label: "听讲解", definition: "通过听别人解释，把新内容听明白。" },
  sound_cues: { id: "sound_cues", primary: "A", label: "念几遍", definition: "通过朗读、重复和声音节奏帮助记忆。" },
  reading_comprehension: { id: "reading_comprehension", primary: "R", label: "读明白", definition: "通过课本、笔记、说明和解析理解内容。" },
  note_organization: { id: "note_organization", primary: "R", label: "记重点", definition: "把关键词、条件和重要信息记录下来。" },
  written_synthesis: { id: "written_synthesis", primary: "R", label: "写总结", definition: "用自己的文字重新整理和表达学到的内容。" },
  process_rehearsal: { id: "process_rehearsal", primary: "K", label: "做一遍", definition: "按完整过程亲自完成一次，检验是否真正会做。" },
  hands_on_operation: { id: "hands_on_operation", primary: "K", label: "先试做", definition: "先动手尝试，再根据结果和反馈调整。" },
  contextual_immersion: { id: "contextual_immersion", primary: "K", label: "用例子", definition: "放进具体题目、案例或情境中理解抽象内容。" }
};

test("正式题库与定稿20题逐字一致", () => {
  const questions = getScenarioQuestions();
  assert.equal(QUESTION_BANK_VERSION, "scenario-mode-bank-v4");
  assert.equal(questions.length, 20);
  assert.deepEqual(questions, EXPECTED_QUESTIONS);
});

test("80个选项的一级和二级机制分布符合人工复核结果", () => {
  const questions = getScenarioQuestions();
  const options = questions.flatMap(({ options }) => options);
  assert.deepEqual(countBy(options, "mode"), { V: 20, A: 20, R: 20, K: 20 });
  assert.deepEqual(countBy(options, "specificMode"), {
    image_association: 6, structure_mapping: 8, spatial_relationship: 6,
    interactive_clarification: 7, spoken_explanation: 7, sound_cues: 6,
    reading_comprehension: 6, note_organization: 8, written_synthesis: 6,
    process_rehearsal: 7, hands_on_operation: 6, contextual_immersion: 7
  });
  assert.deepEqual(questions.map(({ group }) => group), ["learn", "learn", "learn", "learn", "learn", "remember", "remember", "remember", "remember", "remember", "practice", "practice", "practice", "practice", "practice", "repair", "repair", "repair", "repair", "repair"]);
  for (let index = 0; index < 4; index += 1) assert.deepEqual(countBy(questions.map(({ options }) => options[index]), "mode"), { V: 5, A: 5, R: 5, K: 5 });
});

test("学生端展示12个统一短名称", () => {
  assert.deepEqual(SPECIFIC_MODES, EXPECTED_SPECIFIC_MODES);
  assert.deepEqual(MODE_ORDER, ["V", "A", "R", "K"]);
  for (const mode of MODE_ORDER) assert.equal(specificModesFor(mode).length, 3);
});

test("听讲解的题目都提供清楚的口头讲解来源", () => {
  const listeningOptions = getScenarioQuestions()
    .flatMap(({ options }) => options)
    .filter(({ specificMode }) => specificMode === "spoken_explanation");

  assert.equal(listeningOptions.length, 7);
  for (const option of listeningOptions) assert.match(option.text, /听/);
});
