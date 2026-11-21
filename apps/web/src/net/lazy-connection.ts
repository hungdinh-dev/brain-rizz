import type { JoinOptions } from "@brain-rizz/shared";
import { STORAGE_KEYS, safeSession } from "@/lib/storage";

/*
 * Cửa tải lười của lớp kết nối (`connection.ts`) cho các màn nằm trong gói đầu (App, trang chủ).
 * `connection.ts` kéo theo Colyseus SDK, zod (schema tin nhắn) và danh mục minigame, nên tách thành
 * chunk riêng để giữ gói đầu ≤ 300 KB gzip (NFR-PERF-01). Chunk được tải trước lúc rảnh ở menu cùng
 * các màn trong phòng (`app/party-screens.tsx` import tĩnh `connection.ts`). Màn trong chunk lười
 * vẫn import thẳng `@/net/connection`.
 */
const loadConnection = () => import("./connection");

type CreatePartyExtra = Parameters<Awaited<ReturnType<typeof loadConnection>>["createParty"]>[1];

export async function createParty(options: JoinOptions, extra?: CreatePartyExtra) {
  return (await loadConnection()).createParty(options, extra);
}

export async function joinParty(code: string, options: JoinOptions) {
  return (await loadConnection()).joinParty(code, options);
}

/**
 * Như `resumeParty` của `connection.ts`, nhưng không có token nối lại (lần mở trang bình thường) thì
 * trả `false` ngay, không tải chunk kết nối. Tải chunk lỗi (mất mạng, bản deploy mới đã xoá chunk
 * cũ) cũng trả `false`, không ném lỗi — giống `resumeParty` gốc.
 */
export async function resumeParty(): Promise<boolean> {
  if (!safeSession.get(STORAGE_KEYS.reconnect)) return false;
  const connection = await loadConnection().catch(() => null);
  return connection ? connection.resumeParty() : false;
}
