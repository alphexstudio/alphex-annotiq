# Image annotation (Phase 4)
Vanilla `<canvas>` engine (`assets/js/modules/image-canvas.js`). No external library, so the workspace runs offline and without a build step.

## Coordinate convention
All geometry is **normalized to the original image**: `x, y, w, h` in [0,1], origin top-left, y down. Pixels = value x image width (x, w) or height (y, h). Zoom, pan and window size only change the drawing transform; stored data never depends on canvas size. Validation (UI and server stand-in): boxes need w,h > 0, stay inside [0,1], and respect `config.min_box_px` (default 2 px of the original image); polygons need 3 to 1000 vertices, 3 distinct points, inside [0,1], area of at least 1 px squared; points inside [0,1]. Self-intersecting polygons are not rejected.

## annotation_data (task_type `image_annotation`)
```
{ classification: { label_ids: [..], labels: [..names..] },
  objects: [ { id, task_id, type:'bbox', label_id, label, x, y, w, h, confidence?, annotator_id, created_at },
             { id, ..., type:'polygon', points:[{x,y},...] },
             { id, ..., type:'point', x, y } ],
  mask: { key, width, height, classes:[label_id,...], rev, nonzero } | null }
```
`label` is a display copy; **resolve names and colors by `label_id`** (labels can be renamed). One project uses one annotation type: classification, bounding boxes, polygons, points, or segmentation. Objects of another type are rejected.

## Entities (relational mapping)
| Requested entity | Where it lives |
|---|---|
| image_tasks | `tasks` with `task_type='image_annotation'`, `payload.image` = `{source:'demo'\|'asset'\|'url', ref, filename, width, height, size_bytes}` |
| image_assets | mock: IndexedDB store `images` (blob + metadata). Production: object storage + a table keyed by asset id, organization_id, project_id |
| image_labels | `project.config.labels[]` = `{id, name, description, color:'#rrggbb', created_at}` (one label system per project; text projects still accept plain strings) |
| image_annotations | `annotations.annotation_data` |
| bounding_boxes, polygons, points | items in `annotation_data.objects` (split into tables if desired) |
| segmentation_masks | metadata in `annotation_data.mask`; pixels in IndexedDB store `masks` (mock) or an object-storage file (production) |
| annotation_history | `task.history[]`: `{id, organization_id, task_id, subject_id, action:'submitted'\|'review_approved'\|'review_rejected', version, actor_id, created_at}`. Undo history is client-only and not persisted |
Every row keeps `organization_id`, `project_id`, `task_id`, `dataset_id`/`record_id`, annotator and reviewer links.

## Segmentation mask representation
Indexed mask: one byte per pixel at a working resolution (long side at most 1024 px, same aspect ratio as the image). 0 = background, k = `classes[k-1]` (label id), up to 254 classes, one class per pixel. Stored run-length encoded as `[value, run, ...]` (row-major) in IndexedDB; never in localStorage and never as base64. Limitations: semantic (not instance) masks; resolution lower than very large images; only the latest mask per task is kept (no per-version mask history); production should store the mask as PNG or RLE in object storage and keep the key in `annotation_data.mask`.

## Export formats (Project > Tasks > Export)
Scope: approved only, or approved plus awaiting review. A report is shown and, for YOLO, bundled as `export_report.txt`.
- **COCO JSON**: images, categories, annotations. Boxes `[x,y,w,h]` pixels; polygons as `segmentation` pixel lists; masks as per-class uncompressed RLE (column-major, `iscrowd=1`, resampled to full image size); points as single-keypoint annotations; image-level labels in the custom field `images[].alphex_image_labels`. Custom fields are prefixed `alphex_`.
- **YOLO (ZIP)**: one `labels/<image>.txt` per image (`class_id cx cy w h`, normalized) plus `classes.txt`. YOLO detection cannot hold polygons, points, masks or image-level labels: they are **skipped and counted in the report**, never dropped silently.
- **Alphex JSON**: everything (project, datasets, labels, images, annotator, timestamps, objects, classification, RLE mask).
Mock mode builds exports in the browser; production should expose `GET /api/v1/projects/{id}/export?format=coco|yolo|json&scope=approved|all`.

## Limits and performance
Overlays redraw on a `requestAnimationFrame` schedule; the image layer redraws only when the view changes; mask brush updates only the dirty rectangle. Import limits (mock): JPG/JPEG/PNG/WebP, 15 MB per file, 8192 px per side, 40 megapixels, 100 files per import. Practical limits: images up to roughly 20 megapixels stay responsive; 500 objects per image; undo history keeps 80 steps (object snapshots as JSON, mask strokes as pixel diffs; images are never copied). The mouse wheel zooms over the canvas, so it does not scroll the page there.

## Security and backend requirements
Escape all labels and filenames (done in the UI); validate file type by decoding, size and dimensions server-side; store images in private storage with signed, short-lived URLs; re-run all geometry and label checks server-side (the client checks are convenience only); enforce organization isolation, assignee-only writes, label-management permissions, and the review state machine; scan uploads; set CORS and cache headers for signed URLs. Mock mode is local to one browser and has no real storage or multi-user sync.
