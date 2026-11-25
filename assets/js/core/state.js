/* Tiny shared state store plus helpers. Namespace: window.Alphex */
(function () {
  const A = window.Alphex = window.Alphex || {};
  A.config = window.ALPHEX_CONFIG;
  const subs = {}, data = {};
  A.state = { get: k => data[k], set(k, v) { data[k] = v; (subs[k] || []).forEach(f => f(v)); }, on(k, f) { (subs[k] = subs[k] || []).push(f); } };
  const M = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  A.util = {
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => M[c]),
    qs(o) { const s = new URLSearchParams(Object.entries(o || {}).filter(([, v]) => v != null && v !== '')).toString(); return s ? '?' + s : ''; },
    ago(iso) { const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 6e4)); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); return h < 24 ? h + ' h ago' : Math.round(h / 24) + ' d ago'; },
    toast(t) { const e = document.createElement('div'); e.className = 'toast'; e.setAttribute('role', 'status'); e.textContent = t; document.body.appendChild(e); setTimeout(() => e.remove(), 3800); },
    TYPES: { text_annotation: 'Text Annotation', image_annotation: 'Image Annotation', ai_response_evaluation: 'AI Response Evaluation', multimodal_annotation: 'Multimodal Annotation' }
  };
})();
