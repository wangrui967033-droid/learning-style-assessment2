import { PRIMARY_MODES, SPECIFIC_MODES, specificModesFor } from "./learning-modes.js";

const LEVELS = Object.freeze(["基础巩固", "稳定提升", "冲刺提高"]);
const SUBJECTS = Object.freeze(["语文", "数学", "英语", "日语", "物理", "化学", "生物", "政治", "历史", "地理"]);

const card = (materials, minutes, quantity, task, completionCheck) => Object.freeze({ materials, minutes, quantity, task, completionCheck });

const BASE_TASKS = Object.freeze({
  语文: Object.freeze({
    基础巩固: card("课内一段文字、注释和2个基础问题", 20, "一段文字、2个问题", "找出这段话写了什么、怎么写，完成2个问题。", "合上书后能说出段意，并在原文中找到2处依据。"),
    稳定提升: card("一篇现代文阅读和2道题", 25, "一篇阅读、2道题", "先读题，再回原文找依据，写完2道题。", "每道题都能标出对应句子，答案没有漏掉题目要求。"),
    冲刺提高: card("一组阅读材料和1道主观题", 30, "一组材料、1道主观题", "圈出材料重点，写出观点和两处依据。", "答案有明确观点、两处材料依据，表达紧扣题目。")
  }),
  数学: Object.freeze({
    基础巩固: card("1个公式或定理、2道课本基础题", 20, "1个公式、2道题", "写清公式的使用条件，独立完成2题。", "2题中至少独立完成1题，并能说出公式为什么能用。"),
    稳定提升: card("同一方法的2道变式题", 25, "2道变式题", "分别列出已知条件，完成2题并比一比做法哪里不同。", "两题步骤完整，能指出哪条条件让做法发生变化。"),
    冲刺提高: card("1道含条件变化的综合小题", 30, "1道综合小题", "分清已知、所求和限制条件，再完成求解。", "结果可核对，关键一步写明用了什么条件。")
  }),
  英语: Object.freeze({
    基础巩固: card("本周课本里的8个单词和4个短例句", 20, "8个单词、4个短例句", "记住词义和短语，把4个例句读懂。", "遮住单词后能独立写出6个及以上，并圈出还不稳的词。"),
    稳定提升: card("一篇短阅读和3道题", 25, "一篇短阅读、3道题", "先看题，再回原文找句子，完成3道题。", "每题都在原文旁留下依据，至少独立答对2题。"),
    冲刺提高: card("一篇阅读材料和4道题", 30, "一篇阅读、4道题", "限时完成，再回原文核对每道题的依据。", "4题都写完，能为每题找到原文提示并标出犹豫题。")
  }),
  日语: Object.freeze({
    基础巩固: card("8个词或句型、4个课本短句", 20, "8个词或句型、4个短句", "看懂词义和句型，把4个短句读通。", "遮住提示后能写出6个及以上，并读出4个短句。"),
    稳定提升: card("一段短阅读和3道题", 25, "一段短阅读、3道题", "先读问题，再回原文找词句，完成3道题。", "每题都能在原文找到词句依据，至少独立答对2题。"),
    冲刺提高: card("一段阅读材料和4道题", 30, "一段阅读、4道题", "限时完成，重点核对助词、句型和题干要求。", "4题都完成，能标出每题的原文依据和1处最犹豫的地方。")
  }),
  物理: Object.freeze({
    基础巩固: card("1个规律、1张情境图、2道基础题", 25, "1个规律、2道题", "标出研究对象和已知量，完成2道题。", "至少独立完成1题，图中的量和所用关系能对上。"),
    稳定提升: card("2道同类情境题", 25, "2道同类题", "画出过程，列出关系式，比较条件变化后怎样处理。", "两题关系式有依据，能指出条件变化带来的一个影响。"),
    冲刺提高: card("1道综合情境小题", 30, "1道综合小题", "分清研究对象和过程后再求解，不跳过过程图。", "结果可核对，过程图、量和关系式彼此一致。")
  }),
  化学: Object.freeze({
    基础巩固: card("1组物质变化、条件和2个基础问题", 25, "1组变化、2个问题", "对应物质、条件和现象，完成2个问题。", "至少独立完成1题，化学用语和条件没有混淆。"),
    稳定提升: card("1道实验或反应材料题", 25, "1道材料题、2个小问", "圈出物质、条件和现象，再完成2个小问。", "每个判断都能对应到材料中的现象或条件。"),
    冲刺提高: card("1道含数据或流程的综合小题", 30, "1道综合小题", "逐步写出变化和判断依据，最后核对条件。", "答案写全，结论能回到数据、现象或条件上。")
  }),
  生物: Object.freeze({
    基础巩固: card("1张结构或过程图、2个基础问题", 25, "1张图、2个问题", "认清名称、顺序和功能，完成2个问题。", "图中至少标对主要结构或步骤，并独立完成1题。"),
    稳定提升: card("1段资料或实验材料、2道题", 25, "1段材料、2道题", "圈出变量和材料信息，再写出2道题的依据。", "每个结论都有材料依据，没有把相关当成因果。"),
    冲刺提高: card("1道图表或实验综合小题", 30, "1道综合小题", "先读图表和变量，再组织完整解释。", "结论、变量和证据能一一对应，答案回应全部小问。")
  }),
  政治: Object.freeze({
    基础巩固: card("3个概念、1段生活材料和2个问题", 20, "3个概念、2个问题", "把材料里的事实对应到概念，完成2个问题。", "至少说清1个概念为什么能用，答案不只重复材料。"),
    稳定提升: card("1段时政或生活材料、2道题", 25, "1段材料、2道题", "圈出材料事实，用“观点—依据”写完2道题。", "每个观点后都有材料依据，概念使用准确。"),
    冲刺提高: card("1道材料综合小题", 30, "1道综合小题", "按题目要求列出要点，再把每个要点写完整。", "每个小问都回应到，观点和材料没有错配。")
  }),
  历史: Object.freeze({
    基础巩固: card("一个时期的6个事件和课本页", 20, "6个事件", "排清时间，补出事件的背景或影响。", "遮住课本后能按顺序说出4个事件及其中2个联系。"),
    稳定提升: card("1组材料和2道题", 25, "1组材料、2道题", "找出时间、人物或事件线索，再完成2道题。", "每个答案都能回到材料或已学事实，时间不串。"),
    冲刺提高: card("1道材料分析小题", 30, "1道材料小题", "先分清材料说了什么，再写观点和两处证据。", "有明确观点和两处证据，回答没有超出材料和史实。")
  }),
  地理: Object.freeze({
    基础巩固: card("1张区域图、4个图例或位置点、2道题", 20, "1张区域图、2道题", "标出位置、方向和图例，完成2道题。", "至少独立完成1题，能说清一个位置条件带来的结果。"),
    稳定提升: card("1组区域图表和2道题", 25, "1组图表、2道题", "圈出图表条件，写出“条件—过程—结果”。", "两道题都有图表依据，过程和空间条件对得上。"),
    冲刺提高: card("1道区域分析或图表综合小题", 30, "1道综合小题", "先列关键条件，再组织两组因果关系。", "每组关系都能回到图表信息，答案回应全部小问。")
  })
});

const LIGHT_SUPPORT = Object.freeze({ V: "再画出关系或顺序。", A: "再听一遍关键理由。", R: "再写下关键词或一句结论。", K: "再拿一个相似例子试一次。" });
const TASK_MODE_START = Object.freeze({
  V: "先把材料里的关键关系画成一张小图或几栏。",
  A: "先找一小段相关讲解，听清最关键的一组关系。",
  R: "先把材料里的关键词和条件写在草稿旁。",
  K: "先挑材料里的一小部分，动手做或推一步。"
});
const TASK_SUBJECT_FOCUS = Object.freeze({
  语文: "原文句子、写法和答题依据", 数学: "已知条件、公式和解题步骤", 英语: "单词、短语和原文句子", 日语: "助词、句型和课本短句", 物理: "研究对象、受力和过程", 化学: "物质、条件和现象", 生物: "变量、过程和结果", 政治: "材料事实、概念和观点", 历史: "时间、事件和前后关系", 地理: "位置条件、过程和结果"
});
const SPECIFIC_TASK_START = Object.freeze({
  image_association: (focus) => `给${focus}各配一个小图或记号。`,
  structure_mapping: (focus) => `把${focus}用线连起来。`,
  spatial_relationship: (focus) => `把${focus}按先后或位置排开。`,
  interactive_clarification: (focus) => `圈出${focus}里一个没懂的地方，去问清。`,
  spoken_explanation: (focus) => `找一小段讲${focus}的讲解，听清它在说什么。`,
  sound_cues: (focus) => `把${focus}里最关键的词句读出声，读到顺口。`,
  reading_comprehension: (focus) => `把题目和${focus}来回读一遍。`,
  note_organization: (focus) => `把${focus}里的重要词和条件记在草稿旁。`,
  written_synthesis: (focus) => `用自己的话写一句${focus}之间的关系。`,
  process_rehearsal: (focus) => `挑一个小问，按${focus}相关步骤完整做一遍。`,
  hands_on_operation: (focus) => `挑一个条件或例子，围绕${focus}先试一步。`,
  contextual_immersion: (focus) => `找一个具体例子，看${focus}怎么用在题里。`
});
const TASK_FOLLOW_UP = Object.freeze({
  语文: "做完后，把每个答案对应回原文句子，看看有没有漏掉题目要求。",
  数学: "做完后，圈出两题里条件不同的地方，核对做法为什么跟着变。",
  英语: "做完后，遮住释义和原文提示，圈出还不能独立说出的词句。",
  日语: "做完后，遮住中文提示，圈出还不能独立读出的词和句型。",
  物理: "做完后，回看过程图，核对研究对象、方向和关系式能不能对上。",
  化学: "做完后，回看物质、条件和现象，核对每个判断有没有依据。",
  生物: "做完后，回到材料核对变量和结果，看看结论有没有超出证据。",
  政治: "做完后，回到材料核对每个观点有没有对应的事实和概念。",
  历史: "做完后，回到课本或材料核对时间、背景和影响有没有串。",
  地理: "做完后，回到图表核对位置条件、过程和结果能不能一一对上。"
});

const SUBJECT_MODE_EXAMPLES = Object.freeze({
  语文: Object.freeze({ V: "例如阅读题里，“写什么、怎么写、为什么这样写”和原文句子会放在一起看。", A: "例如老师讲清段意和写法后，更容易抓住这段话在说什么。", R: "例如答题时，题目要问的词和原文依据会被标在一起。", K: "例如解释关键句时，会把它放回上下文看它起什么作用。" }),
  数学: Object.freeze({ V: "例如一道题里，已知、所求、关键条件和公式之间的关系会画在同一张草稿上。", A: "例如老师讲清每一步为什么这样算后，更容易跟上解题思路。", R: "例如草稿边上会留下已知条件和公式成立的条件。", K: "例如会先把题里的一个数代进关系式，看下一步要求什么。" }),
  英语: Object.freeze({ V: "例如一组单词会按“人物、地点、动作”放进候机或画室这样的画面里。", A: "例如听完课本短语的讲解后，更容易把短语和意思对上。", R: "例如阅读题问什么和支持答案的原文句子会标在一起。", K: "例如课本短句里的人会换成自己或同学，再把整句说一遍。" }),
  日语: Object.freeze({ V: "例如本课词和句型会放进“在教室打招呼”这样的一段小对话里。", A: "例如听完课本短句的讲解后，更容易听懂句型的用法。", R: "例如句子里的助词、句型和它们的意思会标在一起。", K: "例如课本短句里的人会换成自己或同学，再把整句说一遍。" }),
  物理: Object.freeze({ V: "例如题目中的研究对象、运动过程、力和已知量会画在同一张过程图上。", A: "例如老师讲清物体怎么动、哪个力在起作用后，更容易跟上过程。", R: "例如草稿上会列出已知量、单位和能用的关系式。", K: "例如会先把一个已知量代进关系式，看看下一步要算什么。" }),
  化学: Object.freeze({ V: "例如反应物、条件、现象和生成物会用箭头排成一条变化线。", A: "例如老师讲清“加什么、看到什么、说明什么”后，更容易跟上实验过程。", R: "例如物质、反应条件和实验现象会分开记在草稿上。", K: "例如会先根据一个现象判断变化，再回头核对。" }),
  生物: Object.freeze({ V: "例如结构、发生过程和功能会画在同一张图上，用箭头连起来。", A: "例如听老师顺着讲一个生命过程后，更容易记住先后关系。", R: "例如材料里的变量、结果和需要解释的现象会被圈出来。", K: "例如会根据一组变量变化先判断结果，再核对材料证据。" }),
  政治: Object.freeze({ V: "例如材料事实、对应概念和结论会分成三栏，用线连起来。", A: "例如听老师把材料和课本概念连起来讲后，更容易跟上思路。", R: "例如题目要求、材料事实和能用的概念会标在一起。", K: "例如材料中的一句话会放进一个概念里试着解释。" }),
  历史: Object.freeze({ V: "例如一个时期的事件会放到时间线上，再连出背景、经过和影响。", A: "例如听老师按时间顺序讲事件后，更容易记住它和前后事件的关系。", R: "例如材料里的时间、人物、事件会和对应的课本知识标在一起。", K: "例如一道事件题会先补全背景和影响，再回到课本核对。" }),
  地理: Object.freeze({ V: "例如区域图上的经纬度、海陆位置和地形，会连到气候或产业结果。", A: "例如听老师讲清位置条件怎样带来结果后，更容易读懂区域图。", R: "例如图表里的位置条件、过程和结果会分三行记在草稿上。", K: "例如一道区域题会先拿临海或地形条件推出可能的结果。" })
});

const SUBJECT_MECHANISM_EXAMPLES = Object.freeze({
  语文: Object.freeze({ image_association: "例如人物、场景和情绪会各配一个小图或记号。", structure_mapping: "例如“写什么、怎么写、为什么这样写”会和原文句子连起来。", spatial_relationship: "例如叙事的起因、经过和结果会按先后排在纸上。", interactive_clarification: "例如读到关键句时，会问“这句话为什么这样写”。", spoken_explanation: "例如会听老师把段意、写法和原文依据顺着讲清。", sound_cues: "例如课文里的关键句会读几遍，读到语气顺口。", reading_comprehension: "例如题目要求和原文依据会来回读清。", note_organization: "例如关键词和答题要求会记在草稿旁。", written_synthesis: "例如会用自己的话写出这段话的段意和写法。", process_rehearsal: "例如会从读题、回原文到写答案，完整做一道阅读题。", hands_on_operation: "例如会先拿一句关键句试着说清它在文中的作用。", contextual_immersion: "例如会把一个写法放回另一段文字里看看怎么用。" }),
  数学: Object.freeze({ image_association: "例如已知、所求和关键条件会各配一个记号。", structure_mapping: "例如条件和公式会用线连起来，看清为什么能用。", spatial_relationship: "例如解题的几个步骤会按先后排在纸上。", interactive_clarification: "例如卡在一个条件时，会问“这个条件为什么要用”。", spoken_explanation: "例如会听老师把每一步为什么这样算顺着讲清。", sound_cues: "例如公式的使用条件会按顺序念几遍。", reading_comprehension: "例如题目条件和例题说明会来回读清。", note_organization: "例如已知条件和公式条件会记在草稿旁。", written_synthesis: "例如会用自己的话写出这道题该用什么方法。", process_rehearsal: "例如会从读条件、列式到核对结果，完整做一遍。", hands_on_operation: "例如会先拿一个条件代进关系式试一试。", contextual_immersion: "例如会把一个公式放进具体小题里看看怎么用。" }),
  英语: Object.freeze({ image_association: "例如单词、短语和句子意思会各配一个小图或记号。", structure_mapping: "例如题目问题和支持答案的原文句子会连起来。", spatial_relationship: "例如句子里的动作和时间会按顺序排出来。", interactive_clarification: "例如读到原文句时，会问“这句话为什么能选这个答案”。", spoken_explanation: "例如会听老师把短语的意思和用法顺着讲清。", sound_cues: "例如单词、短语和例句会按顺序念几遍。", reading_comprehension: "例如题目和原文句子会来回读清。", note_organization: "例如生词、短语和原文依据会记在草稿旁。", written_synthesis: "例如会用自己的话写出句子意思和答题依据。", process_rehearsal: "例如会从看题、回原文到选答案，完整做一遍。", hands_on_operation: "例如会先拿一个短语放进课本句子试一试。", contextual_immersion: "例如会把一个短语放进具体句子里看看怎么用。" }),
  日语: Object.freeze({ image_association: "例如单词、助词和句型会各配一个小图或记号。", structure_mapping: "例如句型、助词和句子意思会连起来看。", spatial_relationship: "例如句子里的动作和时间会按顺序排出来。", interactive_clarification: "例如读到短句时，会问“这里为什么用这个助词”。", spoken_explanation: "例如会听老师把短句的意思和句型用法顺着讲清。", sound_cues: "例如单词、助词和短句会按顺序念几遍。", reading_comprehension: "例如题目要求和原文短句会来回读清。", note_organization: "例如助词、句型和关键词会记在草稿旁。", written_synthesis: "例如会用自己的话写出句子的意思和句型用法。", process_rehearsal: "例如会从读题、找原句到写答案，完整做一遍。", hands_on_operation: "例如会先拿一个句型换进课本短句试一试。", contextual_immersion: "例如会把一个句型放进具体短句里看看怎么用。" }),
  物理: Object.freeze({ image_association: "例如研究对象、力和已知量会各配一个记号。", structure_mapping: "例如过程、受力和关系式会用线连起来。", spatial_relationship: "例如运动过程的几个阶段会按先后排在纸上。", interactive_clarification: "例如看过程图时，会问“这个力为什么要画出来”。", spoken_explanation: "例如会听老师把物体怎么动、哪个力在起作用顺着讲清。", sound_cues: "例如受力和公式条件会按顺序念几遍。", reading_comprehension: "例如题目条件和过程图会来回读清。", note_organization: "例如已知量、单位和关系式会记在草稿旁。", written_synthesis: "例如会用自己的话写出这个过程该怎么列式。", process_rehearsal: "例如会从画过程、列关系式到求结果，完整做一遍。", hands_on_operation: "例如会先拿一个已知量代进关系式试一试。", contextual_immersion: "例如会把一个受力过程放进具体小题里看看怎么用。" }),
  化学: Object.freeze({ image_association: "例如物质、条件和实验现象会各配一个记号。", structure_mapping: "例如反应物、条件、现象和生成物会用线连起来。", spatial_relationship: "例如实验操作的先后会按顺序排在纸上。", interactive_clarification: "例如看到一种现象时，会问“这个现象说明什么”。", spoken_explanation: "例如会听老师把加什么、看到什么、说明什么顺着讲清。", sound_cues: "例如反应条件和实验现象会按顺序念几遍。", reading_comprehension: "例如实验材料和化学用语会来回读清。", note_organization: "例如物质、条件和现象会记在草稿旁。", written_synthesis: "例如会用自己的话写出这一步变化说明什么。", process_rehearsal: "例如会从读材料、判断变化到写结论，完整做一遍。", hands_on_operation: "例如会先根据一个现象试着判断发生了什么变化。", contextual_immersion: "例如会把一个实验现象放进具体题里看看怎么用。" }),
  生物: Object.freeze({ image_association: "例如结构、变量和结果会各配一个小图或记号。", structure_mapping: "例如结构、过程和功能会用线连起来。", spatial_relationship: "例如生命过程的先后会按顺序排在纸上。", interactive_clarification: "例如看到一个变量时，会问“它为什么会影响结果”。", spoken_explanation: "例如会听老师把一个生命过程的先后和作用顺着讲清。", sound_cues: "例如结构名称和过程顺序会按顺序念几遍。", reading_comprehension: "例如实验材料、变量和结果会来回读清。", note_organization: "例如变量、结果和现象会记在草稿旁。", written_synthesis: "例如会用自己的话写出这个现象和变量的关系。", process_rehearsal: "例如会从读材料、找变量到写结论，完整做一遍。", hands_on_operation: "例如会先根据一组变量变化试着判断结果。", contextual_immersion: "例如会把一个实验结果放进具体题里看看怎么用。" }),
  政治: Object.freeze({ image_association: "例如材料事实、概念和结论会各配一个记号。", structure_mapping: "例如材料事实和课本概念会用线连起来。", spatial_relationship: "例如材料里的事情发展会按先后排在纸上。", interactive_clarification: "例如读到材料一句话时，会问“它能说明哪个概念”。", spoken_explanation: "例如会听老师把材料事实怎样连到课本概念顺着讲清。", sound_cues: "例如概念和材料事实会按顺序念几遍。", reading_comprehension: "例如题目要求、材料事实和概念会来回读清。", note_organization: "例如材料事实和能用的概念会记在草稿旁。", written_synthesis: "例如会用自己的话写出观点和材料依据。", process_rehearsal: "例如会从读材料、找观点到写依据，完整做一遍。", hands_on_operation: "例如会先拿一句材料试着解释一个概念。", contextual_immersion: "例如会把一个材料事实放进具体题里看看怎么用。" }),
  历史: Object.freeze({ image_association: "例如时间、人物和事件会各配一个小图或记号。", structure_mapping: "例如背景、经过和影响会用线连起来。", spatial_relationship: "例如一个时期的事件会按先后排到时间线上。", interactive_clarification: "例如读到材料一句话时，会问“它能说明什么历史背景”。", spoken_explanation: "例如会听老师把为什么发生、后来怎样、带来什么影响顺着讲清。", sound_cues: "例如时间、事件和影响会按顺序念几遍。", reading_comprehension: "例如材料里的时间、人物和事件会来回读清。", note_organization: "例如时间、人物和结论会记在草稿旁。", written_synthesis: "例如会用自己的话写出事件的背景和影响。", process_rehearsal: "例如会从读材料、排时间到写答案，完整做一遍。", hands_on_operation: "例如会先拿一个事件试着补全背景和影响。", contextual_immersion: "例如会把一个历史事件放进具体材料题里看看怎么用。" }),
  地理: Object.freeze({ image_association: "例如经纬度、海陆位置和地形会各配一个小图或记号。", structure_mapping: "例如位置条件、过程和结果会用线连起来。", spatial_relationship: "例如区域变化的几个环节会按先后排在纸上。", interactive_clarification: "例如看到一个图表条件时，会问“它会带来什么结果”。", spoken_explanation: "例如会听老师把位置条件怎样带来气候或产业结果顺着讲清。", sound_cues: "例如位置条件和对应结果会按顺序念几遍。", reading_comprehension: "例如区域图、图例和题干条件会来回读清。", note_organization: "例如位置、过程和结果会记在草稿旁。", written_synthesis: "例如会用自己的话写出区域条件会带来什么结果。", process_rehearsal: "例如会从读图表、找条件到写结论，完整做一遍。", hands_on_operation: "例如会先拿一个位置条件试着推出结果。", contextual_immersion: "例如会把一个区域条件放进具体题里看看怎么用。" })
});

function requireSubject(subject) {
  if (!SUBJECTS.includes(subject)) throw new RangeError("未知的报告学科");
  return subject;
}

function requireLevel(learningLevel) {
  if (!LEVELS.includes(learningLevel)) throw new RangeError("未知的学习阶段");
  return learningLevel;
}

function preferredSpecific(primaryCode, rates, opportunities, scores) {
  return specificModesFor(primaryCode)
    .filter(({ id }) => (opportunities[id] ?? 0) >= 3)
    .sort((left, right) => (rates[right.id] ?? 0) - (rates[left.id] ?? 0)
      || (scores[right.id] ?? 0) - (scores[left.id] ?? 0))[0] ?? null;
}

function entryFor(primaryCode, rates, opportunities, scores) {
  return preferredSpecific(primaryCode, rates, opportunities, scores);
}

function parallelEntry(candidates, rates, opportunities, scores) {
  return candidates
    .flatMap((primaryCode) => specificModesFor(primaryCode))
    .filter(({ id }) => (opportunities[id] ?? 0) >= 3)
    .sort((left, right) => (rates[right.id] ?? 0) - (rates[left.id] ?? 0)
      || (scores[right.id] ?? 0) - (scores[left.id] ?? 0))[0] ?? null;
}

function taskStart(subject, primaryCode, entry) {
  if (!entry) return TASK_MODE_START[primaryCode];
  return `先用“${SPECIFIC_MODES[entry.id].label}”开始：${SPECIFIC_TASK_START[entry.id](TASK_SUBJECT_FOCUS[subject])}`;
}

export function subjectModeExample(subject, primaryCode) {
  requireSubject(subject);
  if (!Object.hasOwn(PRIMARY_MODES, primaryCode)) throw new RangeError("未知的学习模式");
  return SUBJECT_MODE_EXAMPLES[subject][primaryCode];
}

export function subjectMechanismExample(subject, specificMode) {
  requireSubject(subject);
  if (!Object.hasOwn(SUBJECT_MECHANISM_EXAMPLES[subject], specificMode)) throw new RangeError("未知的具体学习方式");
  return SUBJECT_MECHANISM_EXAMPLES[subject][specificMode];
}

export function buildTaskCard({ subject, learningLevel, classification, specificRates = {}, specificOpportunities = {}, specificScores = {}, answeredCount = 20 }) {
  requireSubject(subject);
  requireLevel(learningLevel);
  if (!classification || !["clear", "primary_supporting", "parallel"].includes(classification.kind)) throw new TypeError("学习模式结论无效");
  const base = BASE_TASKS[subject][learningLevel];
  const shared = { heading: `${subject}｜${learningLevel}`, subject, learningLevel, ...base };

  if (classification.kind === "parallel") {
    const candidates = classification.candidates?.filter((code) => Object.hasOwn(PRIMARY_MODES, code));
    if (!candidates || candidates.length < 2) throw new TypeError("并列学习模式无效");
    // 作答不足时，二级方式的比例很容易被一两次选择放大；这时给出学科任务即可，不替学生指定细节入口。
    const entry = answeredCount >= 10 ? parallelEntry(candidates, specificRates, specificOpportunities, specificScores) : null;
    return Object.freeze({
      ...shared,
      firstStep: entry ? `${taskStart(subject, entry.primary, entry)} ${base.task}` : base.task,
      secondStep: TASK_FOLLOW_UP[subject],
      startChoices: Object.freeze([]),
      primarySpecific: entry?.id ?? null,
      supportingMode: null
    });
  }

  if (!Object.hasOwn(PRIMARY_MODES, classification.primary)) throw new TypeError("主要学习模式无效");
  const entry = entryFor(classification.primary, specificRates, specificOpportunities, specificScores);
  const support = classification.kind === "primary_supporting" ? classification.supporting : null;
  if (support && !Object.hasOwn(PRIMARY_MODES, support)) throw new TypeError("辅助学习模式无效");
  return Object.freeze({
    ...shared,
    firstStep: `${taskStart(subject, classification.primary, entry)} ${base.task}`,
    secondStep: support ? `${TASK_FOLLOW_UP[subject]} ${LIGHT_SUPPORT[support]}` : TASK_FOLLOW_UP[subject],
    startChoices: Object.freeze([]),
    primarySpecific: entry?.id ?? null,
    supportingMode: support
  });
}

export { LEVELS, SUBJECTS };
