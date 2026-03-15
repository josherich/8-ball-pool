type Quaternion = { w: number; x: number; y: number; z: number };

export const BALL_COLORS = [
  '#FCD116', '#1C3F94', '#EE2737', '#601D84', '#F58025',
  '#056839', '#862234', '#333333'
];

export function rotatePointByQuaternion(
  point: { x: number; y: number; z: number },
  q: Quaternion
): { x: number; y: number; z: number } {
  const px = point.x, py = point.y, pz = point.z;
  const qw = q.w, qx = -q.x, qy = -q.y, qz = -q.z;

  const tx = 2 * (qy * pz - qz * py);
  const ty = 2 * (qz * px - qx * pz);
  const tz = 2 * (qx * py - qy * px);

  return {
    x: px + qw * tx + (qy * tz - qz * ty),
    y: py + qw * ty + (qz * tx - qx * tz),
    z: pz + qw * tz + (qx * ty - qy * tx)
  };
}

function renderStripe3D(
  ctx: CanvasRenderingContext2D,
  radius: number,
  color: string,
  quaternion: Quaternion
) {
  ctx.fillStyle = color;
  const stripeHalfWidth = 0.35;
  const segments = 32;

  for (let i = 0; i < segments; i++) {
    const angle1 = (i / segments) * Math.PI * 2;
    const angle2 = ((i + 1) / segments) * Math.PI * 2;

    const points3D = [
      { x: Math.cos(angle1), y: stripeHalfWidth, z: Math.sin(angle1) },
      { x: Math.cos(angle2), y: stripeHalfWidth, z: Math.sin(angle2) },
      { x: Math.cos(angle2), y: -stripeHalfWidth, z: Math.sin(angle2) },
      { x: Math.cos(angle1), y: -stripeHalfWidth, z: Math.sin(angle1) }
    ];

    const rotatedPoints = points3D.map(p => {
      const len = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
      const normalized = { x: p.x / len, y: p.y / len, z: p.z / len };
      return rotatePointByQuaternion(normalized, quaternion);
    });

    const avgY = (rotatedPoints[0].y + rotatedPoints[1].y + rotatedPoints[2].y + rotatedPoints[3].y) / 4;
    if (avgY < -0.1) continue;

    const projected = rotatedPoints.map(p => ({
      x: p.x * radius * 0.95,
      y: p.z * radius * 0.95
    }));

    ctx.beginPath();
    ctx.moveTo(projected[0].x, projected[0].y);
    ctx.lineTo(projected[1].x, projected[1].y);
    ctx.lineTo(projected[2].x, projected[2].y);
    ctx.lineTo(projected[3].x, projected[3].y);
    ctx.closePath();
    ctx.fill();
  }
}

function renderNumberCircle(
  ctx: CanvasRenderingContext2D,
  radius: number,
  ballNumber: number,
  quaternion: Quaternion,
  circleScaleFactor: number,
  circleSizeFactor: number,
  fontSizeFactor: number,
  fontThreshold: number
) {
  const circlePos3D = rotatePointByQuaternion({ x: 0, y: 1, z: 0 }, quaternion);
  if (circlePos3D.y <= -0.2) return;

  const projX = circlePos3D.x * radius * circleScaleFactor;
  const projY = circlePos3D.z * radius * circleScaleFactor;
  const circleScale = Math.max(0, circlePos3D.y * 0.5 + 0.5);
  const circleRadius = radius * circleSizeFactor * circleScale;

  if (circleRadius <= 2) return;

  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(projX, projY, circleRadius, 0, Math.PI * 2);
  ctx.fill();

  if (circleScale > fontThreshold) {
    ctx.fillStyle = 'black';
    ctx.font = `bold ${Math.round(fontSizeFactor * circleScale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(ballNumber), projX, projY);
  }
}

export function renderBall3D(
  ctx: CanvasRenderingContext2D,
  pixelX: number,
  pixelY: number,
  radius: number,
  ballType: string,
  ballNumber: number,
  quaternion: Quaternion
) {
  ctx.save();
  ctx.translate(pixelX, pixelY);

  if (ballType === 'cue') {
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'hsl(25, 15%, 80%)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const dotPos3D = rotatePointByQuaternion({ x: 0, y: 1, z: 0 }, quaternion);
    if (dotPos3D.y > 0) {
      const projX = dotPos3D.x * radius * 0.7;
      const projY = dotPos3D.z * radius * 0.7;
      const dotSize = 2 + dotPos3D.y * 1.5;
      ctx.fillStyle = `rgba(30, 100, 200, ${0.4 + dotPos3D.y * 0.6})`;
      ctx.beginPath();
      ctx.arc(projX, projY, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (ballType === 'eight') {
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    const circlePos3D = rotatePointByQuaternion({ x: 0, y: 1, z: 0 }, quaternion);
    if (circlePos3D.y > -0.2) {
      const projX = circlePos3D.x * radius * 0.6;
      const projY = circlePos3D.z * radius * 0.6;
      const circleScale = Math.max(0, circlePos3D.y * 0.5 + 0.5);
      const circleRadius = radius * 0.5 * circleScale;

      if (circleRadius > 2) {
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(projX, projY, circleRadius, 0, Math.PI * 2);
        ctx.fill();

        if (circleScale > 0.4) {
          ctx.fillStyle = 'black';
          ctx.font = `bold ${Math.round(10 * circleScale)}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('8', projX, projY);
        }
      }
    }
  } else {
    const colorIndex = (ballNumber - 1) % 8;
    const ballColor = BALL_COLORS[colorIndex];

    if (ballType === 'solid') {
      ctx.fillStyle = ballColor;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      renderStripe3D(ctx, radius, ballColor, quaternion);
    }

    renderNumberCircle(ctx, radius, ballNumber, quaternion, 0.55, 0.45, 9, 0.35);
  }

  ctx.restore();
}

export function renderDisplayBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  ballType: string,
  ballNumber: number,
  color: string,
  isPocketed: boolean,
  isMuted: boolean
) {
  ctx.save();

  if (isPocketed) {
    ctx.globalAlpha = 0.35;
  } else if (isMuted) {
    ctx.globalAlpha = 0.4;
  }

  if (ballType === 'eight') {
    ctx.fillStyle = isPocketed ? '#555555' : 'black';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isPocketed ? '#999999' : 'white';
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isPocketed ? '#555555' : 'black';
    ctx.font = `bold ${Math.round(radius * 0.8)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('8', x, y);
  } else if (ballType === 'solid') {
    ctx.fillStyle = isPocketed ? '#666666' : color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isPocketed ? '#999999' : 'white';
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isPocketed ? '#555555' : 'black';
    ctx.font = `bold ${Math.round(radius * 0.7)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(ballNumber), x, y);
  } else if (ballType === 'stripe') {
    ctx.fillStyle = isPocketed ? '#888888' : 'white';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = isPocketed ? '#666666' : color;
    ctx.fillRect(x - radius, y - radius * 0.4, radius * 2, radius * 0.8);
    ctx.restore();

    ctx.fillStyle = isPocketed ? '#999999' : 'white';
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isPocketed ? '#555555' : 'black';
    ctx.font = `bold ${Math.round(radius * 0.7)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(ballNumber), x, y);
  }

  ctx.strokeStyle = isPocketed ? 'rgba(100, 100, 100, 0.5)' : 'rgba(0, 0, 0, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}
