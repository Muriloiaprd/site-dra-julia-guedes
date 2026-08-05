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

  // ===== SWIPER DEPOIMENTOS =====
  if (typeof Swiper !== 'undefined') {
    new Swiper('.swiper-depoimentos', {
      slidesPerView: 1,
      spaceBetween: 24,
      loop: true,
      autoplay: { delay: 5000, disableOnInteraction: false },
      pagination: { el: '.swiper-pagination', clickable: true },
      navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
      breakpoints: {
        640:  { slidesPerView: 1.2 },
        768:  { slidesPerView: 2 },
        1024: { slidesPerView: 3 },
      },
    });
  }

  // ===== FORMULÁRIO → WHATSAPP =====
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
