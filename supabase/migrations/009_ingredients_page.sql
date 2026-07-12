-- ════════════════════════════════════════════════════════════
-- Ingredients encyclopedia
-- ════════════════════════════════════════════════════════════
-- Lets a customer tap an ingredient name on a product page and land
-- on a page explaining, in plain Arabic, what that ingredient
-- scientifically does. Content sourced from "Act 01.docx" (the same
-- bilingual product spec sheet used for 008_real_product_content.sql).
--
-- No join table: matching a product's `ingredients` (comma-separated
-- text) to a row here is done client-side by substring match against
-- `name` (see js/store-api.js ingredients.list()). Kept this way
-- instead of a product_ingredients join table because the text field
-- already carries the exact wording and no admin UI for per-product
-- ingredient tagging exists yet — a join table would need one to stay
-- in sync. Same reasoning is used to find "used in" products on the
-- ingredient detail page (ingredients ilike '%name%').
-- ════════════════════════════════════════════════════════════

create table if not exists ingredients (
  id          serial primary key,
  slug        text unique not null,
  name        text not null,
  description text not null,
  sort_order  int not null default 0,
  created_at  timestamptz default now()
);

alter table ingredients enable row level security;

drop policy if exists ingredients_public_read on ingredients;
drop policy if exists ingredients_admin_write on ingredients;
create policy ingredients_public_read on ingredients for select to public using (true);
create policy ingredients_admin_write on ingredients for all to authenticated
  using (is_store_admin()) with check (is_store_admin());

insert into ingredients (slug, name, description, sort_order) values
('salicylic-acid', 'حمض الساليسيليك', 'يساعد على تنظيف المسام بعمق وتقشير خلايا الجلد الميتة بلطف، يحسّن نقاء البشرة ونعومتها، ويساعد على تجديدها وتقليل التصبغات.', 1),
('zinc-pca', 'زنك PCA', 'ينظم إفراز الدهون الزائدة، يساعد في تقليل البكتيريا المسببة لحب الشباب، ويقلل الالتهابات التي تسبب البقع الداكنة.', 2),
('niacinamide', 'النياسيناميد', 'يساعد على تقليل آثار حب الشباب والبقع الداكنة، يقلل من تفاوت لون البشرة والاسمرار، يحسّن ترطيب البشرة ونعومتها، يهدئ الالتهاب، ويقوّي حاجز البشرة.', 3),
('argan-oil', 'زيت الأرجان', 'زيت طبيعي يساعد على حماية البشرة من الجفاف، وله خصائص مهدئة ومضادة للالتهاب.', 4),
('olive-oil', 'زيت الزيتون', 'غني بالأحماض الدهنية ومضادات الأكسدة، يساعد على تغذية البشرة وتنعيمها، ودعم الحاجز الطبيعي للبشرة.', 5),
('jojoba-oil', 'زيت الجوجوبا', 'يساعد على الحفاظ على ترطيب البشرة ودعم حاجزها الطبيعي، ويمنح إحساسًا ناعمًا دون ملمس دهني.', 6),
('licorice-extract', 'مستخلص العرقسوس', 'يقلل من البقع الداكنة ويساعد على تثبيط إنزيم التيروزينيز المسؤول عن إنتاج الميلانين، ويحتوي على مركبات (مثل الجلابريدين) تخفف من التصبغات الناتجة عن حب الشباب والتعرض للشمس.', 7),
('vitamin-c', 'فيتامين C', 'مضاد أكسدة قوي، يثبط إنتاج الميلانين، يقلل البقع الداكنة ويعزز الإشراقة.', 8),
('tea-tree-oil', 'زيت شجرة الشاي', 'له تأثير مضاد للالتهاب، يساعد في تنظيف البشرة وتقليل انسداد المسام مما يحسّن صفاء البشرة.', 9),
('wheat-germ-oil', 'زيت جنين القمح', 'غني بفيتامين E ومضادات الأكسدة، يساعد في إصلاح البشرة التالفة وتحسين ملمسها.', 10),
('almond-oil', 'زيت اللوز', 'يرطّب وينعّم البشرة، يحسّن مظهر الجفاف وخشونة الجلد، ويمنحها إشراقة أكثر.', 11),
('alpha-arbutin', 'ألفا أربوتين', 'مكوّن يساعد على تفتيح البشرة وتقليل التصبغات، ويعمل عن طريق تثبيط إنزيم التيروزيناز المسؤول عن إنتاج الميلانين.', 12),
('lactic-acid', 'حمض اللاكتيك', 'يمنح تفتيحًا تدريجيًا من خلال تقشير لطيف للطبقات السطحية من الجلد، ليجعل البشرة تبدو أكثر نعومة وإشراقًا.', 13),
('zinc-oxide', 'أكسيد الزنك', 'يعمل كحاجز واقٍ من أشعة الشمس ويساعد على حماية البشرة من التصبغات الناتجة عن التعرض للشمس.', 14),
('vitamin-e', 'فيتامين E', 'مضاد أكسدة يساعد على حماية البشرة ودعم ترطيبها ووظيفة حاجزها الطبيعي، ويساعد في التعافي من الإجهاد التأكسدي.', 15),
('rose-oil', 'زيت الورد', 'يُستخدم بشكل أساسي للترطيب وتهدئة البشرة ومنحها إحساسًا مريحًا.', 16),
('glycerin', 'الجلسرين', 'مرطب فعّال يجذب الماء إلى البشرة، ويساعد على الحفاظ عليها رطبة وناعمة وملساء.', 17),
('coconut-oil', 'زيت جوز الهند', 'يساعد على تنعيم وترطيب البشرة مع دعم الاحتفاظ بالرطوبة.', 18),
('cocoa-butter', 'زبدة الكاكاو', 'مرطب غني يساعد على حبس الرطوبة وتحسين نعومة وملمس البشرة.', 19),
('shea-butter', 'زبدة الشيا', 'ترطيب عميق يساعد على دعم حاجز البشرة، ومناسب للبشرة الجافة والخشنة.', 20),
('beeswax', 'شمع العسل', 'يشكل طبقة واقية على البشرة تقلل فقدان الرطوبة وتحمي الجلد، مما يحسّن راحتها أثناء التعافي.', 21),
('sesame-oil', 'زيت السمسم', 'غني بالأحماض الدهنية ومضادات الأكسدة، يساعد على تغذية البشرة وتقليل الجفاف ودعم إصلاح حاجز الجلد بعد الليزر.', 22),
('panthenol', 'بانثينول (فيتامين B5)', 'من أهم مكونات ما بعد الإجراءات، يساعد على تهدئة التهيّج وتقليل الاحمرار وتسريع التئام الجلد مع تحسين الترطيب.', 23),
('allantoin', 'الألانتوين', 'مكوّن مهدئ ومجدد للبشرة، يقلل التهيّج والانزعاج ويدعم تجدد الجلد المتضرر.', 24),
('aloe-vera', 'الألوفيرا', 'مكوّن مهدئ ومضاد للالتهاب، يقلل الحرقان والاحمرار ويساعد على تهدئة البشرة بعد العلاج.', 25),
('green-tea-extract', 'مستخلص الشاي الأخضر', 'غني بمضادات الأكسدة، يقلل الالتهاب ويهدئ الاحمرار ويحمي خلايا البشرة أثناء التعافي.', 26),
('lanolin', 'اللانولين', 'مرطب قوي يساعد على تكوين حاجز واقٍ وحبس الرطوبة وتسريع تعافي البشرة شديدة الجفاف أو التضرر.', 27),
('medical-silicone', 'سيليكون طبي', 'يحسّن مظهر الندبات من خلال تكوين طبقة واقية وخفيفة على سطح الجلد، تحافظ على رطوبته وتقلل من سمك ولون واحمرار الندبة تدريجيًا مع الوقت.', 28)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

-- Consistency fix: same ingredient, same wording everywhere it's used
-- ("مستخلص العرقسوس" not "خلاصة العرقسوس" — 008 introduced the
-- mismatch between whitening-cleanser and whitening-cream).
update products set
  ingredients = 'مستخلص العرقسوس، النياسيناميد، حمض الساليسيليك، زنك PCA، فيتامين C، زيت شجرة الشاي، زيت جنين القمح، زيت اللوز'
where slug = 'whitening-cleanser';
