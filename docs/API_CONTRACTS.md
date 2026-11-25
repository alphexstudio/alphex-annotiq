# API contracts (proposed; no real backend exists yet)
Envelope: `{data, meta?}`. Errors: `{error:{code,message}}` with HTTP 4xx/5xx. Lists return `meta:{page,limit,total}`. The mock adapter answers every route below.

## Phase 3 routes
| Route | Body / query | Result |
|---|---|---|
| POST /api/v1/projects/{id}/tasks/generate *(proposed)* | none | `{created, skipped, total}` (production: a backend job) |
| GET /api/v1/tasks | project_id, status, organization_id, page, limit | task[] (with `assigned_to_name`, `annotation`, `evaluation`, `reviews` expanded) |
| GET /api/v1/tasks/{id} | | task |
| POST /api/v1/tasks/{id}/assign | | task. 409 `ALREADY_ASSIGNED` |
| POST /api/v1/tasks/{id}/skip *(proposed)* | | task. 409 `ALREADY_SUBMITTED` |
| PUT /api/v1/tasks/{id}/draft *(proposed)* | `{data}` annotation_data or evaluation_data | `{saved_at, task}`. 403 `NOT_ASSIGNED`, 409 `ALREADY_SUBMITTED`, 422 `VALIDATION` |
| POST /api/v1/tasks/{id}/submit | `{data}` | task (status completed, review_status pending, version+1). Same errors as draft, with completeness checks |
| GET /api/v1/reviews | status `pending\|approved\|rejected`, project_id, page, limit | task[] awaiting or carrying that review state |
| POST /api/v1/reviews | `{task_id, decision, comments}` | review. 409 `NOT_PENDING`; comments required when rejecting. A rejection returns the task to `in_progress` |
| PATCH /api/v1/projects/{id} | `{config:{...}}` | project. 422 on invalid config |

The spec's `/annotations` and `/evaluations` resources are served through the task endpoints in this prototype; split them out if preferred. Phase 2 routes (`/projects`, `/datasets`, `/activity-logs`) are unchanged.

## Validation the backend must enforce
Offsets inside the text, integers, start<end, `text` equals the slice, no overlaps, labels in project config, single-label limit, unique span ids; scores whole numbers in the configured range; side-by-side preference in {response ids, tie, both_poor}; rankings list each response once; rationale at most 5000 characters; no submission after submit (409); only the assignee may save or submit; organization isolation on every query.
