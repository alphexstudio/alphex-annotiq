(function (A) {
  const c = A.util.call, q = o => '?organization_id=' + encodeURIComponent(o);
  A.analytics = { summary: o => c('GET', '/dashboard/summary' + q(o)), activity: o => c('GET', '/dashboard/activity' + q(o)) };
})(window.Alphex);
