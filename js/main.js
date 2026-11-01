// Header background on scroll
const bar = document.getElementById('top-bar');
const onScroll = () => bar.classList.toggle('scrolled', window.scrollY > 40);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// Mobile menu
const burger = document.getElementById('burger');
burger.addEventListener('click', () => {
  const open = bar.classList.toggle('menu-open');
  burger.setAttribute('aria-expanded', open);
});
document.querySelectorAll('#nav-links a').forEach(a => a.addEventListener('click', () => {
  bar.classList.remove('menu-open');
  burger.setAttribute('aria-expanded', false);
}));

// Reveal on scroll
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: .15, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// Open now indicator (Пн-Пт 08-23, Сб-Нд 09-22)
const now = new Date();
const day = now.getDay();
const h = now.getHours() + now.getMinutes() / 60;
const weekend = day === 0 || day === 6;
const [from, to] = weekend ? [9, 22] : [8, 23];
const openEl = document.getElementById('open-now');
if (h >= from && h < to) {
  openEl.textContent = `Отворено сега · до ${to}:00`;
  openEl.classList.add('is-open');
} else {
  // След затваряне следващото отваряне е утре — съботата и неделята отварят в 09:00
  const next = h < from ? day : (day + 1) % 7;
  const nextFrom = next === 0 || next === 6 ? 9 : 8;
  openEl.textContent = `Затворено · отваряме ${h < from ? 'днес' : 'утре'} в 0${nextFrom}:00`;
}

document.getElementById('year').textContent = now.getFullYear();
