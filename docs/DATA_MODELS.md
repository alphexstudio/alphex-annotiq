# Data models (Phase 1-3)
All organization-owned rows carry `organization_id`. IDs are stable strings, timestamps are ISO 8601 UTC. The mock stores these as JSON; each maps to one relational table.
**Offsets:** `start` inclusive, `end` exclusive, zero-based UTF-16 code-unit indexes (JavaScript string indexes). Python or SQL backends must convert if they count code points. The original text is never modified; only `{start,end,text,label}` is stored.

| Entity | Key fields |
|---|---|
| projects | id, organization_id, name, description, type, annotation_type, status, priority, start_date, due_date, instructions, **config** (Phase 3, optional), created_by, created_at, updated_at |
| project.config | `labels: string[]`, `selection: single\|multi`, `blind`, `randomize`, `assignment: self\|manual`, `rubric:{min,max,instructions,dimensions:[{id,name,description,guidance}]}`. Missing config falls back to defaults (`A.model.config`). |
| datasets / dataset_records | see Phase 2. A record is `{id, dataset_id, organization_id, index, data:{...}}` |
| tasks | id, organization_id, project_id, dataset_id, record_id, index, task_type `text_annotation\|ai_evaluation`, status `unassigned\|assigned\|in_progress\|completed\|skipped`, review_status `none\|pending\|approved\|rejected`, assigned_to, payload (snapshot of the record), created_at, updated_at |
| task_assignments | id, task_id, organization_id, user_id, assigned_at |
| annotations | id, organization_id, project_id, task_id, annotator_id, annotation_type, status `draft\|submitted\|approved\|rejected`, version, annotation_data, created_at, updated_at |
| annotation_data | classification: `{labels:string[]}`; NER/span: `{spans:[{id,start,end,text,label}]}` (maps to an `annotation_spans` table) |
| evaluations | id, organization_id, project_id, task_id, evaluator_id, method, status, version, evaluation_data, created_at, updated_at |
| evaluation_data | `{presented_order:string[], blind, scores:{dimensionId:{score,justification}}, preferred:responseId\|'tie'\|'both_poor', ranking:responseId[], rationale}` (maps to `evaluation_scores` and `evaluation_rankings`). `preferred` and `ranking` always use underlying response ids, never display positions. |
| reviews | id, organization_id, project_id, task_id, subject_type, subject_id, reviewer_id, decision `approved\|rejected`, comments, created_at |
| task_activity | activity_logs rows with `task_id` set (id, organization_id, project_id, dataset_id, task_id, actor_id, action, summary, created_at) |

Task payloads: text `{field,text}`; evaluation `{prompt, reference|null, responses:[{id,field,text,model|null}]}`.
