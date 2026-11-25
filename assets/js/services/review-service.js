(function (A) { A.reviews = { list: o => A.util.page('/reviews', o), decide: (task_id, decision, comments) => A.util.call('POST', '/reviews', { task_id, decision, comments }) }; })(window.Alphex);
