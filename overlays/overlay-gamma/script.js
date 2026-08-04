function tick() {
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString('de-DE');
  document.getElementById('date').textContent = now.toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

tick();
setInterval(tick, 1000);

document.getElementById('route').textContent = window.location.pathname;
