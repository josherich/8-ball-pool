import { SCALE } from '../pool_physics';
import type { Ball } from '../pool_physics';

export type PointerSource = 'mouse' | 'touch';

export type InputCallbacks = {
  canShoot: () => boolean;
  getBalls: () => Ball[];
  getAimAngle: () => number;
  setAimAngle: (angle: number) => void;
  isAiming: () => boolean;
  isBallInHand: () => boolean;
  isCueControlExpanded: () => boolean;
  setCueControlExpanded: (v: boolean) => void;
  isWithinCueSpinControl: (x: number, y: number, expanded: boolean) => boolean;
  updateCueSpinOffset: (x: number, y: number, expanded: boolean) => void;
  isDraggingCueSpin: () => boolean;
  setDraggingCueSpin: (v: boolean) => void;
  startPowerShot: () => void;
  releasePowerShot: () => void;
  cancelPowerShot: () => void;
  placeBallInHand: () => void;
  unlockAudio: () => void;
  onOpeningSoundCheck: () => void;
  mobileTouchControlsEnabled: boolean;
};

export class InputHandler {
  private canvas: HTMLCanvasElement;
  private cb: InputCallbacks;
  private cleanup: (() => void) | null = null;
  mousePos = { x: 0, y: 0 };
  touchAimDragActive = false;
  private touchAimLastAngle = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: InputCallbacks) {
    this.canvas = canvas;
    this.cb = callbacks;
  }

  attach() {
    const handleMouseMove = (e: MouseEvent) => {
      this.updateMousePosFromClient(e.clientX, e.clientY);
      this.updateAimFromMousePosition();
    };
    const handleMouseDown = () => { this.handlePointerDown('mouse'); };
    const handleMouseUp = () => { this.handlePointerUp('mouse'); };
    const handleMouseLeave = () => {
      this.cb.setDraggingCueSpin(false);
      this.endTouchAimDrag();
      this.cb.cancelPowerShot();
    };

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      if (!touch) return;
      this.updateMousePosFromClient(touch.clientX, touch.clientY);
      this.handlePointerDown('touch');
      e.preventDefault();
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      if (!touch) return;
      this.updateMousePosFromClient(touch.clientX, touch.clientY);
      if (this.touchAimDragActive) {
        this.updateTouchAimDrag();
      } else {
        this.updateAimFromMousePosition();
      }
      e.preventDefault();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      this.handlePointerUp('touch');
      e.preventDefault();
    };

    const handleTouchCancel = (e: TouchEvent) => {
      this.cb.setDraggingCueSpin(false);
      this.endTouchAimDrag();
      this.cb.cancelPowerShot();
      e.preventDefault();
    };

    this.canvas.addEventListener('mousemove', handleMouseMove);
    this.canvas.addEventListener('mousedown', handleMouseDown);
    this.canvas.addEventListener('mouseup', handleMouseUp);
    this.canvas.addEventListener('mouseleave', handleMouseLeave);
    this.canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    this.canvas.addEventListener('touchcancel', handleTouchCancel, { passive: false });

    this.cleanup = () => {
      this.canvas.removeEventListener('mousemove', handleMouseMove);
      this.canvas.removeEventListener('mousedown', handleMouseDown);
      this.canvas.removeEventListener('mouseup', handleMouseUp);
      this.canvas.removeEventListener('mouseleave', handleMouseLeave);
      this.canvas.removeEventListener('touchstart', handleTouchStart);
      this.canvas.removeEventListener('touchmove', handleTouchMove);
      this.canvas.removeEventListener('touchend', handleTouchEnd);
      this.canvas.removeEventListener('touchcancel', handleTouchCancel);
    };
  }

  detach() {
    if (this.cleanup) {
      this.cleanup();
      this.cleanup = null;
    }
  }

  updateMousePosFromClient(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    this.mousePos.x = (clientX - rect.left) * scaleX;
    this.mousePos.y = (clientY - rect.top) * scaleY;
  }

  private updateAimFromMousePosition() {
    if (this.cb.isDraggingCueSpin()) {
      this.cb.updateCueSpinOffset(this.mousePos.x, this.mousePos.y, true);
      return;
    }

    if (this.cb.canShoot() && !this.cb.isAiming()) {
      const cueBall = this.cb.getBalls().find(b => b.type === 'cue');
      if (cueBall) {
        const ballPos = cueBall.body.translation();
        const ballPixelX = ballPos.x * SCALE;
        const ballPixelY = ballPos.z * SCALE;

        this.cb.setAimAngle(Math.atan2(
          this.mousePos.y - ballPixelY,
          this.mousePos.x - ballPixelX
        ));
      }
    }
  }

  private getCueBallPixelPosition(): { x: number; y: number } | null {
    const cueBall = this.cb.getBalls().find(b => b.type === 'cue');
    if (!cueBall) return null;
    const ballPos = cueBall.body.translation();
    return { x: ballPos.x * SCALE, y: ballPos.z * SCALE };
  }

  private getTouchAimSpeedFactor(distance: number): number {
    const nearDistance = 60;
    const farDistance = 520;
    const maxFactor = 0.9;
    const minFactor = 0.22;
    const t = Math.min(Math.max((distance - nearDistance) / (farDistance - nearDistance), 0), 1);
    return maxFactor - t * (maxFactor - minFactor);
  }

  private beginTouchAimDrag() {
    if (!this.cb.mobileTouchControlsEnabled || this.cb.isAiming() || !this.cb.canShoot()) return;
    const cueBallPos = this.getCueBallPixelPosition();
    if (!cueBallPos) return;

    this.touchAimDragActive = true;
    this.touchAimLastAngle = Math.atan2(
      this.mousePos.y - cueBallPos.y,
      this.mousePos.x - cueBallPos.x
    );
  }

  private updateTouchAimDrag() {
    if (!this.touchAimDragActive || this.cb.isAiming() || !this.cb.canShoot()) return;
    const cueBallPos = this.getCueBallPixelPosition();
    if (!cueBallPos) return;

    const nextTouchAngle = Math.atan2(
      this.mousePos.y - cueBallPos.y,
      this.mousePos.x - cueBallPos.x
    );
    const delta = Math.atan2(
      Math.sin(nextTouchAngle - this.touchAimLastAngle),
      Math.cos(nextTouchAngle - this.touchAimLastAngle)
    );
    const distance = Math.hypot(
      this.mousePos.x - cueBallPos.x,
      this.mousePos.y - cueBallPos.y
    );
    const speedFactor = this.getTouchAimSpeedFactor(distance);
    const nextAimAngle = this.cb.getAimAngle() + delta * speedFactor;
    this.cb.setAimAngle(Math.atan2(Math.sin(nextAimAngle), Math.cos(nextAimAngle)));
    this.touchAimLastAngle = nextTouchAngle;
  }

  private endTouchAimDrag() {
    this.touchAimDragActive = false;
  }

  private handlePointerDown(source: PointerSource) {
    this.cb.unlockAudio();
    this.cb.onOpeningSoundCheck();

    if (this.cb.isCueControlExpanded()) {
      if (this.cb.isWithinCueSpinControl(this.mousePos.x, this.mousePos.y, true)) {
        this.cb.setDraggingCueSpin(true);
        this.cb.updateCueSpinOffset(this.mousePos.x, this.mousePos.y, true);
        return;
      }
      this.cb.setCueControlExpanded(false);
      return;
    }

    if (this.cb.isWithinCueSpinControl(this.mousePos.x, this.mousePos.y, false)) {
      this.cb.setCueControlExpanded(true);
      return;
    }

    if (this.cb.isBallInHand()) {
      this.cb.placeBallInHand();
      return;
    }

    if (source === 'touch' && this.cb.mobileTouchControlsEnabled) {
      this.beginTouchAimDrag();
      return;
    }
    this.cb.startPowerShot();
  }

  private handlePointerUp(source: PointerSource) {
    if (this.cb.isDraggingCueSpin()) {
      this.cb.setDraggingCueSpin(false);
      return;
    }
    if (source === 'touch' && this.cb.mobileTouchControlsEnabled) {
      this.endTouchAimDrag();
      return;
    }
    this.cb.releasePowerShot();
  }
}
