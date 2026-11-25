(function (A) { A.team = { orgs: () => A.util.call('GET', '/organizations'), members: id => A.util.call('GET', '/organizations/' + encodeURIComponent(id) + '/members') }; })(window.Alphex);
