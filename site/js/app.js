/* Istanbul Doner — меню, корзина и отправка заказа в WhatsApp. Настройки — в config.js */
(function () {
  'use strict';

  const CFG = window.ISTANBUL;
  const REV = window.ISTANBUL_REVIEWS || { summary: null, items: [] };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const icon = id => '<svg class="ic" aria-hidden="true"><use href="#i-' + id + '"/></svg>';

  // el('div', {class: 'x', text: '…'}, [children]) — text всегда безопасен, html только для своей разметки
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    });
    (children || []).forEach(c => c && node.appendChild(c));
    return node;
  }

  const group3 = (n, sep) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  const money = n => group3(n, ' ') + ' ' + CFG.currency;      // для страницы
  const moneyText = n => group3(n, ' ') + ' ' + CFG.currency;            // для сообщения
  const plural = (n, forms) => {
    const a = Math.abs(n) % 100, b = a % 10;
    return forms[a > 10 && a < 20 ? 2 : b === 1 ? 0 : b > 1 && b < 5 ? 1 : 2];
  };

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
    },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* приватный режим */ } }
  };

  // ───────────────────────── меню: индекс блюд ─────────────────────────
  const CATS = CFG.menu.filter(c => !c.hidden).map(c => Object.assign({}, c, { items: c.items.filter(i => !i.hidden) }));
  const ITEMS = {};
  CATS.forEach(c => c.items.forEach(i => { ITEMS[i.id] = i; }));

  // ───────────────────────────── корзина ─────────────────────────────
  // строка корзины: { id, sel: {groupId: optionId}, addons: [id], qty } — названия и цены всегда берём из config.js
  let cart = store.get('istanbul.cart.v1', []);

  function lineKey(line) {
    const item = ITEMS[line.id];
    if (!item || item.type !== 'configurable') return line.id;
    return [line.id, item.groups.map(g => (line.sel || {})[g.id]).join('/'), (line.addons || []).slice().sort().join('+')].join('|');
  }

  function resolve(line) {
    const item = ITEMS[line.id];
    if (!item) return null;
    const qty = Math.max(1, Math.min(99, parseInt(line.qty, 10) || 1));
    if (item.type !== 'configurable') {
      return { key: lineKey(line), title: item.name, opts: '', unit: item.price, qty, sum: item.price * qty };
    }
    const chosen = item.groups.map(g => g.options.find(o => o.id === (line.sel || {})[g.id]));
    if (chosen.some(o => !o)) return null;
    const base = item.prices[chosen.map(o => o.id).join('/')];
    if (base == null) return null;
    const addons = (line.addons || []).map(id => (item.addons || []).find(a => a.id === id)).filter(Boolean);
    const unit = base + addons.reduce((s, a) => s + a.price, 0);
    return {
      key: lineKey(line),
      title: item.name + ' ' + chosen.map(o => o.line).join(', '),
      opts: addons.map(a => '+ ' + a.line).join(', '),
      unit, qty, sum: unit * qty
    };
  }

  cart = cart.filter(resolve);
  const lines = () => cart.map(resolve).filter(Boolean);
  const cartCount = () => lines().reduce((s, l) => s + l.qty, 0);
  const cartTotal = () => lines().reduce((s, l) => s + l.sum, 0);
  const qtyOf = id => cart.filter(l => l.id === id).reduce((s, l) => s + l.qty, 0);

  function addToCart(line, qty) {
    const key = lineKey(line);
    const found = cart.find(l => lineKey(l) === key);
    if (found) found.qty = Math.min(99, found.qty + qty);
    else cart.push(Object.assign({}, line, { qty }));
    commit(true);
  }
  function setQty(key, qty) {
    const found = cart.find(l => lineKey(l) === key);
    if (!found) return;
    if (qty <= 0) cart = cart.filter(l => l !== found);
    else found.qty = Math.min(99, qty);
    commit(false);
  }
  function commit(bump) {
    store.set('istanbul.cart.v1', cart);
    view = 'form';
    renderCart(bump);
  }

  // ─────────────────────────── рендер меню ───────────────────────────
  function stepper(qty, onChange, label) {
    return el('div', { class: 'stepper', role: 'group', 'aria-label': label || 'Количество' }, [
      el('button', { type: 'button', 'aria-label': 'Меньше', html: icon('minus'), onclick: () => onChange(qty - 1) }),
      el('output', { text: String(qty), 'aria-live': 'polite' }),
      el('button', { type: 'button', 'aria-label': 'Больше', html: icon('plus'), onclick: () => onChange(qty + 1) })
    ]);
  }

  function renderDoner(item) {
    const state = { sel: {}, addons: new Set(), qty: 1 };
    item.groups.forEach(g => { state.sel[g.id] = g.options[0].id; });

    const buy = el('button', { type: 'button', class: 'btn btn--red btn--lg' });
    const qtyBox = el('div', { class: 'doner__qty' });
    const unit = () => item.prices[item.groups.map(g => state.sel[g.id]).join('/')] +
      (item.addons || []).filter(a => state.addons.has(a.id)).reduce((s, a) => s + a.price, 0);
    const refresh = () => {
      buy.textContent = 'В корзину · ' + money(unit() * state.qty);
      qtyBox.replaceChildren(el('span', { text: 'Количество' }),
        stepper(state.qty, q => { state.qty = Math.max(1, Math.min(20, q)); refresh(); }, 'Сколько донеров'));
    };

    const groups = item.groups.map(g => el('div', { class: 'opt' }, [
      el('div', { class: 'opt__t', text: g.title, id: 'opt-' + item.id + '-' + g.id }),
      el('div', { class: 'seg seg--' + g.options.length, role: 'radiogroup', 'aria-labelledby': 'opt-' + item.id + '-' + g.id },
        g.options.map((o, i) => {
          const input = el('input', { type: 'radio', name: item.id + '-' + g.id, value: o.id, checked: i === 0,
            onchange: () => { state.sel[g.id] = o.id; refresh(); } });
          return el('label', {}, [input, el('span', {}, [
            document.createTextNode(o.name), o.kz && o.kz !== o.name.toLowerCase() ? el('small', { text: o.kz, lang: 'kk' }) : null
          ])]);
        }))
    ]));

    const addons = (item.addons || []).length ? el('div', { class: 'opt' }, [
      el('div', { class: 'opt__t', text: 'Добавить' }),
      el('div', { class: 'addons' }, item.addons.map(a => el('label', { class: 'addon' }, [
        el('input', { type: 'checkbox', value: a.id, onchange: e => { e.target.checked ? state.addons.add(a.id) : state.addons.delete(a.id); refresh(); } }),
        el('span', { html: '<svg class="ic ic--off" aria-hidden="true"><use href="#i-plus"/></svg><svg class="ic ic--on" aria-hidden="true"><use href="#i-check"/></svg>' }, [
          document.createTextNode(a.name + ' '), el('i', { text: '+' + money(a.price) })
        ])
      ])))
    ]) : null;

    buy.addEventListener('click', () => {
      const line = { id: item.id, sel: Object.assign({}, state.sel), addons: Array.from(state.addons) };
      addToCart(line, state.qty);
      toast('В корзине: ' + resolve(Object.assign({ qty: 1 }, line)).title);
      state.qty = 1;
      refresh();
    });

    const min = Math.min.apply(null, Object.values(item.prices));
    const card = el('article', { class: 'doner' }, [
      el('div', { class: 'doner__img' }, [el('img', { src: item.image, alt: item.imageAlt || item.name, loading: 'lazy', width: 1300, height: 1947 })]),
      el('div', { class: 'doner__body' }, [
        el('div', { class: 'doner__title' }, [el('h4', { text: item.name }), el('span', { text: 'от ' + money(min) })]),
        item.desc ? el('p', { class: 'doner__desc', text: item.desc }) : null
      ].concat(groups, [addons, el('div', { class: 'doner__buy' }, [qtyBox, buy])]))
    ]);
    refresh();
    return card;
  }

  const actionSlots = {};   // id блюда → контейнер с кнопкой «Добавить» / степпером

  function renderItem(item) {
    const slot = el('div', { class: 'card__act' });
    actionSlots[item.id] = slot;
    const combo = Array.isArray(item.includes);
    const foot = el('div', { class: 'card__foot' }, [el('span', { class: 'card__price', text: money(item.price) }), slot]);
    if (!combo) {
      return el('article', { class: 'card' }, [
        el('div', { class: 'card__e', text: item.emoji || '🍽️', 'aria-hidden': 'true' }),
        el('div', { class: 'card__name', text: item.name }),
        foot
      ]);
    }
    return el('article', { class: 'card card--combo' }, [
      el('div', { class: 'card__top' }, [
        el('div', { class: 'card__e', text: item.emoji || '🍱', 'aria-hidden': 'true' }),
        el('div', {}, [item.badge ? el('span', { class: 'badge', text: item.badge }) : null, el('div', { class: 'card__name', text: item.name })])
      ]),
      el('ul', { class: 'incl' }, item.includes.map(t => el('li', { html: icon('check') }, [document.createTextNode(t)]))),
      foot
    ]);
  }

  function renderActions() {
    Object.keys(actionSlots).forEach(id => {
      const qty = qtyOf(id);
      const item = ITEMS[id];
      actionSlots[id].replaceChildren(qty > 0
        ? stepper(qty, q => setQty(id, q), item.name + ': количество')
        : el('button', { type: 'button', class: 'btn btn--red add', html: icon('plus') + 'Добавить', 'aria-label': 'Добавить: ' + item.name,
          onclick: () => { addToCart({ id }, 1); toast('В корзине: ' + item.name); } }));
    });
  }

  function renderMenu() {
    const menu = $('[data-menu]'), cats = $('[data-cats]');
    CATS.forEach(cat => {
      cats.appendChild(el('a', { href: '#cat-' + cat.id, text: cat.title, 'data-cat': cat.id }));
      const configurable = cat.items.filter(i => i.type === 'configurable');
      const simple = cat.items.filter(i => i.type !== 'configurable');
      const cardsClass = 'cards' + (simple.some(i => i.includes) ? ' cards--combo' : ' cards--snacks');
      menu.appendChild(el('section', { class: 'cat', id: 'cat-' + cat.id, 'aria-labelledby': 'cat-h-' + cat.id }, [
        el('div', { class: 'cat__head' }, [
          el('h3', { text: cat.title, id: 'cat-h-' + cat.id }),
          cat.note ? el('span', { class: 'cat__note', text: cat.note }) : null
        ])
      ].concat(configurable.map(renderDoner), simple.length ? [el('div', { class: cardsClass }, simple.map(renderItem))] : [])));
    });
    $('[data-menu-hint]').textContent = CFG.menuHint || '';
    $('[data-menu-hint]').hidden = !CFG.menuHint;

    // подсветка активной категории
    if ('IntersectionObserver' in window) {
      const links = $$('[data-cat]');
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => {
          if (!en.isIntersecting) return;
          links.forEach(a => a.classList.toggle('is-active', '#' + en.target.id === a.getAttribute('href')));
        });
      }, { rootMargin: '-35% 0px -55% 0px' });
      $$('.cat').forEach(s => io.observe(s));
    }
  }

  // ─────────────────────── статус «открыто / закрыто» ───────────────────────
  function cafeNow() {
    const d = new Date();
    return new Date(d.getTime() + (d.getTimezoneOffset() + CFG.hours.utcOffsetMin) * 60000);
  }
  function isOpen() {
    const n = cafeNow(), h = n.getHours() + n.getMinutes() / 60;
    return h >= CFG.hours.open && h < CFG.hours.close;
  }
  const hh = h => String(h).padStart(2, '0') + ':00';
  function renderStatus() {
    const open = isOpen();
    $$('[data-status]').forEach(node => {
      node.hidden = false;
      node.textContent = open ? 'Открыто до ' + hh(CFG.hours.close) : 'Закрыто · откроемся в ' + hh(CFG.hours.open);
      node.classList.toggle('is-open', open);
      node.classList.toggle('is-closed', !open);
    });
    const note = $('[data-closed-note]');
    note.hidden = open;
    note.textContent = 'Сейчас мы закрыты — работаем ' + hh(CFG.hours.open) + '–' + hh(CFG.hours.close) +
      ' по времени Хромтау. Заказ можно отправить уже сейчас, ответим после открытия.';
  }

  // ───────────────────── оформление и сообщение в WhatsApp ─────────────────────
  const form = $('[data-checkout]');
  const saved = store.get('istanbul.customer.v1', {});
  let view = 'form';           // 'form' | 'done'
  let lastFocus = null;

  function formData() {
    const f = form.elements;
    return {
      mode: f.mode.value, address: f.address.value.trim(), name: f.name.value.trim(), phone: f.phone.value.trim(),
      when: f.when.value, time: f.time.value, payment: f.payment ? f.payment.value : '', comment: f.comment.value.trim()
    };
  }

  function buildMessage() {
    const d = formData(), delivery = d.mode === 'delivery', out = [];
    out.push('*Новый заказ с сайта — ' + CFG.brand.name + '*', '');
    lines().forEach((l, i) => {
      out.push((i + 1) + '. ' + l.title + (l.opts ? ' (' + l.opts + ')' : ''));
      out.push('   ' + l.qty + ' × ' + moneyText(l.unit) + ' = ' + moneyText(l.sum));
    });
    out.push('', '*Итого: ' + moneyText(cartTotal()) + '*' + (delivery ? ' (без учёта доставки)' : ''), '');
    out.push('Получение: ' + (delivery ? 'доставка' : 'самовывоз'));
    if (delivery) out.push('Адрес: ' + d.address);
    out.push('Когда: ' + (d.when === 'time' && d.time ? 'к ' + d.time : 'как можно скорее'));
    if (d.payment) out.push('Оплата: ' + d.payment);
    out.push('Имя: ' + d.name);
    if (d.phone) out.push('Телефон: ' + d.phone);
    if (d.comment) out.push('Комментарий: ' + d.comment);
    return out.join('\n');
  }

  const waLink = text => 'https://wa.me/' + CFG.contacts.whatsapp + (text ? '?text=' + encodeURIComponent(text) : '');

  function validate(show) {
    const d = formData(), errors = [];
    if (d.mode === 'delivery' && d.address.length < 4) errors.push('address');
    if (d.name.length < 2) errors.push('name');
    if (d.when === 'time' && !d.time) errors.push('time');
    if (show) {
      ['address', 'name', 'time'].forEach(name => {
        const bad = errors.includes(name);
        $('[data-err="' + name + '"]').hidden = !bad;
        form.elements[name].closest('.field').classList.toggle('is-err', bad);
        form.elements[name].setAttribute('aria-invalid', bad ? 'true' : 'false');
      });
    }
    return errors;
  }

  function syncForm() {
    const d = formData();
    $('[data-address-field]').hidden = d.mode !== 'delivery';
    $('[data-pickup-note]').hidden = d.mode === 'delivery';
    $('[data-time-field]').hidden = d.when !== 'time';
    $('[data-total-note]').textContent = d.mode === 'delivery' ? CFG.deliveryNote : '';
    $('[data-send]').href = waLink(buildMessage());
    store.set('istanbul.customer.v1', { mode: d.mode, address: d.address, name: d.name, phone: d.phone, payment: d.payment });
  }

  function renderLines() {
    $('[data-lines]').replaceChildren.apply($('[data-lines]'), lines().map(l => el('li', { class: 'line' }, [
      el('div', {}, [
        el('div', { class: 'line__name', text: l.title }),
        l.opts ? el('div', { class: 'line__opts', text: l.opts }) : null,
        el('div', { class: 'line__unit', text: money(l.unit) + ' за шт.' })
      ]),
      el('div', { class: 'line__sum', text: money(l.sum) }),
      el('div', { class: 'line__ctrl' }, [
        stepper(l.qty, q => setQty(l.key, q), l.title + ': количество'),
        el('button', { type: 'button', class: 'line__del', html: icon('trash') + 'Убрать', 'aria-label': 'Убрать: ' + l.title, onclick: () => setQty(l.key, 0) })
      ])
    ])));
  }

  function renderCart(bump) {
    const count = cartCount(), total = cartTotal();
    const badge = $('[data-cart-count]'), bar = $('[data-cartbar]');
    badge.hidden = count === 0;
    badge.textContent = count;
    bar.hidden = count === 0;
    document.body.classList.toggle('has-cart', count > 0);
    $('[data-cartbar-count]').textContent = count + ' ' + plural(count, ['позиция', 'позиции', 'позиций']);
    $('[data-cartbar-total]').textContent = money(total);
    if (bump && count) { bar.classList.remove('is-bump'); void bar.offsetWidth; bar.classList.add('is-bump'); }
    renderActions();

    const empty = count === 0;
    $('[data-empty]').hidden = !(empty && view === 'form');
    $('[data-done]').hidden = view !== 'done';
    form.hidden = empty || view !== 'form';
    $('[data-sheet-foot]').hidden = empty || view !== 'form';
    $('[data-total]').textContent = money(total);
    if (!form.hidden) { renderLines(); syncForm(); }
  }

  function openCart() {
    lastFocus = document.activeElement;
    view = 'form';
    $('[data-sheet]').hidden = false;
    document.body.classList.add('is-locked');
    $('#page').inert = true;
    renderStatus();
    renderCart(false);
    $('.sheet__panel').focus();
  }
  function closeCart() {
    $('[data-sheet]').hidden = true;
    document.body.classList.remove('is-locked');
    $('#page').inert = false;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function copyOrder() {
    const text = buildMessage();
    const ok = () => toast('Текст заказа скопирован');
    const fallback = () => {
      const ta = el('textarea', { style: 'position:fixed;opacity:0' });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) { toast('Не получилось скопировать'); }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback);
    else fallback();
  }

  function initCheckout() {
    $('[data-payments]').replaceChildren.apply($('[data-payments]'), CFG.payments.map((p, i) =>
      el('label', {}, [el('input', { type: 'radio', name: 'payment', value: p, checked: saved.payment ? saved.payment === p : i === 0 }), el('span', { text: p })])));
    if (saved.mode) form.elements.mode.value = saved.mode;
    ['address', 'name', 'phone'].forEach(k => { if (saved[k]) form.elements[k].value = saved[k]; });

    form.addEventListener('input', syncForm);
    form.addEventListener('change', syncForm);
    form.addEventListener('submit', e => e.preventDefault());
    ['address', 'name', 'time'].forEach(name => form.elements[name].addEventListener('input', () => {
      if (!validate(false).includes(name)) {
        $('[data-err="' + name + '"]').hidden = true;
        form.elements[name].closest('.field').classList.remove('is-err');
      }
    }));

    // Кнопка — настоящая ссылка на wa.me: так WhatsApp открывается и во встроенных браузерах (Instagram и т. п.)
    $('[data-send]').addEventListener('click', e => {
      const errors = validate(true);
      if (errors.length || !cartCount()) {
        e.preventDefault();
        const first = form.elements[errors[0]];
        if (first) { first.scrollIntoView({ block: 'center', behavior: 'smooth' }); first.focus({ preventScroll: true }); }
        return;
      }
      syncForm();
      setTimeout(() => { view = 'done'; renderCart(false); $('[data-sheet-scroll]').scrollTop = 0; }, 700);
    });

    $$('[data-open-cart]').forEach(b => b.addEventListener('click', openCart));
    $$('[data-close-cart]').forEach(b => b.addEventListener('click', closeCart));
    $('[data-copy]').addEventListener('click', copyOrder);
    $('[data-back]').addEventListener('click', () => { view = 'form'; renderCart(false); });
    $('[data-new]').addEventListener('click', () => {
      cart = [];
      form.elements.comment.value = '';
      commit(false);
      closeCart();
      toast('Корзина очищена — можно собрать новый заказ');
    });
  }

  // ───────────────────────────── отзывы ─────────────────────────────
  const AVA = ['#d81f26', '#141a4a', '#e07b00', '#1a8f57', '#7a3ff2', '#0b7fab'];
  function initials(name) {
    const words = name.split(/\s+/).filter(w => /^[\p{L}]/u.test(w));
    const s = words.slice(0, 2).map(w => Array.from(w)[0].toUpperCase()).join('');
    return s || '★';
  }
  function stars(n) {
    const box = el('span', { class: 'stars', role: 'img', 'aria-label': 'Оценка ' + n + ' из 5' });
    for (let i = 1; i <= 5; i++) box.insertAdjacentHTML('beforeend', '<svg class="ic' + (i > n ? ' off' : '') + '" aria-hidden="true"><use href="#i-star"/></svg>');
    return box;
  }
  const dateRu = iso => new Date(iso + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  function renderReviews() {
    const s = REV.summary, box = $('[data-rating-box]'), track = $('[data-reviews]');
    if (s) {
      $$('[data-rating]').forEach(n => { n.textContent = s.rating.toFixed(1); });
      $$('[data-ratings-count]').forEach(n => { n.textContent = s.ratings_count; });
      const dist = s.distribution_confirmed, max = Math.max.apply(null, Object.values(dist)) || 1;
      box.replaceChildren(
        el('div', { class: 'rating__top' }, [
          el('div', { class: 'rating__num', text: s.rating.toFixed(1) }),
          el('div', {}, [stars(Math.round(s.rating)), el('div', { class: 'rating__sub',
            text: s.ratings_count + ' ' + plural(s.ratings_count, ['оценка', 'оценки', 'оценок']) + ' · ' + s.reviews_count + ' ' + plural(s.reviews_count, ['отзыв', 'отзыва', 'отзывов']) + ' в 2ГИС' })])
        ]),
        el('div', { class: 'bars' }, [5, 4, 3, 2, 1].map(n => el('div', { class: 'bar' }, [
          el('span', { text: String(n) }),
          el('i', {}, [el('b', { style: 'width:' + Math.round((dist[n] || 0) / max * 100) + '%' })]),
          el('span', { text: String(dist[n] || 0) })
        ]))),
        el('p', { class: 'bars__note', text: 'Распределение — по ' + s.confirmed_reviews + ' подтверждённым отзывам.' }),
        s.topics && s.topics.length ? el('p', { class: 'topics__t', text: 'Чаще всего хвалят:' }) : null,
        s.topics && s.topics.length ? el('div', { class: 'topics' }, s.topics.map(t => el('span', { text: t }))) : null
      );
    } else box.hidden = true;

    REV.items.forEach((r, i) => {
      const text = el('p', { class: 'rev__text', text: r.text });
      const long = r.text.length > 260 || r.text.split('\n').length > 6;
      if (long) text.classList.add('is-clamped');
      const more = long ? el('button', { type: 'button', class: 'rev__more', text: 'Читать полностью', onclick: () => {
        const clamped = text.classList.toggle('is-clamped');
        more.textContent = clamped ? 'Читать полностью' : 'Свернуть';
      } }) : null;
      const tag = r.visits >= 3 ? 'Частый гость · ' + r.visits + ' ' + plural(r.visits, ['посещение', 'посещения', 'посещений'])
        : r.visits ? 'Посещение подтверждено 2ГИС' : '';
      track.appendChild(el('article', { class: 'rev' }, [
        el('div', { class: 'rev__head' }, [
          el('div', { class: 'rev__ava', text: initials(r.author), style: 'background:' + AVA[i % AVA.length], 'aria-hidden': 'true' }),
          el('div', {}, [el('div', { class: 'rev__name', text: r.author }), el('div', { class: 'rev__meta', text: dateRu(r.date) })])
        ]),
        stars(r.rating), text, more,
        tag ? el('span', { class: 'rev__tag', text: tag }) : null
      ]));
    });

    const prev = $('[data-rev-prev]'), next = $('[data-rev-next]');
    const step = () => { const c = $('.rev', track); return c ? c.getBoundingClientRect().width + 14 : 320; };
    const sync = () => {
      prev.disabled = track.scrollLeft < 8;
      next.disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 8;
    };
    prev.addEventListener('click', () => track.scrollBy({ left: -step() * 2, behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: step() * 2, behavior: 'smooth' }));
    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  }

  // ───────────────────────────── галерея ─────────────────────────────
  function initGallery() {
    const grid = $('[data-gallery]'), box = $('[data-lightbox]'), img = $('[data-lb-img]'), cap = $('[data-lb-cap]');
    let index = 0, opener = null;
    const show = i => {
      index = (i + CFG.gallery.length) % CFG.gallery.length;
      const g = CFG.gallery[index];
      img.src = g.src; img.alt = g.alt;
      cap.textContent = g.alt + ' · фото гостей, 2ГИС';
    };
    const close = () => { box.hidden = true; document.body.classList.remove('is-locked'); $('#page').inert = false; if (opener) opener.focus(); };
    CFG.gallery.forEach((g, i) => grid.appendChild(el('button', {
      type: 'button', class: g.shape ? 'is-' + g.shape : '', 'aria-label': 'Открыть фото: ' + g.alt,
      onclick: e => { opener = e.currentTarget; show(i); box.hidden = false; document.body.classList.add('is-locked'); $('#page').inert = true; $('[data-lb-close]').focus(); }
    }, [el('img', { src: g.thumb, alt: g.alt, loading: 'lazy' })])));
    $('[data-lb-close]').addEventListener('click', close);
    $('[data-lb-prev]').addEventListener('click', () => show(index - 1));
    $('[data-lb-next]').addEventListener('click', () => show(index + 1));
    box.addEventListener('click', e => { if (e.target === box || e.target.tagName === 'FIGURE') close(); });
    document.addEventListener('keydown', e => {
      if (!box.hidden) {
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowLeft') show(index - 1);
        if (e.key === 'ArrowRight') show(index + 1);
      } else if (!$('[data-sheet]').hidden && e.key === 'Escape') closeCart();
    });
  }

  // ───────────────────── контакты из config.js → в разметку ─────────────────────
  function applyConfig() {
    const c = CFG.contacts;
    $$('[data-phone]').forEach(a => { a.href = 'tel:' + c.phone; });
    $$('[data-phone-text]').forEach(n => { n.textContent = c.phoneDisplay; });
    $$('[data-wa-chat]').forEach(a => { a.href = waLink(''); });
    $$('[data-address]').forEach(n => { n.textContent = c.address; });
    $$('[data-city]').forEach(n => { n.textContent = c.city; });
    $$('[data-landmark]').forEach(n => { n.textContent = c.landmark; n.hidden = !c.landmark; });
    $$('[data-instagram]').forEach(a => { a.href = 'https://www.instagram.com/' + c.instagram + '/'; $('b', a).textContent = '@' + c.instagram; });
    $$('[data-2gis]').forEach(a => { a.href = c.twoGis; });
    $$('[data-2gis-reviews]').forEach(a => { a.href = c.twoGisReviews; });
    $$('[data-year]').forEach(n => { n.textContent = new Date().getFullYear(); });
    const map = $('[data-map]');
    if (map && c.lat && c.lon) {
      const bbox = [c.lon - 0.0028, c.lat - 0.0016, c.lon + 0.0028, c.lat + 0.0016].map(v => v.toFixed(6)).join(',');
      const src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + encodeURIComponent(bbox) + '&layer=mapnik&marker=' + encodeURIComponent(c.lat + ',' + c.lon);
      if (map.getAttribute('src') !== src) map.src = src;
    }
    const prices = [];
    Object.values(ITEMS).forEach(i => { if (i.type === 'configurable') prices.push.apply(prices, Object.values(i.prices)); });
    if (prices.length) $$('[data-min-price]').forEach(n => { n.textContent = money(Math.min.apply(null, prices)); });
  }

  // ─────────────────────────── уведомление ───────────────────────────
  let toastTimer;
  function toast(text) {
    const t = $('[data-toast]');
    t.textContent = text;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 2200);
  }

  // ──────────────────────────────── старт ────────────────────────────────
  applyConfig();
  renderMenu();
  initCheckout();
  renderReviews();
  initGallery();
  renderStatus();
  renderCart(false);
  setInterval(renderStatus, 60000);
})();
