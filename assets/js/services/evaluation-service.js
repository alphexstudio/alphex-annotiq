(function (A) { const c = A.util.call, id = encodeURIComponent;
  A.evaluations = { saveDraft: (t, data) => c('PUT', '/tasks/' + id(t) + '/draft', { data }), submit: (t, data) => c('POST', '/tasks/' + id(t) + '/submit', { data }) }; })(window.Alphex);
