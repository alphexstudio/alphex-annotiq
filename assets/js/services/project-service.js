(function (A) {
  const c = A.util.call, id = encodeURIComponent;
  A.projects = { list: o => c('GET', '/projects' + A.util.qs(o)), create: b => c('POST', '/projects', b),
    get: i => c('GET', '/projects/' + id(i)), update: (i, b) => c('PATCH', '/projects/' + id(i), b), archive: i => c('PATCH', '/projects/' + id(i), { status: 'archived' }) };
})(window.Alphex);
