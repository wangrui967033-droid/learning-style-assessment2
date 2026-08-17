import fs from "node:fs";
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";

const ID_PATTERNS = {
  core: /^(V|A|R|K)0[1-8]$/,
  reserve: /^(V|A|R|K)(09|1[0-6])$/,
  science: /^LS(0[1-9]|10)$/
};

const PROCESS_CODES = new Map([
  ["学", "learning"],
  ["背", "memory"],
  ["练", "practice"],
  ["补", "improve"]
]);

const SCENARIO_CODES = new Map([
  ["学科", "academic"],
  ["生活", "life"]
]);

const DIRECTION_CODES = new Map([
  ["正向", "positive"],
  ["反向", "reverse"]
]);

const SUBDIMENSION_CODES = new Map([
  ["信息定位", "information_location"],
  ["图形建构", "graphic_construction"],
  ["关系组织", "relationship_organization"],
  ["差异识别", "difference_identification"],
  ["讲解理解", "explanation_comprehension"],
  ["声音线索", "sound_cues"],
  ["语言表达", "language_expression"],
  ["互动澄清", "interactive_clarification"],
  ["文字理解", "text_comprehension"],
  ["结构整理", "structure_organization"],
  ["书面表达", "written_expression"],
  ["规则提取", "rule_extraction"],
  ["案例进入", "case_entry"],
  ["操作尝试", "hands_on_trial"],
  ["过程演练", "process_rehearsal"],
  ["情境迁移", "situational_transfer"]
]);

const STRATEGY_CODES = new Map([
  ["主动回忆", "active_recall"],
  ["间隔重复", "spaced_repetition"],
  ["刻意练习", "deliberate_practice"],
  ["及时反馈", "timely_feedback"],
  ["元认知", "metacognition"]
]);

const CALIBRATION_PAIRS = new Map([
  ["视觉×听觉", ["V-A", "V", "A"]],
  ["视觉×读写", ["V-R", "V", "R"]],
  ["视觉×动觉", ["V-K", "V", "K"]],
  ["听觉×读写", ["A-R", "A", "R"]],
  ["听觉×动觉", ["A-K", "A", "K"]],
  ["读写×动觉", ["R-K", "R", "K"]]
]);

function directChildren(nodes, name) {
  return nodes.flatMap((node) => (node[name] ? [node[name]] : []));
}

function cellText(nodes) {
  let result = "";

  for (const node of nodes) {
    for (const [name, value] of Object.entries(node)) {
      if (name === "#text") result += value;
      else if (name === "w:tab") result += "\t";
      else if (name !== ":@" && Array.isArray(value)) result += cellText(value);
    }
  }

  return result;
}

function tableRows(table) {
  return directChildren(table, "w:tr").map((row) =>
    directChildren(row, "w:tc").map((cell) => cellText(cell))
  );
}

function code(map, value, label) {
  const result = map.get(value.trim());
  if (!result) throw new Error(`Unknown ${label}: ${value}`);
  return result;
}

function importPreferenceItem(cells, form) {
  const id = cells[0].trim();
  return {
    id,
    kind: "preference",
    form,
    preference: id[0],
    subdimension: code(SUBDIMENSION_CODES, cells[3], "subdimension"),
    process: code(PROCESS_CODES, cells[1], "process"),
    scenarioType: code(SCENARIO_CODES, cells[2], "scenario type"),
    direction: code(DIRECTION_CODES, cells[5], "direction"),
    prompt: cells[4],
    scale: [1, 2, 3, 4, 5]
  };
}

function importScienceItem(cells) {
  return {
    id: cells[0].trim(),
    kind: "science",
    strategy: code(STRATEGY_CODES, cells[1], "science strategy"),
    direction: code(DIRECTION_CODES, cells[3], "direction"),
    prompt: cells[2],
    scale: [1, 2, 3, 4, 5]
  };
}

function importCalibrationItem(cells) {
  const pair = CALIBRATION_PAIRS.get(cells[0].trim());
  if (!pair) throw new Error(`Unknown calibration pair: ${cells[0]}`);

  return {
    pair: pair[0],
    process: code(PROCESS_CODES, cells[1], "process"),
    prompt: cells[2],
    options: [
      { preference: pair[1], text: cells[3] },
      { preference: pair[2], text: cells[4] }
    ]
  };
}

function parseTables(docxPath) {
  const xml = new AdmZip(docxPath).readAsText("word/document.xml");
  const document = new XMLParser({ ignoreAttributes: false, preserveOrder: true }).parse(xml);
  const documentNode = document.find((node) => node["w:document"])["w:document"];
  const body = documentNode.find((node) => node["w:body"])["w:body"];
  return body.filter((node) => node["w:tbl"]).map((node) => tableRows(node["w:tbl"]));
}

function assertUniqueIds(bank) {
  const ids = new Set();
  for (const item of [...bank.core, ...bank.science, ...bank.reserve]) {
    if (ids.has(item.id)) throw new Error(`Duplicate imported ID: ${item.id}`);
    ids.add(item.id);
  }
}

export function importQuestionBank(docxPath) {
  const bank = { core: [], science: [], reserve: [], calibration: [] };

  for (const rows of parseTables(docxPath)) {
    const header = rows[0]?.map((cell) => cell.trim());
    if (header?.[0] === "偏好组合" && header[1] === "过程") {
      for (const cells of rows.slice(1)) bank.calibration.push(importCalibrationItem(cells));
      continue;
    }

    for (const cells of rows) {
      const id = cells[0]?.trim();
      if (ID_PATTERNS.core.test(id)) bank.core.push(importPreferenceItem(cells, "core"));
      else if (ID_PATTERNS.reserve.test(id)) bank.reserve.push(importPreferenceItem(cells, "reserve"));
      else if (ID_PATTERNS.science.test(id)) bank.science.push(importScienceItem(cells));
    }
  }

  assertUniqueIds(bank);
  return bank;
}

const [docxPath, outputPath] = process.argv.slice(2);
if (!docxPath || !outputPath) {
  throw new Error("Usage: node scripts/import-question-bank.mjs <source.docx> <output.json>");
}

fs.writeFileSync(outputPath, `${JSON.stringify(importQuestionBank(docxPath), null, 2)}\n`);
