/* Istanbul Doner — меню, корзина, предложения к покупке и отправка заказа в WhatsApp. Настройки — в config.js */
(function () {
  'use strict';

  const { t, language, localize } = window.ISTANBUL_I18N;
  window.ISTANBUL_I18N.init();
  const CFG = localize(window.ISTANBUL);
  const REV = window.ISTANBUL_REVIEWS || { summary: null, items: [] };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const icon = id => '<svg class="ic" aria-hidden="true"><use href="#i-' + id + '"/></svg>';

  // el('div', {class: 'x', text: '…'}, [children]) — text всегда безопасен, html только для своей разметки
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'text') node.textContent = t(v);
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : ['aria-label', 'alt', 'title'].includes(k) ? t(v) : v);
    });
    (children || []).forEach(c => c && node.appendChild(c));
    return node;
  }

  const group3 = (n, sep) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  const money = n => group3(n, ' ') + ' ' + CFG.currency;      // для страницы
  const moneyText = n => group3(n, ' ') + ' ' + CFG.currency;            // для сообщения
  const plural = (n, forms) => {
    const a = Math.abs(n) % 100, b = a % 10;
    return t(forms[a > 10 && a < 20 ? 2 : b === 1 ? 0 : b > 1 && b < 5 ? 1 : 2]);
  };

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
    },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* приватный режим */ } }
  };

  // ───────────────────────── меню: индекс блюд ─────────────────────────
  const CATS = CFG.menu.filter(c => !c.hidden).map(c => Object.assign({}, c, { items: c.items.filter(i => !i.hidden) }));
  const ITEMS = {}, CAT_OF = {};
  CATS.forEach(c => c.items.forEach(i => { ITEMS[i.id] = i; CAT_OF[i.id] = c.id; }));
  const groupsOf = item => (item && item.groups) || [];

  // ───────────────────────────── корзина ─────────────────────────────
  // строка корзины: { id, sel: {groupId: optionId}, addons: [id], qty } — названия и цены всегда берём из config.js
  let cart = store.get('istanbul.cart.v1', []);

  function lineKey(line) {
    const item = ITEMS[line.id];
    if (!groupsOf(item).length) return line.id;
    return [line.id, groupsOf(item).map(g => (line.sel || {})[g.id] || '').join('/'), (line.addons || []).slice().sort().join('+')].join('|');
  }

  // Цена: таблица item.prices (ключ — обязательные варианты через «/») либо item.price + цены выбранных вариантов.
  // Необязательная группа (optional) без ответа попадает в pending — сайт спросит её отдельно.
  function resolve(line) {
    const item = ITEMS[line.id];
    if (!item) return null;
    const qty = Math.max(1, Math.min(99, parseInt(line.qty, 10) || 1));
    const picks = groupsOf(item).map(g => ({ g, o: g.options.find(o => o.id === (line.sel || {})[g.id]) || null }));
    if (picks.some(p => !p.o && !p.g.optional)) return null;
    let unit;
    if (item.prices) {
      unit = item.prices[picks.filter(p => !p.g.optional).map(p => p.o.id).join('/')];
      if (unit == null) return null;
    } else {
      unit = (item.price || 0) + picks.reduce((s, p) => s + ((p.o && p.o.price) || 0), 0);
    }
    const addons = (line.addons || []).map(id => (item.addons || []).find(a => a.id === id)).filter(Boolean);
    unit += addons.reduce((s, a) => s + a.price, 0);
    const main = picks.filter(p => !p.g.optional).map(p => p.o.line);
    const extra = picks.filter(p => p.g.optional && p.o).map(p => p.o.line).concat(addons.map(a => '+ ' + a.line));
    return {
      key: lineKey(line), id: item.id,
      title: item.name + (main.length ? ' ' + main.join(', ') : ''),
      opts: extra.join(', '),
      pending: picks.filter(p => p.g.optional && !p.o).map(p => p.g),
      unit, qty, sum: unit * qty
    };
  }

  cart = cart.filter(resolve);
  const lines = () => cart.map(resolve).filter(Boolean);
  const cartCount = () => lines().reduce((s, l) => s + l.qty, 0);
  const cartTotal = () => lines().reduce((s, l) => s + l.sum, 0);
  const qtyOf = id => cart.filter(l => l.id === id).reduce((s, l) => s + l.qty, 0);
  const specOf = s => ({ id: s.id, sel: Object.assign({}, s.sel), addons: (s.addons || []).slice() });

  function addToCart(line, qty, opts) {
    const spec = specOf(line), key = lineKey(spec);
    const found = cart.find(l => lineKey(l) === key);
    if (found) found.qty = Math.min(99, found.qty + qty);
    else cart.push(Object.assign(spec, { qty }));
    commit(true);
    if (!(opts && opts.silent)) afterAdd(spec);
  }
  function setQty(key, qty) {
    const found = cart.find(l => lineKey(l) === key);
    if (!found) return;
    if (qty <= 0) cart = cart.filter(l => l !== found);
    else found.qty = Math.min(99, qty);
    commit(false);
  }
  function decLast(id) {
    for (let i = cart.length - 1; i >= 0; i--) {
      if (cart[i].id !== id) continue;
      cart[i].qty -= 1;
      if (cart[i].qty <= 0) cart.splice(i, 1);
      break;
    }
    commit(false);
  }
  // Ответ на необязательный вопрос (соус к фри): переносим одну порцию или всю строку в вариант с ответом
  function changeOption(key, groupId, optId, whole) {
    const line = cart.find(l => lineKey(l) === key);
    if (!line) return;
    const moved = whole ? line.qty : 1;
    const next = specOf(line);
    next.sel[groupId] = optId;
    line.qty -= moved;
    if (line.qty <= 0) cart = cart.filter(l => l !== line);
    const same = cart.find(l => lineKey(l) === lineKey(next));
    if (same) same.qty = Math.min(99, same.qty + moved);
    else cart.push(Object.assign(next, { qty: moved }));
    commit(false);
  }
  function commit(bump) {
    store.set('istanbul.cart.v1', cart);
    view = 'form';
    renderCart(bump);
  }

  // ─────────────────────── предложения к покупке ───────────────────────
  // «Уже есть»: само блюдо, любая позиция из «одиночной» категории (напитки, соусы) или комбо, куда оно входит
  function covered(id) {
    const cat = CAT_OF[id], single = (CFG.upsellExclusive || []).includes(cat);
    return cart.some(l => l.id === id || (single && CAT_OF[l.id] === cat) ||
      (((ITEMS[l.id] || {}).covers) || []).some(c => c === id || c === cat));
  }
  function suggestion(s) {
    const item = ITEMS[s.id], r = item && resolve(Object.assign({ qty: 1 }, specOf(s)));
    return r ? { spec: specOf(s), label: s.label || r.title, price: r.unit, emoji: item.emoji || '🍽️' } : null;
  }
  const available = list => (list || []).filter(s => !covered(s.id)).map(suggestion).filter(Boolean);

  const dismissed = new Set();      // что гость закрыл крестиком — больше не показываем в этот визит
  let trayTimer, trayDismissKey = null;

  function openTray(lead, title, chips, dismissKey) {
    const tray = $('[data-tray]');
    $('[data-tray-lead]').textContent = lead || '';
    $('[data-tray-lead]').hidden = !lead;
    $('[data-tray-title]').textContent = title;
    $('[data-tray-chips]').replaceChildren.apply($('[data-tray-chips]'), chips);
    trayDismissKey = dismissKey;
    tray.hidden = false;
    tray.classList.remove('is-in'); void tray.offsetWidth; tray.classList.add('is-in');
    $('[data-toast]').classList.remove('is-on');
    clearTimeout(trayTimer);
    trayTimer = setTimeout(hideTray, 16000);
  }
  function hideTray() {
    clearTimeout(trayTimer);
    $('[data-tray]').hidden = true;
  }

  // 1) вопрос по только что добавленному блюду (бесплатный соус к фри)
  function askTray(r, group, lead) {
    openTray(lead, group.ask || group.title, group.options.map(o => el('button', {
      type: 'button', class: 'chip' + (o.id === 'none' ? ' chip--muted' : ''), text: o.name,
      onclick: () => {
        changeOption(r.key, group.id, o.id, false);
        if (!ruleTray(r.id, o.id === 'none' ? '' : '✓ ' + o.name + t(' — положим к заказу'))) {
          hideTray();
          toast(o.id === 'none' ? t('Хорошо, без соуса') : o.name + t(' — положим к заказу'));
        }
      }
    })), 'ask:' + group.id);
  }

  // 2) правило из config.upsell: «к донеру — фри и напиток», «к наггетсам — соус»…
  function ruleTray(itemId, lead) {
    const rule = (CFG.upsell || []).find(u => u.after.includes(itemId) && !dismissed.has(u.id) && available(u.suggest).length);
    if (!rule) return false;
    openTray(lead, rule.title, available(rule.suggest).map(s => el('button', {
      type: 'button', class: 'chip', 'aria-label': t('Добавить: ') + s.label + ', ' + money(s.price),
      onclick: () => {
        addToCart(s.spec, 1, { silent: true });
        const r = resolve(Object.assign({ qty: 1 }, s.spec)), ask = r.pending[0];
        if (ask && !dismissed.has('ask:' + ask.id)) return askTray(r, ask, '✓ ' + t('В корзине: ') + r.title);
        if (!ruleTray(itemId, '✓ ' + t('В корзине: ') + s.label) && !ruleTray(s.spec.id, '✓ ' + t('В корзине: ') + s.label)) {
          hideTray();
          toast(t('В корзине: ') + s.label);
        }
      }
    }, [
      el('span', { class: 'chip__e', text: s.emoji, 'aria-hidden': 'true' }),
      el('span', { text: s.label }),
      el('b', { text: '+' + money(s.price) })
    ])), rule.id);
    return true;
  }

  function afterAdd(spec) {
    const r = resolve(Object.assign({ qty: 1 }, spec));
    if (!r || !$('[data-sheet]').hidden) return;
    const lead = '✓ ' + t('В корзине: ') + r.title, ask = r.pending[0];
    if (ask && !dismissed.has('ask:' + ask.id)) return askTray(r, ask, lead);
    if (ruleTray(r.id, lead)) return;
    hideTray();
    toast(t('В корзине: ') + r.title);
  }

  // ─────────────────────────── рендер меню ───────────────────────────
  function stepper(qty, onChange, label) {
    return el('div', { class: 'stepper', role: 'group', 'aria-label': label || 'Количество' }, [
      el('button', { type: 'button', 'aria-label': 'Меньше', html: icon('minus'), onclick: () => onChange(qty - 1) }),
      el('output', { text: String(qty), 'aria-live': 'polite' }),
      el('button', { type: 'button', 'aria-label': 'Больше', html: icon('plus'), onclick: () => onChange(qty + 1) })
    ]);
  }

  // переключатель-кнопки для группы вариантов
  function segControl(item, g, state, refresh, small) {
    return el('div', { class: 'seg seg--' + g.options.length + (small ? ' seg--sm' : ''), role: 'radiogroup', 'aria-label': item.name + ': ' + g.title.toLowerCase() },
      g.options.map((o, i) => el('label', {}, [
        el('input', { type: 'radio', name: item.id + '-' + g.id, value: o.id, checked: i === 0, onchange: () => { state.sel[g.id] = o.id; refresh(); } }),
        el('span', {}, [document.createTextNode(o.name)])
      ])));
  }

  function renderDoner(item, headingId) {
    const state = { sel: {}, addons: new Set(), qty: 1 };
    item.groups.forEach(g => { state.sel[g.id] = g.options[0].id; });

    const buy = el('button', { type: 'button', class: 'btn btn--red btn--lg' });
    const qtyBox = el('div', { class: 'doner__qty' });
    const spec = () => ({ id: item.id, sel: Object.assign({}, state.sel), addons: Array.from(state.addons) });
    const refresh = () => {
      buy.textContent = t('В корзину · ') + money(resolve(Object.assign({ qty: 1 }, spec())).unit * state.qty);
      qtyBox.replaceChildren(el('span', { text: 'Количество' }),
        stepper(state.qty, q => { state.qty = Math.max(1, Math.min(20, q)); refresh(); }, 'Сколько донеров'));
    };

    const groups = item.groups.map(g => el('div', { class: 'opt' }, [
      el('div', { class: 'opt__t', text: g.title }),
      segControl(item, g, state, refresh, false)
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
      addToCart(spec(), state.qty);
      state.qty = 1;
      refresh();
    });

    const min = Math.min.apply(null, Object.values(item.prices));
    const card = el('article', { class: 'doner' }, [
      el('div', { class: 'doner__img' }, [el('img', { src: item.image, alt: item.imageAlt || item.name, loading: 'lazy', width: 1300, height: 1947 })]),
      el('div', { class: 'doner__body' }, [
        el('div', { class: 'doner__title' }, [el(headingId ? 'h3' : 'h4', { text: item.name, id: headingId }), el('span', { text: t('от {price}', { price: money(min) }) })]),
        item.desc ? el('p', { class: 'doner__desc', text: item.desc }) : null
      ].concat(groups, [addons, el('div', { class: 'doner__buy' }, [qtyBox, buy])]))
    ]);
    refresh();
    return card;
  }

  const actionSlots = {};   // id блюда → контейнер с кнопкой «Добавить» / степпером
  const countBadges = {};   // id напитка → «в корзине: N»

  // компактная карточка с вариантами: напитки (вкус + объём)
  function renderOptionCard(item) {
    const state = { sel: {} };
    item.groups.forEach(g => { state.sel[g.id] = g.options[0].id; });
    const price = el('span', { class: 'card__price' });
    const count = el('span', { class: 'card__count', hidden: true });
    countBadges[item.id] = count;
    const spec = () => ({ id: item.id, sel: Object.assign({}, state.sel), addons: [] });
    const refresh = () => { price.textContent = money(resolve(Object.assign({ qty: 1 }, spec())).unit); };

    const controls = item.groups.map(g => g.style === 'select'
      ? el('select', { class: 'sel', 'aria-label': item.name + ': ' + g.title.toLowerCase(), onchange: e => { state.sel[g.id] = e.target.value; refresh(); } },
        g.options.map(o => el('option', { value: o.id, text: o.name })))
      : segControl(item, g, state, refresh, true));

    refresh();
    return el('article', { class: 'card card--opt' }, [
      el('div', { class: 'card__e card__e--tone', text: item.emoji || '🥤', 'aria-hidden': 'true', style: item.tone ? '--tone:' + item.tone : null }),
      el('div', { class: 'card__name' }, [document.createTextNode(item.name), count]),
      el('div', { class: 'card__ctrl' }, controls),
      el('div', { class: 'card__foot' }, [price,
        el('button', { type: 'button', class: 'btn btn--red add', html: icon('plus') + t('Добавить'), 'aria-label': t('Добавить: ') + item.name,
          onclick: () => addToCart(spec(), 1) })])
    ]);
  }

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
      const qty = qtyOf(id), item = ITEMS[id];
      actionSlots[id].replaceChildren(qty > 0
        ? stepper(qty, q => (q > qty ? addToCart({ id }, 1) : decLast(id)), item.name + t(': количество'))
        : el('button', { type: 'button', class: 'btn btn--red add', html: icon('plus') + t('Добавить'), 'aria-label': t('Добавить: ') + item.name,
          onclick: () => addToCart({ id }, 1) }));
    });
    Object.keys(countBadges).forEach(id => {
      const qty = qtyOf(id);
      countBadges[id].hidden = qty === 0;
      countBadges[id].textContent = t('в корзине: ') + qty;
    });
  }

  function renderMenu() {
    const menu = $('[data-menu]'), cats = $('[data-cats]');
    CATS.forEach(cat => {
      cats.appendChild(el('a', { href: '#cat-' + cat.id, text: cat.title, 'data-cat': cat.id }));
      const big = cat.items.filter(i => i.type === 'configurable');
      const rest = cat.items.filter(i => i.type !== 'configurable');
      const sharedHeading = cat.items.length === 1 && big.length === 1 && big[0].name === cat.title && !cat.note;
      const kind = rest.some(i => i.type === 'options') ? 'opt' : rest.some(i => i.includes) ? 'combo' : 'snacks';
      menu.appendChild(el('section', { class: 'cat', id: 'cat-' + cat.id, 'aria-labelledby': 'cat-h-' + cat.id }, [
        sharedHeading ? null : el('div', { class: 'cat__head' }, [
          el('h3', { text: cat.title, id: 'cat-h-' + cat.id }),
          cat.note ? el('span', { class: 'cat__note', text: cat.note }) : null
        ])
      ].concat(big.map(item => renderDoner(item, sharedHeading ? 'cat-h-' + cat.id : null)), rest.length ? [el('div', { class: 'cards cards--' + kind },
        rest.map(i => (i.type === 'options' ? renderOptionCard(i) : renderItem(i))))] : [])));
    });
    $('[data-menu-hint]').textContent = CFG.menuHint || '';
    $('[data-menu-hint]').hidden = !CFG.menuHint;

    // подсветка активной категории
    if ('IntersectionObserver' in window) {
      const links = $$('[data-cat]');
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => {
          if (!en.isIntersecting) return;
          links.forEach(a => {
            const on = '#' + en.target.id === a.getAttribute('href');
            a.classList.toggle('is-active', on);
            if (on && a.parentNode.scrollWidth > a.parentNode.clientWidth) {   // на телефоне лента категорий листается
              a.parentNode.scrollTo({ left: a.offsetLeft - 16, behavior: 'smooth' });
            }
          });
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
      node.textContent = open ? t('Открыто до {time}', { time: hh(CFG.hours.close) }) : t('Закрыто · откроемся в {time}', { time: hh(CFG.hours.open) });
      node.classList.toggle('is-open', open);
      node.classList.toggle('is-closed', !open);
    });
    const note = $('[data-closed-note]');
    note.hidden = open;
    note.textContent = t('Сейчас мы закрыты — работаем {open}–{close} по времени Хромтау. Заказ можно отправить уже сейчас, ответим после открытия.', { open: hh(CFG.hours.open), close: hh(CFG.hours.close) });
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
    out.push('*' + t('Новый заказ с сайта — ') + CFG.brand.name + '*', '');
    lines().forEach((l, i) => {
      out.push((i + 1) + '. ' + l.title + (l.opts ? ' (' + l.opts + ')' : ''));
      out.push('   ' + l.qty + ' × ' + moneyText(l.unit) + ' = ' + moneyText(l.sum));
    });
    out.push('', '*' + t('Итого: ') + moneyText(cartTotal()) + '*' + (delivery ? t(' (без учёта доставки)') : ''), '');
    out.push(t('Получение: ') + t(delivery ? 'доставка' : 'самовывоз'));
    if (delivery) out.push(t('Адрес: ') + d.address);
    out.push(t('Когда: ') + (d.when === 'time' && d.time ? t('к {time}', { time: d.time }) : t('как можно скорее')));
    if (d.payment) out.push(t('Оплата: ') + t(d.payment));
    out.push(t('Имя: ') + d.name);
    if (d.phone) out.push(t('Телефон: ') + d.phone);
    if (d.comment) out.push(t('Комментарий: ') + d.comment);
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
        el('div', { class: 'line__unit', text: money(l.unit) + t(' за шт.') })
      ]),
      el('div', { class: 'line__sum', text: money(l.sum) }),
      // вопрос без ответа (соус к фри) — спрашиваем прямо в строке
      l.pending.length ? el('div', { class: 'line__ask' }, [el('span', { text: l.pending[0].short || l.pending[0].title + ':' })].concat(
        l.pending[0].options.map(o => el('button', { type: 'button', class: 'chip chip--sm' + (o.id === 'none' ? ' chip--muted' : ''), text: o.name,
          onclick: () => changeOption(l.key, l.pending[0].id, o.id, true) })))) : null,
      el('div', { class: 'line__ctrl' }, [
        stepper(l.qty, q => setQty(l.key, q), l.title + t(': количество')),
        el('button', { type: 'button', class: 'line__del', html: icon('trash') + t('Убрать'), 'aria-label': t('Убрать: ') + l.title, onclick: () => setQty(l.key, 0) })
      ])
    ])));
  }

  // блок «Добавить к заказу?» в корзине
  function renderCartSuggest() {
    const box = $('[data-cart-suggest]');
    const asking = lines().some(l => l.pending.length);      // пока не выбран бесплатный соус, платные не предлагаем
    const list = available(CFG.cartSuggest).filter(s => !(asking && CAT_OF[s.spec.id] === 'sauces')).slice(0, 4);
    box.hidden = !list.length;
    if (!list.length) return;
    box.replaceChildren(
      el('div', { class: 'cs__t', text: 'Добавить к заказу?' }),
      el('div', { class: 'cs__row' }, list.map(s => el('button', { type: 'button', class: 'cs__item', 'aria-label': t('Добавить: ') + s.label + ', ' + money(s.price),
        onclick: () => { addToCart(s.spec, 1, { silent: true }); toast(t('В корзине: ') + s.label); } }, [
        el('span', { class: 'cs__e', text: s.emoji, 'aria-hidden': 'true' }),
        el('span', { class: 'cs__n', text: s.label }),
        el('span', { class: 'cs__p', html: icon('plus') }, [document.createTextNode(money(s.price))])
      ])))
    );
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
    if (!count) hideTray();
    renderActions();

    const empty = count === 0;
    $('[data-empty]').hidden = !(empty && view === 'form');
    $('[data-done]').hidden = view !== 'done';
    form.hidden = empty || view !== 'form';
    $('[data-sheet-foot]').hidden = empty || view !== 'form';
    $('[data-total]').textContent = money(total);
    if (!form.hidden) { renderLines(); renderCartSuggest(); syncForm(); }
  }

  function openCart() {
    lastFocus = document.activeElement;
    view = 'form';
    hideTray();
    $('[data-sheet]').hidden = false;
    document.body.classList.add('is-locked');
    $('#page').inert = true;
    renderStatus();
    renderCart(false);
    $('.sheet__panel').focus();
  }
  function closeCart() {
    endEditing();
    $('[data-sheet]').hidden = true;
    document.body.classList.remove('is-locked');
    $('#page').inert = false;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // На мобильных клавиатура уменьшает visualViewport, но не всегда fixed-контейнер.
  function fitKeyboardViewport() {
    const sheet = $('[data-sheet]');
    const viewport = window.visualViewport;
    sheet.style.setProperty('--visible-height', (viewport ? viewport.height : window.innerHeight) + 'px');
    sheet.style.setProperty('--visible-top', (viewport ? viewport.offsetTop : 0) + 'px');
  }

  function endEditing() {
    const active = document.activeElement;
    if (active && form.contains(active)) active.blur();
    $('[data-sheet]').classList.remove('is-editing');
    $('[data-dismiss-keyboard]').hidden = true;
  }

  function revealCheckoutField(field) {
    const scroll = $('[data-sheet-scroll]');
    const area = scroll.getBoundingClientRect();
    const bounds = field.getBoundingClientRect();
    if (bounds.bottom > area.bottom - 12) scroll.scrollTop += bounds.bottom - area.bottom + 12;
    else if (bounds.top < area.top + 12) scroll.scrollTop -= area.top + 12 - bounds.top;
  }

  function initKeyboard() {
    const sheet = $('[data-sheet]');
    const done = $('[data-dismiss-keyboard]');
    form.addEventListener('focusin', event => {
      if (!window.matchMedia('(max-width: 899px)').matches ||
          !event.target.matches('textarea, input:not([type="radio"]):not([type="checkbox"])')) return;
      sheet.classList.add('is-editing');
      done.hidden = false;
      fitKeyboardViewport();
      requestAnimationFrame(() => revealCheckoutField(event.target));
    });
    // Сохраняем фокус до click, чтобы кнопка не сдвинулась из-под пальца.
    done.addEventListener('pointerdown', event => event.preventDefault());
    done.addEventListener('click', () => {
      endEditing();
      $('.sheet__panel').focus({ preventScroll: true });
    });
    form.addEventListener('keydown', event => {
      if (event.key === 'Enter' && event.target.matches('input:not([type="radio"])')) {
        event.preventDefault();
        endEditing();
        $('.sheet__panel').focus({ preventScroll: true });
      }
    });
    let frame;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!sheet.classList.contains('is-editing')) return;
        fitKeyboardViewport();
        // Дожидаемся перерасчёта высоты скролл-области после появления клавиатуры.
        requestAnimationFrame(() => {
          const active = document.activeElement;
          if (sheet.classList.contains('is-editing') && form.contains(active)) revealCheckoutField(active);
        });
      });
    };
    window.addEventListener('resize', resize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', resize);
      window.visualViewport.addEventListener('scroll', resize);
    }
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
    try {
      const draft = JSON.parse(sessionStorage.getItem('istanbul.languageDraft') || 'null');
      if (draft) Object.entries(draft).forEach(([key, value]) => {
        const field = form.elements.namedItem(key);
        if (field) field.value = value;
      });
      sessionStorage.removeItem('istanbul.languageDraft');
    } catch (e) { /* storage unavailable */ }

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
      setTimeout(() => { endEditing(); view = 'done'; renderCart(false); $('[data-sheet-scroll]').scrollTop = 0; }, 700);
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
      toast('Корзина очищена — можно оформить новый заказ');
    });
    $('[data-tray-close]').addEventListener('click', () => {
      if (trayDismissKey) dismissed.add(trayDismissKey);
      hideTray();
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
    const box = el('span', { class: 'stars', role: 'img', 'aria-label': t('Оценка {n} из 5', { n }) });
    for (let i = 1; i <= 5; i++) box.insertAdjacentHTML('beforeend', '<svg class="ic' + (i > n ? ' off' : '') + '" aria-hidden="true"><use href="#i-star"/></svg>');
    return box;
  }
  function reviewDate(iso) {
    // В некоторых браузерах kk-KZ выводит «M03» вместо названия месяца.
    if (language === 'kk') {
      const [year, month, day] = iso.split('-').map(Number);
      const months = ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'];
      return day + ' ' + months[month - 1] + ' ' + year;
    }
    return new Date(iso + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  }

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
            text: s.ratings_count + ' ' + plural(s.ratings_count, ['оценка', 'оценки', 'оценок']) + ' · ' + s.reviews_count + ' ' + plural(s.reviews_count, ['отзыв', 'отзыва', 'отзывов']) + t(' в 2ГИС') })])
        ]),
        el('div', { class: 'bars' }, [5, 4, 3, 2, 1].map(n => el('div', { class: 'bar' }, [
          el('span', { text: String(n) }),
          el('i', {}, [el('b', { style: 'width:' + Math.round((dist[n] || 0) / max * 100) + '%' })]),
          el('span', { text: String(dist[n] || 0) })
        ]))),
        el('p', { class: 'bars__note', text: t('Распределение — по {n} подтверждённым отзывам.', { n: s.confirmed_reviews }) }),
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
        more.textContent = t(clamped ? 'Читать полностью' : 'Свернуть');
      } }) : null;
      const tag = r.visits >= 3 ? t('Частый гость · ') + r.visits + ' ' + plural(r.visits, ['посещение', 'посещения', 'посещений'])
        : r.visits ? 'Посещение подтверждено 2ГИС' : '';
      track.appendChild(el('article', { class: 'rev' }, [
        el('div', { class: 'rev__head' }, [
          el('div', { class: 'rev__ava', text: initials(r.author), style: 'background:' + AVA[i % AVA.length], 'aria-hidden': 'true' }),
          el('div', {}, [el('div', { class: 'rev__name', text: r.author }), el('div', { class: 'rev__meta', text: reviewDate(r.date) })])
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
      cap.textContent = g.alt + t(' · фото гостей, 2ГИС');
    };
    const close = () => { box.hidden = true; document.body.classList.remove('is-locked'); $('#page').inert = false; if (opener) opener.focus(); };
    CFG.gallery.forEach((g, i) => grid.appendChild(el('button', {
      type: 'button', class: g.shape ? 'is-' + g.shape : '', 'aria-label': t('Открыть фото: ') + g.alt,
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
      else if (!$('[data-tray]').hidden && e.key === 'Escape') hideTray();
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
    Object.values(ITEMS).forEach(i => { if (i.type === 'configurable' && i.prices) prices.push.apply(prices, Object.values(i.prices)); });
    if (prices.length) $$('[data-min-price]').forEach(n => { n.textContent = money(Math.min.apply(null, prices)); });
  }

  // ─────────────────────────── уведомление ───────────────────────────
  let toastTimer;
  function toast(text) {
    const t = $('[data-toast]');
    t.textContent = window.ISTANBUL_I18N.t(text);
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 2200);
  }

  // ──────────────────────────────── старт ────────────────────────────────
  applyConfig();
  renderMenu();
  initCheckout();
  initKeyboard();
  renderReviews();
  initGallery();
  renderStatus();
  renderCart(false);
  setInterval(renderStatus, 60000);
})();
