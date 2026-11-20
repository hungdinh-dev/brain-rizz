// Hồ sơ trên máy đã chuyển xuống `@/lib/profile` (dùng chung, gỡ import vòng home ↔ pets); giữ lối
// import cũ cho các file trong home.
export { loadProfile, type Profile, saveAccessories, saveProfile } from "@/lib/profile";
