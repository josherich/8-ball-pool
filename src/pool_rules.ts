import type { Ball, PocketedThisShot } from './pool_physics';

export const allBallsStopped = (balls: Ball[]): boolean =>
  balls.every(ball => {
    const linvel = ball.body.linvel();
    const angvel = ball.body.angvel();
    const linearSpeed = Math.sqrt(linvel.x * linvel.x + linvel.z * linvel.z);
    const angularSpeed = Math.sqrt(angvel.x * angvel.x + angvel.y * angvel.y + angvel.z * angvel.z);
    return linearSpeed < 0.05 && angularSpeed < 0.1;
  });

export const canShoot = ({
  mode,
  isMyTurn,
  balls
}: {
  mode: string;
  isMyTurn: boolean;
  balls: Ball[];
}): boolean => {
  if (mode === 'online' && !isMyTurn) return false;
  return balls.every(ball => {
    const linvel = ball.body.linvel();
    const angvel = ball.body.angvel();
    const linearSpeed = Math.sqrt(linvel.x * linvel.x + linvel.y * linvel.y + linvel.z * linvel.z);
    const angularSpeed = Math.sqrt(angvel.x * angvel.x + angvel.y * angvel.y + angvel.z * angvel.z);
    return linearSpeed < 0.05 && angularSpeed < 0.1;
  });
};

export const switchTurn = ({
  mode,
  currentPlayer,
  isMyTurn
}: {
  mode: string;
  currentPlayer: number;
  isMyTurn: boolean;
}) => {
  const nextPlayer = currentPlayer === 1 ? 2 : 1;
  return {
    currentPlayer: nextPlayer,
    isMyTurn: mode === 'online' ? !isMyTurn : isMyTurn
  };
};

export const evaluateTurnSwitch = ({
  currentPlayer,
  mode,
  isMyTurn,
  playerTypes,
  pocketedThisShot
}: {
  currentPlayer: number;
  mode: string;
  isMyTurn: boolean;
  playerTypes: { player1: string | null; player2: string | null };
  pocketedThisShot: PocketedThisShot;
}) => {
  // If cue ball was scratched, always switch turn
  if (pocketedThisShot.cueBall) {
    return {
      playerTypes,
      ...switchTurn({ mode, currentPlayer, isMyTurn })
    };
  }

  // Determine current player's ball type
  const currentPlayerType = currentPlayer === 1
    ? playerTypes.player1
    : playerTypes.player2;

  // If types haven't been assigned yet
  if (!currentPlayerType) {
    // If player pocketed any ball, they get that type and keep their turn
    if (pocketedThisShot.solids.length > 0) {
      if (currentPlayer === 1) {
        playerTypes.player1 = 'solid';
        playerTypes.player2 = 'stripe';
      } else {
        playerTypes.player2 = 'solid';
        playerTypes.player1 = 'stripe';
      }
      return { playerTypes, currentPlayer, isMyTurn };
    }
    if (pocketedThisShot.stripes.length > 0) {
      if (currentPlayer === 1) {
        playerTypes.player1 = 'stripe';
        playerTypes.player2 = 'solid';
      } else {
        playerTypes.player2 = 'stripe';
        playerTypes.player1 = 'solid';
      }
      return { playerTypes, currentPlayer, isMyTurn };
    }
    // Didn't pocket anything, switch turn
    return {
      playerTypes,
      ...switchTurn({ mode, currentPlayer, isMyTurn })
    };
  }

  // Check if player pocketed their assigned ball type
  const pocketedOwn = currentPlayerType === 'solid'
    ? pocketedThisShot.solids.length > 0
    : pocketedThisShot.stripes.length > 0;

  if (!pocketedOwn) {
    return {
      playerTypes,
      ...switchTurn({ mode, currentPlayer, isMyTurn })
    };
  }

  // If they pocketed their own ball type, they keep their turn
  return { playerTypes, currentPlayer, isMyTurn };
};
