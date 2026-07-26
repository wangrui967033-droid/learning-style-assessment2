export const SUBJECT_SCENES = Object.freeze({
  语文: Object.freeze({
    learning: Object.freeze({
      scene: "当前语文课文、注释和课堂学习要求",
      task: "通读课文并标出关键语句，说明段落之间怎样推进内容或观点",
      output: "一份带有关键语句和段落关系说明的课文结构稿",
      check: "不看示例也能依据原文说清各部分的联系，并找到对应语句"
    }),
    memory: Object.freeze({
      scene: "当前要求积累或背诵的语文篇目、注释和重点语句",
      task: "先确认语句顺序与含义，再遮住原文独立背写并补出关键注释",
      output: "一份脱离原文完成的背写稿和关键注释清单",
      check: "逐句对照原文，内容、顺序和关键字准确后才算完成"
    }),
    practice: Object.freeze({
      scene: "一段未作答的语文阅读材料或一道表达任务及其作答要求",
      task: "从材料中找出依据，按题目要求组织答案并写清依据与结论",
      output: "一份包含材料依据和完整表达的独立作答",
      check: "逐项核对题目要求，每个结论都能在材料或表达规则中找到依据"
    }),
    improve: Object.freeze({
      scene: "一份已经获得批注或参考答案的语文作答",
      task: "对照反馈定位遗漏、误读或表达不清之处，说明原因后重新作答",
      output: "一份错因说明和不看原答案完成的修订稿",
      check: "修订稿回应全部作答要求，且原来遗漏的依据或表达已经补全"
    })
  }),
  数学: Object.freeze({
    learning: Object.freeze({
      scene: "当前数学教材中的概念、例题、条件和关系",
      task: "从例题中提取已知条件、所求关系和每一步使用的公式条件",
      output: "一份条件到结论的关系图和带依据的例题步骤",
      check: "遮住例题后仍能按条件恢复关系，并说明每一步为什么成立"
    }),
    memory: Object.freeze({
      scene: "当前数学学习材料中的公式、定理条件和典型例题",
      task: "先整理公式与适用条件，再遮住材料独立写出关系并完成一次代入验证",
      output: "一张公式条件恢复稿和一道独立验证题",
      check: "没有提示时能写全公式及适用条件，并用验证题得到可核对的结果"
    }),
    practice: Object.freeze({
      scene: "一道当前数学方法对应的未做例题和一道条件变化题",
      task: "独立列出条件、选择关系并完成计算，再比较条件变化后步骤怎样调整",
      output: "两道保留条件分析、计算步骤和比较说明的解题稿",
      check: "答案可核对，关键步骤有依据，且能指出变题中哪项条件改变了做法"
    }),
    improve: Object.freeze({
      scene: "一道已经批改的数学错题、原解题过程和反馈",
      task: "定位第一个不成立的步骤，写明对应条件或运算问题后遮住原解重新完成",
      output: "一份首错点说明和完整的独立重做过程",
      check: "重做过程不沿用原错误，每一步符合条件并得到可核对答案"
    })
  }),
  英语: Object.freeze({
    learning: Object.freeze({
      scene: "当前英语单元的语篇、例句和学习要求",
      task: "阅读语篇并找出关键词句，结合上下文说明句子关系和表达作用",
      output: "一份英语关键词句标记和语篇关系说明",
      check: "离开讲解后仍能用自己的话说明语篇主线，并指出原文依据"
    }),
    memory: Object.freeze({
      scene: "当前英语单元的词汇、短语、例句和中文提示",
      task: "根据中文或情境提示独立恢复英文词句，并把目标表达放入新句子",
      output: "一份遮住原文完成的词句恢复稿和自造例句",
      check: "拼写、搭配和句意均可核对，自造句符合目标表达的使用条件"
    }),
    practice: Object.freeze({
      scene: "一篇未完成的英语阅读材料或一项新的英语表达任务",
      task: "根据题目要求定位语言证据或组织英文表达，并写出选择依据",
      output: "一份带原文依据的阅读作答或结构完整的英文表达",
      check: "逐项核对任务要求，答案有语言依据且目标表达使用准确"
    }),
    improve: Object.freeze({
      scene: "一份已有批注的英语阅读或表达作答及参考依据",
      task: "区分理解、词句使用和表达组织问题，说明原因后独立改写答案",
      output: "一份英语错因说明和不看原答案完成的修订稿",
      check: "修订内容回应反馈，语言形式与语境匹配，并保留可核对依据"
    })
  }),
  日语: Object.freeze({
    learning: Object.freeze({
      scene: "当前日语课文、会话例句和语法说明",
      task: "阅读课文并找出关键词句，说明句型在当前语境中的连接与作用",
      output: "一份日语关键词句标记和句型语境说明",
      check: "离开讲解后仍能读懂句子关系，并从课文中指出判断依据"
    }),
    memory: Object.freeze({
      scene: "当前日语词汇、假名、汉字写法、句型和中文提示",
      task: "根据中文或语境提示独立恢复日语词句，并用目标句型另造一句",
      output: "一份假名与词句恢复稿和日语自造例句",
      check: "读音、写法、助词和句型连接均可核对，自造句符合使用语境"
    }),
    practice: Object.freeze({
      scene: "一段新的日语阅读材料或一项日语会话与表达任务",
      task: "根据语境选择词句和助词，完成理解作答或组织完整日语表达",
      output: "一份带语境依据的日语作答或可独立读出的表达稿",
      check: "答案回应题意，词句连接与语境一致，关键选择能说明依据"
    }),
    improve: Object.freeze({
      scene: "一份已有批注的日语阅读、翻译或表达作答",
      task: "定位词义、助词、句型连接或语境理解的问题，说明原因后重新作答",
      output: "一份日语错因说明和脱离原答案完成的修订稿",
      check: "修订稿逐项回应反馈，词句形式正确且放回语境后意思成立"
    })
  }),
  物理: Object.freeze({
    learning: Object.freeze({
      scene: "当前物理概念、现象情境、已知量和示例过程",
      task: "从情境中识别研究对象、已知量和物理关系，说明关系成立的条件",
      output: "一份物理情境示意图、量的标记和关系说明",
      check: "不看示例也能从情境恢复研究对象与关系，并说清每个量的含义"
    }),
    memory: Object.freeze({
      scene: "当前物理规律、公式、单位和适用条件",
      task: "遮住材料写出物理关系、量的单位和使用条件，再用一个情境核对",
      output: "一份物理规律恢复稿和情境对应说明",
      check: "符号、单位与条件完整，并能判断核对情境是否满足使用条件"
    }),
    practice: Object.freeze({
      scene: "一道新的物理情境题和一项条件变化任务",
      task: "画出研究对象与过程，选择物理关系完成求解，再说明条件变化的影响",
      output: "一份含示意图、关系式、计算和变化说明的解题稿",
      check: "图、量和关系彼此对应，结果可核对，变化说明指向明确条件"
    }),
    improve: Object.freeze({
      scene: "一道已经批改的物理题、原过程和反馈信息",
      task: "检查研究对象、过程图、关系式和计算，定位首个问题后独立重做",
      output: "一份物理首错点说明和完整重做稿",
      check: "重做过程中的图与关系一致，原问题已修正且结果能够核对"
    })
  }),
  化学: Object.freeze({
    learning: Object.freeze({
      scene: "当前化学概念、反应材料、实验现象和条件说明",
      task: "整理物质、条件、现象和变化之间的对应关系，并说明观察依据",
      output: "一份化学物质变化关系表和现象依据说明",
      check: "离开示例后仍能把物质、条件与现象正确对应，并解释依据"
    }),
    memory: Object.freeze({
      scene: "当前化学用语、反应条件、实验现象和表达规则",
      task: "遮住材料恢复化学用语与条件，再根据现象提示写出对应变化",
      output: "一份化学用语恢复稿和条件现象对应表",
      check: "符号、条件和表达规则准确，现象与变化能够逐项对应"
    }),
    practice: Object.freeze({
      scene: "一道新的化学反应或实验材料题和一项条件变化任务",
      task: "提取物质与条件，写出变化过程并依据现象或数据完成判断",
      output: "一份含化学表达、材料依据和条件比较的独立作答",
      check: "表达符合规则，结论有现象或数据依据，条件变化处理正确"
    }),
    improve: Object.freeze({
      scene: "一份已有批注的化学计算、反应或实验分析作答",
      task: "定位化学用语、条件、数量关系或现象解释中的问题并独立重做",
      output: "一份化学错因说明和完整修订过程",
      check: "修订后的用语与条件准确，过程可追踪，原问题不再出现"
    })
  }),
  生物: Object.freeze({
    learning: Object.freeze({
      scene: "当前生物概念、结构图、生命过程和材料说明",
      task: "找出结构、过程与功能之间的关系，并用材料信息说明连接依据",
      output: "一份生物结构过程关系图和材料依据标注",
      check: "遮住教材后仍能恢复主要关系，并指出每条关系对应的材料信息"
    }),
    memory: Object.freeze({
      scene: "当前生物术语、结构名称、过程顺序和关键条件",
      task: "根据空白图或问题提示恢复术语与过程，再写出关键条件和结果",
      output: "一份生物空白图补全稿和过程条件清单",
      check: "名称、顺序、条件与结果完整，能够对照教材逐项确认"
    }),
    practice: Object.freeze({
      scene: "一段新的生物实验或资料分析材料和相关问题",
      task: "提取变量、数据与生命过程信息，依据材料完成解释和条件变化判断",
      output: "一份含变量、数据依据和完整解释的生物作答",
      check: "每个判断都指向材料信息，变量关系清楚，结论不超出证据"
    }),
    improve: Object.freeze({
      scene: "一份已有批注的生物图表、实验或资料分析作答",
      task: "核对术语、变量、材料依据和因果表达，说明问题后独立重写",
      output: "一份生物错因说明和证据完整的修订稿",
      check: "修订稿使用准确术语，依据与结论对应，并解决原反馈问题"
    })
  }),
  历史: Object.freeze({
    learning: Object.freeze({
      scene: "当前历史教材、时间线、事件材料和课堂问题",
      task: "整理时间、事件、背景与影响之间的联系，并标出材料依据",
      output: "一份历史时间关系线和事件联系说明",
      check: "不看示例也能按时间说明事件联系，并从材料中找到依据"
    }),
    memory: Object.freeze({
      scene: "当前历史时期的时间、事件、人物主张和影响材料",
      task: "根据时间或问题提示独立恢复事件链，再补写背景与影响",
      output: "一份历史事件链恢复稿和背景影响对照表",
      check: "时间顺序、事件要素和影响对应准确，能够逐项对照教材"
    }),
    practice: Object.freeze({
      scene: "一组新的历史文字或图表材料和一道分析问题",
      task: "提取材料出处、时间和关键信息，结合问题组织有依据的历史解释",
      output: "一份包含材料证据和历史联系的独立作答",
      check: "答案回应设问，每个观点都有材料或已学事实支持，表达边界清楚"
    }),
    improve: Object.freeze({
      scene: "一份已有批注的历史材料题作答和参考依据",
      task: "检查审题、材料提取和观点依据，说明遗漏或错配后重新组织答案",
      output: "一份历史错因说明和证据重新对应的修订稿",
      check: "修订稿逐项回应设问，材料证据与观点对应，原遗漏已经补全"
    })
  }),
  政治: Object.freeze({
    learning: Object.freeze({
      scene: "当前政治概念、观点说明、生活材料和课堂问题",
      task: "区分概念条件与观点依据，并说明材料事实怎样连接相应观点",
      output: "一份政治概念条件表和材料观点对应说明",
      check: "离开示例后仍能用准确概念解释材料，并指出事实依据"
    }),
    memory: Object.freeze({
      scene: "当前政治概念、关键词、观点层次和适用条件",
      task: "根据问题提示恢复概念与观点，再写出各观点的条件和关键词",
      output: "一份政治概念观点恢复稿和关键词条件清单",
      check: "概念表述完整，层次清楚，关键词与适用条件能够逐项核对"
    }),
    practice: Object.freeze({
      scene: "一段新的政治情境材料和一道分析或评价任务",
      task: "提取材料事实，选择对应概念并按观点、材料依据和结论组织答案",
      output: "一份观点与材料事实逐项对应的政治作答",
      check: "答案回应设问，概念使用准确，每个观点都有明确材料依据"
    }),
    improve: Object.freeze({
      scene: "一份已有批注的政治材料题作答和评分依据",
      task: "核对设问、概念、材料事实和表达层次，说明问题后独立重写",
      output: "一份政治错因说明和观点依据完整的修订稿",
      check: "修订稿概念与材料对应，层次完整，并逐项回应原反馈"
    })
  }),
  地理: Object.freeze({
    learning: Object.freeze({
      scene: "当前地理地图、统计图表、区域材料和过程说明",
      task: "读取位置、方向、图例和数据，说明空间条件与地理过程的联系",
      output: "一份地理图表标注和条件过程关系说明",
      check: "不看示例也能从图表提取关键信息，并说明关系依据"
    }),
    memory: Object.freeze({
      scene: "当前地理区域位置、图例、过程顺序和关键条件",
      task: "根据空白地图或问题提示恢复位置与过程，再补写关键条件和结果",
      output: "一份地理空白图补全稿和过程条件链",
      check: "位置、方向、图例与过程对应准确，能够逐项对照原材料"
    }),
    practice: Object.freeze({
      scene: "一组新的地理地图、图表或区域材料和相关问题",
      task: "提取空间与数据证据，解释地理过程并完成条件变化下的判断",
      output: "一份含图表证据、过程解释和变化判断的地理作答",
      check: "答案回应设问，证据来自图表，过程解释与空间条件一致"
    }),
    improve: Object.freeze({
      scene: "一份已有批注的地理图表或区域分析作答",
      task: "检查读图、数据提取、空间判断和过程解释，说明问题后独立重做",
      output: "一份地理错因说明和图表证据完整的修订稿",
      check: "修订稿读图准确，证据与结论对应，并解决原反馈指出的问题"
    })
  }),
  技术: Object.freeze({
    learning: Object.freeze({
      scene: "当前技术设计任务、操作流程、图示和要求说明",
      task: "找出设计目标、限制条件和操作顺序，说明每一步为什么这样安排",
      output: "一份技术要求标记和流程说明稿",
      check: "不看示例也能说清设计目标、限制条件和主要步骤"
    }),
    memory: Object.freeze({
      scene: "当前技术概念、操作规则、步骤图和关键词",
      task: "遮住材料后写出关键步骤和使用条件，再对照补漏",
      output: "一份技术步骤恢复稿和条件清单",
      check: "步骤顺序和使用条件完整，能够逐项对照原材料"
    }),
    practice: Object.freeze({
      scene: "一道新的技术设计、流程或分析任务",
      task: "根据设计要求选择材料或步骤，完成方案并说明每一步的依据",
      output: "一份包含设计要求、步骤和依据的技术作答",
      check: "方案回应全部要求，步骤合理，关键选择能够说明依据"
    }),
    improve: Object.freeze({
      scene: "一份已有批注的技术设计或流程作答",
      task: "对照反馈定位遗漏的要求或不合理步骤，再独立修改方案",
      output: "一份技术错因说明和修订后的方案",
      check: "修订稿回应反馈，设计要求、步骤与依据保持一致"
    })
  })
});

const LANGUAGE_STRATEGY_PRIORITY = Object.freeze([
  "retrieval", "spaced_repetition", "timely_feedback", "metacognition", "deliberate_practice"
]);

const SCIENCE_STRATEGY_PRIORITY = Object.freeze([
  "deliberate_practice", "timely_feedback", "retrieval", "metacognition", "spaced_repetition"
]);

export const SUBJECT_STRATEGY_PRIORITY = Object.freeze({
  语文: Object.freeze(["retrieval", "metacognition", "timely_feedback", "spaced_repetition", "deliberate_practice"]),
  数学: SCIENCE_STRATEGY_PRIORITY,
  英语: LANGUAGE_STRATEGY_PRIORITY,
  日语: LANGUAGE_STRATEGY_PRIORITY,
  物理: SCIENCE_STRATEGY_PRIORITY,
  化学: SCIENCE_STRATEGY_PRIORITY,
  生物: LANGUAGE_STRATEGY_PRIORITY,
  历史: LANGUAGE_STRATEGY_PRIORITY,
  政治: LANGUAGE_STRATEGY_PRIORITY,
  地理: LANGUAGE_STRATEGY_PRIORITY,
  技术: SCIENCE_STRATEGY_PRIORITY
});

export const SEVEN_DAY_VERIFIABILITY = Object.freeze([
  "retrieval",
  "timely_feedback",
  "deliberate_practice",
  "spaced_repetition",
  "metacognition"
]);
