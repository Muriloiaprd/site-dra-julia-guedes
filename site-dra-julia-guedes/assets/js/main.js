// ===== AOS INIT =====
document.addEventListener('DOMContentLoaded', function () {
  if (typeof AOS !== 'undefined') {
    AOS.init({
      duration: 700,
      easing: 'ease-out-cubic',
      once: true,
      offset: 60,
    });
  }

  // Rede lenta ou CDN do AOS fora do ar: sem isso as seções ficam com
  // opacity:0/pointer-events:none para sempre (ver auditoria F6.4).
  setTimeout(function () {
    if (typeof AOS === 'undefined') {
      document.querySelectorAll('[data-aos]').forEach(function (el) {
        el.style.opacity = '1';
        el.style.transform = 'none';
        el.style.pointerEvents = 'auto';
      });
    }
  }, 4000);

  // ===== SWIPER SERVIÇOS =====
  if (typeof Swiper !== 'undefined') {
    new Swiper('.swiper-servicos', {
      slidesPerView: 1.5,
      spaceBetween: 20,
      loop: true,
      navigation: { nextEl: '.swiper-servicos .swiper-button-next', prevEl: '.swiper-servicos .swiper-button-prev' },
      breakpoints: {
        480:  { slidesPerView: 2.2 },
        768:  { slidesPerView: 3.2 },
        1024: { slidesPerView: 4.2 },
        1280: { slidesPerView: 5 },
      },
    });
  }

  // ===== SWIPER DEPOIMENTOS =====
  if (typeof Swiper !== 'undefined') {
    new Swiper('.swiper-depoimentos', {
      slidesPerView: 1,
      spaceBetween: 24,
      loop: true,
      autoplay: { delay: 5000, disableOnInteraction: false },
      navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
      breakpoints: {
        640:  { slidesPerView: 1.2 },
        768:  { slidesPerView: 2 },
        1024: { slidesPerView: 3 },
      },
    });
  }

  // ===== "VER MAIS" NOS DEPOIMENTOS =====
  // O texto trava em 5 linhas via CSS (line-clamp). Só mostramos o botão
  // quando o texto realmente foi cortado, comparando altura visível x altura real.
  document.querySelectorAll('.testimonial-card').forEach(function (card) {
    const text = card.querySelector('.testimonial-text');
    const btn = card.querySelector('.ver-mais-btn');
    if (!text || !btn) return;

    if (text.scrollHeight <= text.clientHeight + 2) {
      // Mantém o espaço reservado (não remove do layout) para todos os
      // cards continuarem com a mesma altura, com ou sem o botão.
      btn.style.visibility = 'hidden';
      return;
    }

    btn.addEventListener('click', function () {
      const expanded = text.classList.toggle('expanded');
      btn.textContent = expanded ? 'Ver menos' : 'Ver mais';
    });
  });

  // ===== FORMULÁRIO → WHATSAPP =====
  // Único listener de submit do formulário — não duplicar com uma diretiva
  // Alpine @submit no HTML (ver auditoria F1.1: isso já causou duas abas
  // do WhatsApp abrindo ao mesmo tempo).
  const form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const name    = document.getElementById('f-name').value.trim();
      const phone   = document.getElementById('f-phone').value.trim();
      const email   = document.getElementById('f-email').value.trim();
      const message = document.getElementById('f-message').value.trim();

      if (!name || !phone || !message) {
        alert('Por favor, preencha nome, telefone e mensagem.');
        return;
      }

      const text = `Olá, Dra. Julia! 😊\n\nMeu nome é *${name}*.\nTelefone: ${phone}\nE-mail: ${email || 'Não informado'}\n\nMensagem:\n${message}`;
      window.open(`https://wa.me/5532984624848?text=${encodeURIComponent(text)}`, '_blank');

      const success = document.getElementById('form-success');
      if (success) success.style.display = 'block';
      form.reset();
    });
  }

  // ===== ACTIVE NAV LINK ON SCROLL =====
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  function setActiveLink() {
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop - 100;
      if (window.scrollY >= sectionTop) current = section.getAttribute('id');
    });
    navLinks.forEach(link => {
      link.classList.remove('text-rosegold', 'font-semibold');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('text-rosegold', 'font-semibold');
      }
    });
  }

  window.addEventListener('scroll', setActiveLink, { passive: true });
});
