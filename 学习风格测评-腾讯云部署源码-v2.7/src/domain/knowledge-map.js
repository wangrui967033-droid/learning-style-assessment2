import { readFileSync } from "node:fs";

const rows = Object.freeze(JSON.parse(readFileSync(new URL("./zhejiang-knowledge-map.json", import.meta.url), "utf8")));
const MAP_LEVEL_INDEX = Object.freeze({ foundation: 0, core: 1, integrated: 1, advanced: 2 });
const MAPPED_SUBJECTS = Object.freeze(new Set(["语文", "数学", "英语", "日语", "化学", "生物", "历史", "政治", "地理"]));
const FOCUS_TOPIC_HINTS = Object.freeze({
  英语: Object.freeze({
    learning: /句|语法|连词|代词/,
    memory: /词|搭配|短语|动词|介词|连词/,
    practice: /阅读|写作|匹配|推理|细节/,
    improve: /阅读|写作|匹配|推理|细节/
  }),
  日语: Object.freeze({
    learning: /句型|助词|动词|表达/,
    memory: /单词|助词|动词|句型|时间|数量/,
    practice: /信息理解|原因|理由|主旨|阅读|填空/,
    improve: /信息理解|原因|理由|主旨|阅读|填空/
  })
});

function rankCandidate(left, right, learningFocus) {
  const leftMemory = learningFocus === "memory" && left.memoryCheckpoint ? 1 : 0;
  const rightMemory = learningFocus === "memory" && right.memoryCheckpoint ? 1 : 0;
  return rightMemory - leftMemory
    || right.frequency - left.frequency
    || left.module.localeCompare(right.module, "zh-Hans-CN")
    || left.topic.localeCompare(right.topic, "zh-Hans-CN")
    || left.detail.localeCompare(right.detail, "zh-Hans-CN");
}

export function supportsKnowledgeMap(subject) {
  return MAPPED_SUBJECTS.has(subject);
}

export function selectKnowledgeTarget({ subject, scoreLevel, learningFocus }) {
  if (!supportsKnowledgeMap(subject)) return null;
  const levelIndex = MAP_LEVEL_INDEX[scoreLevel];
  if (levelIndex === undefined) throw new RangeError(`Unknown score level: ${scoreLevel}`);

  const candidates = rows
    .filter((row) => row.subject === subject)
    .filter((row) => row.mastery[levelIndex] || row.mastery.some(Boolean))
    .sort((left, right) => rankCandidate(left, right, learningFocus));
  const hint = FOCUS_TOPIC_HINTS[subject]?.[learningFocus];
  const target = candidates.find((candidate) => hint?.test(`${candidate.topic} ${candidate.detail}`)) ?? candidates[0];
  if (!target) throw new RangeError(`No knowledge map target for ${subject}`);
  return Object.freeze({
    subject: target.subject,
    module: target.module,
    topic: target.topic,
    studentLabel: target.studentLabel,
    detail: target.detail,
    memoryCheckpoint: target.memoryCheckpoint,
    sourceFile: target.sourceFile
  });
}
