# IMPLEMENTATION PLAN — PAS Module

**Document này dùng để làm gì:**
Đây là kế hoạch thi công chi tiết từng tuần để gắn module PAS vào web app KPI hiện tại. Viết cho **PO không biết code**, dùng Claude Code làm dev tool.

**Cách dùng:**
- Đọc qua một lượt trước khi bắt đầu để có hình dung toàn cảnh
- Khi bắt đầu mỗi Sprint, mở section Sprint đó để xem việc cụ thể trong tuần
- Khi không biết hỏi Claude Code thế nào → mục "Câu lệnh mẫu cho Claude Code" trong mỗi Sprint

**Tài liệu kèm theo:**
- `PRD_PAS_MVP_v3.md` — tài liệu mô tả PAS làm gì
- `CLAUDE_CODE_KICKOFF.md` — câu lệnh đầu tiên paste vào Claude Code

---

## 1. Tổng quan timeline

```
Tuần       │ Sprint        │ Việc chính                          │ User thấy gì?
───────────┼───────────────┼─────────────────────────────────────┼──────────────────
Trước S0   │ Chuẩn bị      │ Cài Claude Code, tạo Supabase       │ Không thay đổi
           │               │ staging, đọc PRD                    │
───────────┼───────────────┼─────────────────────────────────────┼──────────────────
Tuần 1     │ Sprint 0      │ Dọn nợ kỹ thuật                     │ Không thay đổi
           │ (recommended) │ (3 việc nhỏ trong KPI)              │
───────────┼───────────────┼─────────────────────────────────────┼──────────────────
Tuần 2-3   │ Sprint 1      │ Móng PAS: DB + Permission           │ Không (chưa UI)
           │               │ + Access layer                      │
───────────┼───────────────┼─────────────────────────────────────┼──────────────────
Tuần 4-5   │ Sprint 2      │ UI cơ bản: list/create/detail       │ Có trên preview
           │               │ Problem                             │ link
───────────┼───────────────┼─────────────────────────────────────┼──────────────────
Tuần 6-7   │ Sprint 3      │ Manager flow + Library + KPI        │ Có trên preview
           │               │ Linkage                             │ link
───────────┼───────────────┼─────────────────────────────────────┼──────────────────
Tuần 8-9   │ Sprint 4      │ Dashboard tích hợp + Analytics      │ Có trên prod
           │               │ + Polish + merge vào main           │ nhưng PAS ẩn
───────────┼───────────────┼─────────────────────────────────────┼──────────────────
Tuần 10    │ Phase 0       │ Training 6 manager, chốt taxonomy   │ Không
           │               │ seed, tạo problem mẫu               │
───────────┼───────────────┼─────────────────────────────────────┼──────────────────
Tuần 11-12 │ Phase 1       │ Bật PAS cho 2 team pilot            │ 2 team thấy PAS
           │ (Pilot)       │                                     │
───────────┼───────────────┼─────────────────────────────────────┼──────────────────
Tuần 13-14 │ Phase 2       │ Bật PAS cho 3 team còn lại          │ 5 team thấy PAS
           │ (Soft)        │                                     │
───────────┼───────────────┼─────────────────────────────────────┼──────────────────
Tuần 15+   │ Phase 3       │ Hard rollout, weekly review chỉ     │ Bình thường
           │ (Hard)        │ dùng PAS                            │
```

**Tổng:** ~3 tháng từ bắt đầu Sprint 0 đến hard rollout.

---

## 2. Trước khi bắt đầu — checklist

Hoàn thành 5 việc sau trước khi gõ câu lệnh đầu tiên vào Claude Code:

- [ ] Đã cài Claude Code trên desktop app
- [ ] Đã kết nối Claude Code với folder code KPI app trên máy
- [ ] Đã xác thực Claude Code với GitHub (`gh auth login` hoặc Personal Access Token)
- [ ] Đã có file `PRD_PAS_MVP_v3.md` trong Project hoặc trên máy
- [ ] Đã tạo Supabase project staging (tách biệt với production)

**Nếu chưa hoàn thành cái nào, dừng lại làm cái đó trước. Đừng nhảy vào Sprint 0.**

### Cách tạo Supabase staging (10 phút, làm 1 lần)

1. Vào https://supabase.com → đăng nhập
2. Click **New Project** → đặt tên `kpi-app-staging` → chọn region gần Việt Nam (Singapore) → set password mạnh, lưu lại
3. Đợi 2-3 phút Supabase setup
4. Vào **Settings → API**, copy 2 giá trị:
   - **Project URL** (kiểu `https://xxx.supabase.co`)
   - **anon public key**
5. Trên máy, vào folder code KPI, tạo file mới `.env.staging`:
   ```
   VITE_SUPABASE_URL="<paste URL staging>"
   VITE_SUPABASE_ANON_KEY="<paste anon key staging>"
   ```
6. Vào **SQL Editor** trong Supabase staging, chạy lần lượt 3 file migration đã có:
   - `supabase/migrations/001_fix_profiles_rls.sql`
   - `supabase/migrations/002_user_management_rls.sql`
   - `supabase/migrations/003_kpi_permissions.sql`
   
   (Mở từng file trong code → copy → paste vào SQL Editor → Run)
7. Tạo bảng cơ bản trên staging (workspaces, profiles, departments, kpis, kpi_items, etc.). Nếu chưa có file SQL khởi tạo, **bảo Claude Code xuất hộ**:
   > *"Đọc tất cả file migration trong supabase/migrations/ và đọc cách các bảng đang được dùng trong src/lib/dataAccess.ts. Tạo cho tôi 1 file SQL `bootstrap_staging.sql` để tạo toàn bộ schema cần thiết để app chạy được trên Supabase staging trống."*

Khi xong, app của bạn có thể chạy với 2 môi trường:
- `npm run dev` → kết nối production (đừng chạy trừ khi cần thiết)
- Tạm thời đổi sang staging bằng cách rename `.env.staging` → `.env.local` khi muốn test

---

## 3. SPRINT 0 — Dọn nợ kỹ thuật (1 tuần)

**Mục tiêu:** Sửa 3 vấn đề trong KPI app hiện tại trước khi gắn PAS, để PAS không kế thừa lỗi.

**Có thể skip không?** Có, nhưng rủi ro authorization gap (đã ghi trong PRD v3 section 18, table risk). Strongly recommended làm.

**Có ai thấy thay đổi không?** Hầu như không. Chỉ là sửa lỗi tiềm ẩn.

### Việc cần làm

#### Việc 1: Fix RLS profiles recursion

Vấn đề: Migration `001_fix_profiles_rls.sql` chưa fix triệt để policy. Triệu chứng: thỉnh thoảng load profile bị lỗi, hệ thống tự "giả vờ" user là director.

#### Việc 2: Bỏ fallback giả role 'director'

File `src/app/app/layout.tsx` lines 36-43 đang có đoạn:
```typescript
setUserProfile({
  user_id: session.user.id,
  full_name: session.user.email?.split('@')[0] || 'Unknown',
  function: '',
  role: 'director',  // ← NGUY HIỂM
  email: session.user.email || ''
});
```

Khi PAS dùng `myProfile.role` để check quyền (ví dụ `canEvaluateAction`), nếu user gặp lỗi load profile thì sẽ bị fake thành director → thấy menu Manager dù chỉ là member.

#### Việc 3: Xóa 3 file rác ở root

`fix_uuid.js`, `rewrite.js`, `test_supabase.js` — utility cũ không dùng, làm bẩn repo.

### Quy trình thi công với Claude Code

**Bước 3.0.1: Tạo branch Sprint 0**

Câu lệnh đầu tiên paste vào Claude Code:

> ```
> Tôi chuẩn bị bắt đầu Sprint 0 cho project PAS. Đọc các file sau để có context:
> - PRD_PAS_MVP_v3.md (đặc biệt section 18 — Sprint 0)
> - supabase/migrations/001_fix_profiles_rls.sql
> - src/app/app/layout.tsx
> 
> Sau đó:
> 1. Tạo branch mới tên 'chore/sprint-0-cleanup' từ main
> 2. Tóm tắt cho tôi 3 việc Sprint 0 sẽ làm, mỗi việc 2-3 dòng
> 3. Đợi tôi xác nhận rồi mới bắt đầu Việc 1
> 
> ĐỪNG sửa file nào hết cho đến khi tôi nói "tiếp tục".
> ```

Claude Code sẽ tóm tắt và đợi. Bạn đọc tóm tắt, hỏi lại nếu chưa hiểu, rồi gõ "tiếp tục".

**Bước 3.0.2: Làm Việc 1 — Fix RLS**

> ```
> Bắt đầu Việc 1: Fix RLS profiles.
> 
> Trước khi sửa, giải thích cho tôi:
> (a) Hiện tại RLS profiles bị recursion ở chỗ nào (chỉ dòng cụ thể)
> (b) Cách fix bạn đề xuất là gì
> (c) Rủi ro tiềm ẩn nếu fix
> 
> Sau khi tôi xác nhận, tạo file migration mới '010_fix_profiles_rls_v2.sql' (chừa số 004-009 cho PAS). Trong file phải có:
> - SQL DROP các policy cũ bị lỗi
> - SQL CREATE policy mới đã fix
> - Comment rollback ở cuối file
> 
> ĐỪNG chạy migration lên Supabase. Chỉ tạo file. Tôi sẽ tự test trên staging trước.
> ```

Sau khi có file → bạn vào Supabase Dashboard **staging** (không phải production) → SQL Editor → chạy file `010_fix_profiles_rls_v2.sql`. Test xem có lỗi không. Đăng nhập app staging vài user xem có gì khác lạ.

Nếu OK trên staging → quay lại Claude Code:
> ```
> Đã test trên staging OK. Giờ commit file migration vào branch chore/sprint-0-cleanup, message theo conventional commits.
> ```

**Bước 3.0.3: Làm Việc 2 — Bỏ fallback giả role**

> ```
> Sang Việc 2: Bỏ fallback giả role 'director' trong src/app/app/layout.tsx.
> 
> Đọc file đó. Tìm đoạn catch error rồi setUserProfile với role: 'director'.
> 
> Đề xuất cách xử lý: thay vì fake role, nên redirect về login hoặc hiện error screen "Không tải được profile, vui lòng thử lại". Cho tôi xem code thay đổi đề xuất trước khi sửa.
> ```

Đọc code đề xuất → nếu OK bảo "tiếp tục" → Claude Code sửa file → commit.

**Bước 3.0.4: Làm Việc 3 — Xóa file rác**

> ```
> Sang Việc 3: Xóa 3 file utility ở root: fix_uuid.js, rewrite.js, test_supabase.js. Đọc qua nội dung 3 file đó trước khi xóa để chắc chắn không có gì quan trọng. Commit thay đổi.
> ```

**Bước 3.0.5: Push lên GitHub + tạo Pull Request**

> ```
> Push branch chore/sprint-0-cleanup lên GitHub. Tạo Pull Request vào main với:
> - Tiêu đề: "chore: Sprint 0 cleanup - fix RLS recursion, remove fake role fallback, cleanup root files"
> - Mô tả: liệt kê 3 việc đã làm, có link tới PRD v3 section 18
> ```

**Bước 3.0.6: Review PR và merge**

- Vào GitHub, mở PR vừa tạo
- Đọc qua các file thay đổi (tab "Files changed")
- Đợi Vercel preview deploy (~2-3 phút)
- Mở preview link → đăng nhập 2-3 user khác role → kiểm tra app không bị vỡ
- Nếu OK → bấm **Merge pull request**
- Sau merge, Vercel auto deploy lên production
- Vào production thử lại lần nữa với 1-2 user

**Bước 3.0.7: Chạy migration trên production**

⚠️ **QUAN TRỌNG:** Sau khi merge code, **bạn vẫn cần tự tay chạy migration SQL lên Supabase production** (Claude Code không tự làm vì cần admin access).

1. Mở Supabase Dashboard **production**
2. SQL Editor → New query
3. Copy nội dung file `supabase/migrations/010_fix_profiles_rls_v2.sql` → paste → Run
4. Verify: vào Table Editor → profiles → Policies → xem policy đã đúng chưa

**Kết thúc Sprint 0:** Đăng nhập app production với 2-3 user khác role, đảm bảo mọi thứ vẫn chạy ngon. Nếu có vấn đề → bảo Claude Code revert: *"Có vấn đề với Sprint 0. Hãy tạo PR revert merge commit XYZ và rollback migration."*

---

## 4. SETUP — Tạo môi trường thi công PAS (1 ngày)

Sau Sprint 0 ổn, làm bước setup này 1 lần duy nhất trước khi vào Sprint 1.

### Việc 1: Tạo branch chính cho PAS

> ```
> Tạo branch mới tên 'feat/pas-module' từ main. Đây sẽ là branch tích lũy toàn bộ code PAS. Mọi PR PAS sau này sẽ merge vào branch này, không merge thẳng vào main. Khi cả module xong và stable, ta merge 1 PR lớn từ feat/pas-module → main.
> 
> Push branch lên GitHub luôn.
> ```

### Việc 2: Thêm feature flag pas_enabled

> ```
> Trên branch feat/pas-module, tạo migration mới '004_pas_feature_flag.sql' để:
> - ALTER TABLE workspaces ADD COLUMN pas_enabled BOOLEAN DEFAULT FALSE NOT NULL;
> - Comment rollback ở cuối file
> 
> Sau đó tạo PR vào feat/pas-module (không vào main). Tiêu đề PR: "feat(pas): add pas_enabled feature flag to workspaces table".
> ```

Bạn review PR → merge vào `feat/pas-module`.

Sau đó tự tay chạy migration trên Supabase **production** (Settings → SQL Editor).

---

## 5. SPRINT 1 — Đặt móng PAS (2 tuần)

**Mục tiêu:** Tạo database, permission, lớp truy xuất dữ liệu. **Không có UI.**

**User thấy gì?** Không có gì. Đây là phần "móng nhà".

**Bạn cần làm gì?**
- Review 8 PR Claude Code tạo (xem section 18 của PRD v3 cho danh sách chính xác)
- Sau mỗi PR: đọc giải thích → review code trên GitHub → merge vào `feat/pas-module`
- Sau Sprint: test CRUD bằng Supabase Dashboard hoặc bảo Claude Code viết script test

### Quy trình thi công

**Câu lệnh khởi động Sprint 1:**

> ```
> Bắt đầu Sprint 1 của PAS module.
> 
> Đọc các file sau để có context:
> - PRD_PAS_MVP_v3.md, đặc biệt:
>   * Section 8 (Object Model)
>   * Section 18 (Sprint 1 PR list)
>   * Section 19 (File & Folder Mapping)
>   * Section 21 (Technical Notes)
> - supabase/migrations/003_kpi_permissions.sql (để học RLS pattern)
> - src/lib/dataAccess.ts (để học query pattern)
> - src/lib/uuid.ts (shouldApplyUuidFilter helper)
> - src/lib/permissions.ts (helper pattern)
> - src/lib/activityLogger.ts (activity log pattern)
> 
> Sau khi đọc xong, tóm tắt cho tôi:
> 1. Cấu trúc bảng PAS bạn sẽ tạo (10 bảng theo PRD section 8)
> 2. 8 PR Sprint 1 (theo PRD section 18) — mỗi PR 1 dòng mô tả
> 3. Thứ tự làm các PR và lý do
> 4. Câu hỏi clarify (nếu có)
> 
> ĐỪNG tạo file nào hết. Chỉ tóm tắt và đợi tôi confirm.
> ```

Bạn đọc tóm tắt → hỏi lại nếu có gì không hiểu → bảo "tiếp tục với PR 1".

**Sau mỗi PR Claude Code làm:**

1. Đọc giải thích nó đưa
2. Vào GitHub, mở PR
3. Đọc qua các file thay đổi (đặc biệt file `.sql`)
4. Hỏi lại nếu phân vân: *"Trong file XYZ, dòng ABC nghĩa là gì? Có rủi ro gì không?"*
5. Nếu OK → bấm **Merge** vào `feat/pas-module`
6. Sau merge, bảo Claude Code: *"Tiếp tục PR tiếp theo."*

### Kiểm tra cuối Sprint 1

Sau khi cả 8 PR merge vào `feat/pas-module`:

> ```
> Sprint 1 đã xong. Viết cho tôi 1 script test (file .ts hoặc câu lệnh SQL) để verify:
> 
> 1. Tạo 1 workspace test, set pas_enabled = true
> 2. Tạo 1 problem trong workspace đó
> 3. Tạo 2 root_cause cho problem đó, 1 cái is_primary
> 4. Tạo 1 action gắn với root_cause primary
> 5. Tạo 1 result cho action
> 6. Tạo 1 evaluation Pass cho action
> 7. Verify: SELECT để xem dữ liệu có đúng không, soft delete có hoạt động không
> 8. Check activity_logs có log đủ events không
> 
> Chạy script này trên Supabase staging, in ra kết quả từng bước.
> ```

Nếu test pass → Sprint 1 OK. Nếu fail ở bước nào → bảo Claude Code debug bước đó.

⚠️ **Đừng quên chạy migrations trên Supabase production** (chỉ những migration đã merge vào `feat/pas-module`). Cụ thể: 005_pas_taxonomy.sql → 009_pas_seed_taxonomy.sql.

Vì PAS chưa có UI và `pas_enabled = false` mặc định, dù chạy migration lên production cũng **không user nào thấy gì**. An toàn.

### Thời gian dự kiến Sprint 1

| Hoạt động | Thời gian |
|---|---|
| Claude Code làm 8 PR | 1-1.5 tuần (Claude Code làm nhanh, bottleneck là review) |
| Bạn review + merge | 30 phút mỗi PR × 8 = 4 giờ tổng |
| Test cuối Sprint | 2-3 giờ |
| Buffer fix bug | 1-2 ngày |

---

## 6. SPRINT 2 — Giao diện cơ bản (2 tuần)

**Mục tiêu:** Có thể tạo Problem, Root Cause, Action qua giao diện thật.

**User thấy gì?** Lần đầu tiên thấy PAS trên màn hình — **nhưng chỉ qua preview link Vercel** (chưa lên production cho user thật).

### Quy trình thi công

**Câu lệnh khởi động Sprint 2:**

> ```
> Bắt đầu Sprint 2 của PAS module.
> 
> Đọc các file sau để có context:
> - PRD_PAS_MVP_v3.md, section 9 (Core User Flows), section 18 (Sprint 2 PR list), section 19 (File & Folder Mapping)
> - src/app/app/kpis/page.tsx (học style list page)
> - src/app/app/kpis/[kpiId]/page.tsx (học style detail page)
> - src/app/app/initiatives/page.tsx (học pattern create form)
> - src/components/app-state/* (reuse components)
> - src/lib/uiText.ts (text Việt hóa)
> 
> Tóm tắt cho tôi 6 PR Sprint 2 và đợi confirm trước khi làm PR 9.
> ```

Lặp lại quy trình review → merge từng PR như Sprint 1.

### Lưu ý quan trọng Sprint 2

**Preview link Vercel:** Mỗi PR Claude Code push lên GitHub, Vercel tự build 1 preview URL kiểu `pas-preview-abc.vercel.app`. Cách tìm:
1. Vào PR trên GitHub
2. Cuộn xuống mục "Checks"
3. Tìm dòng "Vercel" → click "Visit Preview"

**Test thực tế ở preview:**
- Đăng nhập với 1 user role Director → tạo Problem
- Đăng nhập với 1 user role Manager → đánh giá Action
- Đăng nhập với 1 user role Member → tạo Problem cho mình
- Kiểm tra phân quyền: Member không được thấy Pending Evaluations của Manager

**Mời 1 manager-champion vào xem preview:**
Cuối tuần Sprint 2, gửi link preview cho 1 manager bạn tin tưởng:
> "Anh/chị thử vào link này, đăng nhập bằng tài khoản đã cấp, thử tạo 1-2 problem giả lập. Sau đó cho tôi feedback về 3 thứ:
> 1. Tạo Problem có dễ không?
> 2. Có chỗ nào không hiểu mục đích không?
> 3. Field nào thừa, field nào thiếu?"

Feedback của manager-champion ở giai đoạn này quý hơn 10 lần bạn tự đoán.

---

## 7. SPRINT 3 — Manager flow + Library + KPI Linkage (2 tuần)

**Mục tiêu:** Hoàn thiện quy trình PAS (Evaluation → Library) + Tích hợp với KPI Detail.

**Bước CRITICAL trong Sprint này:** **Test scoring-isolation**. Đây là test bảo vệ KPI không bị PAS làm hỏng.

### Quy trình thi công

> ```
> Bắt đầu Sprint 3.
> 
> Đọc:
> - PRD_PAS_MVP_v3.md, section 16 (KPI Linkage), section 17.6 (Acceptance KPI Linkage), section 18 (Sprint 3 PR list)
> - src/app/app/kpis/[kpiId]/page.tsx (file bạn sẽ thêm tab Related Problems vào)
> - src/lib/kpiMath.ts (file KHÔNG ĐƯỢC ĐỘNG)
> - src/lib/kpiProgress.ts (file KHÔNG ĐƯỢC ĐỘNG)
> 
> Tóm tắt 6 PR Sprint 3 và đợi confirm.
> 
> Đặc biệt nhấn mạnh: PR 20 (Test scoring-isolation) phải làm TRƯỚC PR 19 (sửa kpis/[kpiId]/page.tsx) để đảm bảo có safety net.
> ```

### Test scoring-isolation (BẮT BUỘC làm)

Đây là test bảo vệ KPI. Quy trình:

1. Bảo Claude Code viết test:
> ```
> Viết file test src/__tests__/scoring-isolation.spec.ts theo PRD section 16.4. Test phải:
> 
> Step 1: Lấy 1 KPI có ≥3 items từ Supabase staging
> Step 2: Gọi calcItemScore cho từng item, sum lại, lưu vào biến scoreA
> Step 3: Tạo 5 Problem liên kết với KPI đó qua related_kpi_id
> Step 4: Mỗi Problem tạo thêm 1 Action + 1 Result + 1 Evaluation Pass
> Step 5: Gọi lại calcItemScore cho từng item, sum lại, lưu vào scoreB
> Step 6: Assert scoreA === scoreB (bit-by-bit, dùng Object.is hoặc deep equal)
> Step 7: Cleanup: xóa các Problem test
> 
> Nếu test fail, dừng Sprint 3 lại và báo tôi.
> ```

2. Sau khi test xong, chạy:
> ```
> Chạy test src/__tests__/scoring-isolation.spec.ts. In kết quả ra.
> ```

3. **Nếu test PASS** → tiếp tục Sprint 3 bình thường
4. **Nếu test FAIL** → dừng lại, đọc lỗi, bảo Claude Code điều tra. Có thể PAS đang vô tình động vào logic KPI ở chỗ nào đó. Phải fix triệt để mới đi tiếp.

### Mời manager-champion test pilot scenario

Cuối Sprint 3 là thời điểm hợp lý để mời 2 manager-champion test scenario thật:

Scenario test mẫu (gửi cho manager):
> "Tuần này CPL chiến dịch Facebook của team chị tăng 30%. Anh/chị thử dùng PAS để:
> 1. Tạo Problem 'CPL tăng 30% tuần này' linked với KPI Performance Ads Q4
> 2. Thêm 2 Root Cause: 'Creative fatigue' và 'Audience bão hòa'
> 3. Tạo Action 'Refresh 5 creative mới, A/B test' deadline 5 ngày
> 4. Sau khi Action 'xong', thêm Result: CPL giảm về mức cũ
> 5. Đánh Pass cho Action đó
> 6. Tạo Solution Pattern từ Action Pass
> 
> Sau đó cho tôi feedback luồng thao tác có dễ hiểu không, có lúng túng chỗ nào không."

Feedback từ scenario thật ở Sprint 3 là cơ sở để fix bug + polish UI ở Sprint 4.

---

## 8. SPRINT 4 — Integration + Analytics + Polish (2 tuần)

**Mục tiêu:**
- Tích hợp PAS vào Dashboard, Alerts, Notifications, Digests hiện có
- Build PAS Analytics tab với 13 metric
- Bug fixing
- Merge `feat/pas-module` vào `main`

**User thấy gì?** Cuối Sprint 4, code PAS đã lên production. Nhưng vì mọi workspace có `pas_enabled = false`, **không user nào thấy menu PAS** — yên tâm.

### Quy trình thi công

> ```
> Bắt đầu Sprint 4.
> 
> Đọc:
> - PRD_PAS_MVP_v3.md, section 5 (Success Metrics — 13 metric), section 11 (Dashboard), section 18 (Sprint 4 PR list)
> - src/lib/alertEngine.ts
> - src/lib/notificationEngine.ts
> - src/lib/digestEngine.ts
> - src/app/app/dashboard/page.tsx
> 
> Tóm tắt 6 PR Sprint 4 và đợi confirm.
> 
> Lưu ý: PR 21-23 mở rộng engine có sẵn. Nguyên tắc CHỈ THÊM, KHÔNG SỬA logic cũ. Sau khi sửa, phải verify KPI alerts/notifications/digest cũ vẫn chạy đúng.
> ```

### Final checklist trước khi merge vào main

Khi PR 26 (cuối cùng) đã merge vào `feat/pas-module`, làm checklist sau **trước khi merge `feat/pas-module` → `main`**:

> ```
> Toàn bộ Sprint 4 đã xong. Trước khi merge feat/pas-module vào main, làm checklist sau:
> 
> 1. Chạy tất cả unit tests, in kết quả
> 2. Chạy E2E test 3 flow chính theo PRD section 21.7
> 3. Chạy test scoring-isolation lần cuối, verify PASS
> 4. Verify TypeScript build không lỗi (npm run lint)
> 5. Verify Vite build không lỗi (npm run build)
> 6. Verify mọi migration mới (004-009) có rollback SQL ở comment cuối
> 7. Liệt kê tất cả file đã thêm/sửa trong feat/pas-module so với main
> 8. Verify file kpiMath.ts, kpiProgress.ts KHÔNG có thay đổi nào
> 9. Verify schema bảng kpis, kpi_items KHÔNG có ALTER nào
> 10. Verify workspaces.pas_enabled default = false
> 
> In ra report dạng checklist. Mọi item phải pass mới merge.
> ```

Nếu mọi item pass:

> ```
> Tạo PR cuối cùng: merge feat/pas-module vào main.
> Tiêu đề: "feat(pas): PAS module MVP - integrated with KPI app"
> Mô tả: liệt kê các tính năng PAS, link tới PRD v3, link tới các Sprint review.
> ```

Bạn vào GitHub, đọc PR, merge.

Vercel auto deploy lên production. Vì `pas_enabled = false` cho mọi workspace nên user vẫn thấy KPI app y nguyên, không thấy PAS.

### Chạy migration trên production lần cuối

Sau khi merge vào `main`, chạy các migration PAS còn lại trên Supabase production (nếu chưa chạy ở các Sprint trước):
- 004_pas_feature_flag.sql (đã chạy ở Setup)
- 005-009 (PAS schema + RLS + seed)

---

## 9. PHASE 0 — Pre-launch (1 tuần, song song Sprint 4)

Trong khi Claude Code đang làm Sprint 4, bạn (PO) làm Phase 0 song song:

### Việc 1: Workshop 1.5h cho 6 manager

Slide deck mẫu:
- Vấn đề hiện tại: tại sao cần PAS
- Demo nhanh PAS trên Vercel preview (PAS đã xong ở Sprint 3)
- Workflow chuẩn: Problem → Root Cause → Action → Result → Evaluation
- Vai trò Manager: confirm Critical 48h, evaluate Action, tạo Pattern
- Taxonomy seed: review Problem Type + Root Cause Type cho từng team
- Q&A

### Việc 2: Chốt taxonomy seed

Họp riêng với 6 manager để review taxonomy seed trong PRD section 8.2 và 8.4.
- Type nào thừa? Type nào thiếu cho team mình?
- Edit lại file `009_pas_seed_taxonomy.sql` nếu cần
- Bảo Claude Code re-run seed: *"Xóa seed taxonomy cũ trên production, chạy lại seed mới."*

### Việc 3: Tạo 5-10 problem mẫu dummy

Để Library và Dashboard không trống rỗng vào ngày đầu pilot. Bảo Claude Code:
> ```
> Tạo seed file 010_pas_demo_data.sql với 10 problem dummy phân bố qua 5 team, mỗi problem có:
> - 1-2 root_cause
> - 1-2 action
> - 50% có result
> - 30% có evaluation Pass
> - 1-2 solution_pattern đã tạo
> 
> Dùng owner_id và workspace_id thật từ DB production.
> ```

### Việc 4: Viết quick guide 1-2 trang gửi member

Format gợi ý:
- PAS là gì (1 paragraph)
- Khi nào dùng PAS (3-4 bullet)
- Cách tạo 1 Problem (5 steps có screenshot)
- Cách update Action của mình (3 steps)
- Liên hệ ai khi vướng (tên + Slack)

---

## 10. PHASE 1 — Pilot 2 team (2 tuần)

### Việc bắt đầu Pilot

Vào Supabase production → Table Editor → workspaces → tìm 2 workspace của 2 team pilot (1 team có manager-champion + 1 team trung bình theo PRD) → set `pas_enabled = true`.

Trong 1 phút, 2 team đó refresh app sẽ thấy menu PAS mới hiện ra.

### Theo dõi hằng ngày (PO)

Mỗi sáng vào Dashboard tab "PAS Analytics", check:

| Metric | Ngưỡng OK | Ngưỡng cảnh báo |
|---|---|---|
| L1: Problem count tuần 2 | ≥5 | <5 → check tại sao không ai dùng |
| L2: Manager evaluation | ≥1/manager/tuần | 0 sau 2 tuần → talk to manager |
| L3: Drop-off rate | <40% problem Open >14 ngày | >40% → problem bị bỏ rơi |
| L4: Action overdue | <30% | >30% → deadline không thực tế |

### Khi gặp bug

Bảo Claude Code:
> ```
> User báo bug: <mô tả bug>. URL: <link>. Steps to reproduce: <steps>.
> 
> Hãy:
> 1. Đọc các file liên quan
> 2. Tìm root cause
> 3. Đề xuất fix
> 4. Đợi tôi xác nhận trước khi tạo PR hotfix vào main
> ```

Hotfix flow:
1. Tạo branch `hotfix/pas-<short-description>` từ main
2. Fix bug
3. PR vào main (không qua feat/pas-module nữa vì đã merge rồi)
4. Bạn review nhanh + merge
5. Vercel auto deploy

### Khi cần rollback Phase 1

Nếu pilot có vấn đề nghiêm trọng:
- Cách 1 (mềm): vào Supabase → set `pas_enabled = false` cho 2 workspace → PAS biến mất, không ảnh hưởng KPI
- Cách 2 (cứng): revert merge commit `feat/pas-module → main` trên GitHub → Vercel rollback deploy

Cả 2 cách đều không động đến data PAS đã có. Khi sẵn sàng quay lại, chỉ cần bật flag lại.

---

## 11. PHASE 2 — Soft rollout (2 tuần)

Sau Phase 1 đạt gate criteria (PRD section 6):

1. Vào Supabase → set `pas_enabled = true` cho 3 workspace còn lại
2. Director thông báo qua Slack/Email: "4 tuần nữa weekly review chỉ dùng PAS"
3. 2 manager-champion làm ambassador, hỗ trợ 3 team mới
4. PO tiếp tục track L1-L4

Bug + feedback → hotfix như Phase 1.

---

## 12. PHASE 3 — Hard rollout (tuần 5+)

Director cam kết weekly review chỉ dùng PAS → chế tài tự nhiên xuất hiện.

Sau Phase 3, PAS chính thức là tool chính của trung tâm. PO tiếp tục:
- Tracking A1-A4, Q1-Q4, O1-O3 hằng tuần
- Review feedback từ 6 manager hằng tháng
- Plan Phase 2 features (xem PRD section 20 — Out of Scope)

---

## 13. Quy tắc giao tiếp với Claude Code (cho cả project)

**5 quy tắc vàng:**

1. **Luôn nói tiếng Việt.** Claude Code hiểu hoàn toàn.

2. **Mọi việc lớn → giải thích trước, sau đó mới làm.** Mẫu câu chuẩn:
   > *"Trước khi thực hiện, hãy giải thích cho tôi: (a) các bước cụ thể bạn sẽ làm, (b) các file nào sẽ bị thay đổi, (c) rủi ro tiềm ẩn. Đợi tôi xác nhận."*

3. **Không bao giờ bảo "cứ làm hết đi đừng hỏi gì cả".** Đây là cách nhanh nhất để PAS làm hỏng KPI.

4. **Khi không hiểu → hỏi lại bằng tiếng Việt thường:**
   > *"Tôi không hiểu chỗ này. Giải thích lại như thể bạn nói với một người không biết code."*

5. **Mỗi commit/PR phải có message rõ ràng theo conventional commits:**
   - `feat(pas): ...` — tính năng mới
   - `fix(pas): ...` — fix bug
   - `chore(pas): ...` — dọn dẹp
   - `test(pas): ...` — viết test
   - `docs(pas): ...` — tài liệu

**4 câu lệnh hay dùng nhất:**

**Trước khi làm gì lớn:**
> *"Trước khi sửa, đọc các file [X, Y, Z] và tóm tắt cho tôi: (a) cấu trúc hiện tại, (b) plan thay đổi, (c) rủi ro. Đợi tôi confirm."*

**Khi không hiểu:**
> *"Tôi không hiểu [X]. Giải thích lại bằng từ ngữ đơn giản, có ví dụ thực tế."*

**Khi check trạng thái:**
> *"Cho tôi xem: (a) branch hiện tại, (b) các file đã thay đổi nhưng chưa commit, (c) 5 commit gần nhất."*

**Khi rollback:**
> *"Có vấn đề với [thay đổi gần nhất]. Đề xuất cách rollback an toàn nhất, đợi tôi confirm trước khi làm."*

---

## 14. Khi gặp sự cố — playbook xử lý

### Sự cố 1: Build Vercel fail sau khi merge PR

> ```
> PR mới nhất làm Vercel build fail. Link: <URL>. Đọc log build, tìm lỗi, đề xuất fix.
> ```

### Sự cố 2: Migration chạy lỗi trên Supabase

> ```
> Migration <tên file> chạy trên Supabase production báo lỗi: <error message>. 
> Đọc lại migration đó, đọc các bảng/policy đang có, đề xuất fix.
> Có thể cần migration phụ trợ. Đừng sửa file migration cũ.
> ```

### Sự cố 3: User báo "không vào được PAS"

Check theo thứ tự:
1. Workspace của user có `pas_enabled = true` không? → Supabase Dashboard
2. Profile user có đầy đủ `role`, `department_id`, `workspace_id` không?
3. RLS policy có cho user role đó thấy được không?

> ```
> User <email> báo không thấy menu PAS. Đăng nhập được KPI bình thường.
> Hãy:
> 1. Query profile của user đó
> 2. Query workspace của user đó, check pas_enabled
> 3. Đề xuất nguyên nhân + cách fix
> ```

### Sự cố 4: KPI app bỗng nhiên load chậm sau khi bật PAS

Có thể PAS query nặng làm chậm app chung.

> ```
> KPI app load chậm sau khi bật PAS. Hãy:
> 1. Check các query PAS trong src/lib/pas/* có dùng index đúng không (xem PRD section 21.8)
> 2. Check Supabase Dashboard → Database → Performance để tìm query chậm
> 3. Đề xuất tối ưu (thêm index, cache, hoặc giảm query)
> ```

### Sự cố 5: Test scoring-isolation fail

⚠️ Đây là sự cố nghiêm trọng — PAS có thể đang làm hỏng KPI.

> ```
> Test scoring-isolation FAIL. KPI score trước/sau có PAS khác nhau.
> Hãy:
> 1. So sánh scoreA vs scoreB, xem khác chỗ nào
> 2. Tìm chỗ PAS đang vô tình động vào logic KPI
> 3. ĐỪNG fix vội, báo cáo cho tôi trước
> ```

Trong khi điều tra, **tắt PAS ngay**: set `pas_enabled = false` cho tất cả workspace.

---

## 15. Checklist tổng — hoàn thành project

- [ ] Sprint 0: 3 việc dọn nhà xong, merge vào main
- [ ] Setup: branch `feat/pas-module` tạo xong, feature flag thêm vào workspaces
- [ ] Sprint 1: 8 PR merge vào `feat/pas-module`, test CRUD pass
- [ ] Sprint 2: 6 PR merge, manager-champion review preview
- [ ] Sprint 3: 6 PR merge, test scoring-isolation PASS, scenario test với manager
- [ ] Sprint 4: 6 PR merge, checklist final pass, merge `feat/pas-module` → `main`
- [ ] Phase 0: 6 manager training xong, taxonomy chốt, problem mẫu xong, quick guide gửi
- [ ] Phase 1: 2 team pilot bật flag, L1-L4 ổn 2 tuần, gate Phase 2 đạt
- [ ] Phase 2: 3 team còn lại bật flag, gate Phase 3 đạt
- [ ] Phase 3: Director cam kết weekly review chỉ dùng PAS
- [ ] Post go-live: review A1-A4 Q1-Q4 O1-O3 sau 3 tháng

---

**End of Implementation Plan**
