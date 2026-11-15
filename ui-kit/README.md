# Thư viện giao diện (ui-kit)

Bộ màu và thành phần dùng chung cho các app của bệnh viện (PWA thuần HTML/CSS/JS, không cần cài thêm gì).

## Dùng nhanh
```html
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="ui-kit/themes.css">      <!-- đổi màu app hiện tại -->
<link rel="stylesheet" href="ui-kit/components.css">  <!-- thêm thành phần mới (tiền tố uk-) -->
<html data-theme="teal" data-mode="sang" data-density="rong">
```
Xem thử toàn bộ: mở `ui-kit/demo.html` (có chọn màu, sáng/tối, rộng/gọn).

## 3 núm chỉnh (đặt trên thẻ `<html>`)
| Thuộc tính | Giá trị | Ghi chú |
|---|---|---|
| `data-theme` | `la` (như app hiện tại), `duong`, `teal`, `tim`, `cam`, `xam`, `tuongphan` | `tuongphan` = tương phản cao cho người lớn tuổi |
| `data-mode` | `sang`, `toi` | thêm màu cảnh báo sáng hơn khi nền tối |
| `data-density` | `rong`, `gon` | `gon` cho màn hình bảng nhiều dòng |

`themes.css` dùng đúng tên biến của `style.css` (`--bg --card --tx --mut --pri --pri2 --soft --gold --line --red --amb --grn --blue --sh`). Nạp sau `style.css` thì app đổi màu mà không phải sửa bố cục. Lưu ý: `style.css` hiện còn vài màu xanh lá viết cứng (header, thanh dưới, nút); muốn đổi hết cần thay các màu đó bằng `var(--pri2)`, `var(--pri)`.

## Thành phần có sẵn (`components.css`)
`uk-btn` (`uk-sec`, `uk-ghost`, `uk-danger`, `uk-block`) · `uk-chip` · `uk-dot` · `uk-seg` · `uk-stat` · `uk-grid` · `uk-list`/`uk-li`/`uk-avatar` · `uk-progress` · `uk-tablewrap`/`uk-table` · `uk-alert` · `uk-switch` · `uk-empty` · `uk-skel` · `uk-sheet` · `uk-fab` · `uk-steps` · `uk-hero`

## Quy tắc thiết kế (tóm từ thực hành UX phổ biến)
1. Vùng bấm tối thiểu 44 px; nút chính chỉ một nút mỗi màn hình.
2. Chữ thường tối thiểu 14 px; nội dung chính 16 px. Tương phản chữ/nền ≥ 4,5:1 (đã kiểm khi chọn màu).
3. Không dùng màu làm tín hiệu duy nhất: trạng thái luôn kèm chữ hoặc chấm `uk-dot` + nhãn.
4. Có sẵn trạng thái trống (`uk-empty`) và đang tải (`uk-skel`) cho mọi danh sách.
5. Bảng nhiều cột bọc `uk-tablewrap` để cuộn ngang trên điện thoại.
6. Hộp thoại trên điện thoại dùng `uk-sheet` (trượt từ dưới lên) thay cho cửa sổ giữa màn hình.
7. Tôn trọng `prefers-reduced-motion` (đã tắt hoạt ảnh).
8. Màu hợp ngữ cảnh: `la`/`teal`/`duong` cho khu y tế, `tim`/`xam` cho hành chính, `tuongphan` khi dùng ngoài trời.

## Thêm giao diện mới
Copy một khối trong `themes.css`, đổi `data-theme="..."`, đặt `--pri` (nút, chữ nhấn) có tương phản ≥ 4,5:1 với chữ trắng; thêm dòng `[data-mode="toi"][data-theme="..."]` với màu sáng hơn cho chế độ tối; thêm vào ô chọn của `demo.html`.

Nguồn tham khảo ý tưởng: kho [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT). Bộ này viết lại riêng, không sao chép dữ liệu từ kho đó.
