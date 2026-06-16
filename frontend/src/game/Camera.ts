// ROLE: Следование камеры, зум. Не рендеринг.
import * as THREE from "three";

export class GameCamera {
  private currentFov = 50.0;

  constructor() {}

  public update(
    camera: THREE.PerspectiveCamera,
    msg: any,
    dt: number,
    myId: string,
    isLocalAccelerating: boolean
  ): void {
    const isAccelerating = this.checkAcceleration(msg, myId, isLocalAccelerating);
    this.updatePositionAndRotation(camera, msg, myId);
    this.updateFov(camera, dt, isAccelerating);
  }

  private checkAcceleration(msg: any, myId: string, isLocalAccelerating: boolean): boolean {
    const myPlayer = msg.gameState?.players[myId];
    return !!(myPlayer?.accelerating || isLocalAccelerating);
  }

  private updatePositionAndRotation(camera: THREE.PerspectiveCamera, msg: any, myId: string): void {
    const gameState = msg.gameState;
    const serverVisual = gameState?.server_visual;
    const cameraBaseZoom = serverVisual?.camera_base_zoom ?? 1.0;
    const cameraPitchAngle = serverVisual?.camera_pitch_angle ?? 55.0;
    const cameraZHeightOffset = serverVisual?.camera_z_height ?? 0.0;
    const cameraYOffset = serverVisual?.camera_y_offset ?? 0.25;

    const serverSnake = msg.gameState?.server_snake;
    const cameraZoomOutCoeff = serverSnake?.camera_zoom_out_coeff ?? 200.0;
    
    const myEffectiveLength = this.getMyEffectiveLength(msg, myId);
    const scoreZoomFactor = 1.0 / (1.0 + myEffectiveLength * 10.0 * (cameraZoomOutCoeff * 1e-5));
    const globalScale = scoreZoomFactor * cameraBaseZoom;

    const distance = (1500.0 / globalScale) + cameraZHeightOffset;
    const pitch = cameraPitchAngle * Math.PI / 180.0;
    const trueCamAngle = -(msg.camAngle ?? 0.0);

    const dirB_x = -Math.cos(trueCamAngle);
    const dirB_y = -Math.sin(trueCamAngle);

    const orbitCamX = msg.camX + dirB_x * distance * Math.sin(pitch);
    const orbitCamY = msg.camY + dirB_y * distance * Math.sin(pitch);
    const orbitCamZ = distance * Math.cos(pitch);

    const offsetDistance = 1000.0 * cameraYOffset / globalScale;
    const finalCamX = orbitCamX + Math.cos(trueCamAngle) * offsetDistance;
    const finalCamY = orbitCamY + Math.sin(trueCamAngle) * offsetDistance;

    camera.position.set(finalCamX, finalCamY, orbitCamZ);
    camera.rotation.order = "ZYX";
    camera.rotation.set(0, 0, trueCamAngle - Math.PI / 2.0);
    camera.rotateX(pitch);
  }

  private getMyEffectiveLength(msg: any, myId: string): number {
    const serverSnakeConfig = msg.gameState?.server_snake;
    const startLength = serverSnakeConfig?.start_length ?? 5;
    let myLength = startLength;
    const myPlayer = msg.gameState?.players[myId];
    if (myPlayer && myPlayer.body) {
      myLength = myPlayer.body.length;
    }
    return Math.max(0, myLength - startLength);
  }

  private updateFov(camera: THREE.PerspectiveCamera, dt: number, isAccelerating: boolean): void {
    const targetFov = isAccelerating ? 70.0 : 50.0;
    this.currentFov += (targetFov - this.currentFov) * 5.0 * dt;
    camera.fov = this.currentFov;
    camera.updateProjectionMatrix();
  }
}
