/* Drives login, signup, forgot-password and verify forms (form[data-auth]). */
(function (A) {
  const f = document.querySelector('form[data-auth]'); if (!f) return;
  const k = f.dataset.auth, root = document.body.dataset.root || '', $ = s => document.getElementById(s), q = new URLSearchParams(location.search);
  const msg = (t, ok) => { $('msg').textContent = t; $('msg').className = 'msg' + (ok ? ' ok' : ''); };
  if (A.config.MODE === 'mock') $('mode').textContent = 'Mock mode: nothing is verified, stored or emailed. Any valid-looking details will work.';
  if (q.get('reason') === 'expired') msg('Your session expired. Sign in again.');
  if (k === 'verify') { $('addr').textContent = q.get('email') || 'your email address'; $('resend').onclick = async () => { try { await A.auth.resend(); msg('A new code has been requested.', 1); } catch (e) { msg(e.message); } }; }
  f.addEventListener('submit', async e => {
    e.preventDefault(); msg(''); const d = Object.fromEntries(new FormData(f)), b = f.querySelector('button[type=submit]'), label = b.textContent;
    if (k === 'signup' && d.password !== d.confirm) return msg('Passwords do not match.');
    b.disabled = true; b.textContent = 'Please wait...';
    try {
      if (k === 'login') { await A.auth.login(d.email, d.password); location.href = root + 'dashboard/index.html'; }
      else if (k === 'signup') { await A.auth.register({ name: d.name, email: d.email, organization_name: d.organization_name, password: d.password }); location.href = root + 'verify.html?email=' + encodeURIComponent(d.email); }
      else if (k === 'verify') { await A.auth.verify(d.code); location.href = root + 'dashboard/index.html'; }
      else { await A.auth.forgot(d.email); msg('If an account exists for that email, a reset link is on its way.', 1); }
    } catch (err) { msg(err.message); } finally { b.disabled = false; b.textContent = label; }
  });
})(window.Alphex);
