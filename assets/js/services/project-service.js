(function (A) {
  const c = A.util.call, id = encodeURIComponent;
  A.projects = { list: o => c('GET', '/projects' + A.util.qs(o)), page: o => A.util.page('/projects', o), create: b => c('POST', '/projects', b),
    get: i => c('GET', '/projects/' + id(i)), update: (i, b) => c('PATCH', '/projects/' + id(i), b), archive: i => c('PATCH', '/projects/' + id(i), { status: 'archived' }), remove: i => c('DELETE', '/projects/' + id(i)) };
  A.activity = { list: o => c('GET', '/activity-logs' + A.util.qs(o)) };   // proposed endpoint
})(window.Alphex);
