export function buildSevenDayPlan(advice) {
  if (!advice?.subject || !advice.material || !advice.entryAction || !advice.supportAction) {
    throw new TypeError("学习建议不完整");
  }
  const target = `未来7天，用${advice.material}完成本周任务；第7天不看答案独立完成一次检验，并达到：${advice.check}。`;
  return Object.freeze({
    target,
    days: Object.freeze([
      Object.freeze({ day: 1, action: `从${advice.material}中选出本周要处理的内容，先按原来的方法完成一次，圈出第一个卡点。`, minimum: "至少选出2个任务", check: "能说清本周只解决哪一个问题" }),
      Object.freeze({ day: 2, action: advice.entryAction, minimum: advice.dailyMinimum, check: "留下图、口述、笔记或操作结果" }),
      Object.freeze({ day: 3, action: `继续用昨天的入口处理新任务。${advice.supportAction}`, minimum: advice.dailyMinimum, check: "标出1处仍然不确定的地方" }),
      Object.freeze({ day: 4, action: `不看前一天答案，按同样方法再完成一轮。${advice.quantity}。`, minimum: "时间不够时完成1个任务", check: "记录今天是否还卡在同一步" }),
      Object.freeze({ day: 5, action: `换一组同类材料，先用主要模式进入，再用辅助模式检查，不照抄前一次结果。`, minimum: "至少完成2个同类任务", check: "能指出新旧任务哪一处条件不同" }),
      Object.freeze({ day: 6, action: `按本周正常任务量完成1次小检验，做完后只订正第1个错点，不整页重抄。`, minimum: advice.dailyMinimum, check: "留下用时、完成数量和第1个错点" }),
      Object.freeze({ day: 7, action: `不看前6天答案，独立完成1组新任务；完成后再对照答案检查。`, minimum: advice.finalMinimum, check: advice.check })
    ])
  });
}
