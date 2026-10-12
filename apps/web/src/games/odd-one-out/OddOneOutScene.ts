import { type Cell, type OddOneOutPuzzle, oddOneOut } from "@brain-rizz/shared";
import Phaser from "phaser";
import type { MinigameBridge } from "../types";

const hex = (color: string) => Number.parseInt(color.slice(1), 16);
const v = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

function drawShape(g: Phaser.GameObjects.Graphics, cell: Cell, r: number) {
  g.fillStyle(hex(cell.color), 1);
  switch (cell.shape) {
    case "circle":
      g.fillCircle(0, 0, r);
      break;
    case "square":
      g.fillRoundedRect(-r, -r, r * 2, r * 2, r * 0.2);
      break;
    case "triangle":
      g.fillTriangle(0, -r, r, r * 0.8, -r, r * 0.8);
      break;
    case "diamond":
      g.fillPoints([v(0, -r), v(r * 0.8, 0), v(0, r), v(-r * 0.8, 0)], true);
      break;
    case "star": {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? r : r * 0.45;
        return v(Math.cos(a) * rr, Math.sin(a) * rr);
      });
      g.fillPoints(pts, true);
      break;
    }
    case "hexagon": {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (i * Math.PI) / 3;
        return v(Math.cos(a) * r, Math.sin(a) * r);
      });
      g.fillPoints(pts, true);
      break;
    }
  }
}

/** Độ mờ của các ô không liên quan trong lúc khoá sau câu sai. */
const DIM_ALPHA = 0.35;

/** Đọc màu token CSS (tự đổi theo sáng/tối) tại canvas, đổi sang số màu của Phaser. */
function tokenColor(el: Element, name: string): number {
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  return Phaser.Display.Color.ValueToColor(value).color;
}

/** Kẻ lạc đàn — chạm vào hình khác biệt. */
export default class OddOneOutScene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private locked = false;
  private board?: Phaser.GameObjects.Container;
  /** Hình của từng ô câu hiện tại, theo chỉ số ô. */
  private shapes: Phaser.GameObjects.Graphics[] = [];
  private cellSize = 0;

  init(data: { bridge: MinigameBridge }) {
    this.bridge = data.bridge;
    this.index = data.bridge.startIndex;
    this.locked = false;
  }

  create() {
    this.showPuzzle();
  }

  private showPuzzle() {
    // Mọi tween đang chạy đều thuộc lưới cũ (xuất hiện, nảy, nhịp ô đúng): dừng trước khi huỷ.
    this.tweens.killAll();
    this.board?.destroy();
    const puzzle = oddOneOut.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    const { width, height } = this.scale;
    const size = Math.min(width - 64, height - 320);
    const cellSize = size / puzzle.cols;
    const ox = (width - size) / 2;
    const oy = (height - size) / 2;

    const board = this.add.container(0, 0);
    this.shapes = puzzle.cells.map((cell, i) => {
      const x = ox + (i % puzzle.cols) * cellSize + cellSize / 2;
      const y = oy + Math.floor(i / puzzle.cols) * cellSize + cellSize / 2;

      const g = this.add.graphics({ x, y });
      drawShape(g, cell, cellSize * 0.34);
      g.setAngle(cell.rotation);

      const hit = this.add.zone(x, y, cellSize, cellSize).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => this.answer(puzzle, i));
      board.add([g, hit]);
      return g;
    });
    this.cellSize = cellSize;

    // Hiệu ứng xuất hiện nhẹ
    board.setAlpha(0);
    this.tweens.add({ targets: board, alpha: 1, duration: 120 });
    this.board = board;
  }

  private answer(puzzle: OddOneOutPuzzle, choice: number) {
    if (this.locked) return;
    this.locked = true;

    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    const index = this.index;
    const correct = oddOneOut.check(puzzle, choice);
    this.bridge.submit(index, choice);
    this.index += 1;

    if (correct) {
      this.tweens.add({ targets: this.shapes[choice], scale: 1.3, duration: 90, yoyo: true });
      this.time.delayedCall(180, () => {
        this.locked = false;
        this.showPuzzle();
      });
      return;
    }

    this.showMiss(choice, puzzle.oddIndex);
    // Hết khoá theo `lockedUntil` của server (không tự đếm 1,5 giây) để khớp huy hiệu khoá của khung.
    void this.bridge.unlockDelay(index).then((ms) => {
      // Hết vòng trong lúc chờ server thì scene đã bị huỷ.
      if (!this.sys.isActive()) return;
      this.time.delayedCall(ms, () => {
        this.locked = false;
        this.showPuzzle();
      });
    });
  }

  /**
   * Sai: rung màn hình, gạch chéo ô vừa chạm, làm mờ các ô khác. Riêng ô đúng giữ sáng,
   * được khoanh và nhịp nhẹ suốt lúc khoá để người chơi thấy đáp án (CR-006).
   */
  private showMiss(choice: number, answer: number) {
    const board = this.board;
    const right = this.shapes[answer];
    const wrong = this.shapes[choice];
    if (!board || !right || !wrong) return;

    const canvas = this.game.canvas;
    const rightColor = tokenColor(canvas, "--highlight");
    const wrongColor = tokenColor(canvas, "--destructive");
    const cell = this.cellSize;

    this.cameras.main.shake(200, 0.01);
    for (const shape of this.shapes) if (shape !== right) shape.setAlpha(DIM_ALPHA);

    // Vòng khoanh ô đúng, đặt dưới hình để không che hình.
    const ringR = cell * 0.46;
    const ring = this.add.graphics({ x: right.x, y: right.y });
    ring.fillStyle(rightColor, 0.18);
    ring.fillCircle(0, 0, ringR);
    ring.lineStyle(Math.max(5, cell * 0.06), rightColor, 1);
    ring.strokeCircle(0, 0, ringR);
    board.addAt(ring, board.getIndex(right));
    this.tweens.add({
      targets: [ring, right],
      scale: 1.12,
      duration: 280,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Dấu ✗ trên ô vừa chạm.
    const arm = cell * 0.56;
    const thick = Math.max(8, cell * 0.1);
    for (const angle of [45, -45]) {
      const bar = this.add.graphics({ x: wrong.x, y: wrong.y }).setAngle(angle);
      bar.fillStyle(wrongColor, 1);
      bar.fillRoundedRect(-arm / 2, -thick / 2, arm, thick, thick / 2);
      board.add(bar);
    }
  }
}
