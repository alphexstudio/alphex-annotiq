/* Auth service. Passwords are sent to the backend and never stored. Session = httpOnly cookie or in-memory token.
   Frontend checks are UX only; the backend must authorise every request. */
(function (A) {
  const root = () => document.body.dataset.root || '', call = A.util.call;
  A.auth = {
    token: null, user: null,
    async login(email, password) { const d = await call('POST', '/auth/login', { email, password }); this.user = d.user; this.token = d.token || null; return d.user; },
    register: b => call('POST', '/auth/register', b),
    async verify(code) { const d = await call('POST', '/auth/verify', { code }); this.user = d.user; return d.user; },
    resend: () => call('POST', '/auth/resend', {}),
    forgot: email => call('POST', '/auth/forgot-password', { email }),
    async me() { if (this.user) return this.user; try { this.user = await call('GET', '/auth/me'); return this.user; } catch (e) { if (e.status === 401) this.expired(); throw e; } },
    async logout() { try { await call('POST', '/auth/logout'); } finally { this.user = null; this.token = null; location.replace(root() + 'login.html'); } },
    expired(reason) { location.replace(root() + 'login.html' + (reason ? '?reason=' + reason : '')); }
  };
})(window.Alphex);
