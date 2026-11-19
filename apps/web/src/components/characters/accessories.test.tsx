import { CHARACTER_IDS, COSMETIC_ITEMS } from "@brain-rizz/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ACCESSORY_ART, AccessoryIcon, wornAccessories } from "./accessories";
import { Character } from "./Character";

describe("ACCESSORY_ART", () => {
  it("vẽ đủ 24 món của COSMETIC_ITEMS, đúng chỗ đeo", () => {
    expect(Object.keys(ACCESSORY_ART).sort()).toEqual(COSMETIC_ITEMS.map((i) => i.id).sort());
    for (const item of COSMETIC_ITEMS) expect(ACCESSORY_ART[item.id].slot).toBe(item.slot);
  });

  it("chỉ món sau lưng mới có phần trước thân", () => {
    for (const art of Object.values(ACCESSORY_ART))
      expect(art.front === undefined).toBe(art.layer === "front");
  });
});

describe("wornAccessories", () => {
  it("bỏ id lạ, giữ món đầu tiên mỗi chỗ, tách áo choàng ra lớp sau lưng", () => {
    const w = wornAccessories(["nope", "crown", "halo", "cape", "monocle"]);
    expect(w.head?.id).toBe("crown");
    expect(w.face?.id).toBe("monocle");
    expect(w.neck?.id).toBe("cape");
    expect(w.back.map((x) => x.id)).toEqual(["cape"]);
  });

  it("hideFace bỏ món chỗ mặt", () => {
    expect(wornAccessories(["sunglasses", "bow"], true).face).toBeUndefined();
  });
});

describe("Character có phụ kiện", () => {
  it("12 loài đều vẽ được đủ 3 chỗ, món đặt theo điểm neo", () => {
    for (const id of CHARACTER_IDS) {
      const html = renderToStaticMarkup(
        <Character
          id={id}
          animated={false}
          accessories={["witch-hat", "star-glasses", "royal-cape"]}
        />,
      );
      expect(html.match(/<g transform="translate\(/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    }
  });

  it("thỏ đội món đầu: tai vẽ lại đè lên món (trừ nơ), loài khác và món chỗ khác không đổi", () => {
    const draw = (id: "mochi" | "khoi", accessories: string[]) =>
      renderToStaticMarkup(<Character id={id} animated={false} accessories={accessories} />);
    const heads = COSMETIC_ITEMS.filter((i) => i.slot === "head").map((i) => i.id);
    expect(heads).toHaveLength(10);
    for (const head of heads) {
      expect(draw("mochi", [head]).includes("<clipPath")).toBe(head !== "bow");
      expect(draw("khoi", [head])).not.toContain("<clipPath");
    }
    expect(draw("mochi", ["sunglasses", "royal-cape"])).not.toContain("<clipPath");
  });

  it("hai thỏ cùng trang có id clipPath riêng", () => {
    const html = renderToStaticMarkup(
      <>
        <Character id="mochi" animated={false} accessories={["crown"]} />
        <Character id="mochi" animated={false} accessories={["beanie"]} />
      </>,
    );
    const ids = [...html.matchAll(/<clipPath id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });

  it("không có phụ kiện thì không thêm lớp nào", () => {
    const plain = renderToStaticMarkup(<Character id="khoi" animated={false} />);
    const none = renderToStaticMarkup(<Character id="khoi" animated={false} accessories={[]} />);
    expect(none).toBe(plain);
  });

  it("AccessoryIcon bỏ qua id lạ", () => {
    expect(renderToStaticMarkup(<AccessoryIcon id="nope" />)).toBe("");
    expect(renderToStaticMarkup(<AccessoryIcon id="crown" label="Vương miện" />)).toContain(
      'aria-label="Vương miện"',
    );
  });
});
