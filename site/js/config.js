/*
 * НАСТРОЙКИ САЙТА — всё, что обычно нужно менять, лежит в этом файле:
 * номер WhatsApp, часы работы, меню и цены, фото в галерее.
 *
 * Как добавить блюдо: скопируйте строку вида
 *   { id: 'cola-05', name: 'Кола 0,5 л', price: 450, emoji: '🥤' },
 * в нужную категорию. id — любое уникальное слово латиницей.
 * Чтобы временно убрать блюдо или категорию — добавьте hidden: true.
 */
window.ISTANBUL = {
  brand: {
    name: 'Istanbul Doner',
    city: 'Хромтау',
    slogan: 'Кто попробует, тот полюбит!'
  },

  contacts: {
    whatsapp: '77078909669',              // номер, на который уходит заказ (только цифры, с кодом страны)
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
      title: 'Комбо',
      items: [
        {
          id: 'combo-doner', name: 'Комбо «Doner»', price: 2490, emoji: '🌯', badge: 'Хит',
          includes: ['Донер куриный', 'Картофель фри', 'Кола 0,5 л']
        },
        {
          id: 'combo-istanbul', name: 'Комбо «Istanbul»', price: 6790, emoji: '🍕', badge: 'На компанию',
          includes: ['Донер куриный', 'Пицца пепперони', 'Крылышки 7 шт', 'Картофель фри', 'Кола 1 л']
        }
      ]
    },
    {
      id: 'snacks',
      title: 'Снэки',
      note: 'Соус к фри — бесплатно',
      items: [
        { id: 'fries', name: 'Фри', price: 800, emoji: '🍟' },
        { id: 'fries-country', name: 'Фри по-деревенски', price: 900, emoji: '🥔' },
        { id: 'nuggets', name: 'Наггетсы', price: 1190, emoji: '🍗' },
        { id: 'pepper', name: 'Перчик', price: 50, emoji: '🌶️' }
      ]
    },
    {
      // На фото борда количество штук обрезано — впишите его в name и уберите hidden.
      id: 'chicken',
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
  menuHint: 'Бургеры, пицца, хот-доги, чикен и напитки тоже есть — напишите, что хотите, в комментарии к заказу, оператор подскажет цену.',

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
