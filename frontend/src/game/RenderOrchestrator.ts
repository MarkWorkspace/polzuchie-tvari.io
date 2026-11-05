// ROLE: Оркестрация обновления и отрисовки трехмерных объектов сцены. Не содержит логики ввода или сети.

import * as THREE from "three";
import { BlackHoleRenderer } from "../renderer/BlackHoleRenderer";
import { DebugRenderer } from "../renderer/DebugRenderer";
import { FoodRenderer } from "../renderer/FoodRenderer";
import { GRASS_GROUND_Z, GrassRenderer } from "../renderer/GrassRenderer";
import { NicknameRenderer } from "../renderer/NicknameRenderer";
import { ParticleRenderer } from "../renderer/ParticleRenderer";
import { PortalRenderer } from "../renderer/PortalRenderer";
import { PropRenderer } from "../renderer/PropRenderer";
import { QUALITY_PRESETS } from "../renderer/RenderQuality";
import type { SceneManager } from "../renderer/SceneManager";
import { SnakeRenderer } from "../renderer/SnakeRenderer";
import { TombstoneRenderer } from "../renderer/TombstoneRenderer";
import type { GameCamera } from "./Camera";

/** Fraction of the visible ground half-extent used to bias the grass forward. */
const GRASS_VIEW_FORWARD_FACTOR = 0.5;
/** Cap so a zoomed-out camera does not drag the field away from the player. */
const GRASS_VIEW_FORWARD_MAX = 120;
/** Camera distance where grass is fully dense. */
const GRASS_FADE_NEAR = 250;
/** Camera distance where grass has faded out and the ground carpet takes over. */
const GRASS_FADE_FAR = 850;

export class RenderOrchestrator {
  private sceneManager: SceneManager;
  private snakeRenderer: SnakeRenderer;
  private nicknameRenderer: NicknameRenderer;
  private foodRenderer: FoodRenderer;
  private portalRenderer: PortalRenderer;
  private blackHoleRenderer: BlackHoleRenderer;
  private particleRenderer: ParticleRenderer;
  private debugRenderer: DebugRenderer;
  private tombstoneRenderer: TombstoneRenderer;
  private grassRenderer: GrassRenderer;
  private propRenderer: PropRenderer;
  private postRenderCallbacks: ((frame: any, myId: string) => void)[] = [];
  private readonly grassForward = new THREE.Vector3();
  private readonly grassRight = new THREE.Vector3();
  private readonly grassUp = new THREE.Vector3();
  private readonly grassRay = new THREE.Vector3();
  private readonly grassView = {
    x: 0,
    y: 0,
    halfExtent: 0,
    cameraX: 0,
    cameraY: 0,
    cameraZ: 0,
    groundZ: GRASS_GROUND_Z,
    near: GRASS_FADE_NEAR,
    far: GRASS_FADE_FAR,
    corners: [] as { x: number; y: number }[],
    viewKey: 0,
  };

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    const scene = this.sceneManager.getScene();

    this.snakeRenderer = new SnakeRenderer(scene);
    this.nicknameRenderer = new NicknameRenderer();
    this.foodRenderer = new FoodRenderer(scene);
    this.portalRenderer = new PortalRenderer(scene);
    this.blackHoleRenderer = new BlackHoleRenderer(scene);
    this.particleRenderer = new ParticleRenderer(scene);
    this.debugRenderer = new DebugRenderer(scene);
    this.tombstoneRenderer = new TombstoneRenderer(scene);
    this.grassRenderer = new GrassRenderer(scene);
    this.propRenderer = new PropRenderer(scene);
  }

  public onPostRender(callback: (frame: any, myId: string) => void): void {
    this.postRenderCallbacks.push(callback);
  }

  public updateAndRender(
    dt: number,
    now: number,
    frame: any,
    myId: string,
    isAccelerating: boolean,
    debugMode: boolean,
    gameCamera?: GameCamera | null,
  ): void {
    const camera = this.sceneManager.getCamera();
    const width = this.sceneManager.getWidth();
    const height = this.sceneManager.getHeight();
    frame.myId = myId; // Attach myId for overlay queries

    if (gameCamera) {
      gameCamera.update(camera, frame, dt, myId, isAccelerating);
    }
    this.resolveGrassView(camera, frame);
    const preset = QUALITY_PRESETS[this.sceneManager.getQuality()];
    this.grassRenderer.update(
      frame,
      preset.grass,
      now,
      this.grassView.x,
      this.grassView.y,
      this.grassView.halfExtent,
      preset.grassRadius,
      this.grassView,
      this.sceneManager.getBodyMaskFrame(),
    );
    this.propRenderer.update(
      frame,
      preset.stones,
      now,
      this.grassView.x,
      this.grassView.y,
      this.grassView.halfExtent,
    );
    this.foodRenderer.update(frame);
    this.portalRenderer.update(frame, now / 1000.0);
    this.blackHoleRenderer.update(frame, now / 1000.0);
    this.particleRenderer.update(frame);
    this.snakeRenderer.update(frame, camera, width, height);
    this.nicknameRenderer.update(frame, camera, width, height);
    this.debugRenderer.update(frame, debugMode);
    this.tombstoneRenderer.update(frame);

    this.sceneManager.render(frame);

    for (const cb of this.postRenderCallbacks) {
      cb(frame, myId);
    }
  }

  public destroy(): void {
    this.snakeRenderer.destroy();
    this.nicknameRenderer.destroy();
    this.foodRenderer.destroy();
    this.portalRenderer.destroy();
    this.blackHoleRenderer.destroy();
    this.particleRenderer.destroy();
    this.debugRenderer.destroy();
    this.tombstoneRenderer.destroy();
    this.grassRenderer.destroy();
    this.propRenderer.destroy();
  }

  /**
   * Grass follows the camera's actual ground target, which exists in both player
   * and spectator modes (spectator frames do not carry usable camX/camY).
   * Builds the ground-plane footprint of the camera frustum and a distance LOD:
   * the placement is clipped to what the camera can see and fades out with
   * camera distance, so player, spectator overview and follow share one rule.
   */
  private resolveGrassView(camera: THREE.PerspectiveCamera, frame: any): void {
    let x = Number.isFinite(frame?.camX) ? frame.camX : 0;
    let y = Number.isFinite(frame?.camY) ? frame.camY : 0;
    let halfExtent = 0;

    camera.updateMatrixWorld();
    const camX = camera.position.x;
    const camY = camera.position.y;
    const camZ = camera.position.z;
    const forward = camera.getWorldDirection(this.grassForward);
    const right = this.grassRight.setFromMatrixColumn(camera.matrixWorld, 0);
    const up = this.grassUp.setFromMatrixColumn(camera.matrixWorld, 1);
    const aspect = Number.isFinite(camera.aspect) && camera.aspect > 0 ? camera.aspect : 1;

    this.grassView.cameraX = camX;
    this.grassView.cameraY = camY;
    this.grassView.cameraZ = camZ;
    this.grassView.groundZ = GRASS_GROUND_Z;
    this.grassView.near = GRASS_FADE_NEAR;
    this.grassView.far = GRASS_FADE_FAR;
    this.grassView.viewKey =
      Math.round(Math.atan2(forward.y, forward.x) * 1000) * 1_000_000 +
      Math.round(Math.asin(Math.max(-1, Math.min(1, -forward.z))) * 1000) * 1_000 +
      Math.round(aspect * 1000);

    if (Number.isFinite(camX) && Number.isFinite(camY) && Number.isFinite(camZ)) {
      const t = Math.abs(forward.z) >= 1e-4 ? (GRASS_GROUND_Z - camZ) / forward.z : Number.NaN;

      if (Number.isFinite(t) && t > 0) {
        x = camX + forward.x * t;
        y = camY + forward.y * t;
        halfExtent = t * Math.tan((camera.fov * Math.PI) / 360);
      } else {
        // Camera parallel to the plane or looking away: stay above the camera.
        x = camX;
        y = camY;
      }
    }

    // Horizontal component only: the offset must not depend on pitch.
    const flat = Math.hypot(forward.x, forward.y);
    if (Number.isFinite(flat) && flat > 1e-4 && halfExtent > 0) {
      const offset = Math.min(GRASS_VIEW_FORWARD_MAX, halfExtent * GRASS_VIEW_FORWARD_FACTOR);
      x += (forward.x / flat) * offset;
      y += (forward.y / flat) * offset;
    }

    // Intersect the four frustum corner rays with the grass plane. The result
    // is the exact ground trapezoid the camera sees, not an approximate circle.
    const tanV = Math.tan((camera.fov * Math.PI) / 360);
    const tanH = tanV * aspect;
    const signs: readonly [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    const corners: { x: number; y: number }[] = [];
    let cornersValid = Number.isFinite(camX) && Number.isFinite(camY) && Number.isFinite(camZ);

    for (const [sx, sy] of signs) {
      if (!cornersValid) break;
      this.grassRay.set(
        forward.x + right.x * tanH * sx + up.x * tanV * sy,
        forward.y + right.y * tanH * sx + up.y * tanV * sy,
        forward.z + right.z * tanH * sx + up.z * tanV * sy,
      );
      const length = this.grassRay.length();
      if (!(length > 1e-6)) {
        cornersValid = false;
        break;
      }
      this.grassRay.divideScalar(length);
      if (this.grassRay.z >= -1e-4) {
        cornersValid = false;
        break;
      }
      const hit = (GRASS_GROUND_Z - camZ) / this.grassRay.z;
      if (!(hit > 0) || !Number.isFinite(hit)) {
        cornersValid = false;
        break;
      }
      corners.push({
        x: camX + this.grassRay.x * hit,
        y: camY + this.grassRay.y * hit,
      });
    }

    // An invalid/parallel camera falls back to the placement disc.
    this.grassView.corners = cornersValid ? corners : [];
    this.grassView.x = x;
    this.grassView.y = y;
    this.grassView.halfExtent = halfExtent;
  }
}
