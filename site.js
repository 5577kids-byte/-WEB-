const header = document.getElementById('header');
const nav = document.getElementById('nav');
const hamburger = document.getElementById('hamburger');

function closeNavigation() {
  if (!nav || !hamburger) return;
  nav.classList.remove('open');
  hamburger.classList.remove('open');
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.setAttribute('aria-label', 'メニューを開く');
  document.body.classList.remove('nav-open');
}

function toggleNavigation() {
  if (!nav || !hamburger) return;
  const open = nav.classList.toggle('open');
  hamburger.classList.toggle('open', open);
  hamburger.setAttribute('aria-expanded', String(open));
  hamburger.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
  document.body.classList.toggle('nav-open', open);
}

hamburger?.addEventListener('click', toggleNavigation);
nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeNavigation));
document.addEventListener('click', event => {
  if (header && !header.contains(event.target)) closeNavigation();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeNavigation();
});
window.addEventListener('resize', () => {
  if (window.innerWidth > 980) closeNavigation();
}, { passive: true });
window.addEventListener('scroll', () => {
  header?.classList.toggle('scrolled', window.scrollY > 24);
}, { passive: true });

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealElements = [...document.querySelectorAll('[data-reveal]')];
if (reducedMotion || !('IntersectionObserver' in window)) {
  revealElements.forEach(element => element.classList.add('revealed'));
} else {
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('revealed');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: .08, rootMargin: '0px 0px -36px' });
  revealElements.forEach(element => revealObserver.observe(element));
}

document.querySelectorAll('[data-video-toggle]').forEach(button => {
  const hero = button.closest('.page-hero');
  const video = hero?.querySelector('video');
  if (!video) {
    button.hidden = true;
    return;
  }

  const label = button.querySelector('span');
  const sync = () => {
    const paused = video.paused;
    button.setAttribute('aria-pressed', String(paused));
    if (label) label.textContent = paused ? '動画を再生' : '動画を停止';
  };

  if (reducedMotion) {
    video.pause();
    sync();
  } else {
    video.play().catch(sync);
  }

  button.addEventListener('click', () => {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
    sync();
  });
  video.addEventListener('play', sync);
  video.addEventListener('pause', sync);
  sync();
});

function createFaqItem(item, index) {
  const wrapper = document.createElement('article');
  wrapper.className = 'faq-item';

  const button = document.createElement('button');
  button.className = 'faq-question';
  button.type = 'button';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', `faq-answer-${index}`);

  const mark = document.createElement('span');
  mark.className = 'faq-question__q';
  mark.textContent = 'Q';
  const question = document.createElement('strong');
  question.textContent = item.q;
  const icon = document.createElement('span');
  icon.className = 'faq-question__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '+';
  button.append(mark, question, icon);

  const answer = document.createElement('div');
  answer.className = 'faq-answer';
  answer.id = `faq-answer-${index}`;
  const answerInner = document.createElement('div');
  const paragraph = document.createElement('p');
  paragraph.textContent = item.a;
  answerInner.appendChild(paragraph);
  answer.appendChild(answerInner);
  wrapper.append(button, answer);

  button.addEventListener('click', () => {
    const list = wrapper.parentElement;
    const shouldOpen = !wrapper.classList.contains('open');
    list?.querySelectorAll('.faq-item.open').forEach(openItem => {
      openItem.classList.remove('open');
      openItem.querySelector('.faq-question')?.setAttribute('aria-expanded', 'false');
    });
    wrapper.classList.toggle('open', shouldOpen);
    button.setAttribute('aria-expanded', String(shouldOpen));
  });

  return wrapper;
}

async function mountFaq() {
  const list = document.getElementById('faqList');
  if (!list) return;
  try {
    const response = await fetch('/data/faq.json');
    if (!response.ok) throw new Error(`FAQ request failed: ${response.status}`);
    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];
    list.replaceChildren(...items.map(createFaqItem));
  } catch (error) {
    list.innerHTML = '<p>よくあるご質問を読み込めませんでした。時間をおいて再度お試しください。</p>';
  }
}

mountFaq();

function mountInteractiveWorld() {
  const world = document.getElementById('worldExperience');
  if (!world) return;

  let loaded = false;
  const load = () => {
    if (loaded) return;
    loaded = true;
    import('/lp-world.js').catch(() => world.classList.add('world-fallback'));
  };

  if (!('IntersectionObserver' in window)) {
    load();
    return;
  }

  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    load();
  }, { rootMargin: '240px 0px' });
  observer.observe(world);
}

mountInteractiveWorld();

const motionData = {
  thinking: {
    title: '思考と感情を、構造で整理する。',
    copy: '事実・解釈・感情・期待・役割・責任・境界線の順に状況を分解し、自分で判断できる状態をつくります。',
    poster: '/assets/posters/scene-thinking.jpg',
    alt: '思考整理セッションのイメージ',
  },
  sales: {
    title: 'メーカーと販売店の間をつなぐ。',
    copy: '商品提案、商談、展示会営業、既存取引先のフォローまで、営業現場に立って支援します。',
    poster: '/assets/posters/scene-sales.svg',
    alt: '営業代行・営業支援のイメージ',
  },
  beauty: {
    title: '美容・ヘルスケア商品の販路を広げる。',
    copy: 'シャンプーブラシ、スカルプブラシ、ネイル関連商品など、美容業界向けの販売支援を行います。',
    poster: '/assets/posters/scene-beauty.png',
    alt: '美容商材の販売支援イメージ',
  },
};

function mountMotionLab() {
  const root = document.getElementById('serviceMotion');
  if (!root) return;
  const image = root.querySelector('[data-motion-image]');
  const title = root.querySelector('[data-motion-title]');
  const copy = root.querySelector('[data-motion-copy]');
  const tabs = [...root.querySelectorAll('[data-motion]')];
  if (!image || !title || !copy || !tabs.length) return;

  let loaded = false;
  const select = key => {
    const item = motionData[key];
    if (!item) return;
    loaded = true;
    tabs.forEach(tab => {
      const active = tab.dataset.motion === key;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    title.textContent = item.title;
    copy.textContent = item.copy;
    image.src = item.poster;
    image.alt = item.alt;
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab.dataset.motion));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      const next = tabs[(index + direction + tabs.length) % tabs.length];
      next.focus();
      select(next.dataset.motion);
    });
  });

  const initialKey = tabs.find(tab => tab.getAttribute('aria-selected') === 'true')?.dataset.motion || tabs[0].dataset.motion;
  if (!('IntersectionObserver' in window)) {
    select(initialKey);
    return;
  }
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting) || loaded) return;
    observer.disconnect();
    select(initialKey);
  }, { rootMargin: '40% 0px' });
  observer.observe(root);
}

mountMotionLab();

function mountContactForm() {
  const form = document.querySelector('[data-contact-form]');
  if (!form) return;

  const submit = form.querySelector('button[type="submit"]');
  const label = form.querySelector('[data-submit-label]');
  const status = form.querySelector('[data-form-status]');
  const endpoint = form.dataset.endpoint;
  if (!endpoint) return;

  if (new URLSearchParams(window.location.search).get('sent') === '1' && status) {
    status.classList.add('is-success');
    status.textContent = 'お問い合わせを送信しました。内容を確認後、メールでご連絡します。';
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!submit || !status || !form.reportValidity()) return;

    submit.disabled = true;
    status.className = 'contact-form__status';
    status.textContent = '送信しています…';
    if (label) label.textContent = '送信中';

    try {
      const payload = Object.fromEntries(new FormData(form));
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      const accepted = result.success === true || result.success === 'true';
      if (!response.ok || !accepted) throw new Error('送信できませんでした。時間をおいて再度お試しください。');

      form.reset();
      status.classList.add('is-success');
      status.textContent = 'お問い合わせを送信しました。内容を確認後、メールでご連絡します。';
    } catch (error) {
      status.classList.add('is-error');
      status.textContent = error.message || '送信できませんでした。時間をおいて再度お試しください。';
    } finally {
      submit.disabled = false;
      if (label) label.textContent = '問い合わせを送信';
    }
  });
}

mountContactForm();
