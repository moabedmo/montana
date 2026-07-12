-- Update product prices per owner request (2026-07-08)
update products set price = 299.00 where slug = 'whitening-cleanser';
update products set price = 329.00 where slug = 'acne-facial-cleanser';
update products set price = 249.00 where slug = 'whitening-cream';
update products set price = 229.00 where slug = 'hand-body-lotion';
update products set price = 369.00 where slug = 'post-laser-cream';

select slug, name, price from products where slug in
  ('whitening-cleanser','acne-facial-cleanser','whitening-cream','hand-body-lotion','post-laser-cream')
order by slug;
