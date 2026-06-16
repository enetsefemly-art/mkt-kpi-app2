# PRD — PAS Problem-Solution Management Module

**Version:** 3.0 (Updated for real KPI app codebase)
**Status:** Ready for development
**Target:** MVP Phase 1 — Integrated into existing KPI Management App
**Timeline:** 2 tháng dev + 1 tháng rollout
**Last updated:** June 2026

---

## 0. Changelog so với v2

v3 cập nhật những điểm sau so với v2 để khớp với thực tế codebase KPI app đã go-live:

| Khu vực | v2 (giả định) | v3 (thực tế) |
|---|---|---|
| **Tech stack** | Next.js 16 App Router | React 19 + Vite 6 + react-router-dom 7 + Supabase + Tailwind v4 |
| **Trạng thái KPI app** | Chưa có, build từ đầu | Đã go-live, đang chạy production |
| **Cách tích hợp** | Build cùng KPI | Module add-on, dùng chung infra hiện có |
| **Sprint 0 (dọn nợ kỹ thuật)** | Không có | Thêm vào, strongly recommended |
| **Feature flag** | Không có | Thêm `pas_enabled` per workspace |
| **Database migrations** | Bắt đầu từ 001 | Tiếp nối số sau migration 003 đã có |
| **Routing** | Next.js App Router | react-router-dom (Routes trong App.tsx) |
| **Engine reuse** | Build từ đầu | Mở rộng `alertEngine.ts`, `notificationEngine.ts`, `digestEngine.ts` đã có |
| **Permission model** | Build mới | Reuse `permissions.ts` (director/manager/member/viewer) |
| **UUID filter pattern** | Không có | Bắt buộc dùng `shouldApplyUuidFilter` từ `lib/uuid.ts` |
| **RLS pattern** | Không có | Bắt buộc theo style migration 003_kpi_permissions.sql |

Phần Rollout Plan, Success Metrics, Object Model business rules giữ nguyên từ v2.

---

## 1. Document Purpose & How to Use

Đây là PRD chính thức để triển khai PAS MVP với Claude Code trên codebase KPI app hiện có. Tài liệu này:

- Đã chốt toàn bộ quyết định business rule (không còn ambiguity cần PO duyệt)
- Đã định nghĩa Success Metrics và Rollout Plan cụ thể
- Đã chỉ định scope rõ ràng — phần nào in/out, phần nào nâng cấp sau
- Đã map chính xác file/folder trong codebase KPI hiện tại

**Quyết định PO đã chốt** (từ v2, không đổi):
- Validation Root Cause: cảnh báo mềm (không block cứng)
- Action - Root Cause: one-to-one
- Status Problem: tự động + manual theo bảng (xem 7.1)
- Severity: manager judge, không có ngưỡng cứng
- Result: 1 result/action, lock sau khi manager evaluate
- Solution Pattern: 1 pattern - 1 source action

**Quyết định Claude tự chốt cho MVP gọn** (PO có thể override — xem section 21):
- Soft delete cho mọi entity, không hard delete
- Deadline gia hạn: log activity, không cần approval
- Cancel action: cần lý do, log activity
- Notification chỉ in-app, không real-time push
- Analytics: built-in dashboard, không export Excel

**Quyết định mới ở v3:**
- Feature flag `pas_enabled` per workspace, default `false`
- Sprint 0 dọn nợ kỹ thuật trước Sprint 1
- Mọi file PAS đặt trong namespace riêng (`src/lib/pas/`, `src/app/app/problems/`, `src/components/pas/`)
- Không sửa schema KPI hiện có, không sửa logic `calcItemScore`

---

## 2. Bối cảnh

Hệ thống KPI Management App hiện có khả năng quản lý KPI, KPI Items, KPI Progress, Initiatives, Tasks, phân quyền theo vai trò (director/manager/member/viewer), quản lý nhân sự/phòng ban, alert engine, notification engine, digest engine, và activity log.

KPI chỉ trả lời câu *what* (đạt hay không đạt), không trả lời *why* và *how to fix*. Module PAS bổ sung khả năng:

- Vì sao kết quả không đạt?
- Vấn đề phát sinh là gì?
- Nguyên nhân là gì?
- Đã xử lý bằng giải pháp nào?
- Giải pháp đó có hiệu quả không?
- Có thể lưu lại thành bài học không?

---

## 3. Mục tiêu sản phẩm

### 3.1. Quản trị vấn đề phát sinh
Ghi nhận các vấn đề trong vận hành: KPI, chỉ số vận hành, quy trình, chất lượng, thực thi, vấn đề team.

### 3.2. Buộc quá trình xử lý đi qua nguyên nhân
Luồng chuẩn: **Problem → Root Cause → Execution Action → Result → Manager Evaluation**

Hệ thống cảnh báo (không block cứng) nếu user tạo Action mà không gắn Root Cause.

### 3.3. Đánh giá chất lượng giải pháp
PAS không đo "số lượng vấn đề" mà đo:
- Vấn đề có được xác định rõ không
- Nguyên nhân có hợp lý không
- Action có bám nguyên nhân không
- Result có cải thiện không
- Manager có đánh Pass không

### 3.4. Xây dựng thư viện giải pháp
Action được Pass + chuẩn hóa thành Solution Pattern → lưu vào Solution Library cho tra cứu.

---

## 4. Bối cảnh tổ chức

| Thông tin | Giá trị |
|---|---|
| Tổng người dùng | 47 (1 Director + 6 Manager + 40 Member) |
| Số team | 5 (Performance Ads, KOC, Cross Sale, UA, Livestream) |
| Manager/team avg | 5-10 member |
| Volume vấn đề ước tính | 10-15 problem/tuần toàn trung tâm |
| Baseline hiện tại | Chưa có công cụ, dùng meeting + meeting note |
| Manager buy-in | Có (có champion) |
| Member quen với structured tool | Chưa (chỉ dùng Excel) |

**Hàm ý cho dev:**
- Quy mô nhỏ → không cần caching phức tạp, không cần sharding
- Volume thấp → không cần optimization sớm
- User chưa quen tool có cấu trúc → **UX phải cực đơn giản**, tránh form dài, tránh nhiều bước
- Reuse infra có sẵn → giảm thời gian dev đáng kể

---

## 5. Success Metrics (chốt với PO, giữ nguyên từ v2)

### 5.1. Adoption Metrics

| # | Metric | Định nghĩa | Target sau 3 tháng |
|---|---|---|---|
| A1 | Team active rate | % team có ≥3 problem mới/tuần | 5/5 team trong ≥8/12 tuần |
| A2 | Manager engagement | % manager có ≥1 evaluation/tuần | 5/6 manager trong ≥8/12 tuần |
| A3 | Problem volume | Số problem mới/tuần toàn trung tâm | ≥10/tuần |
| A4 | Member participation | % member có ≥1 problem/action update/tháng | ≥70% (28/40) |

### 5.2. Quality Metrics

| # | Metric | Định nghĩa | Target |
|---|---|---|---|
| Q1 | Root Cause coverage | % problem có ≥1 root cause | ≥80% |
| Q2 | Action-RootCause linkage | % action gắn root cause | ≥75% |
| Q3 | Result completion | % action Done có result + before/after | ≥60% |
| Q4 | Evaluation completion | % action Done được evaluate trong 7 ngày | ≥70% |

### 5.3. Output Metrics

| # | Metric | Định nghĩa | Target |
|---|---|---|---|
| O1 | Pattern volume | Tổng pattern trong library | ≥30 |
| O2 | Pattern coverage | % team có ≥3 pattern | 5/5 |
| O3 | Library access | View/search library/tuần (tháng 3) | ≥20 |

### 5.4. Leading Indicators

| # | Metric | Ngưỡng cảnh báo |
|---|---|---|
| L1 | Tuần 2 problem count | < 5 → cảnh báo |
| L2 | Manager first evaluation | > 2 tuần không có → cảnh báo |
| L3 | Drop-off rate | > 40% problem Open >14 ngày → cảnh báo |
| L4 | Action overdue rate | > 30% action overdue → cảnh báo |

### 5.5. Must-have metrics
Nếu chỉ track 3: **A1, Q1, O1**.

**Yêu cầu dev:** Analytics module trong scope MVP, đo tự động, không export ra Excel.

---

## 6. Rollout Plan (giữ nguyên từ v2)

### Phase 0: Pre-launch (tuần -2 → 0, song song cuối sprint dev)
- Workshop training 1.5h cho 6 manager
- Chốt taxonomy seed (Problem Type, Root Cause Type) cho 5 team
- Tạo 5-10 problem mẫu dummy trong system
- Viết quick guide 1-2 trang gửi member

**Gate qua Phase 1:** Tất cả 6 manager đã training và xác nhận hiểu flow.

### Phase 1: Pilot (tuần 1-2, 2 team)
- 1 team có manager-champion + 1 team trung bình (~15-20 người)
- Bật `pas_enabled = true` cho workspace của 2 team này
- Mục tiêu: thu thập bug, edge case, refine taxonomy
- PO theo dõi Leading Indicators hàng ngày

**Gate qua Phase 2:**
- ≥10 problem được tạo trong 2 tuần
- ≥1 action được manager evaluate
- Không còn bug critical/high

### Phase 2: Soft rollout (tuần 3-4, 5 team, không chế tài)
- Bật `pas_enabled = true` cho 3 workspace còn lại
- 2 manager-champion làm ambassador
- Director thông báo: "4 tuần sau sẽ chính thức vào weekly review"

**Gate qua Phase 3:**
- 5/5 team có ≥3 problem trong tuần 4
- 6/6 manager đã evaluate ≥1 lần
- Q1 ≥ 60%

### Phase 3: Hard rollout (tuần 5+, có chế tài)
- Director cam kết: "Weekly review chỉ dùng PAS. Vấn đề không nhập trên PAS = không có."
- Action không có root cause sẽ bị reject ở weekly review
- Đây là **chế tài tự nhiên**, không phải hành chính

### Vai trò vận hành post go-live
- **PAS Owner:** PO (kiêm)
- **Ambassador:** 2 manager-champion (hỗ trợ tuần 1-4)
- **Director:** cam kết weekly review chỉ dùng PAS

---

## 7. User Roles & Permissions

Dùng lại role hệ thống KPI app, không tạo role PAS riêng.

| Role | Quyền PAS |
|---|---|
| Director (admin) | Toàn quyền: PAS, taxonomy, library, dashboard, analytics |
| Manager (lead) | Quản lý problem/action/result của team mình, đánh Pass/Not Pass, tạo Solution Pattern, override Severity |
| Member | Tạo/update problem, root cause, action, result của mình |
| Viewer | Xem dữ liệu được phép xem |

**Quyền đặc biệt:**
- Severity = Critical: Member tạo được nhưng phải có Manager confirm để giữ Critical (nếu Manager không confirm trong 48h, hệ thống tự hạ xuống High)
- Mark Resolved cho Problem: chỉ Manager
- Đánh Pass/Not Pass: chỉ Manager
- Tạo Solution Pattern: chỉ Manager
- Library: tất cả role có thể xem

**Implementation:**
- Mở rộng `src/lib/permissions.ts` với các helper PAS:
  - `canCreateProblem`, `canResolveProblem`, `canConfirmCritical`
  - `canCreateAction`, `canEditAction`, `canCancelAction`
  - `canEvaluateAction`
  - `canCreatePattern`, `canEditPattern`
- Pattern theo các hàm hiện có (`canCreateKPI`, `canEditKPI`, v.v.)

---

## 8. Object Model

Mọi bảng PAS có:
- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `workspace_id uuid NOT NULL REFERENCES workspaces(id)`
- `created_at timestamptz DEFAULT now()`
- `updated_at timestamptz DEFAULT now()`
- `deleted_at timestamptz NULL` (soft delete)
- `created_by uuid REFERENCES auth.users(id)`

### 8.1. Problem

```
problem_id (PK)
workspace_id (FK → workspaces, required)
department_id (FK → departments, required)
problem_type_id (FK → problem_types)
problem_owner_id (FK → profiles.user_id, required)
related_kpi_id (FK → kpis, NULLABLE, ON DELETE SET NULL)
related_kpi_item_id (FK → kpi_items, NULLABLE, ON DELETE SET NULL)
problem_title (text, required)
problem_description (text, required)
severity (enum: Low, Medium, High, Critical)
severity_confirmed_by (FK → profiles.user_id, nullable)
severity_confirmed_at (timestamptz, nullable)
status (enum: Open, In Progress, Pending, Resolved)
expected_resolve_date (date, optional)
resolved_at (timestamptz, nullable)
resolved_by (FK → profiles.user_id, nullable)
manager_note (text, optional)
is_repeated (boolean, default false)
linked_previous_problem_id (FK → problems, nullable)
evidence_snapshot (jsonb, nullable) -- snapshot KPI tại thời điểm tạo
created_at, updated_at, deleted_at, created_by
```

**Status transitions:**

| Status | Khi nào chuyển | Ai |
|---|---|---|
| Open | Tự động khi tạo | System |
| In Progress | Tự động khi có ≥1 Action ở status Doing | System |
| Pending | Manual - khi cần chờ | Owner/Manager |
| Resolved | Manual - sau khi có ≥1 Action Pass | **Chỉ Manager** |

**Severity rules:**
- Member chọn Severity ban đầu
- Member chọn Critical → hệ thống set `severity_confirmed_at = NULL`, gửi notification cho Manager confirm trong 48h
- Manager confirm → giữ Critical, set `severity_confirmed_at`
- Không confirm trong 48h → cron/scheduled function auto-hạ về High
- Manager có thể override Severity bất kỳ lúc nào, có log

### 8.2. Problem Type (Taxonomy)

```
problem_type_id (PK)
workspace_id (FK → workspaces)
type_code (text, unique within workspace)
type_name (text, required)
type_group (text: Content, Ads, MI/KOC, Lead Quality, Process, Data, Team, Other)
description (text, optional)
is_active (boolean, default true)
sort_order (int)
created_by_admin (boolean, default true)
created_at, updated_at, deleted_at, created_by
```

**Quản lý:**
- Admin/Director tạo và maintain
- Manager đề xuất type mới → Admin review → merge/chuẩn hóa

**Seed data ban đầu** (cho 5 team):

| Group | Problem Type |
|---|---|
| Content | Content không kéo được click |
| Content | Content thiếu volume |
| Content | Content chuyển đổi thấp |
| Ads | CPL tăng |
| Ads | Creative fatigue |
| Ads | Audience saturated |
| MI/KOC | MI/KOC không ra lead |
| MI/KOC | KOC drop chất lượng |
| Lead Quality | L2/L0 giảm |
| Lead Quality | Lead pass rate giảm |
| Process | Approval chậm |
| Process | Quy trình thiếu rõ ràng |
| Data | Tracking sai |
| Data | Data lag |
| Team | Thiếu nhân sự execute |
| Team | Communication gap |

(Admin có thể bổ sung thêm seed trước go-live, hoặc sửa lại trong Phase 0)

### 8.3. Root Cause

```
root_cause_id (PK)
workspace_id (FK → workspaces)
problem_id (FK → problems)
root_cause_type_id (FK → root_cause_types)
root_cause_note (text, required - evidence/note)
is_primary (boolean) -- chỉ 1 primary tại 1 thời điểm cho mỗi problem
validation_status (enum: Not Validated, Validated, Partially Validated, Rejected, default Not Validated)
created_at, updated_at, deleted_at, created_by
```

**Rules:**
- 1 Problem có nhiều Root Cause
- Chỉ 1 Primary tại 1 thời điểm; đổi Primary → unprimary cái cũ, log activity
- Validation_status mặc định Not Validated, manager đổi sau

### 8.4. Root Cause Type (Taxonomy)

```
root_cause_type_id (PK)
workspace_id (FK → workspaces)
type_code (text, unique within workspace)
type_name (text, required)
description (text)
is_active (boolean, default true)
sort_order (int)
created_by_admin (boolean)
created_at, updated_at, deleted_at, created_by
```

**Mapping với Problem Type:**

```
problem_type_root_cause_map
- workspace_id (FK)
- problem_type_id (FK)
- root_cause_type_id (FK)
- priority_order (int)
PRIMARY KEY (problem_type_id, root_cause_type_id)
```

Khi user chọn Problem Type, hệ thống gợi ý các Root Cause Type theo mapping. User vẫn có thể chọn Root Cause Type ngoài mapping (free choice), nhưng gợi ý theo mapping được hiển thị trước.

**Seed mapping ví dụ:**

| Problem Type | Root Cause Type gợi ý |
|---|---|
| Content không kéo được click | Hook/angle chưa đúng; CTA chưa rõ; Format không phù hợp; Audience bão hòa; Topic không hấp dẫn; Creative fatigue |
| CPL tăng | Audience bão hòa; Creative fatigue; Bidding strategy sai; Budget không đủ; Tracking lỗi |
| L2/L0 giảm | Lead quality kém; Process tư vấn yếu; Offer không hấp dẫn; Sản phẩm không fit |

(Admin chuẩn hóa đầy đủ trong Phase 0)

### 8.5. Execution Action

```
action_id (PK)
workspace_id (FK → workspaces)
problem_id (FK → problems, required)
root_cause_id (FK → root_causes, nullable) -- WARNING nếu null, không block cứng
action_title (text, required)
action_description (text)
action_owner_id (FK → profiles.user_id, default = problem_owner_id)
deadline (date, required)
status (enum: Pending, Todo, Doing, Done, Cancelled, default Todo)
cancel_reason (text, nullable) -- bắt buộc nếu status = Cancelled
action_note (text)
is_overdue (boolean, computed via view)
deadline_changed_count (int, default 0)
done_at (timestamptz, nullable)
created_at, updated_at, deleted_at, created_by
```

**Rules:**
- 1 Action gắn 0 hoặc 1 Root Cause (one-to-one)
- Nếu Action không có root_cause_id → hiển thị warning đỏ trên UI, không cho phép chuyển Problem sang In Progress chỉ bằng action này
- Action Owner default = Problem Owner, có thể đổi
- Deadline gia hạn: cho phép, log activity, tăng deadline_changed_count
- Cancel: bắt buộc nhập cancel_reason
- Overdue computed: `deadline < CURRENT_DATE AND status NOT IN ('Done', 'Cancelled')`

### 8.6. Action Result

```
result_id (PK)
workspace_id (FK → workspaces)
action_id (FK → actions, UNIQUE - 1 result per action)
result_note (text, required)
primary_result_metric_name (text, required nếu muốn Pass)
before_value (numeric, optional)
after_value (numeric, optional)
unit (text, optional)
captured_at (timestamptz)
source (enum: manual, import, api - default manual)
is_locked (boolean, default false) -- lock sau khi manager evaluate
locked_at (timestamptz, nullable)
updated_by (FK → profiles.user_id)
created_at, updated_at, deleted_at
```

**Rules:**
- 1 Action - 1 Result (1:1 via UNIQUE constraint on action_id)
- Có thể update nhiều lần khi `is_locked = false`
- Sau khi Manager đánh Pass/Not Pass → tự động lock
- Muốn sửa sau lock → Manager unlock (có log)

### 8.7. Manager Evaluation

```
evaluation_id (PK)
workspace_id (FK → workspaces)
action_id (FK → actions, UNIQUE)
evaluation (enum: Pass, Not Pass, required)
evaluation_note (text, optional)
evaluated_by (FK → profiles.user_id, must be Manager/Director)
evaluated_at (timestamptz)
created_at, updated_at, deleted_at
```

**Conditions để Pass:**
1. Action status = Done
2. Có Result (result_note + primary_result_metric_name nếu muốn tạo Pattern)
3. Manager submit Pass

**Sau khi Pass:**
- Result auto-lock
- Action xuất hiện trong "Library Candidates" trên Manager Dashboard
- Manager có thể tiếp tục "Tạo Solution Pattern"

**Sau khi Not Pass:**
- Result auto-lock
- Action vẫn hiện trong lịch sử Problem, không vào Library

### 8.8. Solution Pattern

```
pattern_id (PK)
workspace_id (FK → workspaces)
source_action_id (FK → actions, required)
pattern_name (text, required)
pattern_description (text, required)
problem_type_id (FK → problem_types)
root_cause_type_id (FK → root_cause_types)
metric_signal (text, optional) -- vd "CPL tăng >20%"
function_team (text, optional) -- vd "Performance Ads"
channel (text, optional) -- vd "Facebook Ads"
product_id (FK → products, optional)
apply_when (text, required)
do_not_apply_when (text, required)
limitation_note (text, optional)
manager_rating (enum: Hiệu quả cao, Trung bình, Thấp, Cần thêm evidence, Không còn khuyến nghị)
created_at, updated_at, deleted_at, created_by
```

**Rules:**
- 1 Pattern - 1 source action (MVP)
- Tất cả role có quyền xem
- Chỉ Manager tạo/edit pattern của team mình
- Director có toàn quyền

### 8.9. Activity Log

**Reuse bảng `activity_logs` đã có sẵn.** Không tạo bảng PAS riêng.

Pattern dùng: import `logActivity` từ `src/lib/activityLogger.ts`.

**Events cần log (MVP minimum):**

```
problem.created, problem.status_changed, problem.owner_changed,
problem.severity_changed, problem.resolved, problem.marked_repeated, problem.deleted

root_cause.created, root_cause.primary_changed,
root_cause.validation_changed, root_cause.deleted

action.created, action.owner_changed, action.status_changed,
action.deadline_changed, action.cancelled, action.marked_overdue, action.deleted

result.created, result.updated, result.locked, result.unlocked

evaluation.created (Pass/Not Pass)

pattern.created, pattern.updated, pattern.deleted
```

### 8.10. Notification

**Reuse hệ thống notification hiện có.** Mở rộng `src/lib/notificationEngine.ts` với các type mới:

```
PROBLEM_ASSIGNED_TO_ME      → Problem Owner
ACTION_ASSIGNED_TO_ME       → Action Owner
ACTION_OVERDUE_PAS          → Action Owner + Problem Owner
RESULT_PENDING_UPDATE       → Action Owner
EVALUATION_PENDING_MANAGER  → Manager
PROBLEM_REPEATED_CONFIRM    → Manager
PATTERN_CREATED             → Director + Admin
SEVERITY_CRITICAL_PENDING   → Manager
SEVERITY_AUTO_DOWNGRADED    → Owner + Manager
```

**Cơ chế:** In-app, poll khi load app. Không real-time push, không email.

### 8.11. Feature Flag

Thêm 1 cột vào bảng `workspaces`:

```
ALTER TABLE workspaces ADD COLUMN pas_enabled boolean DEFAULT false;
```

**Mục đích:**
- Bật PAS cho từng workspace riêng (phục vụ Phase 1 pilot 2 team)
- Tắt PAS nhanh nếu có sự cố
- Không ảnh hưởng KPI

**Implementation:**
- `src/app/app/layout.tsx`: chỉ render menu PAS nếu `workspace.pas_enabled = true`
- Các route PAS check flag, redirect về `/app/dashboard` nếu workspace chưa enable
- Migration mới: `004_pas_feature_flag.sql`

---

## 9. Core User Flows

### 9.1. Tạo Problem thủ công
```
Sidebar → "Problems" → "+ Tạo Problem"
→ Chọn Problem Type (từ taxonomy của workspace)
→ Nhập title + description (evidence)
→ Chọn Severity (default Medium)
→ Chọn Problem Owner (default = current user)
→ Chọn Team/Department (default = owner's department)
→ Optional: related KPI, expected resolve date
→ Save
```
**Status mặc định:** Open

### 9.2. Tạo Problem từ KPI
```
KPI Detail (src/app/app/kpis/[kpiId]/page.tsx) → tab "Related Problems" → "+ Tạo Problem từ KPI này"
→ Auto-fill: related_kpi_id, related_kpi_item_id (nếu chọn item),
  problem_owner_id (KPI owner), department_id, evidence_snapshot (JSON snapshot
  target/actual/month tại thời điểm tạo)
→ User chọn: Problem Type, Severity, Problem Owner (nếu khác)
→ Save
```

**Constraint kỹ thuật (CRITICAL):**
- Không sửa schema `kpis`, `kpi_items`
- Không sửa hàm `calcItemScore` trong `src/lib/kpiMath.ts`
- Verify: trước/sau khi tạo Problem liên kết, điểm KPI phải bằng nhau bit-by-bit

### 9.3. Thêm Root Cause
```
Problem Detail → "Add Root Cause"
→ Chọn Root Cause Type (gợi ý theo Problem Type từ mapping, có thể chọn ngoài gợi ý)
→ Nhập note/evidence (required)
→ Tick "Primary" nếu cần
→ Save
```
Đổi Primary → unprimary cái cũ, log activity.

### 9.4. Tạo Execution Action
```
Problem Detail → "Add Action"
→ Chọn Root Cause liên quan (warning đỏ nếu skip, không block)
→ Nhập action_title, description
→ Action Owner (default = Problem Owner)
→ Deadline (required)
→ Status (default Todo)
→ Save
```

### 9.5. Update Action
- Owner/Manager update status, note, deadline
- Cancel → bắt buộc cancel_reason
- Deadline thay đổi → log + tăng counter

### 9.6. Update Result
```
Action Detail → "Update Result"
→ result_note (required)
→ before/after value + unit (optional, required nếu muốn Pass)
→ primary_result_metric_name (required nếu muốn Pass)
→ Save
```
Sau khi Manager evaluate → result lock.

### 9.7. Manager Evaluate
```
Manager Dashboard → "Pending Evaluations"
→ Chọn Action có Result
→ Review result + before/after
→ Pass / Not Pass
→ Optional: evaluation_note
→ Submit
```
Pass → option "Tạo Solution Pattern" hiện ra.

### 9.8. Tạo Solution Pattern
```
Action Pass → "Tạo Solution Pattern"
→ Form auto-fill từ Problem, Root Cause, Action, Result
→ Manager chỉnh: pattern_name, description, apply_when, do_not_apply_when, limitation, rating
→ Save → vào Solution Library
```

### 9.9. Tra cứu Solution Library
```
Sidebar → "Solution Library"
→ Keyword search
→ Filter: Problem Type, Root Cause Type, Function/Team, Channel, Product, Rating
→ Sort: Created date, Rating
→ Click pattern → xem detail + link tới source action
```

### 9.10. Mark Repeated
```
Khi user thêm Root Cause cho 1 problem mới, hệ thống check:
- Cùng Problem Type
- Cùng Root Cause Type (vừa thêm)
- Cùng Department
- Có problem khác trong 4 tuần gần nhất với 3 điều kiện trên

→ Hiển thị suggestion "Có thể đây là vấn đề lặp lại của Problem #X"
→ Manager xác nhận → set is_repeated = true, linked_previous_problem_id = X
→ Không reopen problem cũ, không tạo recurrence group
```

---

## 10. Weekly Report (Auto-generated)

**Reuse digestEngine hiện có.** Mở rộng `src/lib/digestEngine.ts`:

- `buildWeeklyDigest()` thêm payload section "PAS This Week":
  - Số problem mới, resolved, overdue actions
  - Top 5 problem critical chưa đóng
  - Pattern mới được tạo
  - Library candidates (action Pass chưa chuẩn hóa)

Truy cập: Dashboard → "Bản tổng hợp" (đã có sẵn).

Hoặc: Sidebar → "PAS Review" (route mới) cho view chi tiết hơn theo tuần.

**Format:** HTML render trong app. Không bắt user submit "No issue" — không có data thì hiển thị "Tuần này chưa có dữ liệu PAS."

---

## 11. Dashboard

**Reuse dashboard hiện có** (`src/app/app/dashboard/page.tsx`).

Vì `alertEngine` và `notificationEngine` được mở rộng cho PAS, Dashboard tự động hiện:
- Alert PAS (Problem Critical pending confirm, Action Overdue PAS)
- Notification PAS (assigned to me, evaluation pending, v.v.)

**Không cần làm 3 dashboard view riêng** như PRD v2 nói. Dashboard hiện tại đã có logic phân quyền theo role.

**Bổ sung tab "PAS Analytics"** trong Dashboard:
- Hiển thị 13 metric (A1-A4, Q1-Q4, O1-O3, L1-L4)
- Refresh ít nhất hàng ngày
- Director thấy toàn workspace, Manager thấy department, Member thấy bản thân

---

## 12. Repeated Problem (Simple Rule)

Logic giữ nguyên từ v2 (section 11). Implementation trong `src/lib/pas/repeatedDetector.ts`.

---

## 13. Activity Log

Reuse `src/lib/activityLogger.ts`. Mỗi entity PAS detail page có tab "Activity" — query `activity_logs` filter theo `entity_type` và `entity_id`.

---

## 14. Data & Snapshot

### 14.1. Nguồn dữ liệu (MVP)
- KPI: lấy từ bảng `kpis`, `kpi_items` qua Supabase (cùng database)
- Operational metrics: nhập tay
- Result metric: nhập tay
- Import Sheet/Excel: defer sang phase sau

### 14.2. Snapshot rules
- Khi tạo Problem có related_kpi → snapshot target, actual, period tại thời điểm đó vào `evidence_snapshot` (jsonb)
- Khi cập nhật Result và lock → before/after value snapshot vào DB không bị ghi đè (vì result đã lock)

### 14.3. Metric Registry (NOT in MVP)
Defer hoàn toàn. MVP chỉ dùng `before_value`/`after_value` numeric + `unit` text.

---

## 15. Solution Library (chi tiết)

Giữ nguyên từ v2 (section 14).

**Implementation:**
- Route: `/app/library` (list), `/app/library/:patternId` (detail)
- Component: `src/components/pas/PatternCard.tsx`
- Library candidates list trên Manager Dashboard: query actions có `evaluation.evaluation = 'Pass'` và chưa có `solution_patterns.source_action_id` trỏ vào

---

## 16. KPI Linkage (CHI TIẾT KỸ THUẬT)

### 16.1. Trong KPI Detail
- File: `src/app/app/kpis/[kpiId]/page.tsx`
- Thêm tab "Related Problems" — query `problems` where `related_kpi_id = kpiId AND deleted_at IS NULL`
- Hiển thị list rút gọn: title, status, severity, owner, last update
- Button "+ Tạo Problem từ KPI này" → navigate sang `/app/problems/new?kpi_id={kpiId}` với pre-fill

### 16.2. Constraint (CRITICAL - bất khả xâm phạm)
- **PAS không được thay đổi schema KPI hiện tại** (bảng `kpis`, `kpi_items`, `kpi_progress`...)
- **PAS không được thay đổi logic tính điểm KPI** (`calcItemScore`, `validateSubWeightTotal` trong `src/lib/kpiMath.ts` và `src/lib/kpiProgress.ts`)
- KPI app là master, PAS là reader (chỉ read KPI data, không write back)

### 16.3. Implementation
- PAS đọc KPI qua Supabase trực tiếp (cùng database, không qua API)
- `related_kpi_id` là FK lỏng với `ON DELETE SET NULL`:
  - Nếu KPI bị xóa, problem vẫn tồn tại với `related_kpi_id = NULL`
  - Không cascade delete

### 16.4. Acceptance test
Viết test trong `src/__tests__/scoring-isolation.spec.ts`:
- Lấy 1 KPI có ≥3 items, ghi điểm A
- Tạo 5 Problem liên kết với KPI đó, mỗi Problem có Action + Result + Evaluation
- Tính lại điểm KPI = điểm B
- Assert: A === B (bit-by-bit)

---

## 17. Acceptance Criteria

### 17.1. PAS Core
- Tạo Problem manual thành công với đầy đủ field required
- Tạo Problem từ KPI với auto-fill đúng + evidence_snapshot có dữ liệu
- Status transition đúng (Open auto, In Progress auto khi action Doing, Pending manual, Resolved chỉ Manager)
- Severity Critical phải có Manager confirm trong 48h, không thì auto-hạ về High

### 17.2. Root Cause
- Chọn được Problem Type từ taxonomy
- Chọn được Root Cause Type, gợi ý theo Problem Type hiển thị trước
- 1 Problem có nhiều Root Cause
- Chỉ 1 Primary tại 1 thời điểm
- Đổi Primary có log
- Validation status có 4 option

### 17.3. Action
- 1 Problem nhiều Action
- Action không có Root Cause → warning hiển thị, không block tạo
- Default Action Owner = Problem Owner
- Deadline required
- Status 5 option đúng spec
- Overdue auto-detect (via computed column hoặc view)
- Cancel cần lý do
- Deadline change có log

### 17.4. Result & Evaluation
- 1 Action - 1 Result (UNIQUE constraint)
- Result update nhiều lần khi chưa lock
- Manager Pass/Not Pass → auto-lock Result
- Pass → option tạo Pattern hiện ra
- Not Pass → action vẫn lưu lịch sử

### 17.5. Solution Library
- Manager tạo Pattern từ action Pass
- Pattern có đủ field bắt buộc (name, description, apply_when, do_not_apply_when, rating)
- Reference tới source action
- Keyword search hoạt động
- Filter theo Problem Type, Root Cause Type, Function, Channel, Product, Rating
- Mọi role xem được library

### 17.6. KPI Linkage
- KPI Detail có tab "Related Problems"
- "Tạo Problem từ KPI" với auto-fill + evidence_snapshot
- **TEST BẮT BUỘC:** Điểm KPI trước/sau khi có PAS data phải bằng nhau bit-by-bit

### 17.7. Weekly Report
- Auto-generated qua digestEngine, không cần submit form
- Có data đúng tuần
- Tuần không có data hiển thị message phù hợp

### 17.8. Dashboard
- Alert PAS hiện trong Dashboard hiện tại
- Notification PAS hiện trong Notifications page hiện tại
- Tab "PAS Analytics" hiển thị 13 metric A1-A4, Q1-Q4, O1-O3, L1-L4

### 17.9. Repeated Problem
- Gợi ý đúng rule (cùng type + cause + team trong 4 tuần)
- Manager confirm/skip
- Tạo Problem mới với link, không reopen cũ

### 17.10. Notification
- In-app only (reuse notificationEngine)
- Đủ 9 trigger spec ở section 8.10
- Poll khi load app

### 17.11. Activity Log
- Log đủ event ở section 8.9
- UI timeline trong entity detail (Problem, Action)

### 17.12. Analytics
- 13 metric tính được tự động
- Refresh ít nhất hàng ngày

### 17.13. Soft Delete
- Mọi entity dùng soft delete (`deleted_at` column)
- UI mặc định ẩn entity bị delete (filter `deleted_at IS NULL`)
- Admin có thể xem/restore qua trang riêng (nice-to-have)

### 17.14. Feature Flag
- `workspaces.pas_enabled` default false
- Menu PAS chỉ hiện khi `pas_enabled = true`
- Route PAS check flag, redirect nếu workspace chưa enable
- Director có UI để toggle flag (admin only) - nice-to-have, có thể tạm dùng Supabase Dashboard

---

## 18. Implementation Milestones

### Sprint 0: Dọn nợ kỹ thuật (1 tuần, STRONGLY RECOMMENDED)

**Lý do cần làm trước:**

| Nợ kỹ thuật | Nếu skip → ảnh hưởng đến PAS thế nào |
|---|---|
| RLS profiles recursion (`001_fix_profiles_rls.sql`) | PAS dùng chung bảng profiles → query Profile cho Problem owner / Action owner có thể fail intermittently. Bug khó debug. |
| Fallback giả role 'director' trong `layout.tsx` (lines 36-43) | PAS dùng `myProfile.role` để check `canCreateProblem`, `canEvaluateAction`, v.v. User load profile fail → bị giả thành director → thấy menu PAS Manager dù chỉ là member. **Vấn đề bảo mật.** |
| 3 file rác ở root (`fix_uuid.js`, `rewrite.js`, `test_supabase.js`) | Không ảnh hưởng PAS, chỉ dọn cho gọn repo. |

**Scope Sprint 0:**
1. Fix triệt để RLS migration 001 cho `profiles` table
2. Bỏ đoạn fallback giả role 'director' trong `src/app/app/layout.tsx` (lines 36-43)
3. Xóa 3 file utility lộn xộn ở root
4. Setup Supabase staging project (1 lần duy nhất, để test PAS trước khi đẩy production)

**PO quyết định:** Nếu PO chấp nhận rủi ro authorization gap, có thể skip Sprint 0 và làm cùng/sau Sprint 1.

### Sprint 1: Foundation (2 tuần)
**Tuần 1-2 of dev**

Mục tiêu: DB + permission + access layer. Chưa có UI.

PR 1: Migration 004 — Feature flag `pas_enabled` cho workspaces
PR 2: Migration 005 — Taxonomy tables (problem_types, root_cause_types, mapping)
PR 3: Migration 006 — Core tables (problems, root_causes, actions, results, evaluations)
PR 4: Migration 007 — Solution Pattern table
PR 5: Migration 008 — RLS policies cho mọi bảng PAS
PR 6: Seed taxonomy data
PR 7: `src/lib/pas/*.ts` — access layer (problemAccess, rootCauseAccess, actionAccess, taxonomyAccess)
PR 8: Mở rộng `src/lib/permissions.ts` với helper PAS

**Deliverable:** CRUD được Problem/RootCause/Action qua console hoặc test script.

### Sprint 2: UI cơ bản (2 tuần)
**Tuần 3-4 of dev**

PR 9: `src/app/app/problems/page.tsx` — list page với filter
PR 10: `src/app/app/problems/new/page.tsx` — create form
PR 11: `src/app/app/problems/[problemId]/page.tsx` — detail với tabs (Overview, Root Causes, Actions, Activity)
PR 12: `src/components/pas/*` — components (Badge, Timeline, Modal)
PR 13: Sửa `src/app/app/layout.tsx` — thêm menu PAS, check `pas_enabled`
PR 14: Sửa `src/App.tsx` — thêm các route PAS

**Deliverable:** Member tạo được Problem + Root Cause + Action đầy đủ flow.

### Sprint 3: Manager flow + Library + KPI Linkage (2 tuần)
**Tuần 5-6 of dev**

PR 15: Manager Evaluation flow (modal + access layer)
PR 16: `src/lib/pas/severityRules.ts` + scheduled function 48h auto-downgrade
PR 17: `src/lib/pas/repeatedDetector.ts` + UI suggestion
PR 18: `src/app/app/library/*` — Solution Library list + detail
PR 19: Mở rộng `src/app/app/kpis/[kpiId]/page.tsx` — tab "Related Problems"
PR 20: Test scoring-isolation.spec.ts

**Deliverable:** Manager đánh Pass → tạo Pattern → vào Library. KPI Detail thấy Related Problems. KPI scoring không bị ảnh hưởng.

### Sprint 4: Integration + Analytics + Polish (2 tuần)
**Tuần 7-8 of dev**

PR 21: Mở rộng `src/lib/alertEngine.ts` với 2 alert type PAS
PR 22: Mở rộng `src/lib/notificationEngine.ts` với 9 notification type PAS
PR 23: Mở rộng `src/lib/digestEngine.ts` với PAS section trong weekly digest
PR 24: Dashboard tab "PAS Analytics" với 13 metric
PR 25: `src/app/app/pas-review/page.tsx` — PAS-specific weekly review
PR 26: Bug fixing + Phase 0 preparation (training material, taxonomy refine)

**Deliverable:** Toàn bộ PAS xong, merge `feat/pas-module` → `main`. PAS deployed lên production nhưng vẫn ẩn (mọi workspace có `pas_enabled = false`).

### Phase 0-3: Rollout (xem section 6)

---

## 19. File & Folder Mapping (cho dev/Claude Code)

### Files mới hoàn toàn

```
src/app/app/problems/
├── page.tsx                              # list + filters
├── new/page.tsx                          # create form
└── [problemId]/
    ├── page.tsx                          # detail with tabs
    └── components/
        ├── OverviewTab.tsx
        ├── RootCausesTab.tsx
        ├── ActionsTab.tsx
        └── ActivityTab.tsx

src/app/app/library/
├── page.tsx                              # list + search + filter
└── [patternId]/page.tsx                  # detail

src/app/app/pas-review/
└── page.tsx                              # weekly review riêng (nice-to-have)

src/lib/pas/
├── problemAccess.ts                      # CRUD problems
├── rootCauseAccess.ts                    # CRUD root causes
├── actionAccess.ts                       # CRUD actions + status FSM
├── resultAccess.ts                       # CRUD results + lock logic
├── evaluationAccess.ts                   # Manager Pass/Not Pass
├── patternAccess.ts                      # Solution Library
├── taxonomyAccess.ts                     # Problem Type, Root Cause Type
├── severityRules.ts                      # 48h auto-downgrade
├── repeatedDetector.ts                   # repeat check 4 tuần
├── pasAlerts.ts                          # alert logic riêng (gọi từ alertEngine)
├── pasNotifications.ts                   # notification logic (gọi từ notificationEngine)
└── pasDigest.ts                          # digest section (gọi từ digestEngine)

src/components/pas/
├── ProblemStatusBadge.tsx
├── SeverityBadge.tsx
├── RootCauseList.tsx
├── ActionTimeline.tsx
├── EvaluationModal.tsx
├── PatternCard.tsx
├── RelatedProblemsTab.tsx                # dùng cả ở kpis/[kpiId]
└── RepeatedSuggestion.tsx

supabase/migrations/
├── 004_pas_feature_flag.sql              # ALTER workspaces ADD pas_enabled
├── 005_pas_taxonomy.sql                  # problem_types, root_cause_types, mapping
├── 006_pas_core.sql                      # problems, root_causes, actions, results, evaluations
├── 007_pas_library.sql                   # solution_patterns
├── 008_pas_rls.sql                       # RLS policies
└── 009_pas_seed_taxonomy.sql             # seed data
```

### Files cũ được SỬA (chỉ THÊM, không sửa logic cũ)

```
src/App.tsx
  + Thêm 6 Route cho PAS pages

src/app/app/layout.tsx
  + Bỏ fallback giả role 'director' (Sprint 0)
  + Thêm 3 menu PAS, check workspace.pas_enabled

src/app/app/kpis/[kpiId]/page.tsx
  + Thêm tab "Related Problems"
  + Thêm component RelatedProblemsTab

src/lib/permissions.ts
  + Thêm các helper canCreateProblem, canEvaluateAction, v.v.

src/lib/alertEngine.ts
  + getWorkspaceAlerts() thêm logic check PAS alerts
  + Thêm 2 type vào AlertType union

src/lib/notificationEngine.ts
  + getMyNotifications() thêm logic check PAS notifications
  + Thêm 9 type vào NotificationType union

src/lib/digestEngine.ts
  + buildWeeklyDigest() thêm PAS section

src/lib/uiText.ts
  + Thêm các chuỗi tiếng Việt cho menu/label PAS

src/lib/dataAccess.ts
  + Có thể bổ sung helper get workspace.pas_enabled
```

### Files cũ KHÔNG ĐƯỢC ĐỘNG VÀO

```
src/lib/kpiMath.ts                     # logic tính điểm KPI - SACRED
src/lib/kpiProgress.ts                 # logic progress KPI - SACRED
src/lib/kpiProgressAccess.ts           # SACRED
supabase/migrations/001-003_*.sql      # đã chạy production
schema của bảng kpis, kpi_items        # SACRED
```

---

## 20. Out of Scope (defer phase sau)

- Metric Tree đầy đủ
- Formula Builder
- Metric Signal engine
- Suggested Problem tự động
- AI-assisted recommendation
- API integration với external tools (FB Ads, Google Ads, ...)
- Apply Solution Pattern → tạo Action mới
- Weekly Meeting Agenda tự động
- Blocker module riêng
- Decision module riêng
- Anti-pattern module riêng (đã merge vào Pattern)
- PAS role riêng (dùng KPI role)
- Email notification, real-time push
- Import Excel/Sheet vào PAS
- Pattern effectiveness tự động
- Multi-source Solution Pattern (gộp nhiều action thành 1 pattern)
- Investigative vs Execution Action (defer phase 2)
- Pattern lifecycle (Draft/Published/Archived)
- Cross-team problem (problem ảnh hưởng nhiều team)
- Director UI để toggle feature flag (dùng Supabase Dashboard tạm)

---

## 21. Technical Notes for Dev / Claude Code

### 21.1. Tech stack (đã có)
- React 19 + Vite 6 + react-router-dom 7
- Supabase (Auth + Postgres + RLS)
- Tailwind CSS v4
- Deploy: Vercel (frontend), Supabase Cloud (DB)

### 21.2. Database conventions (BẮT BUỘC theo)
- Mọi bảng PAS phải có: `id uuid PK`, `workspace_id`, `created_at`, `updated_at`, `deleted_at`, `created_by`
- Mọi query phải dùng `shouldApplyUuidFilter` từ `src/lib/uuid.ts`:
  ```typescript
  .match(shouldApplyUuidFilter(workspaceId) ? { workspace_id: workspaceId } : {})
  ```
- RLS policies theo pattern `003_kpi_permissions.sql`:
  - Director: full access
  - Manager: full access if `department_id = current_user_department()`
  - Member/Owner: limited update if `owner_id = auth.uid()`
- Soft delete: filter `deleted_at IS NULL` mặc định trong access layer
- Prefix bảng PAS: không cần prefix `pas_` (vì namespace đã rõ qua semantic)

### 21.3. UI/UX principles
- Member chưa quen tool có cấu trúc → form ngắn, ít field bắt buộc nhất có thể
- Field optional rõ ràng đánh dấu "(Tùy chọn)" hoặc không có dấu *
- Default value smart (current user làm owner, current month, v.v.)
- Inline validation
- Mobile-friendly cho 3 màn hình quan trọng: Problem list, Action update, Notification
- Reuse component có sẵn từ `src/components/app-state/`
- Bám style của `src/app/app/kpis/page.tsx` cho nhất quán

### 21.4. Permission pattern
- Dùng helper từ `src/lib/permissions.ts`
- Mở rộng thêm helper PAS theo cùng pattern (không tạo file permissions riêng)
- RLS ở DB layer là last line of defense, UI check là first line

### 21.5. Activity log pattern
```typescript
import { logActivity } from '@/lib/activityLogger';

await logActivity({
  workspaceId,
  entityType: 'problem',
  entityId: newProblem.id,
  action: 'create',
  detail: { title, severity, owner_id }
});
```

### 21.6. Error handling
- Dùng `formatError` từ `src/lib/errorUtils.ts`
- Hiển thị friendly message tiếng Việt
- Không expose stack trace cho user

### 21.7. Testing
- Unit test cho business rule:
  - status transition Problem
  - overdue calc Action
  - severity auto-downgrade
  - repeated detection
  - result lock after evaluation
- E2E test cho 3 flow chính:
  - Tạo problem → action → result → evaluate → pattern
  - Tạo problem từ KPI
  - Soft delete + restore
- **TEST BẮT BUỘC:** scoring-isolation (xem section 16.4)

### 21.8. Performance
- Volume nhỏ (10-15 problem/tuần × 1 năm ≈ 600-800 problem) → không cần optimization sớm
- Indexes cần thiết:
  - `problems(workspace_id, department_id, status, deleted_at)`
  - `problems(problem_owner_id, deleted_at)`
  - `problems(related_kpi_id) WHERE deleted_at IS NULL`
  - `root_causes(problem_id, deleted_at)`
  - `actions(problem_id, status, deleted_at)`
  - `actions(action_owner_id, deadline, deleted_at)`
  - `evaluations(action_id)`
  - `solution_patterns(workspace_id, problem_type_id, deleted_at)`

---

## 22. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Manager không evaluate kịp → action chết ở Done không Pass | High | High | Notification + dashboard "Pending Evaluation" + chế tài weekly review |
| Member nhập đối phó (root cause = "không biết") | Medium | High | Training Phase 0 + manager spot check + Q1 metric theo dõi |
| Solution Library sinh chậm, library rỗng trong 6 tuần đầu | Medium | Medium | Champion manager chủ động tạo pattern từ case có sẵn |
| Taxonomy không cover hết case → user không chọn được Problem Type | High | Medium | Phase 0 chốt taxonomy với 5 team + cho phép đề xuất type mới |
| Severity inflation (ai cũng đánh Critical) | Medium | Low | Rule auto-downgrade nếu Manager không confirm |
| PO overload (kiêm PAS Owner + PO + dev coordination) | High | High | Champion manager làm ambassador; chia rõ pre-launch vs post-launch responsibilities |
| KPI module thay đổi schema → PAS bị break | Low | High | PAS dùng FK lỏng (`ON DELETE SET NULL`) + test scoring-isolation |
| Action không gắn root cause nhiều (warning bị ignore) | Medium | High | Theo dõi Q2 metric, nếu < 60% trong tháng 1 thì cân nhắc đổi sang block cứng ở phase 2 |
| Skip Sprint 0 → RLS profiles bug làm PAS authorization lỗi | Medium | High | Mạnh khuyến nghị làm Sprint 0 trước. Nếu skip, monitor profile load error logs |
| 47 user, 5 team — quá nhỏ để có Analytics ý nghĩa nếu rollout không kỷ luật | Medium | Medium | Bám kế hoạch Phase 0-3; PO theo dõi L1-L4 hàng tuần |

---

## 23. Decisions Auto-resolved (PO override-able)

Giữ nguyên 12 quyết định từ v2, không đổi.

| # | Quyết định | Lý do tự chốt | Override nếu |
|---|---|---|---|
| 1 | Soft delete cho mọi entity | Volume nhỏ, audit trail quan trọng | PO muốn hard delete |
| 2 | Deadline change không cần approval, chỉ log | Reduce friction | PO muốn manager approve |
| 3 | Cancel action cần lý do, không cần approval | Quick action | PO muốn manager approve |
| 4 | Notification in-app, poll, không real-time | MVP gọn, đỡ infra | PO muốn real-time/email |
| 5 | Analytics built-in dashboard | Đo metric must-have | PO chấp nhận export Excel tay |
| 6 | Critical severity auto-downgrade sau 48h | Chống inflation | PO muốn manager confirm mới hạ |
| 7 | Result auto-lock sau evaluate, Manager unlock | Chống chỉnh sửa sau Pass | PO muốn lock cứng vĩnh viễn |
| 8 | 1 Result per Action (không snapshot lịch sử) | MVP gọn | PO muốn track lịch sử update result |
| 9 | Action không Root Cause: warning, không block | Linh hoạt exploratory | PO muốn block cứng |
| 10 | Investigative Action: defer phase sau | Không phức tạp MVP | PO thấy nhiều case cần |
| 11 | 1 Pattern - 1 source action | MVP gọn | PO muốn many-to-many |
| 12 | Member tự đánh Critical, Manager confirm trong 48h | Cân bằng giữa empower và control | PO muốn Manager ép set Critical |

**Quyết định mới ở v3 (PO có thể override):**

| # | Quyết định | Lý do | Override nếu |
|---|---|---|---|
| 13 | Feature flag `pas_enabled` per workspace, default false | Cho phép Phase 1 pilot 2 team mà không cần deploy lại | PO muốn bật cho all khi merge |
| 14 | Sprint 0 dọn nợ kỹ thuật (strongly recommended) | Tránh PAS kế thừa bug authorization của KPI | PO chấp nhận rủi ro authorization |
| 15 | KPI scoring isolation test bắt buộc | Bảo vệ KPI không bị PAS làm hỏng | Không nên override |

---

## 24. Kết luận

PRD v3 sẵn sàng để dev với Claude Code trên codebase KPI app hiện có.

**Khác biệt chính so với v2:**

1. **Khớp với stack thực tế** (React+Vite, không phải Next.js)
2. **Reuse infra hiện có** (alertEngine, notificationEngine, digestEngine, activityLogger, permissions, profiles, departments, products)
3. **Map cụ thể file/folder** trong codebase — Claude Code có thể đọc và làm trực tiếp
4. **Thêm Sprint 0** để xử lý nợ kỹ thuật trước
5. **Thêm feature flag** `pas_enabled` cho phép Phase 1 pilot
6. **Bảo vệ KPI** bằng scoring-isolation test bắt buộc
7. **Migration numbering** tiếp nối 003 đã có

**Việc cần làm tiếp theo của PO:**

1. Review PRD v3, override các quyết định ở section 23 nếu muốn
2. Cài đặt Claude Code và làm quen (đã có hướng dẫn riêng)
3. Quyết định: làm Sprint 0 hay skip
4. Tải file PRD này về, đẩy vào Project hoặc đưa cho Claude Code
5. Chuẩn bị Phase 0 (taxonomy seed + training material) song song với Sprint 1-4
6. Identify 2 champion manager + ambassador

---

**End of PRD v3**
