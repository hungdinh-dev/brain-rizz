#!/usr/bin/env node
/**
 * Tạo khung cho một minigame mới — chạy được ngay, rồi thay dần bằng logic thật.
 *
 *   pnpm new-game <id> <nhóm>
 *   vd: pnpm new-game number-balloons compute
 *
 * Tạo ra:
 *   packages/shared/src/games/<id>/<id>.ts        bộ sinh câu đố (mẫu: "chạm vào số lớn nhất")
 *   packages/shared/src/games/<id>/<id>.test.ts   test 10.000 seed
 *   apps/web/src/games/<id>/<Name>Scene.ts        scene Phaser
 *   apps/web/src/games/<id>/locales.ts            tên + cách chơi (vi, en)
 *   apps/web/src/games/<id>/index.ts              GameClient
 *   docs/04-minigames/<id>.md                     đặc tả (từ _template.md)
 * và đăng ký game vào packages/shared/src/games/index.ts + apps/web/src/games/registry.ts.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CATEGORIES = ["identify", "memorize", "analyze", "compute", "visualize"];
const CATEGORY_VI = {
  identify: "Nhận diện",
  memorize: "Ghi nhớ",
  analyze: "Phân tích",
  compute: "Tính toán",
  visualize: "Hình dung",
};

const [id, category] = process.argv.slice(2);

function fail(message) {
  console.error(`✖ ${message}`);
  console.error(
    "  Cách dùng: pnpm new-game <id> <nhóm>   (vd. pnpm new-game number-balloons compute)",
  );
  console.error(`  Nhóm: ${CATEGORIES.join(" | ")}`);
  process.exit(1);
}

if (!id || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id))
  fail("id phải là kebab-case, vd. number-balloons");
if (!CATEGORIES.includes(category)) fail(`nhóm không hợp lệ: ${category ?? "(trống)"}`);

const pascal = id.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());
const camel = pascal[0].toLowerCase() + pascal.slice(1);

const paths = {
  sharedDir: join(ROOT, "packages/shared/src/games", id),
  sharedIndex: join(ROOT, "packages/shared/src/games/index.ts"),
  webDir: join(ROOT, "apps/web/src/games", id),
  webRegistry: join(ROOT, "apps/web/src/games/registry.ts"),
  docTemplate: join(ROOT, "docs/04-minigames/_template.md"),
  doc: join(ROOT, "docs/04-minigames", `${id}.md`),
  docIndex: join(ROOT, "docs/04-minigames/README.md"),
};

if (existsSync(paths.sharedDir) || existsSync(paths.webDir)) fail(`game "${id}" đã tồn tại`);

// Bảng docs/04-minigames/README.md có sẵn dòng dự kiến cho game này → lấy tên tiếng Việt ở đó.
// Cột: | Nhóm | ID | Tên | MVP | Trạng thái | Đặc tả |
const docIndex = readFileSync(paths.docIndex, "utf8");
const rowPattern = new RegExp(
  `^(\\|[^|\\n]*\\| \`${id}\` \\|([^|\\n]*)\\|[^|\\n]*\\|) [^|\\n]* \\|[^|\\n]*\\|$`,
  "m",
);
const plannedName = docIndex.match(rowPattern)?.[2]?.trim();
const viTitle = plannedName || pascal;

const written = [];
function write(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  written.push(file);
}

/** Chèn `importLine` sau dòng import cuối cùng của file. */
function addImport(source, importLine) {
  const lines = source.split("\n");
  let last = -1;
  lines.forEach((line, i) => {
    if (line.startsWith("import ")) last = i;
  });
  lines.splice(last + 1, 0, importLine);
  return lines.join("\n");
}

/** Chèn `line` ngay trước dòng chứa `marker`. */
function insertBefore(source, marker, line, file) {
  const at = source.indexOf(marker);
  if (at === -1) fail(`không thấy "${marker}" trong ${relative(ROOT, file)}`);
  const lineStart = source.lastIndexOf("\n", at) + 1;
  return `${source.slice(0, lineStart)}${line}\n${source.slice(lineStart)}`;
}

// ---------------------------------------------------------------- shared: bộ sinh câu đố

write(
  join(paths.sharedDir, `${id}.ts`),
  `import type { Difficulty } from "../../difficulty";
import { createRng, deriveSeed } from "../../rng";
import type { MinigameDef } from "../types";

/**
 * TODO: mô tả game (đặc tả: docs/04-minigames/${id}.md).
 * Hiện là câu đố MẪU "chạm vào số lớn nhất" để chạy được ngay — thay bằng logic thật.
 * Mọi thứ ngẫu nhiên phải đi qua \`rng\`, không dùng Math.random() hay Date.now().
 */

export interface ${pascal}Puzzle {
  numbers: number[];
  answerIndex: number;
}

/** Đáp án = chỉ số ô người chơi chạm. */
export type ${pascal}Answer = number;

const COUNT_BY_DIFFICULTY: Record<Difficulty, number> = { 0: 3, 1: 4, 2: 6, 3: 8 };
const MAX_OPTIONS = 8;

export const ${camel}: MinigameDef<${pascal}Puzzle, ${pascal}Answer> = {
  id: "${id}",
  category: "${category}",
  durationMs: 60_000,

  generate(roundSeed, index, difficulty) {
    const rng = createRng(deriveSeed(roundSeed, index));
    const count = COUNT_BY_DIFFICULTY[difficulty];

    // Các số đôi một khác nhau → luôn có đúng một số lớn nhất.
    const pool = new Set<number>();
    while (pool.size < count) pool.add(rng.int(1, 99));
    const numbers = [...pool];

    return { numbers, answerIndex: numbers.indexOf(Math.max(...numbers)) };
  },

  check(puzzle, answer) {
    return answer === puzzle.answerIndex;
  },

  isAnswer(value): value is ${pascal}Answer {
    return Number.isInteger(value) && (value as number) >= 0 && (value as number) < MAX_OPTIONS;
  },
};
`,
);

write(
  join(paths.sharedDir, `${id}.test.ts`),
  `import { describe, expect, it } from "vitest";
import { DIFFICULTIES } from "../../difficulty";
import { ${camel} } from "./${id}";

describe("${id}", () => {
  it("tất định: cùng (seed, index, độ khó) → cùng câu đố", () => {
    for (const d of DIFFICULTIES) {
      expect(${camel}.generate(777, 5, d)).toEqual(${camel}.generate(777, 5, d));
    }
  });

  it("mọi câu đố có đúng MỘT đáp án (10.000 seed × 4 độ khó)", () => {
    for (const d of DIFFICULTIES) {
      for (let seed = 0; seed < 2_500; seed++) {
        const p = ${camel}.generate(seed, seed % 20, d);
        const correct = p.numbers.filter((_, i) => ${camel}.check(p, i));
        expect(correct).toHaveLength(1);
      }
    }
  });

  it("khó dần theo độ khó", () => {
    const sizes = DIFFICULTIES.map((d) => ${camel}.generate(1, 0, d).numbers.length);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
  });

  it("isAnswer() từ chối dữ liệu rác", () => {
    expect(${camel}.isAnswer(0)).toBe(true);
    expect(${camel}.isAnswer(-1)).toBe(false);
    expect(${camel}.isAnswer(1.5)).toBe(false);
    expect(${camel}.isAnswer("0")).toBe(false);
  });
});
`,
);

let sharedIndex = readFileSync(paths.sharedIndex, "utf8");
sharedIndex = addImport(sharedIndex, `import { ${camel} } from "./${id}/${id}";`);
sharedIndex = insertBefore(
  sharedIndex,
  "// @new-game:entry",
  `  "${id}": ${camel},`,
  paths.sharedIndex,
);
sharedIndex = insertBefore(
  sharedIndex,
  'export * from "./types";',
  `export * from "./${id}/${id}";`,
  paths.sharedIndex,
);
writeFileSync(paths.sharedIndex, sharedIndex);
written.push(paths.sharedIndex);

// ---------------------------------------------------------------- web: scene + chữ hiển thị

write(
  join(paths.webDir, `${pascal}Scene.ts`),
  `import { type ${pascal}Puzzle, ${camel} } from "@brain-rizz/shared";
import Phaser from "phaser";
import type { MinigameBridge } from "../types";

/** Độ mờ của các ô không liên quan trong lúc khoá sau câu sai. */
const DIM_ALPHA = 0.35;

/** Đọc màu token CSS (tự đổi theo sáng/tối) tại canvas, đổi sang số màu của Phaser. */
function tokenColor(el: Element, name: string): number {
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  return Phaser.Display.Color.ValueToColor(value).color;
}

/** TODO: vẽ câu đố thật. Hiện là scene MẪU: lưới ô số, chạm vào số lớn nhất. */
export default class ${pascal}Scene extends Phaser.Scene {
  private bridge!: MinigameBridge;
  private index = 0;
  private locked = false;
  private board?: Phaser.GameObjects.Container;
  /** Ô của câu hiện tại (hình + số), theo chỉ số ô. */
  private cells: Phaser.GameObjects.Container[] = [];
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
    const puzzle = ${camel}.generate(this.bridge.seed, this.index, this.bridge.difficulty);
    const { width, height } = this.scale;
    const cols = 2;
    const rows = Math.ceil(puzzle.numbers.length / cols);
    const cell = Math.min((width - 64) / cols, (height - 320) / rows);
    const ox = (width - cell * cols) / 2;
    const oy = (height - cell * rows) / 2;

    const board = this.add.container(0, 0);
    this.cells = puzzle.numbers.map((n, i) => {
      const x = ox + (i % cols) * cell + cell / 2;
      const y = oy + Math.floor(i / cols) * cell + cell / 2;
      const bg = this.add.circle(0, 0, cell * 0.4, 0x7fd1ae);
      const label = this.add
        .text(0, 0, String(n), { fontFamily: "Be Vietnam Pro", fontSize: cell * 0.3, color: "#1f1b3a" })
        .setOrigin(0.5);
      const box = this.add.container(x, y, [bg, label]);
      // Vùng chạm phủ cả ô (≥ 48 px).
      const hit = this.add.zone(x, y, cell, cell).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => this.answer(puzzle, i));
      board.add([box, hit]);
      return box;
    });
    this.cellSize = cell;

    board.setAlpha(0);
    this.tweens.add({ targets: board, alpha: 1, duration: 120 });
    this.board = board;
  }

  private answer(puzzle: ${pascal}Puzzle, choice: number) {
    if (this.locked) return;
    this.locked = true;

    // Chấm ngay ở client cho cảm giác tức thì; server chấm lại để tính điểm thật.
    const index = this.index;
    const correct = ${camel}.check(puzzle, choice);
    this.bridge.submit(index, choice);
    this.index += 1;

    if (correct) {
      this.tweens.add({ targets: this.cells[choice], scale: 1.2, duration: 90, yoyo: true });
      this.time.delayedCall(180, () => {
        this.locked = false;
        this.showPuzzle();
      });
      return;
    }

    // Sai: hiện đáp án đúng suốt lúc khoá (CR-006).
    this.showMiss(choice, puzzle.answerIndex);
    // Hết khoá theo lockedUntil của server (không tự đếm WRONG_ANSWER_LOCK_MS) để khớp huy hiệu
    // khoá của khung.
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
   * Sai: rung màn hình, làm mờ các ô khác, gạch chéo ô vừa chạm; ô đúng giữ sáng, được khoanh và
   * nhịp nhẹ suốt lúc khoá để người chơi thấy đáp án.
   * TODO: hiện đáp án theo mục "Hiện đáp án đúng khi sai" của đặc tả. Không đặt đáp án ở dải trên
   * cùng khung mà huy hiệu khoá che (xem comment unlockDelay trong ../types.ts).
   */
  private showMiss(choice: number, answer: number) {
    const board = this.board;
    const right = this.cells[answer];
    const wrong = this.cells[choice];
    if (!board || !right || !wrong) return;

    const canvas = this.game.canvas;
    const rightColor = tokenColor(canvas, "--highlight");
    const wrongColor = tokenColor(canvas, "--destructive");
    const size = this.cellSize;

    this.cameras.main.shake(200, 0.01);
    for (const cell of this.cells) if (cell !== right) cell.setAlpha(DIM_ALPHA);

    // Vòng khoanh ô đúng, đặt dưới hình để không che hình.
    const ring = this.add
      .circle(0, 0, size * 0.46, rightColor, 0.18)
      .setStrokeStyle(Math.max(5, size * 0.06), rightColor);
    right.addAt(ring, 0);
    this.tweens.add({
      targets: right,
      scale: 1.12,
      duration: 280,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Dấu ✗ trên ô vừa chạm (đặt trên lưới, không bị làm mờ cùng ô).
    for (const angle of [45, -45]) {
      const bar = this.add.rectangle(wrong.x, wrong.y, size * 0.56, Math.max(8, size * 0.1), wrongColor);
      board.add(bar.setAngle(angle));
    }
  }
}
`,
);

write(
  join(paths.webDir, "locales.ts"),
  `import type { Language } from "@/i18n/languages";
import type { GameLocale } from "../types";

// TODO: đặt tên, câu hướng dẫn, 3 bước, điều khiển, câu nhắc và mô tả 4 mức độ khó thật cho game
// (mục "Màn hướng dẫn" trong đặc tả). Mức nào có câu nhắc riêng trong đặc tả (đổi luật, bẫy cần nhớ)
// thì thêm levelHints, vd. levelHints: { 3: { touch: "…", mouse: "…" } }; mức khác dùng hint chung.
// Thêm Illustration ở index.ts nếu có hình minh hoạ (khung ngang 14:9, như artboard 560×360).
export const locales: Record<Language, GameLocale> = {
  vi: {
    title: "${viTitle}",
    howTo: "Chạm vào số lớn nhất.",
    summary: "Tìm số lớn nhất",
    steps: ["Nhìn các số", "Chạm vào số lớn nhất", "Đúng và nhanh để được nhiều điểm"],
    controls: { touch: "Chạm vào số", mouse: "Click chuột vào số" },
    hint: { touch: "Chạm vào số lớn nhất!", mouse: "Click vào số lớn nhất!" },
    levels: ["Mầm", "Thường", "Khó", "Siêu khó"],
  },
  en: {
    title: "${pascal}",
    howTo: "Tap the biggest number.",
    summary: "Find the biggest number",
    steps: ["Look at the numbers", "Tap the biggest one", "Be right and fast for more points"],
    controls: { touch: "Tap the number", mouse: "Click the number" },
    hint: { touch: "Tap the biggest number!", mouse: "Click the biggest number!" },
    levels: ["Sprout", "Normal", "Hard", "Super hard"],
  },
};
`,
);

write(
  join(paths.webDir, "index.ts"),
  `import type { GameClient } from "../types";
import { locales } from "./locales";

/** Logic câu đố: packages/shared/src/games/${id}/. */
export const ${camel}Client: GameClient = {
  scene: () => import("./${pascal}Scene"),
  locales,
};
`,
);

let registry = readFileSync(paths.webRegistry, "utf8");
registry = addImport(registry, `import { ${camel}Client } from "./${id}";`);
registry = insertBefore(
  registry,
  "// @new-game:entry",
  `  "${id}": ${camel}Client,`,
  paths.webRegistry,
);
writeFileSync(paths.webRegistry, registry);
written.push(paths.webRegistry);

// ---------------------------------------------------------------- docs

if (!existsSync(paths.doc)) {
  const doc = readFileSync(paths.docTemplate, "utf8")
    .replace("<Tên minigame>", viTitle)
    .replaceAll("<id>", id)
    .replace("Nhận diện | Ghi nhớ | Phân tích | Tính toán | Hình dung", CATEGORY_VI[category]);
  write(paths.doc, doc);
}

// Bảng danh mục: game đã có dòng dự kiến thì đổi trạng thái + gắn link đặc tả.
if (plannedName) {
  writeFileSync(
    paths.docIndex,
    docIndex.replace(rowPattern, `$1 🚧 Đang làm | [${id}.md](${id}.md) |`),
  );
  written.push(paths.docIndex);
}

// ---------------------------------------------------------------- định dạng + tổng kết

try {
  const files = written.filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => relative(ROOT, f));
  // Gọi thẳng biome bằng node (không qua shell) để chạy giống nhau trên Windows/macOS/Linux.
  const biome = join(ROOT, "node_modules/@biomejs/biome/bin/biome");
  execFileSync(process.execPath, [biome, "check", "--write", ...files], {
    cwd: ROOT,
    stdio: "ignore",
  });
} catch {
  console.warn("! Chưa format được bằng Biome — chạy `pnpm format` sau.");
}

console.log(`✔ Đã tạo minigame "${id}" (nhóm ${CATEGORY_VI[category]}):`);
for (const f of written) console.log(`  ${relative(ROOT, f).replaceAll("\\", "/")}`);
console.log(`
Tiếp theo:
  1. Viết đặc tả: docs/04-minigames/${id}.md
  2. Thay câu đố mẫu bằng logic thật + sửa test (pnpm --filter @brain-rizz/shared test:watch)
  3. Vẽ scene: apps/web/src/games/${id}/${pascal}Scene.ts; đặt tên ở locales.ts
  4. pnpm check, rồi pnpm dev và chơi thử 2 tab`);
