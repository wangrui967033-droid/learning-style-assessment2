import { getScenarioQuestions } from "../src/domain/learning-mode-bank.js";
import { MODE_ORDER, SPECIFIC_MODES } from "../src/domain/learning-modes.js";

const questions = getScenarioQuestions();
const errors = [];
const groups = ["learn", "remember", "practice", "repair"];
const count = (values) => Object.fromEntries([...new Set(values)].map((value) => [value, values.filter((item) => item === value).length]));
const matches = (actual, expected) => Object.entries(expected).every(([key, value]) => actual[key] === value);
const abstractOrResultLanguage = /看看能不能|再验证|能不能|是否(?:能|会)|掌握|学会|做对|做完|成功|有效|建立(?:理解|知识)?框架|理解框架|构建(?:知识体系|理解框架)|建立学习模型|系统(?:地)?理解|形成(?:能力|方法|认识)|提升(?:能力|效率)|巩固(?:理解|记忆)|深化(?:理解|认识)|(?:英语|语文|数学|历史|地理|政治|物理|化学|生物|科学|道法|信息技术|美术|音乐|体育|外语)(?:课|题|知识|单词|公式|课文)?/;
const multiStepComplements = /先[^。！？]{0,24}再|(?:画|整理|读|写|说|做|试|问|用|改|查|排|标|圈)完(?:后|了)?(?:再)?(?:确认|检查|验证|整理|看|读|写|说|做|试|问|用|改|查|排|标|圈)|(?:然后|最后|之后|接着|，再)(?:整理|确认|检查|验证|看|读|写|说|做|试|问|用|改|查|排|画|标|圈)/;
const sentenceCount = (text) => (text.match(/[。！？]/g) ?? []).length;

if (questions.length !== 20) errors.push(`基础题应为20题，实际为${questions.length}题`);
if (new Set(questions.map(({ id }) => id)).size !== questions.length) errors.push("基础题ID重复");
for (const group of groups) if (questions.filter((question) => question.group === group).length !== 5) errors.push(`${group}场景应为5题`);
if (!matches(count(questions.flatMap(({ options }) => options.map(({ mode }) => mode))), { V: 20, A: 20, R: 20, K: 20 })) errors.push("四种学习模式各应出现20次");

for (const question of questions) {
  if (question.options.length !== 4) errors.push(`${question.id}应有4个选项`);
  if (new Set(question.options.map(({ mode }) => mode)).size !== 4) errors.push(`${question.id}的学习模式不完整`);
  if (/总是|从不|一定能|最正确|最努力|做这种任务|一段内容|一个过程|中间接不上/.test(JSON.stringify(question))) errors.push(`${question.id}含不合格表达`);
  if (!/你会——$/.test(question.prompt)) errors.push(`${question.id}题干必须以“你会——”结尾`);
  if (abstractOrResultLanguage.test(question.prompt)) errors.push(`${question.id}题干含抽象或结果导向表达`);
  if (multiStepComplements.test(question.prompt)) errors.push(`${question.id}题干含多步骤补语`);
  for (const option of question.options) {
    if (sentenceCount(option.text) !== 1) errors.push(`${option.id}必须是单句动作`);
  }
}
for (let index = 0; index < 4; index += 1) if (!matches(count(questions.map(({ options }) => options[index].mode)), { V: 5, A: 5, R: 5, K: 5 })) errors.push(`第${index + 1}个选项位置不平衡`);
const specificCounts = count(questions.flatMap(({ options }) => options.map(({ specificMode }) => specificMode)));
const expectedSpecificCounts = {
  image_association: 6, structure_mapping: 8, spatial_relationship: 6,
  interactive_clarification: 7, spoken_explanation: 7, sound_cues: 6,
  reading_comprehension: 6, note_organization: 8, written_synthesis: 6,
  process_rehearsal: 7, hands_on_operation: 6, contextual_immersion: 7
};
if (!matches(specificCounts, expectedSpecificCounts)) errors.push("12种具体方式次数与定稿不一致");

if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
else console.log(`Learning mode scenario bank valid: ${questions.length} questions, ${groups.length} groups, ${Object.keys(SPECIFIC_MODES).length} specific ways`);
