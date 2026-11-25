/* API client: GET/POST/PUT/PATCH/DELETE, JSON + file upload, timeout, error normalisation, loading events.
   Auth: httpOnly session cookie (credentials:'include') and/or in-memory bearer token. Never localStorage. */
(function (A) {
  const C = A.config;
  class ApiError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
  A.ApiError = ApiError;
  let busy = 0;
  const loading = d => { busy += d; document.dispatchEvent(new CustomEvent('alphex:loading', { detail: busy })); };
  async function request(method, path, { body, file, timeout = C.REQUEST_TIMEOUT_MS } = {}) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeout), h = { Accept: 'application/json' };
    if (A.auth && A.auth.token) h.Authorization = 'Bearer ' + A.auth.token;
    let payload;
    if (file) { if (file.size > C.MAX_UPLOAD_BYTES) throw new ApiError(413, 'FILE_TOO_LARGE', 'File exceeds the upload limit.'); payload = new FormData(); payload.append('file', file); }
    else if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    loading(1);
    try {
      const r = await fetch(C.API_BASE_URL + path, { method, headers: h, body: payload, signal: ctl.signal, credentials: 'include' });
      const j = r.status === 204 ? null : await r.json().catch(() => null);
      if (!r.ok) {
        if (r.status === 401 && !path.startsWith('/auth/')) A.auth && A.auth.expired('expired');
        throw new ApiError(r.status, (j && j.error && j.error.code) || 'HTTP_' + r.status, (j && j.error && j.error.message) || r.statusText || 'Request failed.');
      }
      return j;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw e.name === 'AbortError' ? new ApiError(0, 'TIMEOUT', 'The server took too long to respond.') : new ApiError(0, 'NETWORK', 'Cannot reach the API. Check API_BASE_URL in config.js.');
    } finally { clearTimeout(timer); loading(-1); }
  }
  const o = (x, y) => Object.assign({}, x, y);
  A.api = { request, get: (p, x) => request('GET', p, x), post: (p, b, x) => request('POST', p, o(x, { body: b })), put: (p, b, x) => request('PUT', p, o(x, { body: b })),
    patch: (p, b, x) => request('PATCH', p, o(x, { body: b })), del: (p, x) => request('DELETE', p, x), upload: (p, file) => request('POST', p, { file }) };
  /* Single switch between mock and real backend. Services only ever call A.util.call. */
  A.transport = (m, p, b) => C.MODE === 'mock' ? A.mock.handle(m, p, b) : request(m, p, { body: b });
  A.util.call = (m, p, b) => A.transport(m, p, b).then(r => r.data);
  A.util.page = (p, o) => A.transport('GET', p + A.util.qs(o)).then(r => ({ items: r.data, total: (r.meta && r.meta.total) || r.data.length, meta: r.meta || {} }));
})(window.Alphex);
