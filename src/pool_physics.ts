import type RAPIER from '@dimforge/rapier3d-compat';

export type Ball = {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  type: string;
  number: number;
};

export type Pocket = { x: number; y: number; radius: number };
export type Pocketed = { solids: number[]; stripes: number[]; eight: boolean };
export type PocketedThisShot = { solids: number[]; stripes: number[]; cueBall: boolean };
export type PocketedEvent = {
  type: string;
  number: number;
  startX: number;
  startY: number;
  pocketX: number;
  pocketY: number;
  rotation: { w: number; x: number; y: number; z: number };
};

// Default physics properties for realistic pool ball behavior
export const PHYSICS_DEFAULTS = {
  BALL_MASS: 0.17,            // kg (standard pool ball is ~170g)
  BALL_RESTITUTION: 0.92,     // Bounciness of ball-to-ball collisions
  BALL_FRICTION: 0.1,         // Surface friction between balls
  CUSHION_RESTITUTION: 0.75,  // Cushion bounce factor
  CUSHION_FRICTION: 0.15,     // Cushion surface friction
  ROLLING_FRICTION: 0.01,     // Felt resistance (simulated)
  LINEAR_DAMPING: 0.3,        // Simulates rolling resistance on felt
  ANGULAR_DAMPING: 0.5,       // Simulates rotational friction on felt
  MAX_SHOT_POWER: 5,          // Maximum shot power (affects impulse strength)
} as const;

// Mutable runtime physics config (tunable via debug UI)
export const physicsConfig = { ...PHYSICS_DEFAULTS };

// Convenience accessors for backward compatibility
export const BALL_MASS = PHYSICS_DEFAULTS.BALL_MASS;
export const BALL_RESTITUTION = PHYSICS_DEFAULTS.BALL_RESTITUTION;
export const BALL_FRICTION = PHYSICS_DEFAULTS.BALL_FRICTION;
export const CUSHION_RESTITUTION = PHYSICS_DEFAULTS.CUSHION_RESTITUTION;
export const CUSHION_FRICTION = PHYSICS_DEFAULTS.CUSHION_FRICTION;
export const ROLLING_FRICTION = PHYSICS_DEFAULTS.ROLLING_FRICTION;
export const LINEAR_DAMPING = PHYSICS_DEFAULTS.LINEAR_DAMPING;
export const ANGULAR_DAMPING = PHYSICS_DEFAULTS.ANGULAR_DAMPING;
export const MAX_SHOT_POWER = PHYSICS_DEFAULTS.MAX_SHOT_POWER;

// Canvas to physics scale (pixels per physics unit)
export const SCALE = 5;

// Fixed timestep for deterministic physics (120 Hz)
export const FIXED_DT = 1 / 120;

export const createWorld = (rapier: typeof RAPIER) =>
  new rapier.World({ x: 0.0, y: 0.0, z: 0.0 });

export const setupTable = ({
  canvas,
  world,
  RAPIER: rapier
}: {
  canvas: HTMLCanvasElement;
  world: RAPIER.World;
  RAPIER: typeof RAPIER;
}) => {
  const w = canvas.width;
  const h = canvas.height;
  const cushionInset = 40; // Distance from edge to visual cushion (pixels)
  const ballRadius = 12;   // Ball radius in pixels
  const cushionThickness = 15; // Cushion thickness in pixels
  const pocketRadius = 25; // Corner pocket radius in pixels
  const sidePocketRadius = 22; // Side pocket radius in pixels
  const cornerPocketGap = 45; // Gap in cushion for corner pockets (pixels)
  const sidePocketGap = 40;   // Gap for side pockets (pixels)

  // Pocket positions (in pixels for rendering)
  const pockets: Pocket[] = [
    { x: cushionInset, y: cushionInset, radius: pocketRadius },                    // Top-left
    { x: w / 2, y: cushionInset - 5, radius: sidePocketRadius },                   // Top-middle
    { x: w - cushionInset, y: cushionInset, radius: pocketRadius },                // Top-right
    { x: cushionInset, y: h - cushionInset, radius: pocketRadius },                // Bottom-left
    { x: w / 2, y: h - cushionInset + 5, radius: sidePocketRadius },               // Bottom-middle
    { x: w - cushionInset, y: h - cushionInset, radius: pocketRadius }             // Bottom-right
  ];

  // Create cushion walls using Rapier 3D
  // In our 3D setup: X = left-right, Y = up (height), Z = top-bottom (depth into screen)
  // We'll simulate a top-down view, so balls roll on the X-Z plane at Y=BALL_RADIUS

  // Physics coordinates: Convert from pixels
  // Left edge at x=0, right edge at x=w/SCALE
  // Top edge at z=0, bottom edge at z=h/SCALE
  const physW = w / SCALE;
  const physH = h / SCALE;
  const physCushionInset = cushionInset / SCALE;
  const physCushionThickness = cushionThickness / SCALE;
  const physCornerGap = cornerPocketGap / SCALE;
  const physSideGap = sidePocketGap / SCALE;
  const physBallRadius = ballRadius / SCALE;
  const cushionHeight = physBallRadius * 2.5; // Cushions are taller than balls

  const cushionBodies: RAPIER.RigidBody[] = [];

  // Helper to create a cushion cuboid
  const createCushion = (x: number, y: number, z: number, hx: number, hy: number, hz: number) => {
    const bodyDesc = rapier.RigidBodyDesc.fixed().setTranslation(x, y, z);
    const body = world.createRigidBody(bodyDesc);
    const colliderDesc = rapier.ColliderDesc.cuboid(hx, hy, hz)
      .setRestitution(physicsConfig.CUSHION_RESTITUTION)
      .setFriction(physicsConfig.CUSHION_FRICTION)
      .setActiveEvents(rapier.ActiveEvents.COLLISION_EVENTS);
    world.createCollider(colliderDesc, body);
    cushionBodies.push(body);
  };

  // Cushion Y position (bottom of cushion at table level)
  const cushionY = cushionHeight / 2;

  // Top cushions (along Z = physCushionInset, extending in X direction)
  // Left segment of top cushion (from left corner pocket to center pocket)
  // Offset by ball radius so the edge of the ball collides with the visual cushion edge
  const topZ = physCushionInset + physBallRadius;
  const topLeftStart = physCushionInset + physCornerGap;
  const topLeftEnd = physW / 2 - physSideGap;
  const topLeftLength = topLeftEnd - topLeftStart;
  if (topLeftLength > 0) {
    createCushion(
      topLeftStart + topLeftLength / 2,
      cushionY,
      topZ,
      topLeftLength / 2,
      cushionHeight / 2,
      physCushionThickness / 2
    );
  }

  // Right segment of top cushion
  const topRightStart = physW / 2 + physSideGap;
  const topRightEnd = physW - physCushionInset - physCornerGap;
  const topRightLength = topRightEnd - topRightStart;
  if (topRightLength > 0) {
    createCushion(
      topRightStart + topRightLength / 2,
      cushionY,
      topZ,
      topRightLength / 2,
      cushionHeight / 2,
      physCushionThickness / 2
    );
  }

  // Bottom cushions (along Z = physH - physCushionInset)
  // Offset by ball radius so the edge of the ball collides with the visual cushion edge
  const bottomZ = physH - physCushionInset - physBallRadius;
  const bottomLeftStart = physCushionInset + physCornerGap;
  const bottomLeftEnd = physW / 2 - physSideGap;
  const bottomLeftLength = bottomLeftEnd - bottomLeftStart;
  if (bottomLeftLength > 0) {
    createCushion(
      bottomLeftStart + bottomLeftLength / 2,
      cushionY,
      bottomZ,
      bottomLeftLength / 2,
      cushionHeight / 2,
      physCushionThickness / 2
    );
  }

  const bottomRightStart = physW / 2 + physSideGap;
  const bottomRightEnd = physW - physCushionInset - physCornerGap;
  const bottomRightLength = bottomRightEnd - bottomRightStart;
  if (bottomRightLength > 0) {
    createCushion(
      bottomRightStart + bottomRightLength / 2,
      cushionY,
      bottomZ,
      bottomRightLength / 2,
      cushionHeight / 2,
      physCushionThickness / 2
    );
  }

  // Left cushion (along X = physCushionInset, extending in Z direction)
  // Offset by ball radius so the edge of the ball collides with the visual cushion edge
  const leftX = physCushionInset + physBallRadius;
  const leftStart = physCushionInset + physCornerGap;
  const leftEnd = physH - physCushionInset - physCornerGap;
  const leftLength = leftEnd - leftStart;
  if (leftLength > 0) {
    createCushion(
      leftX,
      cushionY,
      leftStart + leftLength / 2,
      physCushionThickness / 2,
      cushionHeight / 2,
      leftLength / 2
    );
  }

  // Right cushion
  // Offset by ball radius so the edge of the ball collides with the visual cushion edge
  const rightX = physW - physCushionInset - physBallRadius;
  const rightStart = physCushionInset + physCornerGap;
  const rightEnd = physH - physCushionInset - physCornerGap;
  const rightLength = rightEnd - rightStart;
  if (rightLength > 0) {
    createCushion(
      rightX,
      cushionY,
      rightStart + rightLength / 2,
      physCushionThickness / 2,
      cushionHeight / 2,
      rightLength / 2
    );
  }

  return { pockets, cushionBodies };
};

export const setupBalls = ({
  canvas,
  world,
  RAPIER: rapier
}: {
  canvas: HTMLCanvasElement;
  world: RAPIER.World;
  RAPIER: typeof RAPIER;
}): Ball[] => {
  const balls: Ball[] = [];
  const pixelRadius = 12;
  const physRadius = pixelRadius / SCALE;
  const h = canvas.height;

  // Cue ball position in pixels, then convert to physics
  const cuePixelX = 300;
  const cuePixelY = h / 2;
  const cuePhysX = cuePixelX / SCALE;
  const cuePhysZ = cuePixelY / SCALE;

  // Create a ball helper function
  const createBall = (physX: number, physZ: number, type: string, number: number) => {
    // Ball center at Y = physRadius (sitting on table surface at Y=0)
    const bodyDesc = rapier.RigidBodyDesc.dynamic()
      .setTranslation(physX, physRadius, physZ)
      .setLinearDamping(physicsConfig.LINEAR_DAMPING)
      .setAngularDamping(physicsConfig.ANGULAR_DAMPING)
      .setCcdEnabled(true); // Enable CCD for fast-moving balls

    const body = world.createRigidBody(bodyDesc);

    const colliderDesc = rapier.ColliderDesc.ball(physRadius)
      .setRestitution(physicsConfig.BALL_RESTITUTION)
      .setFriction(physicsConfig.BALL_FRICTION)
      .setMass(physicsConfig.BALL_MASS)
      .setActiveEvents(rapier.ActiveEvents.COLLISION_EVENTS);

    const collider = world.createCollider(colliderDesc, body);

    balls.push({ body, collider, type, number });
  };

  // Create cue ball
  createBall(cuePhysX, cuePhysZ, 'cue', 0);

  // Rack position (foot spot is typically 3/4 down the table length)
  const rackPixelX = 900;
  const rackPixelY = h / 2;
  const rackPhysX = rackPixelX / SCALE;
  const rackPhysZ = rackPixelY / SCALE;

  // Rack the balls in triangle formation
  // Standard 8-ball rack: 8-ball in center, one solid and one stripe in back corners
  const ballOrder = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  let ballIndex = 0;
  const spacing = physRadius * 2.05; // Slightly more than diameter for tight rack

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      // Triangle points toward cue ball (negative X direction)
      const x = rackPhysX + row * spacing * 0.866; // cos(30deg) approx 0.866
      const z = rackPhysZ + (col - row / 2) * spacing;

      const ballNum = ballOrder[ballIndex];
      const type = ballNum === 8 ? 'eight' :
                   ballNum < 8 ? 'solid' : 'stripe';

      createBall(x, z, type, ballNum);
      ballIndex++;
    }
  }

  return balls;
};

export const checkPockets = ({
  world,
  canvas,
  balls,
  pockets,
  pocketed,
  pocketedThisShot,
  RAPIER: rapier
}: {
  world: RAPIER.World;
  canvas: HTMLCanvasElement;
  balls: Ball[];
  pockets: Pocket[];
  pocketed: Pocketed;
  pocketedThisShot: PocketedThisShot;
  RAPIER: typeof RAPIER;
}): PocketedEvent[] => {
  const pixelRadius = 12;
  const h = canvas.height;
  const pocketedEvents: PocketedEvent[] = [];

  // Check if ball has fallen into a pocket
  for (let i = balls.length - 1; i >= 0; i--) {
    const ball = balls[i];
    const pos = ball.body.translation();

    // Convert physics position to pixel position
    const pixelX = pos.x * SCALE;
    const pixelZ = pos.z * SCALE;

    // Check proximity to pockets
    let isInPocket = false;
    let pocketHit: Pocket | null = null;
    for (const pocket of pockets) {
      const dx = pixelX - pocket.x;
      const dz = pixelZ - pocket.y;
      const dist = Math.sqrt(dx * dx + dz * dz);
      // Ball is pocketed if its center is within pocket radius
      if (dist < pocket.radius) {
        isInPocket = true;
        pocketHit = pocket;
        break;
      }
    }

    // Fallback: If ball is outside table bounds, consider it pocketed
    // This catches fast-moving balls that might skip past pocket detection
    const w = canvas.width;
    const cushionInset = 40;
    if (pixelX < cushionInset - pixelRadius || pixelX > w - cushionInset + pixelRadius ||
        pixelZ < cushionInset - pixelRadius || pixelZ > h - cushionInset + pixelRadius) {
      isInPocket = true;
    }

    if (isInPocket) {
      if (!pocketHit) {
        pocketHit = pockets.reduce((closest, pocket) => {
          const dx = pixelX - pocket.x;
          const dz = pixelZ - pocket.y;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (!closest || dist < closest.dist) {
            return { pocket, dist };
          }
          return closest;
        }, null as { pocket: Pocket; dist: number } | null)?.pocket || pockets[0];
      }

      if (ball.type !== 'cue') {
        const rot = ball.body.rotation();
        pocketedEvents.push({
          type: ball.type,
          number: ball.number,
          startX: pixelX,
          startY: pixelZ,
          pocketX: pocketHit.x,
          pocketY: pocketHit.y,
          rotation: { w: rot.w, x: rot.x, y: rot.y, z: rot.z }
        });
      }

      // Remove ball from physics world
      world.removeRigidBody(ball.body);

      if (ball.type === 'cue') {
        // Scratch - replace cue ball
        const resetPixelX = 300;
        const resetPixelZ = h / 2;
        const resetPhysX = resetPixelX / SCALE;
        const resetPhysZ = resetPixelZ / SCALE;
        const physRadius = pixelRadius / SCALE;

        // Create new cue ball
        const bodyDesc = rapier.RigidBodyDesc.dynamic()
          .setTranslation(resetPhysX, physRadius, resetPhysZ)
          .setLinearDamping(physicsConfig.LINEAR_DAMPING)
          .setAngularDamping(physicsConfig.ANGULAR_DAMPING)
          .setCcdEnabled(true);

        const newBody = world.createRigidBody(bodyDesc);

        const colliderDesc = rapier.ColliderDesc.ball(physRadius)
          .setRestitution(physicsConfig.BALL_RESTITUTION)
          .setFriction(physicsConfig.BALL_FRICTION)
          .setMass(physicsConfig.BALL_MASS)
          .setActiveEvents(rapier.ActiveEvents.COLLISION_EVENTS);

        const newCollider = world.createCollider(colliderDesc, newBody);

        // Update the ball reference
        balls[i] = { body: newBody, collider: newCollider, type: 'cue', number: 0 };

        // Track that cue ball was scratched this shot
        pocketedThisShot.cueBall = true;
      } else if (ball.type === 'eight') {
        pocketed.eight = true;
        balls.splice(i, 1);
      } else {
        if (ball.type === 'solid') {
          pocketed.solids.push(ball.number);
          pocketedThisShot.solids.push(ball.number);
        } else {
          pocketed.stripes.push(ball.number);
          pocketedThisShot.stripes.push(ball.number);
        }
        balls.splice(i, 1);
      }
    }
  }

  return pocketedEvents;
};

export const applyRollingFriction = (balls: Ball[], dt: number) => {
  const frictionCoeff = physicsConfig.ROLLING_FRICTION;
  const pixelRadius = 12;
  const physRadius = pixelRadius / SCALE;

  for (const ball of balls) {
    const linvel = ball.body.linvel();
    const speed = Math.sqrt(linvel.x * linvel.x + linvel.z * linvel.z);

    if (speed > 0.01) {
      // Apply friction force opposite to velocity
      const frictionForce = frictionCoeff * physicsConfig.BALL_MASS * 9.81; // F = mu * m * g
      const deceleration = frictionForce / physicsConfig.BALL_MASS;

      // Reduce velocity slightly each step
      const newSpeed = Math.max(0, speed - deceleration * dt);
      const factor = speed > 0 ? newSpeed / speed : 0;

      ball.body.setLinvel({
        x: linvel.x * factor,
        y: linvel.y,
        z: linvel.z * factor
      }, true);

      // Also apply rolling: angular velocity should match linear velocity
      // For a rolling ball: omega = v / r
      if (speed > 0.05) {
        const targetAngVelX = -linvel.z / physRadius; // Rotation around X from Z motion
        const targetAngVelZ = linvel.x / physRadius;  // Rotation around Z from X motion

        const currentAngVel = ball.body.angvel();
        // Blend toward proper rolling (gradual correction)
        const blend = 0.1;
        ball.body.setAngvel({
          x: currentAngVel.x * (1 - blend) + targetAngVelX * blend,
          y: currentAngVel.y * 0.95, // Damp vertical spin
          z: currentAngVel.z * (1 - blend) + targetAngVelZ * blend
        }, true);
      }
    } else {
      // Stop very slow balls completely
      ball.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      ball.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    // Keep balls on the table (Y should be at ball radius)
    const pos = ball.body.translation();
    if (Math.abs(pos.y - physRadius) > 0.01) {
      ball.body.setTranslation({ x: pos.x, y: physRadius, z: pos.z }, true);
      const linv = ball.body.linvel();
      ball.body.setLinvel({ x: linv.x, y: 0, z: linv.z }, true);
    }
  }
};
