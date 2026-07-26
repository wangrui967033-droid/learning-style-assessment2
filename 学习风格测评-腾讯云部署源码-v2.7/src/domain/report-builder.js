import { PREFERENCE_MODULES } from "./preference-modules.js";
import {
  SEVEN_DAY_VERIFIABILITY,
  SUBJECT_SCENES,
  SUBJECT_STRATEGY_PRIORITY
} from "./subject-rules.js";
import { fullScoreForSubject, scoreLevelFor, validateTargetSubjectScore } from "./score-levels.js";
import { selectTaskUnit } from "./zhejiang-task-bank.js";

const PREFERENCE_ORDER = ["V", "A", "R", "K"];
const PROCESS_ORDER = ["learning", "memory", "practice", "improve"];
const STUDENT_REPORT_SCHEMA_VERSION = "2.7.1";

const PREFERENCE_META = Object.freeze({
  V: Object.freeze({ label: "视觉", definition: "先看图、位置、关系和差别，比较容易找到重点。" }),
  A: Object.freeze({ label: "听觉", definition: "先听别人讲、自己说，或通过一问一答把思路理清。" }),
  R: Object.freeze({ label: "读写", definition: "先读文字、列结构、写下来，再把规则整理清楚。" }),
  K: Object.freeze({ label: "动觉", definition: "先看例子、亲手试、按过程做，再慢慢理解原理。" })
});

const STUDENT_MECHANISM_LABELS = Object.freeze({
  information_location: "找到重点",
  graphic_representation: "图形理解",
  relationship_organization: "理清关系",
  difference_identification: "比较差异",
  explanation_comprehension: "听讲解",
  sound_cues: "声音线索",
  language_expression: "说出思路",
  question_answer_interaction: "一问一答",
  text_comprehension: "读懂文字",
  structure_organization: "结构整理",
  written_expression: "写出思路",
  rule_presentation: "提取规则",
  case_entry: "例子开始",
  hands_on_trial: "动手试试",
  process_rehearsal: "过程演练",
  contextual_presentation: "情境应用"
});

const PREFERENCE_STUDENT_LANGUAGE = Object.freeze({
  V: Object.freeze({
    strengthTitle: "视觉帮你快速看清",
    strength: "一页内容很多时，标记、图示和位置能帮你先找到重点，也更容易看出哪些内容有关联。",
    use: "看清条件、位置、关系和差异",
    risk: "图看明白了、重点标出来了"
  }),
  A: Object.freeze({
    strengthTitle: "听觉帮你连接依据",
    strength: "别人按顺序讲，或和你一问一答时，你更容易跟上过程，弄明白每一步为什么这样做。",
    use: "听清依据、顺序和每一步为什么成立",
    risk: "讲解听懂了、讨论跟上了"
  }),
  R: Object.freeze({
    strengthTitle: "读写帮你整理清楚",
    strength: "把内容读清楚、分点写下来，能帮你把零散信息整理成以后找得到、写得出的内容。",
    use: "把信息整理成有层次、可检查的文字",
    risk: "笔记整理完整了、规则抄清楚了"
  }),
  K: Object.freeze({
    strengthTitle: "动觉帮你从做中理解",
    strength: "先看一个具体例子，再亲手做一遍，能帮你把抽象内容变成自己做过的过程。",
    use: "从具体案例、尝试和完整过程进入",
    risk: "例题做过了、过程跟完了"
  })
});

const PREFERENCE_ACTION_LANGUAGE = Object.freeze({
  V: "先圈出标题、条件和重点，把关键关系看清楚",
  A: "听完一小段后暂停，用自己的话说清每一步为什么成立",
  R: "先读清要求，把关键信息写成三到五条",
  K: "先看一个具体例子，再自己动手完整做一遍"
});

const SINGLE_ENTRY_VALUE = Object.freeze({
  V: Object.freeze({
    title: "从看见重点到自己重建关系",
    text: "视觉线索能帮你看清重点；接下来还要试试，不看现成图示时，自己能不能把关系画出来。",
    example: (subject) => `例如，学完${subject}后合上材料，自己重新标出重点、画出关系，再说说它们怎么连起来。`
  }),
  A: Object.freeze({
    title: "从听懂过程到自己讲清楚",
    text: "讲解能帮你跟上过程；接下来还要试试，没有别人提示时，自己能不能把每一步和理由讲清楚。",
    example: (subject) => `例如，听完${subject}讲解后先停一下，不看讲解稿，自己说清要求、做法和理由，再做一遍。`
  }),
  R: Object.freeze({
    title: "从整理完整到不看材料也能写出",
    text: "文字和提纲能帮你整理清楚；接下来还要试试，合上材料后，自己能不能写出关键内容。",
    example: (subject) => `例如，整理完${subject}笔记后合上资料，重新写出要点和答案；写不出的地方，再回头补上。`
  }),
  K: Object.freeze({
    title: "从跟着做过到换一道题也会做",
    text: "例子和亲手尝试能帮你进入任务；接下来还要换一个问法，看看自己还能不能做出来。",
    example: (subject) => `例如，跟着做完一道${subject}例题后先盖住答案，再换一道问法不同的题自己做。`
  })
});

const PREFERENCE_PAIR_VALUE = Object.freeze({
  AV: Object.freeze({
    title: "从找到重点走向讲清逻辑",
    text: "这两个入口接起来用，先能找到信息，再能把条件和结论之间的关系说清楚。",
    example: (subject) => `例如，完成${subject}任务后，指着自己找到的条件，说说每一步为什么成立；说不清的地方，再问一遍或重做一遍。`
  }),
  RV: Object.freeze({
    title: "从看清结构走向写成答案",
    text: "这两个入口接起来用，先看清关系，再把它写成完整答案。",
    example: (subject) => `例如，把${subject}图示中的关系改写成完整答案；图里看到了，答案却没写出来的地方，再回头检查。`
  }),
  KV: Object.freeze({
    title: "从看见关系走向动手验证",
    text: "这两个入口接起来用，先看出关系，再亲手做一遍，看看这个理解能不能用。",
    example: (subject) => `例如，先根据${subject}图示判断结果，再独立做一道对应任务；结果不一样时，回头看看是哪条关系看错了。`
  }),
  AR: Object.freeze({
    title: "从听懂思路走向写得完整",
    text: "这两个入口接起来用，先听懂思路，再把步骤和理由写完整。",
    example: (subject) => `例如，听懂${subject}做法后不照抄，自己写出步骤和依据；说得出却写不全的地方，再补到答案里。`
  }),
  AK: Object.freeze({
    title: "从听清步骤走向亲自做通",
    text: "这两个入口接起来用，听完步骤就亲自做一遍，哪里卡住，哪里就需要再问清楚。",
    example: (subject) => `例如，听完一小段${subject}做法就停下来，自己接着做；第一处卡住的地方，就是要再问清或再练的地方。`
  }),
  KR: Object.freeze({
    title: "从读懂规则走向实际用出来",
    text: "这两个入口接起来用，先读懂规则，再拿一道新题试试能不能用出来。",
    example: (subject) => `例如，看完${subject}规则后合上材料，独立完成一个新任务；用不出来的那条规则，就是接下来要练的地方。`
  })
});

const MECHANISM_SCENE_EXAMPLES = Object.freeze({
  information_location: (subject) => `例如，做${subject}作业时，先圈出题目要求、已知信息和容易漏掉的关键词，通常更容易找到开始位置。`,
  graphic_representation: (subject) => `例如，看${subject}中关系复杂的内容时，用括号、箭头或简单图示标出来，通常更容易看懂。`,
  relationship_organization: (subject) => `例如，复习${subject}一章内容时，把知识按先后、原因和结果连起来，通常更容易记清。`,
  difference_identification: (subject) => `例如，两道${subject}题看起来很像时，并排比较题目中哪里不一样，能帮你避免用错方法。`,
  explanation_comprehension: (subject) => `例如，${subject}步骤比较多时，听老师按顺序讲清每一步为什么这样做，通常更容易跟上。`,
  sound_cues: (subject) => `例如，背${subject}内容时，把关键词读出声或按节奏分组，通常更容易想起来。`,
  language_expression: (subject) => `例如，做完一道${subject}题后，自己把做法讲一遍，常常能发现哪一步还没想明白。`,
  question_answer_interaction: (subject) => `例如，${subject}学习卡住时，把“不懂”变成一个具体问题，再问清理由，会更容易继续。`,
  text_comprehension: (subject) => `例如，看${subject}课本、规则或题目要求时，先读清关键词和容易漏掉的要求，通常更容易准确理解任务。`,
  structure_organization: (subject) => `例如，${subject}笔记比较乱时，把内容分成几个小标题，通常更容易找到和复习。`,
  written_expression: (subject) => `例如，${subject}思路还不清楚时，先把第一步和理由写下来，通常更容易继续。`,
  rule_presentation: (subject) => `例如，${subject}方法把什么时候用、分几步做写清楚时，通常更容易照着完成。`,
  case_entry: (subject) => `例如，遇到新的${subject}方法时，先看一道例题怎样做，通常更容易理解。`,
  hands_on_trial: (subject) => `例如，学一种新的${subject}做法时，先亲手试一步，再看哪里需要改，通常更容易进入状态。`,
  process_rehearsal: (subject) => `例如，${subject}内容有固定顺序时，自己从头到尾做一遍，会比只看别人做记得更牢。`,
  contextual_presentation: (subject) => `例如，${subject}方法放进一道具体题或真实例子里时，通常更容易知道它什么时候能用。`
});

const MECHANISM_EXECUTION_CARDS = Object.freeze({
  information_location: Object.freeze({
    startAction: "先圈出标题、已知条件、限制条件和任务目标，只保留最关键的标记",
    practiceAction: "每次开始前先用有限标记找齐关键信息，再遮住标记独立完成",
    checkAction: "先不看标记，再说出条件和目标是否齐全",
    evidence: "一份只标出标题、条件和重点的任务稿",
    support: "老师只追问还漏了哪条条件，不直接告诉完整做法"
  }),
  graphic_representation: Object.freeze({
    startAction: "先看清图示中的对象和关系，再用一张简图表示当前任务",
    practiceAction: "把文字、符号或过程转成简图，完成后遮住原图重新画一次",
    checkAction: "遮住原图，检查自己能否重画对象和关系",
    evidence: "一张学生自己补画的关系图和对应作答",
    support: "老师可以提供空白图框，但不替学生完成图中的关系"
  }),
  relationship_organization: Object.freeze({
    startAction: "先把先后、因果或条件与结论排成一条关系链",
    practiceAction: "每次完成后重新排列关系，并说清每一部分怎样连接",
    checkAction: "打乱顺序后重排，检查每一段连接是否说得通",
    evidence: "一条由学生重新组织的关系链和连接说明",
    support: "老师只指出关系断开的地方，让学生自己重新连接"
  }),
  difference_identification: Object.freeze({
    startAction: "先把原任务和变化任务并排，标出唯一发生变化的条件",
    practiceAction: "每次只改变一个条件，比较做法和结果哪里必须调整",
    checkAction: "对照两个任务，说出哪一个条件改变了做法",
    evidence: "一份原任务与变化任务的条件对比表",
    support: "老师一次只改变一个条件，追问这个变化影响了哪一步"
  }),
  explanation_comprehension: Object.freeze({
    startAction: "先听完一小段顺序清楚的讲解，再暂停确认自己听懂了什么",
    practiceAction: "每听完一小段就暂停，用自己的话复述依据，再独立完成下一步",
    checkAction: "不再听讲解，用自己的话说清每一步为什么成立",
    evidence: "一段口头复述记录和对应的独立作答",
    support: "老师把讲解拆短，每一段结束后先让学生复述再继续"
  }),
  sound_cues: Object.freeze({
    startAction: "先把三到五个关键词读出来，为当前内容留下简短声音提示",
    practiceAction: "听到或读出提示词后遮住材料，凭声音线索恢复完整内容",
    checkAction: "只保留少量提示词，检查能否完整恢复内容",
    evidence: "一份关键词声音提示清单和无提示恢复稿",
    support: "老师只保留少量提示词，随后先不看提示，检查学生能否自己想起来"
  }),
  language_expression: Object.freeze({
    startAction: "先用自己的话完整说一遍任务要求和准备采用的做法",
    practiceAction: "每完成一步都说出条件和理由，再把口头思路转成独立作答",
    checkAction: "脱离笔记，说清任务要求、做法和每一步的理由",
    evidence: "一段口头讲解记录和一份对应的书面作答",
    support: "老师先听学生说完整理由，只追问说不清的那一步"
  }),
  question_answer_interaction: Object.freeze({
    startAction: "先把最不清楚的地方变成一个可以回答的具体问题",
    practiceAction: "用一问一答找到卡点，每次回答都必须带上一个依据",
    checkAction: "用一个具体问题追问卡点，回答时必须说出依据",
    evidence: "三组问题、回答和依据的简短记录",
    support: "老师只用具体问题追问，不直接把完整答案讲出来"
  }),
  text_comprehension: Object.freeze({
    startAction: "先读清定义、使用条件和任务要求，在原文旁写下关键词",
    practiceAction: "每读完一段就合上材料，用一句自己的话写出主要意思",
    checkAction: "离开原文，写出定义、条件和任务要求",
    evidence: "一份带关键词标记和自写解释的书面稿",
    support: "老师要求学生离开原文回答，再回到原文核对遗漏"
  }),
  structure_organization: Object.freeze({
    startAction: "先把零散内容分成三到五个标题，每个标题只放一类信息",
    practiceAction: "按标题整理后遮住提纲，凭记忆重新写出结构和要点",
    checkAction: "遮住提纲，检查自己能否重写标题和要点",
    evidence: "一份三到五条提纲和对应的闭卷恢复稿",
    support: "老师检查分类是否重复或遗漏，不帮助美化笔记"
  }),
  written_expression: Object.freeze({
    startAction: "先写下自己的解释或第一步，不让思路只停留在脑中",
    practiceAction: "每一步都写清条件、做法和依据，完成后逐项检查",
    checkAction: "逐项检查书面结果是否准确、完整且有依据",
    evidence: "一份能看见条件、步骤和依据的完整书面稿",
    support: "老师只按准确、完整和有依据三个标准核对书面结果"
  }),
  rule_presentation: Object.freeze({
    startAction: "先阅读分条规则，圈出适用条件、步骤和注意事项",
    practiceAction: "按规则完成后遮住清单，自己重新写出并应用一次",
    checkAction: "遮住清单，检查能否写全适用条件并正确应用",
    evidence: "一份规则清单和一次无提示应用结果",
    support: "老师只提示遗漏了哪类规则，让学生自己补齐并再做"
  }),
  case_entry: Object.freeze({
    startAction: "先看一个和当前任务最接近的具体例子，指出例子每一步在做什么",
    practiceAction: "看完例子后立即遮住，换一个相近任务自己完整做一遍",
    checkAction: "遮住例子，检查能否在相近任务中自己完成",
    evidence: "一份案例步骤拆解和一份独立完成的任务",
    support: "老师追问例子与方法的对应，再换一个例子让学生验证"
  }),
  hands_on_trial: Object.freeze({
    startAction: "先动手完成一个最小步骤，不等全部讲完再开始",
    practiceAction: "试一步、看结果、改一步，完成后从头独立重做",
    checkAction: "从头独立重做，检查修改后的每一步是否成立",
    evidence: "一份保留尝试痕迹和修改过程的完整重做稿",
    support: "老师限定一个小步骤，让学生先试，再追问为什么这样改"
  }),
  process_rehearsal: Object.freeze({
    startAction: "先按真实顺序完整走一遍过程，边做边标记关键选择",
    practiceAction: "连续演练同一流程，每次减少一个提示，直到能够独立完成",
    checkAction: "先不看顺序提示，检查能否按真实顺序完整做完",
    evidence: "一份过程顺序记录和一次无提示完成稿",
    support: "老师只在顺序中断时提示位置，让学生自己恢复后续过程"
  }),
  contextual_presentation: Object.freeze({
    startAction: "先把做法放进一个具体使用情境，判断它在什么时候适用",
    practiceAction: "每次换一个条件或情境，判断哪些做法保留、哪些必须调整",
    checkAction: "换一个具体情境，检查能否说出哪些做法需要调整",
    evidence: "三种情境下的选择、理由和调整记录",
    support: "老师提供条件略有变化的新任务，只根据学生的独立结果反馈"
  })
});

const MECHANISM_COMPACT_ACTIONS = Object.freeze({
  information_location: Object.freeze({ start: "先圈出条件和关键目标", check: "先不看标记再找一次" }),
  graphic_representation: Object.freeze({ start: "把关系画成简图", check: "遮住原图重新画" }),
  relationship_organization: Object.freeze({ start: "把信息连成关系链", check: "打乱后重新排序" }),
  difference_identification: Object.freeze({ start: "标出唯一变化的条件", check: "说清变化影响哪一步" }),
  explanation_comprehension: Object.freeze({ start: "听完一小段讲解再复述", check: "用自己的话说清" }),
  sound_cues: Object.freeze({ start: "读出三到五个提示词", check: "先不看提示再回想" }),
  language_expression: Object.freeze({ start: "先说清要求和做法", check: "脱离笔记再讲一遍" }),
  question_answer_interaction: Object.freeze({ start: "把卡点变成一个问题", check: "回答后再独立完成" }),
  text_comprehension: Object.freeze({ start: "读清要求和限制条件", check: "合上材料再说要求" }),
  structure_organization: Object.freeze({ start: "把内容分成三到五点", check: "打乱要点后重排" }),
  written_expression: Object.freeze({ start: "写出第一步和理由", check: "遮住原稿重新写" }),
  rule_presentation: Object.freeze({ start: "先看清条件和步骤", check: "不看规则再完成" }),
  case_entry: Object.freeze({ start: "先看一个具体例子", check: "换个例子自己做" }),
  hands_on_trial: Object.freeze({ start: "先亲手试一个小步骤", check: "不看示范再做一次" }),
  process_rehearsal: Object.freeze({ start: "按顺序完整做一遍", check: "先不看提示重做过程" }),
  contextual_presentation: Object.freeze({ start: "先看方法在何时使用", check: "换个情境再判断" })
});

const STRATEGY_TASK_ACTIONS = Object.freeze({
  retrieval: (taskUnit) => `合上材料，独立完成${taskUnit.taskFamily}`,
  spaced_repetition: (taskUnit) => `隔一天，不看旧答案再做${taskUnit.taskFamily}`,
  deliberate_practice: () => "只练一个卡点，对照反馈再做一次",
  timely_feedback: () => "核对第一个错误，不看答案重做一次",
  metacognition: () => "比较前后答案，只保留有效的一步"
});

const STRATEGY_PURPOSE = Object.freeze({
  retrieval: "把“看过、听过”变成不看材料也能独立恢复",
  spaced_repetition: "检验内容隔开一段时间后是否仍能保留",
  deliberate_practice: "把一个大问题拆成明确卡点，并针对条件变化反复修正",
  timely_feedback: "让错误在产出后尽快暴露，并用重新完成确认已经修正",
  metacognition: "根据真实产出判断当前方法是否值得保留"
});

const STRATEGY_PROBLEM = Object.freeze({
  retrieval: "合上资料后，你还能不能自己说出来或写出来？",
  spaced_repetition: "隔一天后，你还能不能想起来并用出来？",
  deliberate_practice: "题目换一个条件后，你还能不能自己完成？",
  timely_feedback: "知道哪里错后，你能不能不看答案重新做对？",
  metacognition: "做完以后，你能不能判断哪一步真的有用？"
});

const STRATEGY_STUDENT_LANGUAGE = Object.freeze({
  retrieval: Object.freeze({
    label: "合上资料，自己回想",
    why: "你现在最需要确认的，不是看着材料有没有印象，而是不看材料还能想起多少。",
    success: "不看材料也能说出或写出关键内容，再对照补全遗漏。"
  }),
  spaced_repetition: Object.freeze({
    label: "隔开时间，再测一次",
    why: "你现在最需要确认的，不是刚学完会不会，而是隔开一段时间后还能不能想起并使用。",
    success: "隔一天或两天，不看以前的答案仍能完成相近任务。"
  }),
  deliberate_practice: Object.freeze({
    label: "盯住一个卡点，练到会",
    why: "你现在最需要的不是多做题，而是找到一个具体卡点，连续练习并改对。",
    success: "同一个卡点连续改对，再遇到一道问法不同的题也会做。"
  }),
  timely_feedback: Object.freeze({
    label: "发现错误，马上重做",
    why: "你现在最需要的不是只把答案改对，而是趁错误还清楚时找到原因，再独立做一遍。",
    success: "能说清错在哪里，并在不看答案时独立重做正确。"
  }),
  metacognition: Object.freeze({
    label: "做完比较，留下有效方法",
    why: "你现在最需要的不是不断换方法，而是比较前后结果，留下真正有用的一步。",
    success: "能根据前后两次答案说明这一步该保留、调整还是更换。"
  })
});

const STRATEGY_RISK = Object.freeze({
  retrieval: Object.freeze({
    headline: "不等于合上资料后还能自己说出来或写出来",
    explanation: "接下来要试的是：合上资料，先自己说或写；完成后再打开资料，只补漏掉的内容。"
  }),
  spaced_repetition: Object.freeze({
    headline: "不等于隔一天后还记得、还会用",
    explanation: "接下来要试的是：隔一天或两天，不看以前的答案再做一次。"
  }),
  deliberate_practice: Object.freeze({
    headline: "不等于题目换一种问法时还会做",
    explanation: "接下来要试的是：找到最容易错的一步，连续练对；再换一道问法不同的题，看自己还会不会。"
  }),
  timely_feedback: Object.freeze({
    headline: "不等于错误已经真正改会",
    explanation: "接下来要试的是：改完答案后能不能说清错在哪里，并在不看答案时重新做对。"
  }),
  metacognition: Object.freeze({
    headline: "不等于现在的方法真的有用",
    explanation: "接下来要试的是：比较前后两次答案，再决定这个方法该继续、改一下还是换掉。"
  })
});

const STRATEGY_RISK_SCENES = Object.freeze({
  retrieval: (subject) => `比如，打开${subject}笔记时觉得很熟悉，但合上以后却写不出关键内容。`,
  spaced_repetition: (subject) => `比如，${subject}内容刚学完时会做，隔两天再遇到就需要重新看一遍。`,
  deliberate_practice: (subject) => `比如，${subject}原题跟着讲解会做，但只要换一个条件，就不确定哪一步需要调整。`,
  timely_feedback: (subject) => `比如，${subject}错题已经把答案改对，但遮住答案再做时，还是会在同一步出错。`,
  metacognition: (subject) => `比如，整理、听讲或做题后感觉${subject}学得很充实，但没有关掉材料自己做一次。`
});

const STRATEGIES = Object.freeze({
  retrieval: Object.freeze({ label: "主动回忆", definition: "学习后不看材料，主动从记忆中提取内容，再对照补漏。", sourceKeys: ["retrieval", "active_recall"], process: "memory", action: "移开材料，凭记忆恢复关键信息，再对照补漏。" }),
  spaced_repetition: Object.freeze({ label: "间隔复习", definition: "把复习分散到不同时间点，隔一天或两天再回想、再使用。", sourceKeys: ["spaced_repetition"], process: "memory", action: "隔一天或两天，再次不看资料回想同一内容。" }),
  deliberate_practice: Object.freeze({ label: "刻意练习", definition: "围绕一个明确卡点进行针对练习，并根据反馈反复修正。", sourceKeys: ["deliberate_practice"], process: "practice", action: "围绕明确要求处理条件变化任务，并修正具体步骤。" }),
  timely_feedback: Object.freeze({ label: "及时反馈", definition: "完成任务后尽快对照要求，找出差异并重新完成。", sourceKeys: ["timely_feedback"], process: "improve", action: "完成产出后尽快对照标准，定位差异并重新完成。" }),
  metacognition: Object.freeze({ label: "元认知", definition: "学习前选择做法，学习后根据完成结果判断并调整方法。", sourceKeys: ["metacognition"], process: "learning", action: "任务前选择做法，完成后用实际产出判断是否有效。" })
});

const PROCESS_LABELS = Object.freeze({
  learning: "学：第一次理解",
  memory: "背：记忆与复习",
  practice: "练：做题与应用",
  improve: "补：订正与复盘"
});

const LEARNING_FOCUS_META = Object.freeze({
  learning: Object.freeze({ label: "理解新知识", shortLabel: "学" }),
  memory: Object.freeze({ label: "记忆和复习", shortLabel: "背" }),
  practice: Object.freeze({ label: "做题和应用", shortLabel: "练" }),
  improve: Object.freeze({ label: "错题和补弱", shortLabel: "补" })
});

const FOCUS_MATERIAL_SELECTION = Object.freeze({
  learning: "选1个本周刚学、但还不能用自己的话说清的知识点",
  memory: "选10项本周需要记住、但还不能不看材料说对或写对的内容",
  practice: "选1道还没做过的题和1道方法相同、问法不同的题",
  improve: "选1道本周反复出错或改完仍不会独立做的错题"
});

const FOCUS_PREFERENCE_CHECKS = Object.freeze({
  learning: Object.freeze({
    V: "遮住图示，用自己的话说清主要关系",
    A: "不再听讲解，自己讲一遍",
    R: "合上材料，写出三条要点",
    K: "离开示例，自己做一个相近任务"
  }),
  memory: Object.freeze({
    V: "遮住材料，根据标题或图示把内容说出来或写出来",
    A: "不听提示，自己完整说一遍",
    R: "不看原文，把答案、关键词或表达完整写下来",
    K: "换一个例子，把记住的内容用出来"
  }),
  practice: Object.freeze({
    V: "撤掉标记，自己重新找条件并完成",
    A: "不听讲解，自己说清每一步理由",
    R: "不看步骤卡，写出完整答案",
    K: "换一道相近题，自己完整做一遍"
  }),
  improve: Object.freeze({
    V: "遮住标注，再找一次错误位置",
    A: "不听提示，自己说清错因",
    R: "不看原答案，写出改正后的完整答案",
    K: "换一道同类题，再做一次"
  })
});

const SECTION_TITLES = Object.freeze([
  ["summary", "一句话认识你"],
  ["learningPattern", "你的学习方式"],
  ["strengths", "这些方式能帮你什么"],
  ["risks", "你最容易出现什么错觉"],
  ["subjectPlan", "本周学习建议"],
  ["sevenDayAction", "7天学习小尝试"]
]);
const SECTION_TITLE_BY_ID = Object.freeze(Object.fromEntries(SECTION_TITLES));

const MECHANISM_LEVELS = Object.freeze(["表现较明显", "在部分场景出现", "当前证据较少"]);

function readIndex(value) {
  const index = typeof value === "object" && value !== null ? value.index : value;
  if (!Number.isFinite(index)) throw new TypeError("preference indices must be finite numbers");
  return index;
}

function readIndices(scoreResult, profile) {
  return Object.fromEntries(PREFERENCE_ORDER.map((code) => [
    code,
    readIndex(profile?.indices?.[code] ?? scoreResult?.preference?.[code])
  ]));
}

function rankPreferences(indices) {
  return PREFERENCE_ORDER.slice().sort((left, right) => (
    indices[right] - indices[left] || PREFERENCE_ORDER.indexOf(left) - PREFERENCE_ORDER.indexOf(right)
  ));
}

function scienceEvidence(science, strategy) {
  const key = strategy.sourceKeys.find((sourceKey) => Number.isFinite(science?.[sourceKey]?.total));
  if (!key) throw new TypeError(`missing science score for ${strategy.label}`);
  return science[key];
}

function evidenceLevel(score) {
  if (score <= 4) return { rank: 0, label: "当前证据较少" };
  if (score <= 7) return { rank: 1, label: "在部分场景出现" };
  return { rank: 2, label: "表现较明显" };
}

function choosePriorityStrategy(science, subject, learningFocus) {
  const subjectPriority = SUBJECT_STRATEGY_PRIORITY[subject];
  const candidates = Object.entries(STRATEGIES).map(([id, strategy]) => {
    const evidence = scienceEvidence(science, strategy);
    const level = evidenceLevel(evidence.total);
    const lowItemCount = Number.isInteger(evidence.lowItemCount) ? evidence.lowItemCount : 0;
    return {
      id,
      ...strategy,
      level: level.label,
      evidenceRank: level.rank,
      riskRank: -lowItemCount,
      focusRank: strategy.process === learningFocus ? 0 : 1,
      subjectRank: subjectPriority.indexOf(id),
      verificationRank: SEVEN_DAY_VERIFIABILITY.indexOf(id)
    };
  });
  const selected = candidates.sort((left, right) => (
    left.evidenceRank - right.evidenceRank
    || left.riskRank - right.riskRank
    || left.focusRank - right.focusRank
    || left.subjectRank - right.subjectRank
    || left.verificationRank - right.verificationRank
  ))[0];
  const recommendationReason = `你选择的是${subject}“${LEARNING_FOCUS_META[learningFocus].label}”；${STRATEGY_STUDENT_LANGUAGE[selected.id].why}所以本周先试一次。`;
  return {
    id: selected.id,
    label: selected.label,
    definition: selected.definition,
    studentLabel: STRATEGY_STUDENT_LANGUAGE[selected.id].label,
    process: selected.process,
    level: selected.level,
    action: selected.action,
    reason: recommendationReason
  };
}

function strategyProgress(science, priorityId) {
  return Object.entries(STRATEGIES).map(([id, strategy]) => {
    const evidence = scienceEvidence(science, strategy);
    return {
      id,
      label: strategy.label,
      total: evidence.total,
      level: evidenceLevel(evidence.total).label,
      isPriority: id === priorityId
    };
  });
}

const LANGUAGE_MEMORY_ENTRY_ACTIONS = Object.freeze({
  V: Object.freeze({
    information_location: "用颜色标词义和搭配，遮住后回想",
    graphic_representation: "把词义和词块放进情境图，遮住后回想",
    relationship_organization: "把同义词、反义词连成关系图，遮住后回想",
    difference_identification: "并排易混词，用颜色标出用法差别"
  }),
  A: Object.freeze({ default: "听准词音和词块，再用自己的话说出词义和搭配" }),
  R: Object.freeze({ default: "把词义、搭配和一个例句写成三行，再遮住原文重写" }),
  K: Object.freeze({ default: "把词汇放进一个具体句子或情境中使用，再换一个情境重新表达" })
});

const MECHANISM_TASK_ENTRY_ACTIONS = Object.freeze({
  information_location: (task) => `用颜色圈出${task.focusPrompt}`,
  graphic_representation: (task) => `把${task.focusPrompt}画成简图`,
  relationship_organization: (task) => `把${task.focusPrompt}连成关系链`,
  difference_identification: (task) => `并排比较${task.focusPrompt}`,
  explanation_comprehension: (task) => `听一小段${task.taskFamily}讲解后复述`,
  sound_cues: (task) => `读出${task.focusPrompt}中的关键词`,
  language_expression: (task) => `口头说清${task.workPrompt}的做法`,
  question_answer_interaction: (task) => `围绕${task.issuePrompt}问一个具体问题`,
  text_comprehension: (task) => `读清${task.focusPrompt}并写关键词`,
  structure_organization: (task) => `把${task.focusPrompt}分成三到五点`,
  written_expression: (task) => `写出${task.workPrompt}的第一步和理由`,
  rule_presentation: (task) => `看清${task.focusPrompt}的条件和步骤`,
  case_entry: (task) => `看一个${task.taskFamily}例子`,
  hands_on_trial: (task) => `试做${task.workPrompt}的一小步`,
  process_rehearsal: (task) => `按顺序完整做一遍${task.workPrompt}`,
  contextual_presentation: (task) => `把${task.workPrompt}放进具体情境`
});

function primaryAdapterDetail(adapter) {
  if (adapter.primaryPreference && adapter.primaryMechanism) {
    return { preference: adapter.primaryPreference, mechanism: adapter.primaryMechanism };
  }
  if (Array.isArray(adapter.preferences) && adapter.preferences.length && Array.isArray(adapter.mechanisms)) {
    return { preference: adapter.preferences[0], mechanism: adapter.mechanisms[0] };
  }
  return null;
}

function matchedEntryAction(subject, learningFocus, adapter, taskUnit) {
  const detail = primaryAdapterDetail(adapter);
  if (!detail) return adapter.compactStart;
  const prefix = taskUnit.scoreLevel === "foundation"
    ? "保留提示，先"
    : taskUnit.scoreLevel === "advanced"
      ? "限时先"
      : "先";
  if (["英语", "日语"].includes(subject) && learningFocus === "memory") {
    const actionSet = LANGUAGE_MEMORY_ENTRY_ACTIONS[detail.preference];
    const specialized = actionSet?.[detail.mechanism.id] ?? actionSet?.default;
    if (specialized) return `${prefix}在${taskUnit.taskFamily}中${specialized}`;
  }
  const action = MECHANISM_TASK_ENTRY_ACTIONS[detail.mechanism.id];
  return action ? `${prefix}${action(taskUnit)}` : `${prefix}${adapter.compactStart}`;
}

function adapterMatchLabel(adapter) {
  const detail = primaryAdapterDetail(adapter);
  if (!detail) return "当前学习入口";
  return `${PREFERENCE_META[detail.preference].label}入口的“${detail.mechanism.label}”`;
}

function mechanismEvidence(scoreResult, preference, subject, limit = 2) {
  const levelRank = new Map(MECHANISM_LEVELS.map((level, index) => [level, MECHANISM_LEVELS.length - index]));
  return PREFERENCE_MODULES.filter((module) => module.preference === preference).map((module, order) => {
    const level = scoreResult?.preference?.[preference]?.mechanisms?.[module.id]?.level ?? "在部分场景出现";
    return {
      id: module.id,
      label: STUDENT_MECHANISM_LABELS[module.id] ?? module.label,
      definition: module.definition,
      typicalBehaviors: module.typicalBehaviors.slice(0, 2),
      sceneExample: MECHANISM_SCENE_EXAMPLES[module.id](subject),
      level,
      order
    };
  }).sort((left, right) => (
    levelRank.get(right.level) - levelRank.get(left.level) || left.order - right.order
  )).slice(0, limit).map(({ order, ...mechanism }) => mechanism);
}

function preferenceEntry(scoreResult, preference, role, subject, mechanismLimit = 2) {
  return {
    code: preference,
    label: PREFERENCE_META[preference].label,
    role,
    definition: PREFERENCE_META[preference].definition,
    mechanisms: mechanismEvidence(scoreResult, preference, subject, mechanismLimit)
  };
}

function preferenceInterpretation(preference, score) {
  const language = PREFERENCE_STUDENT_LANGUAGE[preference];
  if (score >= 65) return `本次作答中，这种方式较常出现。它通常能帮助你${language.use}。`;
  if (score >= 45) return `这类方式会在部分学习场景中帮到你。需要时，可以用它来${language.use}。`;
  return `本次作答中，这类方式出现得相对少。它不是短板，遇到合适任务时也可以尝试用它来${language.use}。`;
}

function allPreferenceEntries(scoreResult, indices, subject) {
  return PREFERENCE_ORDER.map((preference) => ({
    ...preferenceEntry(scoreResult, preference, "本次表现", subject, 4),
    score: indices[preference],
    interpretation: preferenceInterpretation(preference, indices[preference])
  }));
}

function namedPreferences(profile) {
  if (profile.type === "single_clear") {
    return {
      primary: profile.primary,
      auxiliary: null,
      equal: []
    };
  }
  if (profile.type === "dual" && Array.isArray(profile.preferences)) {
    if (profile.confirmationStatus === "balanced" || (!profile.primary && !profile.secondary)) {
      return { primary: null, auxiliary: null, equal: profile.preferences.slice(0, 2) };
    }
    return { primary: profile.primary, auxiliary: profile.secondary, equal: [] };
  }
  return { primary: null, auxiliary: null, equal: [] };
}

function overviewProfileLabel(profile, named) {
  if (profile.type === "single_clear") return `${PREFERENCE_META[named.primary].label}主要入口`;
  if (named.equal.length === 2) {
    return `${PREFERENCE_META[named.equal[0]].label}＋${PREFERENCE_META[named.equal[1]].label}双重入口`;
  }
  if (named.primary && named.auxiliary) {
    return `${PREFERENCE_META[named.primary].label}主入口＋${PREFERENCE_META[named.auxiliary].label}辅助入口`;
  }
  if (profile.type === "multi_channel") return "多通道学习入口";
  throw new TypeError(`unsupported profile type: ${profile.type}`);
}

function oneSentence(profile, named, entries, subject, strategy) {
  const behavior = (entry) => entry.mechanisms[0]?.typicalBehaviors?.[0] ?? PREFERENCE_STUDENT_LANGUAGE[entry.code].use;
  if (profile.type === "single_clear") {
    const entry = entries[0];
    return `面对${subject}时，你比较常从${entry.label}线索进入。${behavior(entry)}，这能帮你先找到第一步。接下来先练“${strategy.studentLabel}”，把看懂的内容再做一遍、说一遍或写一遍。这只是本次作答中比较常见的方式，不是能力标签。`;
  }
  if (named.equal.length === 2) {
    const [first, second] = entries;
    return `面对${subject}时，${first.label}和${second.label}两种方式都比较常见，本次不区分主次。${behavior(first)}；${behavior(second)}。接下来可以先练“${strategy.studentLabel}”，看看这两种方式怎样配合起来更顺手。它们是学习时可以调用的入口，不是固定类型。`;
  }
  if (named.primary && named.auxiliary) {
    const [primary, auxiliary] = entries;
    return `面对${subject}时，你比较常先用${primary.label}找到入口，再用${auxiliary.label}补充理解。${behavior(primary)}；内容变复杂时，${behavior(auxiliary)}。接下来先练“${strategy.studentLabel}”，把开始时的帮助接到自己完成的结果上。`;
  }
  if (profile.type === "multi_channel") {
    const labels = entries.map(({ label }) => label).join("、");
    return `本次${labels}等学习入口出现得比较接近，没有明显集中在某一种方式上。面对${subject}时，你可以先选一种顺手的方式开始，再用另一种方式检查。接下来先练“${strategy.studentLabel}”，看看哪种组合更适合这项任务。多通道只说明几种方式都出现过，不代表每种方式都已经熟练。`;
  }
  throw new TypeError(`unsupported profile type: ${profile.type}`);
}

function patternConnection(entries) {
  if (entries.length === 1) {
    const entry = entries[0];
    return `${entry.label}线索帮助你先${PREFERENCE_STUDENT_LANGUAGE[entry.code].use}；接下来还要检查自己能否不看提示完成，并把错误改对。`;
  }
  if (entries.length === 2) {
    const [first, second] = entries;
    return `${first.label}帮助你先${PREFERENCE_STUDENT_LANGUAGE[first.code].use}，${second.label}帮助你再${PREFERENCE_STUDENT_LANGUAGE[second.code].use}；两种方式是否有用，要看你能否少看提示、独立完成。`;
  }
  return `这些入口可以帮助你从不同方向开始任务，但每次只选一组方式试用，再看哪一组能让你做得更完整。`;
}

function profileValueItem(entries, subject) {
  if (entries.length === 1) {
    const value = SINGLE_ENTRY_VALUE[entries[0].code];
    return {
      title: value.title,
      text: value.text,
      example: value.example(subject)
    };
  }

  if (entries.length === 2) {
    const pairKey = entries.map(({ code }) => code).sort().join("");
    const value = PREFERENCE_PAIR_VALUE[pairKey];
    if (!value) throw new TypeError(`missing preference pair value for ${pairKey}`);
    return {
      title: value.title,
      text: value.text,
      example: value.example(subject)
    };
  }

  return {
    title: "根据任务选入口",
    text: "多通道表示这几种入口没有明显集中在某一种方式上。每次只选一组容易开始的方式，并用完成结果判断这组方式是否真的有用。",
    example: `例如，这次做${subject}任务可以选“看图＋书写”，下次再试“听讲＋亲手做”；比较哪一组能让你少看提示、完整做对。`
  };
}

function strengthItems(entries, subject) {
  const first = entries[0];
  const second = entries[1];
  const firstMeta = PREFERENCE_STUDENT_LANGUAGE[first.code];
  const secondMeta = second ? PREFERENCE_STUDENT_LANGUAGE[second.code] : null;
  return [
    {
      title: firstMeta.strengthTitle,
      text: firstMeta.strength,
      example: `例如，做${subject}任务时，可以先这样开始：${PREFERENCE_ACTION_LANGUAGE[first.code]}。`
    },
    second
      ? {
        title: secondMeta.strengthTitle,
        text: secondMeta.strength,
        example: `例如，${subject}内容变复杂时，可以这样检查：${PREFERENCE_ACTION_LANGUAGE[second.code]}。`
      }
      : {
        title: "入口帮你更快开始",
        text: `当材料符合${first.label}入口时，你通常更容易找到第一步，减少面对复杂任务时不知道从哪里开始的感觉。`,
        example: `例如，面对一项陌生的${subject}任务时，可以先这样开始：${PREFERENCE_ACTION_LANGUAGE[first.code]}。`
      },
    profileValueItem(entries, subject)
  ];
}

function learningRisk(strategy, entries, subject) {
  const risk = STRATEGY_RISK[strategy.id];
  const entryCue = entries.slice(0, 2).map(({ code }) => PREFERENCE_STUDENT_LANGUAGE[code].risk).join("、");
  return {
    riskId: strategy.id,
    headline: `你当前最需要注意的学习假象是：${entryCue}，${risk.headline}。`,
    explanation: risk.explanation,
    sceneExample: STRATEGY_RISK_SCENES[strategy.id](subject)
  };
}

function executionAdapter(entries, { equalDual = false, suggestedStart = null } = {}) {
  let selected = entries.slice(0, 2).map((entry) => {
    const mechanism = entry.mechanisms[0];
    const card = MECHANISM_EXECUTION_CARDS[mechanism.id];
    const compact = MECHANISM_COMPACT_ACTIONS[mechanism.id];
    if (!card) throw new TypeError(`missing execution card for ${mechanism.id}`);
    if (!compact) throw new TypeError(`missing compact execution action for ${mechanism.id}`);
    return { entry, mechanism, card, compact };
  });
  if (equalDual && suggestedStart) {
    selected = selected.sort((left, right) => (
      Number(right.entry.code === suggestedStart) - Number(left.entry.code === suggestedStart)
    ));
  }
  const [primary, secondary] = selected;
  const startGuideItems = selected.map(({ entry, mechanism, card }) => ({
    preference: entry.code,
    mechanism: mechanism.id,
    label: `${entry.label}·${mechanism.label}`,
    action: card.startAction.replace(/^先/, "")
  }));
  const startGuide = {
    label: startGuideItems.map(({ label }) => label).join("＋"),
    action: startGuideItems.length > 1
      ? `先${startGuideItems[0].action}；再${startGuideItems[1].action}。`
      : `先${startGuideItems[0].action}。`
  };
  if (equalDual) {
    if (!secondary) throw new TypeError("equal dual execution requires two entries");
    const reason = suggestedStart
      ? `两种入口在雷达图中很接近，本次不固定主辅。本周先用${primary.entry.label}方式开始，再用${secondary.entry.label}方式检查；第二次交换顺序。`
      : `两种入口在雷达图中很接近，本次不固定主辅。第一次用${primary.entry.label}开始、${secondary.entry.label}检查，第二次交换顺序，第三次保留更有帮助的组合。`;
    return {
      entryPattern: "equal_dual",
      preferences: [primary.entry.code, secondary.entry.code],
      ...(suggestedStart ? { suggestedStart } : {}),
      mechanisms: [
        { id: primary.mechanism.id, label: primary.mechanism.label },
        { id: secondary.mechanism.id, label: secondary.mechanism.label }
      ],
      startGuide,
      reason,
      startAction: `${primary.compact.start}；${secondary.compact.start}`,
      checkAction: `${primary.compact.check}；${secondary.compact.check}`,
      practiceAction: `第一次：${primary.compact.start}；第二次：${secondary.compact.start}；第三次：比较哪一种组合更能帮助自己独立完成。`,
      compactStart: `第一次：${primary.compact.start}；第二次：${secondary.compact.start}`,
      compactCheck: `交换顺序后，比较哪一种组合更能帮助自己少看提示、独立完成`,
      evidence: `${primary.card.evidence}；${secondary.card.evidence}；并标出哪一种顺序更有帮助`,
      support: `老师或教练第一次按“${primary.entry.label}开始、${secondary.entry.label}检查”提供支持，第二次交换顺序，只比较实际完成结果`,
      guide: `第一次用${primary.entry.label}开始、${secondary.entry.label}检查；第二次交换顺序；第三次保留更有效的组合。`
    };
  }
  const reason = secondary
    ? `从你的回答看，${primary.entry.label}的“${primary.mechanism.label}”和${secondary.entry.label}的“${secondary.mechanism.label}”出现得较多，这次把两种方式接在一起用。`
    : `从你的回答看，${primary.entry.label}的“${primary.mechanism.label}”出现得较多，这次先从这个方式开始。`;
  return {
    entryPattern: secondary ? "ordered" : "single",
    primaryPreference: primary.entry.code,
    primaryMechanism: { id: primary.mechanism.id, label: primary.mechanism.label },
    ...(secondary ? {
      secondaryPreference: secondary.entry.code,
      secondaryMechanism: { id: secondary.mechanism.id, label: secondary.mechanism.label }
    } : {}),
    startGuide,
    reason,
    startAction: primary.card.startAction,
    checkAction: secondary
      ? `${secondary.entry.label}检查：${secondary.card.checkAction}`
      : `撤掉提示检查：${primary.card.checkAction}`,
    practiceAction: primary.card.practiceAction,
    compactStart: primary.compact.start,
    compactCheck: secondary ? secondary.compact.check : primary.compact.check,
    evidence: primary.card.evidence,
    support: secondary
      ? `${primary.card.support}；完成后再用${secondary.entry.label}方式做一次检查`
      : primary.card.support,
    guide: secondary
      ? `${PREFERENCE_ACTION_LANGUAGE[primary.entry.code]}；完成后再用${secondary.entry.label}方式检查。`
      : `${PREFERENCE_ACTION_LANGUAGE[primary.entry.code]}。`
  };
}

function subjectScenes(subject, templates, learningFocus) {
  return [learningFocus].map((process) => ({
    process,
    label: PROCESS_LABELS[process],
    material: templates[process].scene,
    action: templates[process].task,
    evidence: templates[process].output,
    successCriterion: templates[process].check
  }));
}

function strategyTrialStage({ subject, strategy, adapter, taskUnit }) {
  const base = {
    id: "trial",
    period: "第2—5天",
    title: "照新方法试3次",
    purpose: "用同一个方法多练几次。",
    strategy: strategy.label,
    taskUnitId: taskUnit.id,
    taskTitle: taskUnit.title,
    sourceGuide: taskUnit.sourceGuide,
    taskEvidence: taskUnit.evidence,
    taskSuccessCriterion: taskUnit.successCriterion
  };

  if (strategy.id === "retrieval") {
    return {
      ...base,
        action: `第2、4、5天各试一次：用第4页的方法试3次${taskUnit.taskFamily}。每次先收起材料，自己说或写，再打开材料补漏。`,
      evidence: "保留3次答案，把后来补上的内容用另一种颜色标出。",
      support: `${adapter.support}；完成后再提供原材料核对。`,
      successCriterion: `先自己说或写，再打开材料补漏；${taskUnit.successCriterion}`
    };
  }
  if (strategy.id === "spaced_repetition") {
    return {
      ...base,
        action: `第2、4、5天各试一次：用第4页的方法试3次${taskUnit.taskFamily}。第一次做完隔一天再做，第三次再隔一天。`,
      evidence: "保留3次答案，圈出隔开一天后仍会忘的内容。",
      support: `${adapter.support}；教练保留第一次答案，隔一天或两天再发起同一要求。`,
      successCriterion: `第二次不看以前的答案仍能完成；${taskUnit.successCriterion}`
    };
  }
  if (strategy.id === "deliberate_practice") {
    return {
      ...base,
        action: `第2、4、5天各试一次：用第4页的方法试3次${taskUnit.taskFamily}。只盯住同一个卡点，改对后再换一道相近题。`,
      evidence: "保留3次答案，把同一个卡点每次怎样改标出来。",
      support: `${adapter.support}；老师只指出一个具体步骤差异，不直接给出完整做法。`,
      successCriterion: `${taskUnit.successCriterion}，并能根据差异修正步骤。`
    };
  }
  if (strategy.id === "timely_feedback") {
    return {
      ...base,
        action: `第2、4、5天各试一次：用第4页的方法试3次${taskUnit.taskFamily}。每次做完先找第一个错误，不看答案重新做。`,
      evidence: "保留3次答案，把第一个错误和重做结果并排放好。",
      support: `${adapter.support}；老师只指出首个关键差异，学生据此独立修订。`,
      successCriterion: `${taskUnit.successCriterion}，且修订结果逐项回应反馈。`
    };
  }
  return {
    ...base,
    action: `第2、4、5天各试一次：用第4页的方法试3次${taskUnit.taskFamily}。每次做完比较结果，只留下真正有用的一步。`,
    evidence: "保留3次答案，写下哪一步继续用、哪一步要改。",
    support: `${adapter.support}；教练只追问选择依据和实际结果，不代替学生判断。`,
    successCriterion: `${taskUnit.successCriterion}，且最终判断至少比较一次前后答案。`
  };
}

function buildOneWeekPlan({ subject, strategy, adapter, taskUnit }) {
  return {
    stages: [
      {
        id: "baseline",
        period: "第1天",
        title: "先按平时的方法试一次",
        purpose: "先看看自己原来会怎么做。",
        taskUnitId: taskUnit.id,
        taskTitle: taskUnit.title,
        sourceGuide: taskUnit.sourceGuide,
        taskEvidence: taskUnit.evidence,
        taskSuccessCriterion: taskUnit.successCriterion,
        action: `拿第1道${taskUnit.taskFamily}，按平时的方法完成。卡住时在题旁打一个“？”。`,
        evidence: "保留这次答案和你圈出的第一个卡点。",
        support: "老师或教练只提供任务和验收要求，不提前讲方法；完成后帮助学生标出第一个卡点。",
        successCriterion: taskUnit.successCriterion
      },
      strategyTrialStage({ subject, strategy, adapter, taskUnit }),
      {
        id: "retest",
        period: "第6—7天",
        title: "换一组内容再试一次",
        purpose: "换一组内容再试一次。",
        taskUnitId: taskUnit.id,
        taskTitle: taskUnit.title,
        sourceGuide: taskUnit.sourceGuide,
        taskEvidence: taskUnit.evidence,
        taskSuccessCriterion: taskUnit.successCriterion,
        action: `拿第2道同类内容，不翻前面的答案，再独立完成一次${taskUnit.taskFamily}。`,
        evidence: "把这次答案和第一次放在一起，看错误有没有变少。",
        support: "老师或教练只提供新任务和检查标准，不重讲完整过程；完成后再帮助学生核对前后变化。",
        successCriterion: taskUnit.successCriterion
      }
    ]
  };
}

function subjectActionPlan({ subject, learningFocus, scene, adapter, strategy, taskUnit, scoreLevel }) {
  const checkPreference = adapter.secondaryPreference
    ?? adapter.primaryPreference
    ?? adapter.preferences?.[1]
    ?? adapter.preferences?.[0];
  const studentCheck = FOCUS_PREFERENCE_CHECKS[learningFocus][checkPreference];
  const entryAction = matchedEntryAction(subject, learningFocus, adapter, taskUnit);
  const strategyAction = STRATEGY_TASK_ACTIONS[strategy.id](taskUnit);
  const entryStep = adapter.entryPattern === "equal_dual"
    ? adapter.startAction
    : adapter.secondaryPreference
      ? `${adapter.compactStart}；然后${adapter.compactCheck}`
      : entryAction;
  const practiceRounds = [
    `开始时：${entryStep}`,
    `练习时：${strategyAction}`,
    `检查时：${studentCheck}`
  ];
  const scoreStart = {
    foundation: "先把基础内容练熟",
    core: "先把常见题型做稳",
    integrated: "先做一道常见题，再试一道换了条件的题",
    advanced: "先在限定时间内完成，再试一道不熟悉的题"
  }[scoreLevel];
  return {
    taskUnit,
    examSystem: taskUnit.examSystemLabel,
    taskTitle: taskUnit.title,
    knowledgeTargetLabel: taskUnit.knowledgeTarget?.studentLabel ?? "",
    sourceGuide: taskUnit.sourceGuide,
    problem: STRATEGY_PROBLEM[strategy.id],
    whyTask: `因为你现在想确认的是：${STRATEGY_PROBLEM[strategy.id]}。先按更容易上手的方式开始，再收起提示自己完成，才能看出这次有没有真正学会。`,
    smartGoal: `本周内，${taskUnit.taskLabel.replace(/^选/, "准备")}：先按平时的方法试1次，再按新方法试3次，最后换第2道同类内容独立试1次。`,
    example: `例如，练${subject}的${taskUnit.taskFamily}时，${adapter.startAction}；再${strategyAction}。`,
    entryStart: adapter.startGuide,
    strategyPractice: {
      label: strategy.studentLabel,
      action: strategyAction
    },
    matchExplanation: `你选择先解决“${LEARNING_FOCUS_META[learningFocus].label}”。可以从${taskUnit.taskFamily}开始，${scoreStart}；第一步按你更容易上手的方式来做。`,
    whyFirst: `你可以先试试${subject}的${taskUnit.taskFamily}。${adapter.reason}不用同时换很多方法，先解决一个问题：把“${taskUnit.taskLabel}”做成一份能独立完成的结果。`,
    weeklyAction: `${taskUnit.taskLabel.replace(/^选/, "准备")}。可以按下面3次试试看。`,
    material: taskUnit.taskLabel,
    walkthrough: `拿到${subject}的${taskUnit.taskFamily}后，${taskUnit.actions[0]}；${adapter.startAction}。完成后，${studentCheck}。最后打开答案，只改第一个错误，再做一题条件变化题检查。`,
    firstAction: `从${taskUnit.taskFamily}开始：${entryStep}`,
    auxiliaryCheck: studentCheck,
    practiceRounds,
    steps: practiceRounds,
    evidence: `请保留：${taskUnit.evidence}；以及${adapter.evidence}`,
    support: `老师或教练的支持：${adapter.support}`,
    successCriterion: taskUnit.successCriterion,
    strategyReason: strategy.reason
  };
}

function validateInput(input) {
  if (!input || typeof input !== "object") throw new TypeError("report input must be an object");
  if (Object.hasOwn(input, "quality") || Object.hasOwn(input, "qualityStatus")) {
    throw new TypeError("quality input is not supported");
  }
  if (!SUBJECT_SCENES[input.targetSubject]) throw new RangeError(`unknown target subject: ${input.targetSubject}`);
  if (!LEARNING_FOCUS_META[input.learningFocus]) throw new RangeError(`unknown learning focus: ${input.learningFocus}`);
  if (!input.scoreResult || !input.profile) throw new TypeError("scoreResult and profile are required");
  if (typeof input.studentName !== "string" || input.studentName.length === 0) throw new TypeError("studentName is required");
  if (typeof input.grade !== "string" || input.grade.length === 0) throw new TypeError("grade is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.assessmentDate ?? "")) throw new TypeError("assessmentDate is invalid");
  const targetSubjectScore = validateTargetSubjectScore(input.targetSubject, input.targetSubjectScore);
  const targetSubjectFullScore = fullScoreForSubject(input.targetSubject);
  const scoreLevel = scoreLevelFor(input.targetSubject, targetSubjectScore).id;
  const taskUnit = selectTaskUnit({
    subject: input.targetSubject,
    learningFocus: input.learningFocus,
    score: targetSubjectScore
  });
  if (input.targetSubjectFullScore !== targetSubjectFullScore) {
    throw new TypeError("targetSubjectFullScore does not match target subject");
  }
  if (input.scoreLevel !== scoreLevel) throw new TypeError("scoreLevel does not match target score");
  if (!input.taskUnit || input.taskUnit.id !== taskUnit.id) {
    throw new TypeError("taskUnit does not match score context");
  }
  return { targetSubjectScore, targetSubjectFullScore, scoreLevel, taskUnit };
}

export function buildReport(input) {
  const scoreContext = validateInput(input);
  const { studentName, grade, targetSubject, learningFocus, assessmentDate, scoreResult, profile } = input;
  const { targetSubjectScore, targetSubjectFullScore, scoreLevel, taskUnit } = scoreContext;
  // Legacy integrations may still read this derived label until their report UI is updated.
  const learningTask = taskUnit.taskLabel;
  const indices = readIndices(scoreResult, profile);
  const ranked = rankPreferences(indices);
  const named = namedPreferences(profile);
  const strategy = choosePriorityStrategy(scoreResult.science, targetSubject, learningFocus);
  const templates = SUBJECT_SCENES[targetSubject];
  let entries;
  if (named.equal.length === 2) {
    entries = named.equal.map((preference) => preferenceEntry(scoreResult, preference, "共同入口", targetSubject, 1));
  } else if (profile.type === "single_clear") {
    entries = [preferenceEntry(scoreResult, named.primary, "主要入口", targetSubject, 2)];
  } else if (profile.type === "multi_channel") {
    entries = ranked.slice(0, 3).map((preference) => preferenceEntry(scoreResult, preference, "可调用入口", targetSubject, 1));
  } else {
    entries = [named.primary, named.auxiliary]
      .filter(Boolean)
      .map((preference, index) => preferenceEntry(scoreResult, preference, index === 0 ? "主要入口" : "辅助入口", targetSubject, index === 0 ? 2 : 1));
  }
  const adapter = executionAdapter(entries, {
    equalDual: named.equal.length === 2,
    suggestedStart: profile.suggestedStart ?? null
  });
  const execution = adapter.guide;
  const formalPreference = (preference) => preference ? { code: preference, label: PREFERENCE_META[preference].label } : null;
  const scenes = subjectScenes(targetSubject, templates, learningFocus);
  const weekPlan = buildOneWeekPlan({
    subject: targetSubject,
    strategy,
    adapter,
    taskUnit
  });
  const actionPlan = subjectActionPlan({
    subject: targetSubject,
    learningFocus,
    scene: scenes[0],
    adapter,
    strategy,
    taskUnit,
    scoreLevel
  });
  const risk = learningRisk(strategy, entries, targetSubject);

  const oneSentenceSection = {
    title: SECTION_TITLE_BY_ID.summary,
    text: oneSentence(profile, named, entries, targetSubject, strategy)
  };
  const learningPatternSection = {
    title: SECTION_TITLE_BY_ID.learningPattern,
    intro: profile.type === "multi_channel"
      ? "下面是本次较常出现的几种学习入口，它们不代表能力高低。"
      : "下面这些回答，可以帮助你看清自己现在更容易用什么方式开始和理解学习。",
    entries,
    allEntries: allPreferenceEntries(scoreResult, indices, targetSubject),
    connection: patternConnection(entries)
  };
  const strengthsSection = {
    title: SECTION_TITLE_BY_ID.strengths,
    items: strengthItems(entries, targetSubject),
    boundary: "学习入口能帮助你开始和理解，但不能代替自己回想、独立完成和订正错误。"
  };
  const risksSection = {
    title: SECTION_TITLE_BY_ID.risks,
    riskId: risk.riskId,
    headline: risk.headline,
    explanation: risk.explanation,
    sceneExample: risk.sceneExample,
    items: [risk.headline],
    priorityStrategy: {
      id: strategy.id,
      label: strategy.label,
      definition: strategy.definition,
      studentLabel: strategy.studentLabel,
      level: strategy.level,
      reason: strategy.reason,
      action: strategy.action,
      whyFirst: strategy.reason,
      thisWeek: `本周只围绕${targetSubject}的“${LEARNING_FOCUS_META[learningFocus].label}”试一次，不同时更换多个方法。`,
      successCriterion: STRATEGY_STUDENT_LANGUAGE[strategy.id].success
    }
  };
  const subjectPlanSection = {
    title: SECTION_TITLE_BY_ID.subjectPlan,
    subject: targetSubject,
    focus: { code: learningFocus, label: LEARNING_FOCUS_META[learningFocus].label },
    executionGuide: execution,
    executionAdapter: adapter,
    priorityStrategy: { id: strategy.id, label: strategy.label, definition: strategy.definition, studentLabel: strategy.studentLabel, action: strategy.action },
    scenes,
    ...actionPlan
  };
  const sevenDayActionSection = {
    title: SECTION_TITLE_BY_ID.sevenDayAction,
    intro: "先按平时的方法试一次，再照第4页的方法试3次，最后换一组相近内容再试一次。",
    ...weekPlan
  };

  const studentReport = {
    schemaVersion: STUDENT_REPORT_SCHEMA_VERSION,
    overview: {
      title: "学习方式测评与行动报告",
      englishTitle: "LEARNING ACTION REPORT",
      studentName,
      anonymousCode: input.anonymousCode ?? null,
      grade,
      targetSubject,
      learningFocus: LEARNING_FOCUS_META[learningFocus].label,
      scoreContext: {
        score: targetSubjectScore,
        fullScore: targetSubjectFullScore,
        level: scoreLevel,
        studentLabel: scoreLevelFor(targetSubject, targetSubjectScore).studentLabel
      },
      assessmentDate,
      radar: PREFERENCE_ORDER.map((code) => ({ code, label: PREFERENCE_META[code].label, score: indices[code] })),
      primaryPreference: formalPreference(named.primary),
      auxiliaryPreference: formalPreference(named.auxiliary),
      profileHeadline: overviewProfileLabel(profile, named),
      supportPath: "先找到更容易开始的方式，再用有效方法练习，最后通过真实任务检查是否掌握。",
      strategyBridge: `学习入口能帮助你更容易开始和理解；现在需要验证的是：${STRATEGY_PURPOSE[strategy.id]}，所以本周先练“${strategy.studentLabel}”。`,
      priorityStrategy: {
        id: risksSection.priorityStrategy.id,
        label: risksSection.priorityStrategy.label,
        definition: risksSection.priorityStrategy.definition,
        studentLabel: risksSection.priorityStrategy.studentLabel
      },
      strategyProgress: strategyProgress(scoreResult.science, strategy.id),
      firstAction: {
        subject: subjectPlanSection.subject,
        action: subjectPlanSection.firstAction
      }
    },
    sections: SECTION_TITLES.map(([id, title]) => ({ id, title })),
    oneSentence: oneSentenceSection,
    learningPattern: learningPatternSection,
    strengths: strengthsSection,
    risks: risksSection,
    subjectPlan: subjectPlanSection,
    sevenDayAction: sevenDayActionSection
  };

  return { studentReport };
}
