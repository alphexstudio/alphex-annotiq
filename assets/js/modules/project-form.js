/* Create/edit project dialog, shared by every page. Open with A.projectForm.open([project]) or the 'alphex:create-project' event. */
(function (A) {
  const U = A.util, esc = U.esc, ui = A.ui, mock = A.config.MODE === 'mock';
  const opt = (a, v) => a.map(([k, l]) => '<option value="' + esc(k) + '"' + (k === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('');
  const TYPES = Object.keys(ui.ANN).map(k => [k, U.TYPES[k]]);
  function open(p) {
    const v = Object.assign({ type: 'text_annotation', priority: 'medium', status: 'draft' }, p || {});
    const d = ui.dialog('<form><h2>' + (p ? 'Edit project' : 'Create project') + '</h2><p class="mu small">' + (mock ? 'Mock mode: saved in this browser only.' : '') + '</p>' +
      ui.fld('Project name', '<input name="name" required maxlength="120" value="' + esc(v.name || '') + '">') + ui.fld('Description', '<textarea name="description">' + esc(v.description || '') + '</textarea>') +
      '<div class="two">' + ui.fld('Project type', '<select name="type">' + opt(TYPES, v.type) + '</select>') + ui.fld('Annotation type', '<select name="annotation_type"></select>') + '</div>' +
      '<div class="two">' + ui.fld('Priority', '<select name="priority">' + opt([['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['urgent', 'Urgent']], v.priority) + '</select>') +
      (p ? ui.fld('Status', '<select name="status">' + opt([['draft', 'Draft'], ['active', 'Active'], ['completed', 'Completed'], ['archived', 'Archived']], v.status) + '</select>') : '<div></div>') + '</div>' +
      '<div class="two">' + ui.fld('Start date', '<input type="date" name="start_date" value="' + esc(v.start_date || '') + '">') + ui.fld('Due date', '<input type="date" name="due_date" value="' + esc(v.due_date || '') + '">') + '</div>' +
      ui.fld('Project instructions', '<textarea name="instructions">' + esc(v.instructions || '') + '</textarea>') +
      '<p class="msg" role="alert"></p><div class="acts"><button class="btn sec" type="button" data-x>Cancel</button><button class="btn pri" type="submit">' + (p ? 'Save changes' : 'Create project') + '</button></div></form>');
    const f = d.querySelector('form'), t = f.elements.type, a = f.elements.annotation_type, msg = f.querySelector('.msg');
    const fill = () => { a.innerHTML = opt(ui.ANN[t.value], v.annotation_type); }; t.onchange = () => { v.annotation_type = null; fill(); }; fill();
    f.querySelector('[data-x]').onclick = () => d.close();
    f.onsubmit = async e => { e.preventDefault(); const x = Object.fromEntries(new FormData(f));
      if (x.start_date && x.due_date && x.due_date < x.start_date) { msg.textContent = 'Due date cannot be before the start date.'; return; }
      const btn = f.querySelector('[type=submit]'); btn.disabled = true; msg.textContent = '';
      try { const s = p ? await A.projects.update(p.id, x) : await A.projects.create(Object.assign(x, { organization_id: A.state.get('org') }));
        d.close(); U.toast(p ? 'Project saved.' : 'Project created.'); document.dispatchEvent(new CustomEvent('alphex:project-saved', { detail: s })); }
      catch (err) { msg.textContent = err.message; btn.disabled = false; } };
  }
  document.addEventListener('alphex:create-project', () => open());
  A.projectForm = { open };
})(window.Alphex);
