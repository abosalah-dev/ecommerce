'use strict';

// البيانات المبدئية اللي المتجر بيبدأ بيها أول مرة.
// المنتجات والأسعار من عرض "شنطة التوفير" (شركة أمانكم).
// تقدر تعدل كل ده بعد كده من لوحة التحكم.

const categories = [
  { id: 'basics', name: 'السكر والأرز والدقيق', icon: '🍚', sort: 1 },
  { id: 'oils', name: 'الزيت والخل', icon: '🫒', sort: 2 },
  { id: 'dairy', name: 'الألبان', icon: '🥛', sort: 3 },
  { id: 'drinks', name: 'الشاي', icon: '☕', sort: 4 },
  { id: 'paper', name: 'المناديل', icon: '🧻', sort: 5 },
];

// price = سعر الوحدة ، marketPrice = سعر السوق لو حابب تبين التوفير (اختياري)
// unitCount / unitName = عشان نحسب سعر الكيلو أو اللتر لو العبوة فيها أكتر من وحدة
// [id, image, name, categoryId, unit, price, marketPrice, unitCount, unitName, stock, featured, description]
const productRows = [
  ['pasta-malika', 'pasta-penne', 'مكرونة الملكة', 'basics', 'كيس', 16, null, null, '', 200, true, 'كيس مكرونة الملكة.'],
  ['sugar-bahia', 'sugar-1kg', 'سكر بهية', 'basics', '1 كيلو', 27, null, null, '', 200, true, 'سكر بهية أبيض، بالكيلو.'],
  ['rice-zad', 'rice-1kg', 'أرز معبأ بلدي زاد', 'basics', '1 كيلو', 27, null, null, '', 200, true, 'أرز بلدي معبأ من زاد، بالكيلو.'],
  ['flour-habouba', 'flour-1kg', 'دقيق حبوبة', 'basics', '1 كيلو', 27, null, null, '', 100, false, 'دقيق حبوبة، بالكيلو.'],
  ['salt-malika', 'salt', 'ملح الملكة', 'basics', 'كيس', 4, null, null, '', 200, false, 'كيس ملح الملكة.'],
  ['oil-frying', 'oil-sunflower', 'زيت قلية', 'oils', '1 لتر', 94.5, null, null, '', 100, true, 'زيت قلية، عبوة 1 لتر.'],
  ['vinegar-zad', 'vinegar', 'خل زاد', 'oils', 'زجاجة', 12.5, null, null, '', 100, false, 'زجاجة خل زاد.'],
  ['milk-juhayna-1l', 'milk', 'لبن جهينة', 'dairy', 'كيس 1 لتر', 39.5, null, null, '', 100, true, 'كيس لبن جهينة 1 لتر.'],
  ['milk-juhayna-half', 'milk', 'لبن جهينة', 'dairy', 'نص كيلو', 22.5, null, null, '', 100, false, 'لبن جهينة نص كيلو.'],
  ['tea-arousa', 'tea-loose', 'شاي العروسة', 'drinks', 'باكو 40 جرام', 9, null, null, '', 200, true, 'باكو شاي العروسة 40 جرام.'],
  ['tissues-softpro', 'tissues-box', 'مناديل سوفت برو', 'paper', '3 باكت', 73, null, 3, 'باكت', 100, false, 'مناديل سوفت برو، 3 باكت.'],
];

// الباقات الجاهزة: العميل يضيف الباقة كلها للسلة بضغطة
const bundles = [
  {
    id: 'bundle-savings-bag',
    name: 'شنطة التوفير',
    description: 'كل طلبات البيت الأساسية في شنطة واحدة',
    icon: '🛍️',
    items: [
      ['pasta-malika', 4],
      ['sugar-bahia', 3],
      ['rice-zad', 3],
      ['oil-frying', 1],
      ['salt-malika', 4],
      ['milk-juhayna-1l', 1],
      ['milk-juhayna-half', 1],
      ['vinegar-zad', 2],
      ['tissues-softpro', 1],
      ['tea-arousa', 3],
      ['flour-habouba', 1],
    ],
  },
];

const defaultSettings = {
  storeName: 'جملة بيتك',
  tagline: 'طلبية بيتك للشهر كله.. مرة واحدة وبسعر الجملة لحد بابك',
  phone: '01097979228',
  whatsapp: '201097979228',
  salesPhone: '01112914300',
  salesName: 'جابر',
  address: 'الهرم - فيصل، الجيزة',
  serviceAreas: ['الهرم', 'فيصل'],
  workingHours: 'يومياً من 9 الصبح لـ 12 بالليل',
  deliveryFee: 50,
  freeDeliveryThreshold: 1000,
  minOrder: 100,
  maxQtyPerItem: 20,
  announcement: '🏪 تقدر تيجي تشتري من المحل علطول • 🚚 توصيل مجاني للطلبات فوق 1000 جنيه',
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=29.983306,31.144972',
};

function createSeed() {
  const now = new Date().toISOString();
  return {
    version: 2,
    settings: { ...defaultSettings, serviceAreas: [...defaultSettings.serviceAreas] },
    admin: { passwordHash: null },
    categories: categories.map((c) => ({ ...c })),
    products: productRows.map(
      ([id, image, name, categoryId, unit, price, marketPrice, unitCount, unitName, stock, featured, description], i) => ({
        id,
        name,
        categoryId,
        unit,
        price,
        marketPrice,
        unitCount,
        unitName,
        stock,
        featured,
        description,
        image: `/images/products/${image}.svg`,
        active: true,
        sort: i + 1,
        createdAt: now,
        updatedAt: now,
      })
    ),
    bundles: bundles.map((b, i) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      icon: b.icon,
      items: b.items.map(([productId, qty]) => ({ productId, qty })),
      active: true,
      sort: i + 1,
    })),
    orders: [],
    counters: { order: 1000 },
  };
}

module.exports = { createSeed, defaultSettings };
