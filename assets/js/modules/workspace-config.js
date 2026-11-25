/* Workspace configuration dialog (labels, selection mode, rubric, scale, blind/randomise, assignment). Saved into project.config via the project service. */
(function (A) {
  const U = A.util, esc = U.esc, ui = A.ui, M = A.model;
  function open(P) {
    const m = M.mode(P), C = M.config(P), text = ['cls', 'ner', 'span'].includes(m);
    if (!m) { const d = ui.dialog('<h2>Workspace configuration</h2><p class="mu">This project type has no workspace yet.</p><div class="acts"><button class="btn sec" type="button">Close</button></div>'); d.querySelector('button').onclick = () => d.close(); return; }
    const R = C.rubric, a = ui.fld('Task assignment', '<select name="assignment"><option value="self"' + (C.assignment === 'self' ? ' selected' : '') + '>Self-assign (annotators claim tasks)</option><option value="manual"' + (C.assignment === 'manual' ? ' selected' : '') + '>Manual (managers assign)</option></select>');
    const body = text ? ui.fld('Labels (one per line)', '<textarea name="labels" rows="6">' + esc(C.labels.join('\n')) + '</textarea>') + (m === 'cls' ? ui.fld('Selection mode', '<select name="selection"><option value="single"' + (C.selection === 'single' ? ' selected' : '') + '>Single label</option><option value="multi"' + (C.selection === 'multi' ? ' selected' : '') + '>Multiple labels</option></select>') : '') :
      ui.fld('Scoring dimensions (one per line: Name | Description | Guidance)', '<textarea name="dims" rows="7">' + esc(R.dimensions.map(x => [x.name, x.description, x.guidance].join(' | ')).join('\n')) + '</textarea>') + '<div class="two">' + ui.fld('Minimum score', '<input type="number" name="min" value="' + R.min + '">') + ui.fld('Maximum score', '<input type="number" name="max" value="' + R.max + '">') + '</div>' +
      ui.fld('Evaluation instructions', '<textarea name="rinstr">' + esc(R.instructions) + '</textarea>') + (m === 'side' || m === 'ranking' ? '<label class="fld"><span><input type="checkbox" name="blind" style="width:auto"' + (C.blind ? ' checked' : '') + '> Blind mode (hide model names)</span></label><label class="fld"><span><input type="checkbox" name="randomize" style="width:auto"' + (C.randomize ? ' checked' : '') + '> Randomise presentation order</span></label>' : '');
    const d = ui.dialog('<form><h2>Workspace configuration</h2><p class="mu small">' + esc(P.name) + '. Applies to everyone working on this project.</p>' + body + a + '<p class="msg" role="alert"></p><div class="acts"><button class="btn sec" type="button" data-x>Cancel</button><button class="btn pri" type="submit">Save configuration</button></div></form>', 'wide'), f = d.querySelector('form'), msg = f.querySelector('.msg');
    f.querySelector('[data-x]').onclick = () => d.close();
    f.onsubmit = async e => { e.preventDefault(); const x = f.elements, cfg = Object.assign({}, P.config || {}, { assignment: x.assignment.value });
      if (text) { cfg.labels = x.labels.value.split('\n').map(s => s.trim()).filter(Boolean); if (x.selection) cfg.selection = x.selection.value; }
      else { const dims = x.dims.value.split('\n').map(s => s.trim()).filter(Boolean).map(l => { const p = l.split('|').map(s => s.trim()); return { id: M.slug(p[0]), name: p[0], description: p[1] || '', guidance: p[2] || '' }; });
        cfg.rubric = { min: parseInt(x.min.value, 10), max: parseInt(x.max.value, 10), instructions: x.rinstr.value, dimensions: dims }; if (x.blind) { cfg.blind = x.blind.checked; cfg.randomize = x.randomize.checked; } }
      const er = M.vConfig(cfg); if (er.length) { msg.textContent = er.join(' '); return; }
      try { await A.projects.update(P.id, { config: cfg }); d.close(); U.toast('Configuration saved.'); document.dispatchEvent(new CustomEvent('alphex:project-saved')); } catch (err) { msg.textContent = err.message; } };
  }
  A.wsConfig = { open };
})(window.Alphex);
