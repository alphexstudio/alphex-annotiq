(function (A) {
  const c = A.util.call, id = encodeURIComponent;
  A.tasks = { page: o => A.util.page('/tasks', o), get: i => c('GET', '/tasks/' + id(i)), assign: i => c('POST', '/tasks/' + id(i) + '/assign', {}), skip: i => c('POST', '/tasks/' + id(i) + '/skip', {}),
    generate: p => c('POST', '/projects/' + id(p) + '/tasks/generate', {}), labelUsage: p => c('GET', '/projects/' + id(p) + '/label-usage') };   // label-usage: proposed   // generate: proposed endpoint (backend job in production)
})(window.Alphex);
