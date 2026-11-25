(function (A) {
  const c = A.util.call, id = encodeURIComponent;
  A.datasets = { page: o => A.util.page('/datasets', o), get: i => c('GET', '/datasets/' + id(i)), update: (i, b) => c('PATCH', '/datasets/' + id(i), b), remove: i => c('DELETE', '/datasets/' + id(i)),
    records: (i, o) => A.util.page('/datasets/' + id(i) + '/records', o).then(r => ({ items: r.items, total: r.total, available: r.meta.available !== false })),
    /* mock: records travel in the request body and stay in browser memory.
       production: create metadata, then send the file via POST /datasets/{id}/upload (or a signed upload URL). Untested until a backend exists. */
    async create(meta, file, records) { const mock = A.config.MODE === 'mock', d = await c('POST', '/datasets', mock ? Object.assign({ _records: records }, meta) : meta);
      if (!mock && file) await A.api.upload('/datasets/' + id(d.id) + '/upload', file); return d; } };
})(window.Alphex);
