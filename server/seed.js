'use strict';

// البيانات المبدئية اللي المتجر بيبدأ بيها أول مرة.
// المتجر بيبيع خزين البيت للشهر بأسعار الجملة (بالكرتونة والشيكارة).
// تقدر تعدل كل ده بعد كده من لوحة التحكم.

const categories = [
  { id: 'basics', name: 'السكر والأرز والدقيق', icon: '🍚', sort: 1 },
  { id: 'legumes', name: 'البقوليات', icon: '🫘', sort: 2 },
  { id: 'oils', name: 'الزيوت والسمن', icon: '🫒', sort: 3 },
  { id: 'drinks', name: 'الشاي والقهوة', icon: '☕', sort: 4 },
  { id: 'paper', name: 'المناديل والورقيات', icon: '🧻', sort: 5 },
  { id: 'cleaning', name: 'المنظفات', icon: '🧼', sort: 6 },
];

// price = سعر الجملة ، marketPrice = سعر نفس الكمية قطاعي في السوق
// unitCount / unitName = عشان نحسب سعر الكيلو أو اللتر أو الرول
// [id, image, name, categoryId, unit, price, marketPrice, unitCount, unitName, stock, featured, description]
const productRows = [
  ['sugar-10kg', 'sugar-1kg', 'سكر أبيض ناعم', 'basics', 'كرتونة 10 أكياس × 1 كيلو', 350, 400, 10, 'كيلو', 60, true, 'كرتونة سكر أبيض ناعم نقي، تكفي البيت الشهر كله للشاي والحلويات.'],
  ['sugar-5kg', 'sugar-1kg', 'سكر أبيض ناعم', 'basics', '5 أكياس × 1 كيلو', 178, 200, 5, 'كيلو', 80, false, 'خمس أكياس سكر أبيض ناعم، مناسبة للعيلة الصغيرة.'],
  ['rice-10kg', 'rice-5kg', 'أرز مصري حبة عريضة', 'basics', 'شيكارة 10 كيلو', 380, 440, 10, 'كيلو', 50, true, 'أرز مصري درجة أولى، حبة عريضة ونظيفة. الشيكارة الكبيرة أوفر.'],
  ['rice-5kg', 'rice-1kg', 'أرز مصري حبة عريضة', 'basics', 'شيكارة 5 كيلو', 195, 220, 5, 'كيلو', 80, false, 'أرز مصري درجة أولى، شيكارة 5 كيلو للعيلة الصغيرة.'],
  ['rice-basmati-5kg', 'rice-basmati', 'أرز بسمتي', 'basics', 'شيكارة 5 كيلو', 450, 520, 5, 'كيلو', 25, false, 'أرز بسمتي حبة طويلة، مناسب للكبسة والبرياني.'],
  ['flour-5kg', 'flour-1kg', 'دقيق فاخر', 'basics', '5 أكياس × 1 كيلو', 150, 170, 5, 'كيلو', 50, false, 'دقيق أبيض فاخر متعدد الاستخدامات للعجين والمخبوزات.'],
  ['pasta-carton', 'pasta-penne', 'مكرونة قلم', 'basics', 'كرتونة 20 كيس × 400 جرام', 320, 380, 20, 'كيس', 40, true, 'كرتونة مكرونة من سميد القمح الصلب، تكفي الشهر كله.'],
  ['vermicelli-carton', 'vermicelli', 'شعرية', 'basics', 'كرتونة 10 أكياس × 350 جرام', 145, 170, 10, 'كيس', 40, false, 'شعرية رفيعة للأرز بالشعرية والشوربة.'],
  ['salt-pack', 'salt', 'ملح طعام مكرر', 'basics', '6 أكياس × 700 جرام', 60, 72, 6, 'كيس', 60, false, 'ملح طعام مكرر ومعالج باليود.'],
  ['lentils-5kg', 'lentils-yellow', 'عدس أصفر مجروش', 'legumes', '5 كيلو', 320, 360, 5, 'كيلو', 30, true, 'عدس أصفر مجروش نظيف، لأحلى شوربة عدس طول الشهر.'],
  ['fava-5kg', 'fava-beans', 'فول بلدي', 'legumes', '5 كيلو', 260, 300, 5, 'كيلو', 30, false, 'فول بلدي حبة كاملة للتدميس.'],
  ['white-beans-3kg', 'white-beans', 'فاصوليا بيضاء', 'legumes', '3 كيلو', 240, 270, 3, 'كيلو', 25, false, 'فاصوليا بيضاء ناشفة حبة متوسطة.'],
  ['chickpeas-2kg', 'chickpeas', 'حمص الشام', 'legumes', '2 كيلو', 180, 210, 2, 'كيلو', 25, false, 'حمص حب للحمص بالطحينة والسلطات.'],
  ['oil-carton', 'oil-sunflower', 'زيت عباد الشمس', 'oils', 'كرتونة 12 × 1 لتر', 1020, 1140, 12, 'لتر', 30, true, 'كرتونة زيت عباد شمس نقي وخفيف للطبخ والقلي.'],
  ['oil-5l', 'oil-sunflower', 'زيت عباد الشمس', 'oils', 'جركن 5 لتر', 430, 480, 5, 'لتر', 40, false, 'جركن زيت عباد شمس 5 لتر، أوفر من الإزايز الصغيرة.'],
  ['oil-corn-carton', 'oil-corn', 'زيت ذرة', 'oils', 'كرتونة 6 × 1 لتر', 630, 700, 6, 'لتر', 20, false, 'زيت ذرة صافي، مناسب للطبخ الصحي.'],
  ['ghee-2kg', 'ghee', 'سمن نباتي', 'oils', 'علبة 2 كيلو', 280, 320, 2, 'كيلو', 25, false, 'سمن نباتي بطعم غني للطبيخ والحلويات.'],
  ['tea-loose-1kg', 'tea-loose', 'شاي ناعم', 'drinks', '4 علب × 250 جرام', 360, 420, 4, 'علبة', 40, true, 'شاي أسود ناعم، لون وطعم ومزاج، يكفي الشهر.'],
  ['tea-bags-carton', 'tea-bags', 'شاي فتلة', 'drinks', '6 علب × 100 فتلة', 690, 780, 6, 'علبة', 25, false, 'شاي فتلة سريع التحضير للبيت والشغل.'],
  ['green-tea-pack', 'green-tea', 'شاي أخضر', 'drinks', '6 علب × 25 فتلة', 250, 290, 6, 'علبة', 25, false, 'شاي أخضر خفيف ومنعش.'],
  ['coffee-1kg', 'coffee', 'بن تركي محوّج', 'drinks', '4 أكياس × 250 جرام', 780, 880, 4, 'كيس', 15, false, 'بن تركي محمص ومطحون ناعم بالحبهان.'],
  ['tissues-carton', 'tissues-box', 'مناديل وجه', 'paper', 'كرتونة 10 علب × 500 منديل', 320, 380, 10, 'علبة', 40, true, 'مناديل ناعمة طبقتين، كرتونة تكفي البيت كله.'],
  ['tissues-pocket-50', 'tissues-pocket', 'مناديل جيب', 'paper', '50 باكو', 140, 175, 50, 'باكو', 30, false, 'باكو مناديل صغيرة للشنطة والعربية والمدرسة.'],
  ['toilet-paper-24', 'toilet-paper', 'ورق تواليت', 'paper', 'شوال 24 رول', 270, 320, 24, 'رول', 40, true, 'ورق تواليت ناعم وقوي، شوال 24 رول.'],
  ['kitchen-towels-12', 'kitchen-towels', 'مناشف مطبخ', 'paper', '12 رول', 260, 300, 12, 'رول', 25, false, 'مناشف ورقية عالية الامتصاص للمطبخ.'],
  ['dish-soap-6', 'dish-soap', 'سائل غسيل أطباق', 'cleaning', 'كرتونة 6 × 1 لتر', 240, 280, 6, 'لتر', 30, false, 'سائل أطباق بالليمون، بيشيل الدهون بسهولة.'],
  ['laundry-6kg', 'laundry-powder', 'مسحوق غسيل أوتوماتيك', 'cleaning', 'شيكارة 6 كيلو', 480, 560, 6, 'كيلو', 20, false, 'مسحوق غسيل للغسالات الأوتوماتيك برائحة منعشة.'],
  ['bleach-6', 'bleach', 'كلور', 'cleaning', 'كرتونة 6 × 1 لتر', 130, 156, 6, 'لتر', 30, false, 'كلور مطهر ومبيض للأسطح والملابس البيضاء.'],
  ['floor-cleaner-6', 'floor-cleaner', 'منظف أرضيات معطّر', 'cleaning', 'كرتونة 6 × 1 لتر', 290, 330, 6, 'لتر', 25, false, 'منظف أرضيات برائحة اللافندر.'],
];

// خزين الشهر الجاهز: العميل يضيفه كله للسلة بضغطة
const bundles = [
  {
    id: 'bundle-small',
    name: 'خزين عيلة صغيرة',
    description: 'مناسب لـ 2 - 3 أفراد',
    icon: '🏠',
    items: [
      ['sugar-5kg', 1],
      ['rice-5kg', 1],
      ['oil-5l', 1],
      ['tea-loose-1kg', 1],
      ['pasta-carton', 1],
      ['flour-5kg', 1],
      ['toilet-paper-24', 1],
      ['tissues-carton', 1],
      ['dish-soap-6', 1],
    ],
  },
  {
    id: 'bundle-medium',
    name: 'خزين عيلة متوسطة',
    description: 'مناسب لـ 4 - 5 أفراد',
    icon: '👨‍👩‍👧',
    items: [
      ['sugar-10kg', 1],
      ['rice-10kg', 1],
      ['oil-carton', 1],
      ['tea-loose-1kg', 1],
      ['pasta-carton', 1],
      ['lentils-5kg', 1],
      ['flour-5kg', 1],
      ['salt-pack', 1],
      ['toilet-paper-24', 1],
      ['tissues-carton', 1],
      ['dish-soap-6', 1],
      ['laundry-6kg', 1],
    ],
  },
  {
    id: 'bundle-large',
    name: 'خزين عيلة كبيرة',
    description: 'مناسب لـ 6 أفراد أو أكتر',
    icon: '👨‍👩‍👧‍👦',
    items: [
      ['sugar-10kg', 2],
      ['rice-10kg', 2],
      ['oil-carton', 1],
      ['oil-5l', 1],
      ['tea-loose-1kg', 2],
      ['pasta-carton', 2],
      ['lentils-5kg', 1],
      ['fava-5kg', 1],
      ['flour-5kg', 1],
      ['ghee-2kg', 1],
      ['salt-pack', 1],
      ['toilet-paper-24', 2],
      ['tissues-carton', 1],
      ['kitchen-towels-12', 1],
      ['dish-soap-6', 1],
      ['laundry-6kg', 1],
      ['bleach-6', 1],
    ],
  },
];

const defaultSettings = {
  storeName: 'خيرات ماركت',
  tagline: 'خزين الشهر كله.. بسعر الجملة',
  phone: '01000000000',
  whatsapp: '201000000000',
  address: 'القاهرة، مصر',
  workingHours: 'يومياً من 9 الصبح لـ 12 بالليل',
  deliveryFee: 50,
  freeDeliveryThreshold: 2500,
  minOrder: 1000,
  maxQtyPerItem: 20,
  announcement: '📦 أسعار الجملة لخزين بيتك • توصيل مجاني للطلبات فوق 2500 جنيه',
};

function createSeed() {
  const now = new Date().toISOString();
  return {
    version: 2,
    settings: { ...defaultSettings },
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
