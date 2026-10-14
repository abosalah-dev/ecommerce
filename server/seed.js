'use strict';

// البيانات المبدئية اللي المتجر بيبدأ بيها أول مرة.
// تقدر تعدل كل ده بعد كده من لوحة التحكم.

const categories = [
  { id: 'basics', name: 'أساسيات المطبخ', icon: '🍚', sort: 1 },
  { id: 'legumes', name: 'البقوليات', icon: '🫘', sort: 2 },
  { id: 'oils', name: 'الزيوت والسمن', icon: '🫒', sort: 3 },
  { id: 'drinks', name: 'الشاي والقهوة', icon: '☕', sort: 4 },
  { id: 'paper', name: 'المناديل والورقيات', icon: '🧻', sort: 5 },
  { id: 'cleaning', name: 'المنظفات', icon: '🧼', sort: 6 },
];

// [id, name, categoryId, unit, price, oldPrice, stock, featured, description]
const productRows = [
  ['sugar-1kg', 'سكر أبيض ناعم', 'basics', '1 كيلو', 38, 42, 120, true, 'سكر أبيض ناعم نقي، مناسب للشاي والحلويات وكل استخدامات البيت.'],
  ['sugar-cubes', 'سكر مكعبات', 'basics', '500 جرام', 45, null, 40, false, 'مكعبات سكر منتظمة، مثالية للضيافة والمكاتب.'],
  ['rice-1kg', 'أرز مصري حبة عريضة', 'basics', '1 كيلو', 42, null, 150, true, 'أرز مصري درجة أولى، حبة عريضة ونظيفة وطعمها مميز.'],
  ['rice-5kg', 'أرز مصري - شيكارة', 'basics', '5 كيلو', 199, 215, 30, true, 'شيكارة أرز مصري 5 كيلو، توفير أكتر للعيلة كلها.'],
  ['rice-basmati', 'أرز بسمتي', 'basics', '1 كيلو', 95, null, 35, false, 'أرز بسمتي حبة طويلة، مناسب للكبسة والبرياني.'],
  ['flour-1kg', 'دقيق فاخر', 'basics', '1 كيلو', 32, null, 80, false, 'دقيق أبيض فاخر متعدد الاستخدامات للعجين والمخبوزات.'],
  ['pasta-penne', 'مكرونة قلم', 'basics', '400 جرام', 18, null, 200, false, 'مكرونة قلم من سميد القمح الصلب.'],
  ['vermicelli', 'شعرية', 'basics', '350 جرام', 16, null, 90, false, 'شعرية رفيعة للأرز بالشعرية والشوربة.'],
  ['salt', 'ملح طعام مكرر', 'basics', '700 جرام', 12, null, 100, false, 'ملح طعام مكرر ومعالج باليود.'],
  ['lentils-yellow', 'عدس أصفر مجروش', 'legumes', '1 كيلو', 68, 75, 60, true, 'عدس أصفر مجروش نظيف، لأحلى شوربة عدس.'],
  ['fava-beans', 'فول بلدي', 'legumes', '1 كيلو', 55, null, 70, false, 'فول بلدي حبة كاملة للتدميس.'],
  ['white-beans', 'فاصوليا بيضاء', 'legumes', '1 كيلو', 85, null, 40, false, 'فاصوليا بيضاء ناشفة حبة متوسطة.'],
  ['chickpeas', 'حمص الشام', 'legumes', '500 جرام', 48, null, 45, false, 'حمص حب للحمص بالطحينة والسلطات.'],
  ['oil-sunflower', 'زيت عباد الشمس', 'oils', '1 لتر', 89, 95, 70, true, 'زيت عباد شمس نقي وخفيف للطبخ والقلي.'],
  ['oil-corn', 'زيت ذرة', 'oils', '1 لتر', 110, null, 40, false, 'زيت ذرة صافي، مناسب للطبخ الصحي.'],
  ['ghee', 'سمن نباتي', 'oils', '1 كيلو', 145, null, 25, false, 'سمن نباتي بطعم غني للطبيخ والحلويات.'],
  ['tea-loose', 'شاي ناعم', 'drinks', '250 جرام', 95, 105, 90, true, 'شاي أسود ناعم، لون وطعم ومزاج.'],
  ['tea-bags', 'شاي فتلة', 'drinks', '100 فتلة', 120, null, 60, true, 'شاي فتلة سريع التحضير للبيت والشغل.'],
  ['green-tea', 'شاي أخضر', 'drinks', '25 فتلة', 45, null, 50, false, 'شاي أخضر خفيف ومنعش.'],
  ['coffee', 'بن تركي محوّج', 'drinks', '200 جرام', 165, null, 30, false, 'بن تركي محمص ومطحون ناعم بالحبهان.'],
  ['tissues-box', 'مناديل وجه - علبة', 'paper', '500 منديل', 35, null, 120, true, 'مناديل ناعمة طبقتين في علبة عملية.'],
  ['tissues-pocket', 'مناديل جيب', 'paper', '10 باكو', 30, null, 80, false, 'باكو مناديل صغيرة تتشال في الشنطة والعربية.'],
  ['toilet-paper', 'ورق تواليت', 'paper', '6 رول', 72, 80, 70, true, 'ورق تواليت ناعم وقوي، 6 رولات.'],
  ['kitchen-towels', 'مناشف مطبخ', 'paper', '2 رول', 48, null, 50, false, 'مناشف ورقية عالية الامتصاص للمطبخ.'],
  ['dish-soap', 'سائل غسيل أطباق', 'cleaning', '1 لتر', 45, null, 60, false, 'سائل أطباق بالليمون، بيشيل الدهون بسهولة.'],
  ['laundry-powder', 'مسحوق غسيل أوتوماتيك', 'cleaning', '2.5 كيلو', 215, 235, 25, false, 'مسحوق غسيل للغسالات الأوتوماتيك برائحة منعشة.'],
  ['bleach', 'كلور', 'cleaning', '1 لتر', 25, null, 70, false, 'كلور مطهر ومبيض للأسطح والملابس البيضاء.'],
  ['floor-cleaner', 'منظف أرضيات معطّر', 'cleaning', '1 لتر', 55, null, 45, false, 'منظف أرضيات برائحة اللافندر.'],
];

const defaultSettings = {
  storeName: 'خيرات ماركت',
  tagline: 'كل طلبات البيت.. لحد باب البيت',
  phone: '01000000000',
  whatsapp: '201000000000',
  address: 'القاهرة، مصر',
  workingHours: 'يومياً من 9 الصبح لـ 12 بالليل',
  deliveryFee: 20,
  freeDeliveryThreshold: 500,
  minOrder: 50,
  maxQtyPerItem: 50,
  announcement: '🚚 توصيل مجاني لكل الطلبات فوق 500 جنيه',
};

function createSeed() {
  const now = new Date().toISOString();
  return {
    version: 1,
    settings: { ...defaultSettings },
    admin: { passwordHash: null },
    categories: categories.map((c) => ({ ...c })),
    products: productRows.map(
      ([id, name, categoryId, unit, price, oldPrice, stock, featured, description], i) => ({
        id,
        name,
        categoryId,
        unit,
        price,
        oldPrice,
        stock,
        featured,
        description,
        image: `/images/products/${id}.svg`,
        active: true,
        sort: i + 1,
        createdAt: now,
        updatedAt: now,
      })
    ),
    orders: [],
    counters: { order: 1000 },
  };
}

module.exports = { createSeed, defaultSettings };
