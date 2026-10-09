# assets/ — file nguồn đồ hoạ và âm thanh

Thư mục này chứa **file gốc để chỉnh sửa**, không được web tải trực tiếp. Bản đã tối ưu để ship nằm ở `apps/web/public/assets/`.

```text
assets/
├─ source/
│  ├─ blender/   # .blend: avatar, sân khấu lobby, bục trao giải
│  ├─ figma/     # link/bản xuất từ Figma: icon, sprite minigame
│  └─ audio/     # file âm thanh gốc (.wav), dự án jsfxr
├─ exports/      # bản xuất trung gian (.glb chưa nén, PNG gấp đôi) trước khi tối ưu
└─ LICENSES.md   # SỔ GHI GIẤY PHÉP — bắt buộc cập nhật khi thêm asset của bên thứ ba
```

Quy trình tối ưu và ngân sách dung lượng: [docs/05-assets-guide.md](../docs/05-assets-guide.md).

File `.blend` lớn nên dùng [Git LFS](https://git-lfs.com/) (`git lfs track "*.blend"`) để repo không phình to.
