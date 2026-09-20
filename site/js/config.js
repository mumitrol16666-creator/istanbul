/*
 * НАСТРОЙКИ САЙТА — всё, что обычно нужно менять, лежит в этом файле:
 * номер WhatsApp, часы работы, меню и цены, фото в галерее.
 *
 * Как добавить блюдо: скопируйте строку вида
 *   { id: 'cola-05', name: 'Кола 0,5 л', price: 450, emoji: '🥤' },
 * в нужную категорию. id — любое уникальное слово латиницей.
 * Чтобы временно убрать блюдо или категорию — добавьте hidden: true.
 */

// Вопрос, который сайт задаёт сразу после добавления фри: соус к фри бесплатный (так на меню-борде).
// ⚠️ Названия соусов — заглушки, сверить с кафе.
const ISTANBUL_FREE_SAUCE = {
  id: 'sauce', title: 'Соус', optional: true,
  ask: 'Соус к фри — бесплатно. Какой положить?',
  short: 'Соус бесплатно:',
  options: [
    { id: 'cheese', name: 'Сырный', line: 'соус сырный' },
    { id: 'garlic', name: 'Чесночный', line: 'соус чесночный' },
    { id: 'ketchup', name: 'Кетчуп', line: 'кетчуп' },
    { id: 'none', name: 'Без соуса', line: 'без соуса' }
  ]
};

window.ISTANBUL = {
  brand: {
    name: 'Istanbul Doner',
    city: 'Хромтау',
    slogan: 'Кто попробует, тот полюбит!'
  },

  contacts: {
    whatsapp: '77782508349',              // номер, на который уходит заказ (только цифры, с кодом страны)
    whatsappDisplay: '+7 778 250 83 49',     // как показывать этот номер на сайте
    phone: '+77078909669',
    phoneDisplay: '+7 707 890 96 69',
    instagram: 'istanbul_cafe_hromtau',
    address: 'ул. Есет батыра, 4Б',
    city: 'Хромтау, Актюбинская область',
    landmark: 'остановка «Гостиница Хромит» — 270 м',
    lat: 50.257943,
    lon: 58.436562,
    twoGis: 'https://go.2gis.com/PraD3',
    twoGisReviews: 'https://2gis.kz/aktobe/firm/70000001083426430/tab/reviews'
  },

  // Реквизиты для страницы «Политика конфиденциальности» (privacy.html). Пока пусто — строка с реквизитами не показывается.
  // ⚠️ Перед запуском вписать: operator — 'ИП Фамилия И. О.' или 'ТОО «…»', bin — БИН/ИИН.
  legal: { operator: '', bin: '' },

  // Часы работы по местному времени (Хромтау, UTC+5). close: 24 = до полуночи.
  hours: { open: 10, close: 24, utcOffsetMin: 300, label: 'Ежедневно 10:00–24:00' },

  currency: '₸',
  payments: ['Наличные', 'Карта', 'QR-код'],
  deliveryNote: 'Стоимость и время доставки подтвердит оператор в WhatsApp.',

  // ───────────────────────────── МЕНЮ ─────────────────────────────
  // Цены — с меню-борда кафе (фото из 2ГИС от 27.06.2026).
  menu: [
    {
      id: 'doner',
      emoji: '🌯',
      title: 'Донер',
      items: [
        {
          id: 'doner',
          type: 'configurable',
          name: 'Донер',
          desc: 'Сочное мясо с гриля, свежие овощи и фирменный соус. Выберите основу и мясо — цена пересчитается сама.',
          image: 'img/doner.jpg',
          imageAlt: 'Два донера в разрезе на фирменной бумаге Istanbul Doner',
          groups: [
            {
              id: 'base', title: 'Основа',
              options: [
                { id: 'lavash', name: 'В лаваше', kz: 'лаваштағы', line: 'в лаваше' },
                { id: 'baton', name: 'В батоне', kz: 'батондағы', line: 'в батоне' }
              ]
            },
            {
              id: 'meat', title: 'Мясо',
              options: [
                { id: 'chicken', name: 'Курица', kz: 'тауық еті', line: 'курица' },
                { id: 'beef', name: 'Говядина', kz: 'сиыр еті', line: 'говядина' },
                { id: 'mix', name: 'Ассорти', kz: 'ассорти', line: 'ассорти' }
              ]
            }
          ],
          // ключ = 'основа/мясо'
          prices: {
            'lavash/chicken': 1390, 'lavash/beef': 1690, 'lavash/mix': 1590,
            'baton/chicken': 1490, 'baton/beef': 1790, 'baton/mix': 1690
          },
          addons: [
            { id: 'cheese', name: 'Сыр', line: 'сыр', price: 150 },
            { id: 'hot', name: 'Острый соус', line: 'острый соус', price: 100 }
          ]
        }
      ]
    },
    {
      id: 'combo',
      emoji: '🍱',
      title: 'Комбо',
      items: [
        {
          // covers — что уже входит в комбо: эти блюда/категории не будут предлагаться «добавить к заказу»
          id: 'combo-doner', name: 'Комбо «Doner»', price: 2490, emoji: '🌯', badge: 'Хит',
          includes: ['Донер куриный', 'Картофель фри', 'Кола 0,5 л'], covers: ['drinks', 'fries', 'fries-country']
        },
        {
          id: 'combo-istanbul', name: 'Комбо «Istanbul»', price: 6790, emoji: '🍕', badge: 'На компанию',
          includes: ['Донер куриный', 'Пицца пепперони', 'Крылышки 7 шт', 'Картофель фри', 'Кола 1 л'], covers: ['drinks', 'fries', 'fries-country']
        }
      ]
    },
    {
      id: 'snacks',
      emoji: '🍟',
      title: 'Снэки',
      note: 'Соус к фри — бесплатно',
      items: [
        // groups с optional: true — вопрос, который сайт задаёт сразу после добавления (на цену не влияет)
        { id: 'fries', name: 'Фри', price: 800, emoji: '🍟', groups: [ISTANBUL_FREE_SAUCE] },
        { id: 'fries-country', name: 'Фри по-деревенски', price: 900, emoji: '🥔', groups: [ISTANBUL_FREE_SAUCE] },
        { id: 'nuggets', name: 'Наггетсы', price: 1190, emoji: '🍗' },
        { id: 'pepper', name: 'Перчик', price: 50, emoji: '🌶️' }
      ]
    },
    {
      // ⚠️ НАПИТКИ: ассортимент, вкусы и цены — ЗАГЛУШКИ (цены 0,5 л взяты с сайта-референса, 1 л — оценка).
      //    Перед запуском сверить с кафе. type: 'options' — карточка с выбором вкуса и объёма;
      //    цена = сумма price выбранных вариантов. style: 'select' — выпадающий список, иначе кнопки.
      id: 'drinks',
      emoji: '🥤',
      title: 'Напитки',
      items: [
        {
          id: 'cola', type: 'options', name: 'Coca-Cola', emoji: '🥤', tone: '#e6202a',
          groups: [
            { id: 'flavor', title: 'Вкус', style: 'select', options: [
              { id: 'classic', name: 'Классик', line: 'классик' },
              { id: 'zero', name: 'Zero', line: 'zero' }
            ] },
            { id: 'size', title: 'Объём', options: [
              { id: '05', name: '0,5 л', line: '0,5 л', price: 650 },
              { id: '1', name: '1 л', line: '1 л', price: 950 }
            ] }
          ]
        },
        {
          id: 'fanta', type: 'options', name: 'Fanta', emoji: '🍊', tone: '#f47b20',
          groups: [
            { id: 'flavor', title: 'Вкус', style: 'select', options: [
              { id: 'orange', name: 'Апельсин', line: 'апельсин' },
              { id: 'citrus', name: 'Цитрус', line: 'цитрус' }
            ] },
            { id: 'size', title: 'Объём', options: [
              { id: '05', name: '0,5 л', line: '0,5 л', price: 650 },
              { id: '1', name: '1 л', line: '1 л', price: 950 }
            ] }
          ]
        },
        {
          id: 'piko', type: 'options', name: 'Сок Piko', emoji: '🧃', tone: '#2b2b2b',
          groups: [
            { id: 'flavor', title: 'Вкус', style: 'select', options: [
              { id: 'apple', name: 'Яблоко', line: 'яблоко' },
              { id: 'orange', name: 'Апельсин', line: 'апельсин' },
              { id: 'multi', name: 'Мультифрукт', line: 'мультифрукт' }
            ] },
            { id: 'size', title: 'Объём', options: [
              { id: '02', name: '0,2 л', line: '0,2 л', price: 400 },
              { id: '1', name: '1 л', line: '1 л', price: 1100 }
            ] }
          ]
        },
        {
          id: 'fuse', type: 'options', name: 'Чай Fuse', emoji: '🍋', tone: '#3aa935',
          groups: [
            { id: 'flavor', title: 'Вкус', style: 'select', options: [
              { id: 'lemon', name: 'Лимон', line: 'лимон' },
              { id: 'peach', name: 'Персик', line: 'персик' }
            ] },
            { id: 'size', title: 'Объём', options: [
              { id: '05', name: '0,5 л', line: '0,5 л', price: 600 },
              { id: '1', name: '1 л', line: '1 л', price: 900 }
            ] }
          ]
        },
        {
          id: 'bonaqua', type: 'options', name: 'Вода BonAqua', emoji: '💧', tone: '#0a66c2',
          groups: [
            { id: 'flavor', title: 'Вид', style: 'select', options: [
              { id: 'still', name: 'Без газа', line: 'без газа' },
              { id: 'sparkling', name: 'Газированная', line: 'газированная' }
            ] },
            { id: 'size', title: 'Объём', options: [
              { id: '05', name: '0,5 л', line: '0,5 л', price: 500 }
            ] }
          ]
        }
      ]
    },
    {
      // ⚠️ СОУСЫ: с меню-борда известен только «острый соус — 100 ₸». Остальные названия и цены — заглушки.
      id: 'sauces',
      emoji: '🧄',
      title: 'Соусы',
      note: 'К фри один соус — бесплатно',
      items: [
        { id: 'sauce-cheese', name: 'Сырный соус', price: 100, emoji: '🧀' },
        { id: 'sauce-garlic', name: 'Чесночный соус', price: 100, emoji: '🧄' },
        { id: 'sauce-ketchup', name: 'Кетчуп', price: 100, emoji: '🍅' },
        { id: 'sauce-hot', name: 'Острый соус', price: 100, emoji: '🌶️' }
      ]
    },
    {
      // На фото борда количество штук обрезано — впишите его в name и уберите hidden.
      id: 'chicken',
      emoji: '🍗',
      title: 'Chicken',
      hidden: true,
      items: [
        { id: 'chicken-s', name: 'Крылышки — ? шт', price: 2090, emoji: '🍗' },
        { id: 'chicken-m', name: 'Крылышки — ? шт', price: 3390, emoji: '🍗' },
        { id: 'chicken-l', name: 'Крылышки — ? шт', price: 4590, emoji: '🍗' }
      ]
    }
  ],

  // Подсказка под меню (блюда, которых пока нет в списке)
  menuHint: 'Бургеры, пицца, хот-доги и чикен тоже есть — напишите, что хотите, в комментарии к заказу, оператор подскажет цену.',

  // ───────────────────────── СКИДКА ДНЯ ─────────────────────────
  // Блок на главной + баннер на странице заказа; цена пересчитывается в меню, корзине и сообщении сама.
  // Показывается первая акция, подходящая под сегодняшний день (по времени Хромтау).
  //   items   — id блюд, на которые действует скидка
  //   percent — размер скидки, % (цена округляется до 10 ₸)
  //   days    — дни недели: 1 — пн … 7 — вс; пустой список — каждый день
  //   from / until — необязательные даты 'ГГГГ-ММ-ДД', включительно
  //   active: false — выключить акцию, не удаляя
  // ⚠️ ПРИМЕР ДЛЯ ДЕМО: эту скидку кафе не объявляло. Согласовать с кафе или выключить перед показом гостям.
  deals: [
    {
      active: true,
      items: ['combo-doner'],
      percent: 10,
      days: [],
      title: 'Комбо «Doner» — минус 10%',
      text: 'Донер куриный, картофель фри и кола 0,5 л. Скидка применится в корзине сама — промокод не нужен.',
      image: 'img/g4.jpg',
      imageAlt: 'Донер с картофелем фри и напитками на столике у окна'
    }
  ],

  // ───────────────────── ПРЕДЛОЖЕНИЯ К ПОКУПКЕ ─────────────────────
  // Всплывающая подсказка сразу после добавления блюда. after — какие блюда её вызывают,
  // suggest — что предложить (id блюда; для напитков — с выбранными вариантами и короткой подписью).
  // То, что уже лежит в корзине или входит в комбо, не предлагается.
  upsell: [
    {
      id: 'doner-sides', after: ['doner'], title: 'К донеру отлично зайдёт',
      suggest: [
        { id: 'fries' },
        { id: 'cola', sel: { flavor: 'classic', size: '05' }, label: 'Coca-Cola 0,5 л' },
        { id: 'pepper' }
      ]
    },
    {
      id: 'nuggets-sauce', after: ['nuggets'], title: 'К наггетсам — соус?',
      suggest: [{ id: 'sauce-cheese' }, { id: 'sauce-garlic' }, { id: 'sauce-ketchup' }]
    },
    {
      id: 'snack-drink', after: ['fries', 'fries-country', 'nuggets'], title: 'Добавить напиток?',
      suggest: [
        { id: 'cola', sel: { flavor: 'classic', size: '05' }, label: 'Coca-Cola 0,5 л' },
        { id: 'fuse', sel: { flavor: 'lemon', size: '05' }, label: 'Чай Fuse 0,5 л' },
        { id: 'piko', sel: { flavor: 'apple', size: '02' }, label: 'Сок Piko 0,2 л' }
      ]
    }
  ],
  // Категории, где достаточно одной позиции: есть любой напиток — другие напитки уже не предлагаем
  upsellExclusive: ['drinks', 'sauces'],
  // Блок «Добавить к заказу?» в корзине (показываются первые 4 подходящих)
  cartSuggest: [
    { id: 'cola', sel: { flavor: 'classic', size: '05' }, label: 'Coca-Cola 0,5 л' },
    { id: 'fries' },
    { id: 'sauce-cheese' },
    { id: 'pepper' },
    { id: 'nuggets' },
    { id: 'fuse', sel: { flavor: 'lemon', size: '05' }, label: 'Чай Fuse 0,5 л' }
  ],

  // ─────────────────────────── ГАЛЕРЕЯ ───────────────────────────
  // shape: 'tall' — плитка в 2 ряда, 'wide' — в 2 колонки. Порядок подобран так, чтобы сетка была без дыр.
  gallery: [
    { src: 'img/g1.jpg', thumb: 'img/g1-sm.jpg', shape: 'tall', alt: 'Четыре донера с перчиками на фирменной бумаге Istanbul Doner' },
    { src: 'img/g3.jpg', thumb: 'img/g3-sm.jpg', shape: 'tall', alt: 'Донер с фирменным соусом и колой' },
    { src: 'img/g2.jpg', thumb: 'img/g2-sm.jpg', shape: 'wide', alt: 'Донер и картофель фри крупным планом' },
    { src: 'img/g5.jpg', thumb: 'img/g5-sm.jpg', shape: 'tall', alt: 'Два донера в разрезе на фирменной бумаге' },
    { src: 'img/g7.jpg', thumb: 'img/g7-sm.jpg', shape: 'tall', alt: 'Фасад кафе Istanbul Doner в Хромтау' },
    { src: 'img/g4.jpg', thumb: 'img/g4-sm.jpg', alt: 'Донер с картофелем фри и напитками на столике у окна' },
    { src: 'img/g6.jpg', thumb: 'img/g6-sm.jpg', alt: 'Донер с сыром и соусом, красный диван в зале' }
  ]
};
