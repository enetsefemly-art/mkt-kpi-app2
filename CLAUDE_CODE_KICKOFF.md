# CLAUDE CODE KICKOFF — PAS Module

**Document này dùng để làm gì:**
Đây là **các câu lệnh** bạn paste vào Claude Code (theo thứ tự) để khởi động project PAS. Mỗi câu lệnh là một "prompt" đã được tối ưu để Claude Code hiểu đúng ý và làm đúng việc.

**Cách dùng:**
1. Mở Claude Code (đã kết nối với folder code KPI app)
2. Copy nguyên văn từng câu lệnh dưới đây
3. Paste vào Claude Code, gõ Enter
4. Đọc response → làm theo hướng dẫn
5. Chuyển sang câu lệnh tiếp theo

**Không nên:**
- Bỏ qua câu lệnh giữa chừng (đọc lướt cũng được, nhưng đừng skip)
- Tự ý sửa câu lệnh (đã được tối ưu rồi)
- Paste 2-3 câu lệnh cùng lúc (làm tuần tự)

---

## ⏸️ Trước khi bắt đầu — checklist

Trước khi paste câu lệnh số 1, đảm bảo:

- [ ] Đã cài Claude Code desktop app
- [ ] Đã mở Claude Code, chọn folder code KPI app làm working directory
- [ ] Đã chạy thử Bước E và F trong hướng dẫn cài đặt (test "Hello Claude Code")
- [ ] File `PRD_PAS_MVP_v3.md` đã có trong project (Claude Code đọc được)
- [ ] File `IMPLEMENTATION_PLAN_PAS.md` đã có trong project
- [ ] Supabase staging đã setup xong (Project URL + anon key lưu trong `.env.staging`)
- [ ] GitHub đã xác thực (Claude Code chạy `gh auth status` không báo lỗi)

Nếu thiếu cái nào, dừng lại làm cái đó trước.

---

## 🎯 PROMPT 1 — Onboard Claude Code vào project

Câu lệnh đầu tiên là để Claude Code "đọc" project, hiểu context, và xác nhận sẵn sàng.

**Paste nguyên văn vào Claude Code:**

```
Tôi sẽ làm project gắn module PAS vào web app KPI hiện tại. Bạn sẽ là dev chính, tôi là PO không biết code.

Trước khi bắt đầu, hãy onboard vào project bằng cách đọc các file sau (theo đúng thứ tự):

1. PRD_PAS_MVP_v3.md - tài liệu yêu cầu chi tiết
2. IMPLEMENTATION_PLAN_PAS.md - kế hoạch thi công từng Sprint
3. README.md - thông tin chung project KPI
4. package.json - hiểu stack
5. src/App.tsx - hiểu cấu trúc routing
6. src/lib/dataAccess.ts - học pattern query data
7. src/lib/permissions.ts - học permission pattern
8. src/lib/uuid.ts - học shouldApplyUuidFilter pattern
9. src/lib/activityLogger.ts - học activity log pattern
10. src/lib/alertEngine.ts - sẽ mở rộng cho PAS
11. src/lib/notificationEngine.ts - sẽ mở rộng cho PAS
12. src/lib/digestEngine.ts - sẽ mở rộng cho PAS
13. supabase/migrations/003_kpi_permissions.sql - học RLS pattern
14. src/app/app/kpis/[kpiId]/page.tsx - file sẽ thêm tab Related Problems
15. src/lib/kpiMath.ts và src/lib/kpiProgress.ts - SACRED FILES, không được sửa

Sau khi đọc xong, in ra cho tôi:

A. Tóm tắt 5 dòng về project KPI hiện tại (stack, tính năng chính, trạng thái)

B. Tóm tắt 5 dòng về PAS module sẽ làm

C. Confirm bạn đã hiểu các nguyên tắc bất khả xâm phạm:
   1. Không sửa schema bảng kpis, kpi_items
   2. Không sửa logic trong kpiMath.ts, kpiProgress.ts
   3. Mọi bảng PAS dùng workspace_id + soft delete + created_at/updated_at/deleted_at
   4. Mọi query PAS dùng shouldApplyUuidFilter pattern
   5. RLS policies theo style migration 003
   6. Reuse alertEngine, notificationEngine, digestEngine, activityLogger - chỉ THÊM không sửa logic cũ
   7. Feature flag pas_enabled per workspace, default false
   8. Mọi việc lớn → giải thích trước, đợi tôi confirm rồi mới làm

D. Liệt kê 3 câu hỏi clarify nếu có

ĐỪNG sửa hoặc tạo file nào hết. Chỉ đọc và tóm tắt.
```

**Sau khi paste:**

- Đọc kỹ phản hồi của Claude Code
- Nếu nó hỏi clarify (mục D) → trả lời từng câu
- Nếu nó báo không tìm thấy file nào trong list → kiểm tra lại file có trong project chưa
- Nếu nó tóm tắt đúng project → sang Prompt 2

---

## 🎯 PROMPT 2 — Verify môi trường dev

Đảm bảo máy có đủ tool + GitHub kết nối ổn.

**Paste:**

```
Trước khi vào Sprint 0, verify môi trường dev của tôi:

1. Kiểm tra các tool và in version:
   - node --version (yêu cầu >= 20)
   - npm --version
   - git --version
   - gh --version (GitHub CLI)
   - gh auth status (xác thực GitHub OK chưa)

2. Kiểm tra Supabase CLI có cài chưa:
   - supabase --version
   - Nếu chưa có, hướng dẫn tôi cài

3. Kiểm tra trạng thái Git của project:
   - git branch --show-current (đang ở branch nào)
   - git status (có file thay đổi chưa commit không)
   - git log --oneline -5 (5 commit gần nhất)

4. Verify Vite chạy được:
   - npm install (nếu chưa)
   - npm run lint (TypeScript build OK không)

In kết quả từng bước. Nếu có vấn đề ở bước nào, dừng lại báo tôi, đừng tự fix.
```

**Sau khi paste:**

- Mọi check PASS → sang Prompt 3
- Có check FAIL → làm theo hướng dẫn fix, paste lại Prompt 2 cho đến khi pass

---

## 🎯 PROMPT 3 — Khởi động Sprint 0

Bắt đầu việc thật. Tạo branch Sprint 0 và tóm tắt 3 việc sẽ làm.

**Paste:**

```
Tôi quyết định làm Sprint 0 (dọn nợ kỹ thuật) trước khi gắn PAS.

Đọc lại:
- IMPLEMENTATION_PLAN_PAS.md section 3 (Sprint 0)
- PRD_PAS_MVP_v3.md section 18 (Sprint 0 description)
- supabase/migrations/001_fix_profiles_rls.sql
- src/app/app/layout.tsx (đặc biệt lines 30-50)
- 3 file rác: fix_uuid.js, rewrite.js, test_supabase.js (chỉ liếc nội dung)

Sau khi đọc:

Bước 1: Tạo branch mới tên 'chore/sprint-0-cleanup' từ main. Push branch lên GitHub.

Bước 2: In ra cho tôi tóm tắt 3 việc Sprint 0 sẽ làm:
   - Việc 1: Fix RLS profiles - giải thích recursion ở dòng nào, hướng fix
   - Việc 2: Bỏ fallback giả role director - copy đoạn code hiện tại + đoạn đề xuất thay
   - Việc 3: Xóa 3 file rác - liệt kê đúng tên file, kèm 1 dòng confirm nội dung không cần thiết

Bước 3: Đợi tôi xác nhận. Khi tôi gõ "tiếp tục với Việc 1", bạn mới bắt đầu sửa code.

ĐỪNG sửa file nào ở bước 2 và 3. Chỉ tóm tắt.
```

**Sau khi paste:**

- Đọc tóm tắt 3 việc
- Có thể hỏi lại: *"Trong Việc 1, đoạn 'recursion' nghĩa là gì? Giải thích đơn giản."*
- Khi đã hiểu, gõ: `tiếp tục với Việc 1`

---

## 🎯 PROMPT 4 — Việc 1: Fix RLS profiles

**Paste:**

```
Tiếp tục với Việc 1: Fix RLS profiles.

Tạo file migration mới '010_fix_profiles_rls_v2.sql' (số 010 vì 004-009 sẽ dành cho PAS).

File phải có:
1. Comment block ở đầu file ghi rõ:
   - Mục đích: fix recursion trong RLS profiles
   - Ngày tạo
   - Liên kết tới migration 001_fix_profiles_rls.sql (file gốc bị lỗi)

2. SQL DROP POLICY cho tất cả policy cũ của bảng profiles (theo migration 001)

3. SQL CREATE POLICY mới, fix recursion bằng cách dùng auth.uid() trực tiếp thay vì SELECT trong policy

4. Comment block ở cuối file ghi cách rollback (DROP POLICY mới + CREATE lại policy cũ từ 001)

KHÔNG chạy migration lên Supabase. Chỉ tạo file SQL trong supabase/migrations/.

Sau khi tạo file, in ra:
A. Đường dẫn file vừa tạo
B. Tóm tắt thay đổi (3-5 dòng)
C. Hướng dẫn tôi cách test trên Supabase staging trước khi commit
```

**Sau khi paste:**

- Đọc file SQL trong code, đảm bảo hiểu sơ bộ
- Test trên Supabase staging:
  1. Vào Supabase staging Dashboard → SQL Editor
  2. Copy nội dung file `010_fix_profiles_rls_v2.sql` → paste → Run
  3. Nếu lỗi, paste error message vào Claude Code
  4. Nếu success, đăng nhập app (đổi `.env.staging` → `.env.local`) với 2-3 user khác role → test load profile
- Test OK → quay lại Claude Code:

**Paste tiếp:**

```
Đã test migration 010_fix_profiles_rls_v2.sql trên Supabase staging, mọi user role load profile bình thường.

Commit file vào branch chore/sprint-0-cleanup với message:
"chore(rls): fix profiles RLS recursion - migration 010"

Sau commit, push lên GitHub. Đừng tạo PR vội, chờ làm xong Việc 2 và 3 rồi mới tạo PR chung.
```

---

## 🎯 PROMPT 5 — Việc 2: Bỏ fallback giả role

**Paste:**

```
Sang Việc 2: Bỏ fallback giả role 'director' trong src/app/app/layout.tsx.

Đọc kỹ file src/app/app/layout.tsx. Tìm đoạn try-catch trong useEffect (khoảng lines 20-50) nơi nếu getMyProfile() fail thì setUserProfile với role: 'director'.

Đề xuất 2 cách fix, in ra cho tôi chọn:

Cách A: Redirect về login nếu load profile fail
   - Pros: An toàn nhất, đảm bảo user phải có profile hợp lệ mới vào app
   - Cons: Nếu lỗi tạm thời (network blip) thì user bị đá ra ngoài

Cách B: Hiển thị error screen "Không tải được profile" với nút Retry
   - Pros: User-friendly hơn, có chance retry
   - Cons: Thêm component error screen mới

Cách C: Hỗn hợp - retry 2 lần, fail thì redirect về login
   - Pros: Cân bằng giữa A và B
   - Cons: Code phức tạp hơn 1 chút

Giải thích chi tiết hơn 3 cách + recommend cách nào cho project PAS. Đợi tôi chọn.

ĐỪNG sửa file. Chỉ giải thích.
```

**Sau khi paste:**

- Đọc 3 lựa chọn
- Chọn 1 cách (nếu phân vân, theo recommend của Claude Code)
- Paste tiếp:

```
Chọn Cách [A/B/C].

Bây giờ:
1. Sửa src/app/app/layout.tsx theo cách đã chọn
2. Nếu cần component mới (ProfileErrorScreen.tsx hay tương tự), tạo trong src/components/app-state/
3. Đảm bảo TypeScript build OK (chạy npm run lint sau khi sửa)
4. Commit vào branch hiện tại với message: "chore(layout): remove fake director role fallback, use [chosen approach]"
```

---

## 🎯 PROMPT 6 — Việc 3: Xóa 3 file rác

**Paste:**

```
Sang Việc 3: Xóa 3 file rác ở root.

Trước khi xóa, xem nhanh nội dung 3 file:
- fix_uuid.js
- rewrite.js
- test_supabase.js

Confirm cho tôi:
- 3 file này đều là utility script cũ
- Không được import bởi bất kỳ file nào trong src/ hoặc supabase/
- Không có trong package.json scripts

Sau khi confirm, xóa 3 file + commit với message: "chore: remove obsolete root utility scripts".
```

---

## 🎯 PROMPT 7 — Tạo Pull Request Sprint 0

**Paste:**

```
Cả 3 việc Sprint 0 đã xong trên branch chore/sprint-0-cleanup.

Bây giờ:
1. Push branch lên GitHub (nếu chưa push)
2. Tạo Pull Request từ chore/sprint-0-cleanup vào main
3. Tiêu đề PR: "chore: Sprint 0 cleanup - fix RLS, remove fake role, cleanup root"
4. Mô tả PR theo template:

## Mục đích
Dọn nợ kỹ thuật trước khi gắn module PAS, theo PRD v3 section 18.

## Thay đổi
- ✅ Fix RLS profiles recursion (migration 010_fix_profiles_rls_v2.sql)
- ✅ Bỏ fallback giả role 'director' trong layout.tsx (dùng Cách [A/B/C])
- ✅ Xóa 3 file rác ở root: fix_uuid.js, rewrite.js, test_supabase.js

## Test đã chạy
- Migration 010 chạy thành công trên Supabase staging
- Đăng nhập 3 user khác role (director, manager, member) trên staging - OK
- npm run lint - OK

## Migration cần chạy trên production
File migration 010_fix_profiles_rls_v2.sql cần chạy thủ công trên Supabase production sau khi merge PR này.

## Liên kết
- PRD: PRD_PAS_MVP_v3.md section 18
- Plan: IMPLEMENTATION_PLAN_PAS.md section 3

Sau khi tạo PR, in link PR cho tôi.
```

**Sau khi paste:**

- Vào link PR Claude Code đưa
- Đọc tab "Files changed", check 4 file (migration, layout.tsx, có thể có component mới)
- Đợi Vercel deploy preview (~2-3 phút)
- Mở preview link, đăng nhập 2-3 user khác role
- Nếu app chạy bình thường → bấm **Merge pull request**
- Nếu lỗi → paste error vào Claude Code: *"Preview deploy bị lỗi: <error>. Hãy debug."*

---

## 🎯 PROMPT 8 — Chạy migration trên production

⚠️ Đây là bước **BẠN PHẢI TỰ LÀM** trên Supabase Dashboard. Claude Code không có quyền chạy SQL lên production.

**Quy trình:**

1. Mở Supabase production Dashboard
2. Vào **SQL Editor** → **New query**
3. Mở file `supabase/migrations/010_fix_profiles_rls_v2.sql` trong code (hoặc lấy từ PR đã merge)
4. Copy toàn bộ nội dung → paste vào SQL Editor
5. Bấm **Run**
6. Verify: Database → Policies → bảng `profiles` → check policy mới đã active

**Sau đó verify trên app production:**

- Đăng nhập production với 2-3 user khác role
- Đảm bảo mọi thứ chạy bình thường (KPI page, dashboard, v.v.)

**Quay lại Claude Code:**

```
Đã chạy migration 010 trên Supabase production thành công.
Đã verify 3 user role trên production - OK.

Sprint 0 hoàn thành. Tóm tắt cho tôi:
1. Những gì đã làm trong Sprint 0
2. Trạng thái hiện tại (branch, commits, deployments)
3. Bước tiếp theo: bắt đầu Setup (tạo branch feat/pas-module + feature flag)
```

---

## 🎯 PROMPT 9 — Setup branch chính cho PAS

**Paste:**

```
Sprint 0 OK. Giờ làm bước Setup (tạo môi trường thi công PAS).

Theo IMPLEMENTATION_PLAN_PAS.md section 4, làm 2 việc:

Việc 1: Tạo branch 'feat/pas-module' từ main.
- Đảm bảo main đã pull về và up-to-date (vì vừa merge Sprint 0)
- Tạo branch mới từ main
- Push lên GitHub

Việc 2: Tạo migration 004_pas_feature_flag.sql:
- Trên branch feat/pas-module
- ALTER TABLE workspaces ADD COLUMN pas_enabled BOOLEAN DEFAULT FALSE NOT NULL
- Comment header + rollback ở cuối file
- Tạo PR từ branch nhỏ 'feat/pas-feature-flag' → feat/pas-module (không vào main)
- Tiêu đề PR: "feat(pas): add pas_enabled feature flag to workspaces"

Sau khi tạo PR, in link cho tôi review.
```

**Quy trình:**

1. Claude Code tạo branch + PR
2. Bạn review PR, merge vào `feat/pas-module`
3. Chạy migration 004 trên Supabase production:
   ```sql
   ALTER TABLE workspaces ADD COLUMN pas_enabled BOOLEAN DEFAULT FALSE NOT NULL;
   ```
4. Verify trên Supabase: Table Editor → workspaces → có cột `pas_enabled = false` ở mọi row

---

## 🎯 PROMPT 10 — Khởi động Sprint 1

Đây là prompt vào Sprint 1. Tôi không viết hết các prompt của Sprint 1-4 vì sẽ rất dài, và Claude Code sẽ tự đề xuất prompt cho từng PR. Dưới đây là prompt khởi động Sprint 1.

**Paste:**

```
Sprint 0 và Setup đã xong. Branch feat/pas-module đã có feature flag pas_enabled.

Bắt đầu Sprint 1 — Đặt móng PAS (Foundation: DB + Permission + Access Layer).

Đọc lại:
- PRD_PAS_MVP_v3.md, đặc biệt:
  * Section 8 (Object Model) - schema 10 bảng PAS
  * Section 18 (Sprint 1 PR list)
  * Section 19 (File & Folder Mapping)
  * Section 21 (Technical Notes)
- IMPLEMENTATION_PLAN_PAS.md section 5 (Sprint 1)
- supabase/migrations/003_kpi_permissions.sql (RLS reference)

Sau khi đọc, in ra:

A. Tóm tắt 10 bảng PAS sẽ tạo (mỗi bảng 1 dòng: tên + mục đích)

B. Liệt kê 8 PR Sprint 1 theo thứ tự sẽ làm:
   - PR 1: Migration 005 - Taxonomy tables (problem_types, root_cause_types, mapping)
   - PR 2: Migration 006 - Core tables (problems, root_causes, actions, results, evaluations)
   - PR 3: Migration 007 - Solution Pattern table
   - PR 4: Migration 008 - RLS policies cho mọi bảng PAS
   - PR 5: Migration 009 - Seed taxonomy data
   - PR 6: src/lib/pas/*.ts - access layer (problemAccess, rootCauseAccess, actionAccess, taxonomyAccess)
   - PR 7: src/lib/pas/*.ts - access layer phần 2 (resultAccess, evaluationAccess, patternAccess)
   - PR 8: Mở rộng src/lib/permissions.ts với helper PAS

C. Câu hỏi clarify (nếu có):
   - Có quyết định nào trong PRD section 23 tôi muốn override không?
   - Có thay đổi seed taxonomy không (so với PRD section 8.2 và 8.4)?

ĐỪNG tạo file nào hết. Chỉ tóm tắt và đợi tôi confirm.

Sau khi tôi gõ "bắt đầu PR 1", bạn mới làm PR đầu tiên.
```

**Sau khi đọc tóm tắt:**

- Trả lời câu hỏi clarify (nếu có)
- Gõ `bắt đầu PR 1`

Từ đây, Claude Code sẽ tự đề xuất prompt cho từng PR. Bạn theo flow:
1. Đọc đề xuất của Claude Code cho PR đó
2. Confirm hoặc điều chỉnh
3. Để Claude Code làm PR
4. Review PR trên GitHub
5. Merge vào `feat/pas-module`
6. Bảo Claude Code: `tiếp tục PR tiếp theo`

---

## 📌 Prompts tiện ích hay dùng

Sau Sprint 1, các Sprint sau sẽ theo flow tương tự. Dưới đây là prompt mẫu dùng được mọi lúc.

### Khi không nhớ đang ở đâu

```
Cho tôi xem status hiện tại:
1. Đang ở Sprint nào, PR nào
2. Branch hiện tại
3. Các file đã thay đổi nhưng chưa commit
4. 5 commit gần nhất trên branch hiện tại
5. PR đang mở trên GitHub (tên + trạng thái)
```

### Khi muốn pause

```
Tôi cần dừng việc này lại. Hãy:
1. Stash các thay đổi đang dở (nếu có)
2. Tóm tắt việc đang dở: làm đến đâu, còn gì
3. Note lại "next step" để khi tôi quay lại biết tiếp tục từ đâu
```

### Khi quay lại sau khi pause

```
Tôi quay lại làm tiếp project PAS.
Đọc lại trạng thái git, kiểm tra stash, đọc note "next step" lần trước.
Tóm tắt cho tôi việc đang dở và next step.
```

### Khi cần test cuối Sprint

```
Sprint [X] đã xong (PR cuối: #YY). Trước khi sang Sprint kế tiếp, viết script test verify:
[liệt kê các tính năng Sprint X cần verify]

Chạy script trên Supabase staging. In kết quả từng bước. Nếu fail ở bước nào, dừng lại debug.
```

### Khi user báo bug

```
User <email/role> báo bug trên production:
- Mô tả: <copy nguyên văn user mô tả>
- URL gặp bug: <URL>
- Steps to reproduce: <copy steps>
- Screenshot/error: <copy hoặc đính kèm>

Hãy:
1. Đọc các file liên quan đến tính năng đó
2. Tìm root cause của bug
3. Đề xuất fix (đừng làm vội)
4. Đợi tôi confirm trước khi tạo PR hotfix
```

### Khi muốn rollback

```
Có vấn đề với [thay đổi gần nhất - mô tả cụ thể].
Đề xuất cách rollback an toàn nhất:
- Cách 1: Revert commit
- Cách 2: Tắt feature flag (nếu là tính năng PAS)
- Cách 3: Tạo PR fix forward thay vì revert

Liệt kê pros/cons từng cách. Đợi tôi quyết. Đừng làm vội.
```

### Khi build/test fail

```
[Build/Test] đang fail. Log lỗi:
<copy full error log vào đây>

Hãy:
1. Phân tích root cause
2. Đề xuất fix
3. Đợi tôi confirm trước khi sửa
```

---

## 🚨 Khi nào DỪNG LẠI hỏi tôi (PO)

Có những lúc Claude Code sẽ phải dừng lại hỏi bạn quyết định. Đây là các tình huống Claude Code **bắt buộc** phải hỏi, không được tự quyết:

1. **Sửa schema bảng KPI cũ** (kpis, kpi_items, kpi_progress) → CẤM tuyệt đối. Báo PO ngay.
2. **Sửa file kpiMath.ts hoặc kpiProgress.ts** → CẤM. Báo PO.
3. **Test scoring-isolation FAIL** → DỪNG Sprint, báo PO.
4. **Migration báo lỗi khi chạy trên production** → DỪNG, báo PO trước khi thử fix.
5. **Phát hiện nguy cơ data loss** (vd: DROP TABLE, DELETE WHERE không có điều kiện) → DỪNG, báo PO.
6. **PR conflict không tự resolve được** → Báo PO.
7. **Tính năng PRD không cover** → Báo PO clarify, đừng tự interpret.
8. **User report bug critical trên production** → Báo PO trước khi hotfix.

Bạn nên paste section này vào Claude Code ở đầu mỗi Sprint mới để nhắc lại:

```
Lưu ý: Tuân thủ section "Khi nào DỪNG LẠI hỏi tôi" trong CLAUDE_CODE_KICKOFF.md. Có 8 tình huống bắt buộc dừng và hỏi PO trước khi làm gì.
```

---

## ✅ Checklist hoàn thành Kickoff

Sau khi paste hết Prompt 1-10, bạn đã:

- [x] Onboard Claude Code vào project
- [x] Verify môi trường dev
- [x] Hoàn thành Sprint 0 (dọn nợ kỹ thuật)
- [x] Chạy migration 010 trên production
- [x] Tạo branch feat/pas-module
- [x] Thêm feature flag pas_enabled
- [x] Khởi động Sprint 1

Từ đây, follow IMPLEMENTATION_PLAN_PAS.md cho các Sprint còn lại. Claude Code sẽ tự đề xuất prompt cho từng PR, bạn chỉ cần review và confirm.

**Chúc bạn thành công với PAS module!**

---

**End of Kickoff Guide**
