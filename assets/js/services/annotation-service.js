/* Drafts and submissions share the task endpoints: PUT /tasks/{id}/draft and POST /tasks/{id}/submit (body: {data}). See docs/API_CONTRACTS.md. */
(function (A) { const c = A.util.call, id = encodeURIComponent;
  A.annotations = { saveDraft: (t, data) => c('PUT', '/tasks/' + id(t) + '/draft', { data }), submit: (t, data) => c('POST', '/tasks/' + id(t) + '/submit', { data }) }; })(window.Alphex);
