export const RADAR_AXES = Object.freeze([
  Object.freeze({ code: "V", label: "视觉" }),
  Object.freeze({ code: "A", label: "听觉" }),
  Object.freeze({ code: "R", label: "读写" }),
  Object.freeze({ code: "K", label: "动觉" })
]);

function clampScore(value) {
  if (!Number.isFinite(value)) throw new TypeError("雷达图需要视觉、听觉、读写、动觉四项有限数值");
  return Math.min(100, Math.max(0, value));
}

export function buildRadarGeometry(scores, radius) {
  if (!scores || RADAR_AXES.some(({ code }) => !Number.isFinite(scores[code]))) {
    throw new TypeError("雷达图需要完整四项分数");
  }
  if (!Number.isFinite(radius) || radius <= 0) throw new TypeError("雷达图半径必须大于零");

  const values = RADAR_AXES.map(({ code }) => clampScore(scores[code]));
  const points = values.map((value, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 2;
    const distance = radius * value / 100;
    return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
  });
  return { axes: RADAR_AXES, values, points, maxValue: 100, radius };
}

function tracePolygon(context, points, centerX, centerY) {
  context.beginPath();
  points.forEach(({ x, y }, index) => {
    const method = index === 0 ? "moveTo" : "lineTo";
    context[method](centerX + x, centerY + y);
  });
  context.closePath();
}

export function drawRadar(canvas, scores) {
  if (!canvas || typeof canvas.getContext !== "function") throw new TypeError("需要可绘制的 canvas");
  const context = canvas.getContext("2d");
  if (!context) return;

  const cssWidth = Math.max(280, Math.round(canvas.clientWidth || 360));
  const cssHeight = Math.max(280, Math.round(canvas.clientHeight || cssWidth));
  const pixelRatio = Math.max(1, globalThis.devicePixelRatio || 1);
  canvas.width = Math.round(cssWidth * pixelRatio);
  canvas.height = Math.round(cssHeight * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);

  const centerX = cssWidth / 2;
  const centerY = cssHeight / 2;
  const radius = Math.min(cssWidth, cssHeight) * 0.31;
  const geometry = buildRadarGeometry(scores, radius);

  context.lineJoin = "round";
  context.lineWidth = 1;
  for (const percent of [25, 50, 75, 100]) {
    const ring = RADAR_AXES.map((_, index) => {
      const angle = -Math.PI / 2 + index * Math.PI / 2;
      const distance = radius * percent / 100;
      return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
    });
    tracePolygon(context, ring, centerX, centerY);
    context.strokeStyle = percent === 100 ? "#cbbfae" : "#ded3c2";
    context.stroke();
  }

  context.strokeStyle = "#ded3c2";
  for (let index = 0; index < RADAR_AXES.length; index += 1) {
    const angle = -Math.PI / 2 + index * Math.PI / 2;
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
    context.stroke();
  }

  tracePolygon(context, geometry.points, centerX, centerY);
  context.fillStyle = "rgb(23 107 112 / 18%)";
  context.strokeStyle = "#176b70";
  context.lineWidth = 3;
  context.fill();
  context.stroke();

  geometry.points.forEach(({ x, y }) => {
    context.beginPath();
    context.arc(centerX + x, centerY + y, 4, 0, Math.PI * 2);
    context.fillStyle = "#e76f51";
    context.fill();
  });

  context.fillStyle = "#17202a";
  context.font = '700 14px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  RADAR_AXES.forEach(({ label }, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 2;
    const labelRadius = radius + 30;
    context.fillText(label, centerX + Math.cos(angle) * labelRadius, centerY + Math.sin(angle) * labelRadius);
  });
}
