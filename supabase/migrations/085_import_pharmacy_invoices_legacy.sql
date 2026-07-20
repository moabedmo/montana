-- Legacy pharmacy invoices from Excel sheet `total` only (real Collection / Remain).
-- Includes blank continuation rows under previous pharmacy. No APRIL (avoids double-count).
-- Run AFTER 084. Replaces previous PHI-LEGACY-* rows.

delete from crm_pharmacy_invoices where invoice_number like 'PHI-LEGACY-%';

insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0001', 'Abo Ali', 'Giza', current_date, null, false,
  'credit', 0.35, '[{"sku":"post-laser","name":"Post-Laser","qty":28,"unit_price":349,"line_total":6351.8},{"sku":"lotion","name":"Lotion","qty":28,"unit_price":209,"line_total":3803.8},{"sku":"w-cleanser","name":"W.cleanser","qty":28,"unit_price":279,"line_total":5077.8},{"sku":"acne","name":"Acne","qty":28,"unit_price":299,"line_total":5441.8},{"sku":"w-cream","name":"W.cream","qty":28,"unit_price":229,"line_total":4167.8}]'::jsonb, 24843, 3478.2, 28321.2, 0,
  true, 'old', 'Imported from Excel (total row 2) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0002', 'Misr', 'Giza', current_date, null, false,
  'credit', 0.36, '[{"sku":"post-laser","name":"Post-Laser","qty":80,"unit_price":310.92,"line_total":15919.2},{"sku":"lotion","name":"Lotion","qty":80,"unit_price":186.19,"line_total":9532.8},{"sku":"w-cleanser","name":"W.cleanser","qty":80,"unit_price":248.56,"line_total":12726.4},{"sku":"acne","name":"Acne","qty":80,"unit_price":266.38,"line_total":13638.4}]'::jsonb, 51816.8, 7254.35, 59071.15, 0,
  true, 'old', 'Imported from Excel (total row 3) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0003', 'Ahmed Yehia', 'Giza', current_date, null, false,
  'partial', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":20,"unit_price":349,"line_total":5235},{"sku":"lotion","name":"Lotion","qty":20,"unit_price":209,"line_total":3135},{"sku":"w-cleanser","name":"W.cleanser","qty":20,"unit_price":279,"line_total":4185},{"sku":"acne","name":"Acne","qty":30,"unit_price":589,"line_total":13252.5},{"sku":"w-cream","name":"W.cream","qty":20,"unit_price":229,"line_total":3435}]'::jsonb, 29242.5, 0, 29242.5, 17280,
  true, 'old', 'Imported from Excel (total row 4) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0004', 'Elbeh', 'Giza', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1396},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":836},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":1116},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":1196},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":916}]'::jsonb, 5460, 0, 5460, 0,
  true, 'old', 'Imported from Excel (total row 5) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0005', 'Elesaaf', 'Giza', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":2,"unit_price":349.38,"line_total":559},{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209.38,"line_total":335},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279.38,"line_total":447},{"sku":"acne","name":"Acne","qty":2,"unit_price":299.38,"line_total":479},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229.38,"line_total":367}]'::jsonb, 2187, 0, 2187, 0,
  true, 'old', 'Imported from Excel (total row 6) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0006', 'Elwaleed', 'Giza', current_date, null, false,
  'credit', 0.2, '[{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209.38,"line_total":335},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279.38,"line_total":447},{"sku":"acne","name":"Acne","qty":2,"unit_price":299.38,"line_total":479},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229.38,"line_total":367}]'::jsonb, 1628, 0, 1628, 0,
  true, 'old', 'Imported from Excel (total row 7) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0007', 'Amira abdelfatah', 'Giza', current_date, null, false,
  'credit', 0.2, '[{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209.38,"line_total":335},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279.38,"line_total":447},{"sku":"acne","name":"Acne","qty":2,"unit_price":299.38,"line_total":479},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229.38,"line_total":367}]'::jsonb, 1628, 0, 1628, 0,
  true, 'old', 'Imported from Excel (total row 8) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0008', 'Ghada', 'Giza', current_date, null, false,
  'credit', 0.2, '[{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209.38,"line_total":335},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279.38,"line_total":447},{"sku":"acne","name":"Acne","qty":2,"unit_price":299.38,"line_total":479},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229.38,"line_total":367}]'::jsonb, 1628, 0, 1628, 0,
  true, 'old', 'Imported from Excel (total row 9) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0009', 'AbdelrahmanMohamed', 'Giza', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":2,"unit_price":349.38,"line_total":559},{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209.38,"line_total":335},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279.38,"line_total":447},{"sku":"acne","name":"Acne","qty":2,"unit_price":299.38,"line_total":479},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229.38,"line_total":367}]'::jsonb, 2187, 0, 2187, 0,
  true, 'old', 'Imported from Excel (total row 10) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0010', 'Nouran', 'Giza', current_date, null, false,
  'credit', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":3,"unit_price":349,"line_total":785.25},{"sku":"lotion","name":"Lotion","qty":3,"unit_price":209,"line_total":470.25},{"sku":"w-cleanser","name":"W.cleanser","qty":3,"unit_price":279,"line_total":627.75},{"sku":"acne","name":"Acne","qty":3,"unit_price":299,"line_total":672.75},{"sku":"w-cream","name":"W.cream","qty":3,"unit_price":229,"line_total":515.25}]'::jsonb, 3071.25, 0, 3071.25, 0,
  true, 'old', 'Imported from Excel (total row 11) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0011', 'El3areesh', 'Giza', current_date, null, false,
  'credit', 0.35, '[{"sku":"lotion","name":"Lotion","qty":10,"unit_price":209.08,"line_total":1359},{"sku":"w-cleanser","name":"W.cleanser","qty":10,"unit_price":279.08,"line_total":1814},{"sku":"acne","name":"Acne","qty":10,"unit_price":299.08,"line_total":1944},{"sku":"w-cream","name":"W.cream","qty":10,"unit_price":229.08,"line_total":1489}]'::jsonb, 6606, 0, 6606, 0,
  true, 'old', 'Imported from Excel (total row 12) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0012', 'Elsalam', 'Giza', current_date, null, false,
  'credit', 0.2, '[{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209.38,"line_total":335},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279.38,"line_total":447},{"sku":"acne","name":"Acne","qty":2,"unit_price":299.38,"line_total":479},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":227.81,"line_total":364.5}]'::jsonb, 1625.5, 0, 1625.5, 0,
  true, 'old', 'Imported from Excel (total row 13) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0013', 'Ali', 'Giza', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":2,"unit_price":349,"line_total":558.4},{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209,"line_total":334.4},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279,"line_total":446.4},{"sku":"acne","name":"Acne","qty":2,"unit_price":299,"line_total":478.4},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229,"line_total":366.4}]'::jsonb, 2184, 0, 2184, 0,
  true, 'old', 'Imported from Excel (total row 14) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0014', 'Amira', 'Giza', current_date, null, false,
  'credit', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":10,"unit_price":349,"line_total":2617.5},{"sku":"lotion","name":"Lotion","qty":10,"unit_price":209,"line_total":1567.5},{"sku":"w-cleanser","name":"W.cleanser","qty":10,"unit_price":279,"line_total":2092.5},{"sku":"acne","name":"Acne","qty":10,"unit_price":299,"line_total":2242.5},{"sku":"w-cream","name":"W.cream","qty":10,"unit_price":229.07,"line_total":1718}]'::jsonb, 10238, 0, 10238, 0,
  true, 'old', 'Imported from Excel (total row 15) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0015', 'Khatab', 'Giza', current_date, null, false,
  'partial', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":10,"unit_price":349,"line_total":2617.5},{"sku":"lotion","name":"Lotion","qty":10,"unit_price":209,"line_total":1567.5},{"sku":"w-cleanser","name":"W.cleanser","qty":10,"unit_price":279,"line_total":2092.5},{"sku":"acne","name":"Acne","qty":10,"unit_price":299,"line_total":2242.5},{"sku":"w-cream","name":"W.cream","qty":10,"unit_price":229.07,"line_total":1718}]'::jsonb, 10238, 0, 10238, 2465,
  true, 'old', 'Imported from Excel (total row 16) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0016', 'Abdelrahman Elsayes', 'Giza', current_date, null, false,
  'credit', 0.35, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1134.25},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":679.25},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":906.75},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":971.75},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":744.25}]'::jsonb, 4436.25, 0, 4436.25, 0,
  true, 'old', 'Imported from Excel (total row 17) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0017', 'Abdelrahman Elsayes', 'Giza', current_date, null, false,
  'credit', 0.35, '[{"sku":"post-laser","name":"Post-Laser","qty":15,"unit_price":349,"line_total":3402.75},{"sku":"w-cleanser","name":"W.cleanser","qty":15,"unit_price":279,"line_total":2720.25},{"sku":"w-cream","name":"W.cream","qty":15,"unit_price":229,"line_total":2232.72}]'::jsonb, 8355.72, 0, 8355.72, 0,
  true, 'old', 'Imported from Excel (total row 18 · continuation row) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0018', 'Ahmed Nabawy', 'Giza', current_date, null, false,
  'credit', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":2,"unit_price":349,"line_total":523.5},{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209,"line_total":313.5},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279,"line_total":418.5},{"sku":"acne","name":"Acne","qty":2,"unit_price":299,"line_total":448.5},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229,"line_total":343.5}]'::jsonb, 2047.5, 0, 2047.5, 0,
  true, 'old', 'Imported from Excel (total row 19) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0019', 'adel', 'Giza', current_date, null, false,
  'credit', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":3,"unit_price":349,"line_total":785.25},{"sku":"lotion","name":"Lotion","qty":3,"unit_price":209,"line_total":470.25},{"sku":"w-cleanser","name":"W.cleanser","qty":3,"unit_price":279,"line_total":627.75},{"sku":"acne","name":"Acne","qty":3,"unit_price":299,"line_total":672.75},{"sku":"w-cream","name":"W.cream","qty":3,"unit_price":229,"line_total":515.25}]'::jsonb, 3071.25, 0, 3071.25, 0,
  true, 'old', 'Imported from Excel (total row 20) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0020', '2.5', 'Giza', current_date, null, false,
  'credit', 0.3, '[{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":731.5},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":976.5},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":1046.5},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":801.5}]'::jsonb, 3556, 0, 3556, 0,
  true, 'old', 'Imported from Excel (total row 21) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0021', 'Ahmed azzam', 'Giza', current_date, null, false,
  'cash', 0.3, '[{"sku":"w-cleanser","name":"W.cleanser","qty":1,"unit_price":278.57,"line_total":195},{"sku":"w-cream","name":"W.cream","qty":1,"unit_price":228.57,"line_total":160}]'::jsonb, 355, 0, 355, 355,
  true, 'old', 'Imported from Excel (total row 22) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0022', 'esraa sabry', 'Giza', current_date, null, false,
  'cash', 0.25, '[{"sku":"w-cleanser","name":"W.cleanser","qty":1,"unit_price":282.67,"line_total":212},{"sku":"w-cream","name":"W.cream","qty":1,"unit_price":230.67,"line_total":173}]'::jsonb, 385, 0, 385, 385,
  true, 'old', 'Imported from Excel (total row 23) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0023', 'juvia', 'Giza', current_date, null, false,
  'partial', 0.4, '[{"sku":"post-laser","name":"Post-Laser","qty":20,"unit_price":372.27,"line_total":4467.2},{"sku":"w-cream","name":"W.cream","qty":20,"unit_price":244.27,"line_total":2931.2}]'::jsonb, 7398.4, 0, 7398.4, 5566,
  true, 'old', 'Imported from Excel (total row 24) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0024', 'juvia', 'Giza', current_date, null, false,
  'credit', 0.4, '[{"sku":"post-laser","name":"Post-Laser","qty":30,"unit_price":371.87,"line_total":6693.6},{"sku":"w-cream","name":"W.cream","qty":30,"unit_price":243.71,"line_total":4386.8}]'::jsonb, 11080.4, 0, 11080.4, 0,
  true, 'old', 'Imported from Excel (total row 25 · continuation row) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0025', 'Hagar', 'Giza', current_date, null, false,
  'cash', 0.65, '[{"sku":"post-laser","name":"Post-Laser","qty":20,"unit_price":349,"line_total":2443},{"sku":"lotion","name":"Lotion","qty":20,"unit_price":209.14,"line_total":1464},{"sku":"w-cleanser","name":"W.cleanser","qty":20,"unit_price":279,"line_total":1953},{"sku":"acne","name":"Acne","qty":20,"unit_price":299,"line_total":2093},{"sku":"w-cream","name":"W.cream","qty":20,"unit_price":229,"line_total":1603}]'::jsonb, 9556, 0, 9556, 9556,
  true, 'old', 'Imported from Excel (total row 26) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0026', 'hawas', 'Giza', current_date, null, false,
  'credit', 0.25, '[{"sku":"w-cleanser","name":"W.cleanser","qty":10,"unit_price":279,"line_total":2092.5},{"sku":"w-cream","name":"W.cream","qty":10,"unit_price":229,"line_total":1717.5}]'::jsonb, 3810, 0, 3810, 0,
  true, 'old', 'Imported from Excel (total row 27) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0027', 'elgiza elkobra', 'Giza', current_date, null, false,
  'credit', 0.2, '[{"sku":"w-cleanser","name":"W.cleanser","qty":3,"unit_price":279,"line_total":669.6},{"sku":"acne","name":"Acne","qty":3,"unit_price":299,"line_total":717.6},{"sku":"w-cream","name":"W.cream","qty":3,"unit_price":229,"line_total":549.6}]'::jsonb, 1936.8, 0, 1936.8, 0,
  true, 'old', 'Imported from Excel (total row 28) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0028', 'dr marzouk', 'Giza', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":1,"unit_price":349,"line_total":279.2},{"sku":"lotion","name":"Lotion","qty":1,"unit_price":209,"line_total":167.2},{"sku":"w-cleanser","name":"W.cleanser","qty":1,"unit_price":279,"line_total":223.2},{"sku":"acne","name":"Acne","qty":1,"unit_price":299,"line_total":239.2},{"sku":"w-cream","name":"W.cream","qty":1,"unit_price":229,"line_total":183.2}]'::jsonb, 1092, 0, 1092, 0,
  true, 'old', 'Imported from Excel (total row 29) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0029', 'dr Khaled', 'Giza', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":1,"unit_price":349,"line_total":279.2},{"sku":"lotion","name":"Lotion","qty":1,"unit_price":209,"line_total":167.2},{"sku":"w-cleanser","name":"W.cleanser","qty":1,"unit_price":279,"line_total":223.2},{"sku":"acne","name":"Acne","qty":1,"unit_price":299,"line_total":239.2},{"sku":"w-cream","name":"W.cream","qty":1,"unit_price":229,"line_total":183.2}]'::jsonb, 1092, 0, 1092, 0,
  true, 'old', 'Imported from Excel (total row 30) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0030', '2al omran', 'Giza', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":2,"unit_price":349.38,"line_total":559},{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209.38,"line_total":335},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279.38,"line_total":447},{"sku":"acne","name":"Acne","qty":2,"unit_price":299.38,"line_total":479},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229.38,"line_total":367}]'::jsonb, 2187, 0, 2187, 0,
  true, 'old', 'Imported from Excel (total row 31) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0031', 'Medicine', 'Giza', current_date, null, false,
  'credit', 0.3, '[{"sku":"post-laser","name":"Post-Laser","qty":2,"unit_price":349,"line_total":488.6},{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209,"line_total":292.6},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279,"line_total":390.6},{"sku":"acne","name":"Acne","qty":2,"unit_price":299,"line_total":418.6},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229,"line_total":320.6}]'::jsonb, 1911, 0, 1911, 0,
  true, 'old', 'Imported from Excel (total row 32) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0032', 'Beshoy', 'Giza', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":3,"unit_price":349,"line_total":837.6},{"sku":"lotion","name":"Lotion","qty":3,"unit_price":209,"line_total":501.6},{"sku":"w-cleanser","name":"W.cleanser","qty":3,"unit_price":279,"line_total":669.6},{"sku":"acne","name":"Acne","qty":3,"unit_price":299,"line_total":717.6},{"sku":"w-cream","name":"W.cream","qty":3,"unit_price":229,"line_total":549.6}]'::jsonb, 3276, 0, 3276, 0,
  true, 'old', 'Imported from Excel (total row 33) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0033', 'دكتور اياد عبد الوراث', 'Giza', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":2,"unit_price":349.38,"line_total":559},{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209.38,"line_total":335},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279.38,"line_total":447},{"sku":"acne","name":"Acne","qty":2,"unit_price":299.38,"line_total":479},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229.38,"line_total":367}]'::jsonb, 2187, 0, 2187, 0,
  true, 'old', 'Imported from Excel (total row 34) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0034', 'صيدلية دكتوره مني', 'Giza', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":1,"unit_price":349,"line_total":279.2},{"sku":"lotion","name":"Lotion","qty":1,"unit_price":209,"line_total":167.2},{"sku":"w-cleanser","name":"W.cleanser","qty":1,"unit_price":279,"line_total":223.2},{"sku":"acne","name":"Acne","qty":1,"unit_price":299,"line_total":239.2},{"sku":"w-cream","name":"W.cream","qty":1,"unit_price":229,"line_total":183.2}]'::jsonb, 1092, 0, 1092, 0,
  true, 'old', 'Imported from Excel (total row 35) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0035', 'صيدليه سفنكس فارمازون', 'Giza', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":2,"unit_price":349.38,"line_total":559},{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209.38,"line_total":335},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279.38,"line_total":447},{"sku":"acne","name":"Acne","qty":2,"unit_price":299.38,"line_total":479},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229.38,"line_total":367}]'::jsonb, 2187, 0, 2187, 0,
  true, 'old', 'Imported from Excel (total row 36) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0036', 'صيدلية فاميلي', 'Giza', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":1,"unit_price":349,"line_total":279.2},{"sku":"lotion","name":"Lotion","qty":1,"unit_price":209,"line_total":167.2},{"sku":"w-cleanser","name":"W.cleanser","qty":1,"unit_price":279,"line_total":223.2},{"sku":"acne","name":"Acne","qty":1,"unit_price":299,"line_total":239.2},{"sku":"w-cream","name":"W.cream","qty":1,"unit_price":229,"line_total":183.2}]'::jsonb, 1092, 0, 1092, 0,
  true, 'old', 'Imported from Excel (total row 37) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0037', 'Romany adel', 'Giza', current_date, null, false,
  'credit', 0.2, '[{"sku":"w-cleanser","name":"W.cleanser","qty":3,"unit_price":279,"line_total":669.6},{"sku":"acne","name":"Acne","qty":3,"unit_price":299,"line_total":717.6},{"sku":"w-cream","name":"W.cream","qty":3,"unit_price":0,"line_total":0}]'::jsonb, 1387.2, 0, 1387.2, 0,
  true, 'old', 'Imported from Excel (total row 38) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0038', 'Beshoy safy', 'Giza', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":3,"unit_price":349,"line_total":837.6},{"sku":"lotion","name":"Lotion","qty":3,"unit_price":209,"line_total":501.6},{"sku":"w-cleanser","name":"W.cleanser","qty":3,"unit_price":279,"line_total":669.6},{"sku":"acne","name":"Acne","qty":3,"unit_price":299,"line_total":717.6},{"sku":"w-cream","name":"W.cream","qty":3,"unit_price":229,"line_total":549.6}]'::jsonb, 3276, 0, 3276, 0,
  true, 'old', 'Imported from Excel (total row 39) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0039', 'Abu elfadl', 'Giza', current_date, null, false,
  'credit', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":2,"unit_price":349,"line_total":523.5},{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209,"line_total":313.5},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279,"line_total":418.5},{"sku":"acne","name":"Acne","qty":2,"unit_price":299,"line_total":448.5},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229,"line_total":343.5}]'::jsonb, 2047.5, 0, 2047.5, 0,
  true, 'old', 'Imported from Excel (total row 40) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0040', 'elzahraa', 'مخازن Giza', current_date, null, false,
  'credit', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":20,"unit_price":349,"line_total":5235},{"sku":"lotion","name":"Lotion","qty":20,"unit_price":209,"line_total":3135},{"sku":"w-cleanser","name":"W.cleanser","qty":20,"unit_price":279,"line_total":4185},{"sku":"acne","name":"Acne","qty":20,"unit_price":299,"line_total":4485},{"sku":"w-cream","name":"W.cream","qty":20,"unit_price":229,"line_total":3435}]'::jsonb, 20475, 0, 20475, 0,
  true, 'old', 'Imported from Excel (total row 42) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0041', 'Elesalmya', 'مخازن Giza', current_date, null, false,
  'credit', 0.35, '[{"sku":"lotion","name":"Lotion","qty":12,"unit_price":522.5,"line_total":4075.5},{"sku":"w-cleanser","name":"W.cleanser","qty":12,"unit_price":697.5,"line_total":5440.5},{"sku":"acne","name":"Acne","qty":12,"unit_price":747.5,"line_total":5830.5},{"sku":"w-cream","name":"W.cream","qty":12,"unit_price":572.5,"line_total":4465.5}]'::jsonb, 19812, 0, 19812, 0,
  true, 'old', 'Imported from Excel (total row 43) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0042', 'El Hekma', 'مخازن Giza', current_date, null, false,
  'credit', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":25,"unit_price":349,"line_total":6543.75},{"sku":"lotion","name":"Lotion","qty":25,"unit_price":209,"line_total":3918.75},{"sku":"w-cleanser","name":"W.cleanser","qty":25,"unit_price":279,"line_total":5231.25},{"sku":"acne","name":"Acne","qty":25,"unit_price":299,"line_total":5606.25},{"sku":"w-cream","name":"W.cream","qty":25,"unit_price":229,"line_total":4293.75}]'::jsonb, 25593.75, 0, 25593.75, 0,
  true, 'old', 'Imported from Excel (total row 44) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0043', 'مخزن الاقصي', 'مخازن Giza', current_date, null, false,
  'credit', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":25,"unit_price":349,"line_total":6543.75},{"sku":"lotion","name":"Lotion","qty":25,"unit_price":209,"line_total":3918.75},{"sku":"w-cleanser","name":"W.cleanser","qty":25,"unit_price":279,"line_total":5231.25},{"sku":"w-cream","name":"W.cream","qty":25,"unit_price":229,"line_total":4293.75}]'::jsonb, 19987.5, 0, 19987.5, 0,
  true, 'old', 'Imported from Excel (total row 45) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0044', 'Elfardous', 'Cairo', current_date, null, false,
  'partial', 0.4, '[{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209,"line_total":250.8},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279,"line_total":334.8},{"sku":"acne","name":"Acne","qty":2,"unit_price":299,"line_total":358.8},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229,"line_total":274.8}]'::jsonb, 1219.2, 0, 1219.2, 1219,
  true, 'old', 'Imported from Excel (total row 47) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0045', 'Elfardous', 'Cairo', current_date, null, false,
  'credit', 0.4, '[{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":627},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":837},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":897},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":687}]'::jsonb, 3048, 0, 3048, 0,
  true, 'old', 'Imported from Excel (total row 48 · continuation row) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0046', 'Healthy', 'Cairo', current_date, null, false,
  'credit', 0.35, '[{"sku":"post-laser","name":"Post-Laser","qty":24,"unit_price":349,"line_total":5444.4},{"sku":"lotion","name":"Lotion","qty":24,"unit_price":209,"line_total":3260.4},{"sku":"w-cleanser","name":"W.cleanser","qty":24,"unit_price":279,"line_total":4352.4},{"sku":"acne","name":"Acne","qty":24,"unit_price":299,"line_total":4664.4},{"sku":"w-cream","name":"W.cream","qty":24,"unit_price":229,"line_total":3572.4}]'::jsonb, 21294, 0, 21294, 0,
  true, 'old', 'Imported from Excel (total row 50) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0047', 'Elmenallawy', 'Cairo', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":2,"unit_price":349,"line_total":558.4},{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209,"line_total":334.4},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279,"line_total":446.4},{"sku":"acne","name":"Acne","qty":2,"unit_price":299,"line_total":478.4},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229,"line_total":366.4}]'::jsonb, 2184, 0, 2184, 0,
  true, 'old', 'Imported from Excel (total row 51) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0048', 'Principles', 'Cairo', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1396},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":836},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":1116},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":1196},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":916}]'::jsonb, 5460, 0, 5460, 0,
  true, 'old', 'Imported from Excel (total row 52) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0049', 'Diasty', 'Cairo', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1396},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":836},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":1116},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":1196},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":916}]'::jsonb, 5460, 0, 5460, 0,
  true, 'old', 'Imported from Excel (total row 53) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0050', 'Ahmed mokhtar', 'Cairo', current_date, null, false,
  'partial', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1396},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":836},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":1116},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":1196},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":916}]'::jsonb, 5460, 0, 5460, 1030,
  true, 'old', 'Imported from Excel (total row 54) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0051', 'Hosney Mohamed', 'Cairo', current_date, null, false,
  'partial', 0.25, '[{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":1046.25},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":1121.25}]'::jsonb, 2167.5, 0, 2167.5, 1271,
  true, 'old', 'Imported from Excel (total row 55) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0052', 'Hosney Mohamed', 'Cairo', current_date, null, false,
  'cash', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":3,"unit_price":349,"line_total":785.25},{"sku":"lotion","name":"Lotion","qty":3,"unit_price":209,"line_total":470.25},{"sku":"w-cream","name":"W.cream","qty":3,"unit_price":229,"line_total":515.25}]'::jsonb, 1770.75, 0, 1770.75, 1839,
  true, 'old', 'Imported from Excel (total row 56 · continuation row) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0053', 'Hosney Mohamed', 'Cairo', current_date, null, false,
  'credit', 0.25, '[{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":299,"line_total":1121.25}]'::jsonb, 1121.25, 0, 1121.25, 0,
  true, 'old', 'Imported from Excel (total row 57 · continuation row) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0054', 'Elshefaa', 'Cairo', current_date, null, false,
  'partial', 0.2, '[{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":261.56,"line_total":1046.25},{"sku":"acne","name":"Acne","qty":5,"unit_price":280.31,"line_total":1121.25}]'::jsonb, 2167.5, 0, 2167.5, 628,
  true, 'old', 'Imported from Excel (total row 58) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0055', 'ELSHRFAA', 'Cairo', current_date, null, false,
  'partial', 0.28, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1256.4},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":752.4},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":1004.4},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":1076.4},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":824.4}]'::jsonb, 4914, 0, 4914, 627,
  true, 'old', 'Imported from Excel (total row 59) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0056', 'Latef', 'Cairo', current_date, null, false,
  'partial', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1396},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":836},{"sku":"w-cleanser","name":"W.cleanser","qty":10,"unit_price":270.75,"line_total":2166},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":916}]'::jsonb, 5314, 0, 5314, 1056,
  true, 'old', 'Imported from Excel (total row 60) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0057', 'Elrehab', 'Cairo', current_date, null, false,
  'cash', 0.2, '[{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279,"line_total":446.4},{"sku":"acne","name":"Acne","qty":2,"unit_price":299,"line_total":478.4}]'::jsonb, 924.8, 0, 924.8, 925,
  true, 'old', 'Imported from Excel (total row 61) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0058', 'Elrehab', 'Cairo', current_date, null, false,
  'cash', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":2,"unit_price":349,"line_total":558.4},{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209,"line_total":334.4},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279,"line_total":446.4},{"sku":"acne","name":"Acne","qty":2,"unit_price":299,"line_total":478.4},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229,"line_total":366.4}]'::jsonb, 2184, 0, 2184, 2184,
  true, 'old', 'Imported from Excel (total row 62 · continuation row) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0059', 'Elrehab', 'Cairo', current_date, null, false,
  'cash', 0.2, '[{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":916}]'::jsonb, 916, 0, 916, 916,
  true, 'old', 'Imported from Excel (total row 63 · continuation row) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0060', 'Elrehab', 'Cairo', current_date, null, false,
  'credit', 0.2, '[{"sku":"w-cleanser","name":"W.cleanser","qty":10,"unit_price":279,"line_total":2232},{"sku":"acne","name":"Acne","qty":10,"unit_price":299,"line_total":2392}]'::jsonb, 4624, 0, 4624, 0,
  true, 'old', 'Imported from Excel (total row 64 · continuation row) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0061', 'Amr Ziada', 'Cairo', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":3,"unit_price":349,"line_total":837.6},{"sku":"lotion","name":"Lotion","qty":3,"unit_price":209,"line_total":501.6},{"sku":"w-cleanser","name":"W.cleanser","qty":3,"unit_price":279,"line_total":669.6},{"sku":"acne","name":"Acne","qty":3,"unit_price":299,"line_total":717.6},{"sku":"w-cream","name":"W.cream","qty":3,"unit_price":229,"line_total":549.6}]'::jsonb, 3276, 0, 3276, 0,
  true, 'old', 'Imported from Excel (total row 65) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0062', 'Hany Mohamed', 'Cairo', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1396},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":836},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":1116},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":916}]'::jsonb, 4264, 0, 4264, 0,
  true, 'old', 'Imported from Excel (total row 66) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0063', 'Mahgoub', 'Cairo', current_date, null, false,
  'credit', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":3,"unit_price":349,"line_total":785.25},{"sku":"lotion","name":"Lotion","qty":3,"unit_price":209,"line_total":470.25},{"sku":"w-cleanser","name":"W.cleanser","qty":3,"unit_price":279,"line_total":627.75},{"sku":"acne","name":"Acne","qty":3,"unit_price":299,"line_total":672.75},{"sku":"w-cream","name":"W.cream","qty":3,"unit_price":229,"line_total":515.25}]'::jsonb, 3071.25, 0, 3071.25, 0,
  true, 'old', 'Imported from Excel (total row 67) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0064', 'Mabrouk', 'Cairo', current_date, null, false,
  'credit', 0.3, '[{"sku":"post-laser","name":"Post-Laser","qty":2,"unit_price":349,"line_total":488.6},{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209,"line_total":292.6},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279,"line_total":390.6},{"sku":"acne","name":"Acne","qty":2,"unit_price":299,"line_total":418.6},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229,"line_total":320.6}]'::jsonb, 1911, 0, 1911, 0,
  true, 'old', 'Imported from Excel (total row 68) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0065', 'Zahraa elsalam', 'Cairo', current_date, null, false,
  'credit', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":10,"unit_price":349,"line_total":2617.5},{"sku":"lotion","name":"Lotion","qty":10,"unit_price":209,"line_total":1567.5},{"sku":"w-cleanser","name":"W.cleanser","qty":10,"unit_price":279,"line_total":2092.5},{"sku":"acne","name":"Acne","qty":1,"unit_price":299,"line_total":224.25},{"sku":"w-cream","name":"W.cream","qty":10,"unit_price":229,"line_total":1717.5}]'::jsonb, 8219.25, 0, 8219.25, 0,
  true, 'old', 'Imported from Excel (total row 69) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0066', 'Elraeey', 'Cairo', current_date, null, false,
  'credit', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":10,"unit_price":349,"line_total":2617.5},{"sku":"lotion","name":"Lotion","qty":10,"unit_price":209,"line_total":1567.5},{"sku":"w-cleanser","name":"W.cleanser","qty":10,"unit_price":279,"line_total":2092.5},{"sku":"acne","name":"Acne","qty":10,"unit_price":299,"line_total":2242.5},{"sku":"w-cream","name":"W.cream","qty":10,"unit_price":229,"line_total":1717.5}]'::jsonb, 10237.5, 0, 10237.5, 0,
  true, 'old', 'Imported from Excel (total row 70) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0067', 'Beshoy', 'Cairo', current_date, null, false,
  'partial', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":10,"unit_price":349,"line_total":2617.5},{"sku":"lotion","name":"Lotion","qty":10,"unit_price":209,"line_total":1567.5},{"sku":"w-cleanser","name":"W.cleanser","qty":10,"unit_price":279,"line_total":2092.5},{"sku":"acne","name":"Acne","qty":3,"unit_price":299,"line_total":672.75},{"sku":"w-cream","name":"W.cream","qty":10,"unit_price":229,"line_total":1717.5}]'::jsonb, 8667.75, 0, 8667.75, 1300,
  true, 'old', 'Imported from Excel (total row 71) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0068', 'Mohamed Salah', 'Cairo', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1396},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":836},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":1116},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":1196},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":916}]'::jsonb, 5460, 0, 5460, 0,
  true, 'old', 'Imported from Excel (total row 72) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0069', 'Magdy Elsayed Cosmo', 'Cairo', current_date, null, false,
  'credit', 0.3, '[{"sku":"post-laser","name":"Post-Laser","qty":6,"unit_price":349,"line_total":1465.8},{"sku":"lotion","name":"Lotion","qty":6,"unit_price":209,"line_total":877.8},{"sku":"w-cleanser","name":"W.cleanser","qty":6,"unit_price":279,"line_total":1171.8},{"sku":"acne","name":"Acne","qty":6,"unit_price":299,"line_total":1255.8},{"sku":"w-cream","name":"W.cream","qty":6,"unit_price":229,"line_total":961.8}]'::jsonb, 5733, 0, 5733, 0,
  true, 'old', 'Imported from Excel (total row 73) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0070', 'Amany', 'Cairo', current_date, null, false,
  'partial', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":3,"unit_price":349,"line_total":785.25},{"sku":"lotion","name":"Lotion","qty":3,"unit_price":209,"line_total":470.25},{"sku":"w-cleanser","name":"W.cleanser","qty":3,"unit_price":279,"line_total":627.75},{"sku":"acne","name":"Acne","qty":3,"unit_price":299,"line_total":672.75},{"sku":"w-cream","name":"W.cream","qty":3,"unit_price":229,"line_total":515.25}]'::jsonb, 3071.25, 0, 3071.25, 422,
  true, 'old', 'Imported from Excel (total row 74) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0071', 'Bdeir', 'Cairo', current_date, null, false,
  'credit', 0.3, '[{"sku":"post-laser","name":"Post-Laser","qty":10,"unit_price":349,"line_total":2443},{"sku":"lotion","name":"Lotion","qty":10,"unit_price":209,"line_total":1463},{"sku":"w-cleanser","name":"W.cleanser","qty":10,"unit_price":279,"line_total":1953},{"sku":"acne","name":"Acne","qty":10,"unit_price":299,"line_total":2093},{"sku":"w-cream","name":"W.cream","qty":10,"unit_price":229,"line_total":1603}]'::jsonb, 9555, 0, 9555, 0,
  true, 'old', 'Imported from Excel (total row 75) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0072', 'hamdyy Elsayed', 'Cairo', current_date, null, false,
  'partial', 0.4, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1047},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":627},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":837},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":897},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":687}]'::jsonb, 4095, 0, 4095, 1277,
  true, 'old', 'Imported from Excel (total row 76) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0073', 'Elzo8by', 'Cairo', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":2,"unit_price":349,"line_total":558.4},{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209,"line_total":334.4},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279,"line_total":446.4},{"sku":"acne","name":"Acne","qty":2,"unit_price":299,"line_total":478.4},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229,"line_total":366.4}]'::jsonb, 2184, 30.57, 2214.57, 0,
  true, 'old', 'Imported from Excel (total row 77) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0074', 'Ahmed abdELkhalek', 'Cairo', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":3,"unit_price":349,"line_total":837.6},{"sku":"lotion","name":"Lotion","qty":3,"unit_price":209,"line_total":501.6},{"sku":"w-cleanser","name":"W.cleanser","qty":3,"unit_price":279,"line_total":669.6},{"sku":"acne","name":"Acne","qty":3,"unit_price":299,"line_total":717.6},{"sku":"w-cream","name":"W.cream","qty":3,"unit_price":229,"line_total":549.6}]'::jsonb, 3276, 0, 3276, 0,
  true, 'old', 'Imported from Excel (total row 78) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0075', 'Super Drug', 'Cairo', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1396},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":836},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":1116},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":1196},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":916}]'::jsonb, 5460, 0, 5460, 0,
  true, 'old', 'Imported from Excel (total row 79) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0076', 'ص نور المحمدي', 'Cairo', current_date, null, false,
  'credit', 0.3, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1221.5},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":731.5},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":976.5},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":1046.5},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":801.5}]'::jsonb, 4777.5, 0, 4777.5, 0,
  true, 'old', 'Imported from Excel (total row 80) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0077', 'Dr Lamiaa Niazy', 'Cairo', current_date, null, false,
  'cash', 0.5, '[{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":522.5},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":229,"line_total":572.5},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":747.5},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":279,"line_total":697.5}]'::jsonb, 2540, 0, 2540, 2540,
  true, 'old', 'Imported from Excel (total row 81) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0078', 'dr rania abubakr', 'Cairo', current_date, null, false,
  'credit', 0.4, '[{"sku":"w-cleanser","name":"W.cleanser","qty":10,"unit_price":279,"line_total":1674},{"sku":"acne","name":"Acne","qty":10,"unit_price":299,"line_total":1794},{"sku":"w-cream","name":"W.cream","qty":10,"unit_price":229,"line_total":1374}]'::jsonb, 4842, 0, 4842, 0,
  true, 'old', 'Imported from Excel (total row 82) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0079', 'Mohamed hassan', 'Cairo', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":10,"unit_price":174.5,"line_total":1396},{"sku":"lotion","name":"Lotion","qty":10,"unit_price":104.5,"line_total":836},{"sku":"w-cleanser","name":"W.cleanser","qty":10,"unit_price":139.5,"line_total":1116},{"sku":"w-cream","name":"W.cream","qty":10,"unit_price":114.5,"line_total":916}]'::jsonb, 4264, 0, 4264, 0,
  true, 'old', 'Imported from Excel (total row 83) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0080', 'Mores fekry', 'Cairo', current_date, null, false,
  'cash', 0.5, '[{"sku":"post-laser","name":"Post-Laser","qty":3,"unit_price":349,"line_total":523.5},{"sku":"lotion","name":"Lotion","qty":3,"unit_price":209,"line_total":313.5},{"sku":"w-cleanser","name":"W.cleanser","qty":3,"unit_price":279,"line_total":418.5},{"sku":"acne","name":"Acne","qty":3,"unit_price":299,"line_total":448.5},{"sku":"w-cream","name":"W.cream","qty":3,"unit_price":229,"line_total":343.5}]'::jsonb, 2047.5, 0, 2047.5, 2048,
  true, 'old', 'Imported from Excel (total row 84) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0081', 'ELFAYROUZ', 'Cairo', current_date, null, false,
  'cash', 0.3, '[{"sku":"lotion","name":"Lotion","qty":4,"unit_price":209,"line_total":585.2},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":976.5},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":1046.5},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":801.5}]'::jsonb, 3409.7, 0, 3409.7, 3409.7,
  true, 'old', 'Imported from Excel (total row 85) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0082', 'ELFAYROUZ', 'Cairo', current_date, null, false,
  'cash', 0.3, '[{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":976.5},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":801.5}]'::jsonb, 1778, 0, 1778, 1778,
  true, 'old', 'Imported from Excel (total row 86 · continuation row) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0083', 'ELFAYROUZ', 'Cairo', current_date, null, false,
  'credit', 0.3, '[{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":731.5},{"sku":"w-cream","name":"W.cream","qty":10,"unit_price":229,"line_total":1603}]'::jsonb, 2334.5, 0, 2334.5, 0,
  true, 'old', 'Imported from Excel (total row 87 · continuation row) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0084', 'ELMARKAZ ELESLAMY', 'Cairo', current_date, null, false,
  'credit', 0.2, '[{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279,"line_total":446.4},{"sku":"acne","name":"Acne","qty":2,"unit_price":299,"line_total":478.4},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229,"line_total":366.4}]'::jsonb, 1291.2, 0, 1291.2, 0,
  true, 'old', 'Imported from Excel (total row 88) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0085', 'ELGOMHORIA', 'Cairo', current_date, null, false,
  'credit', 0.25, '[{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":858.75}]'::jsonb, 858.75, 0, 858.75, 0,
  true, 'old', 'Imported from Excel (total row 89) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0086', 'ELAMA7', 'Cairo', current_date, null, false,
  'credit', 0.35, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1134.25},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":679.25},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":906.75},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":971.75},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":744.25}]'::jsonb, 4436.25, 0, 4436.25, 0,
  true, 'old', 'Imported from Excel (total row 90) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0087', 'BARSOUM', 'Cairo', current_date, null, false,
  'credit', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":7,"unit_price":348.99,"line_total":1832.2},{"sku":"lotion","name":"Lotion","qty":7,"unit_price":208.99,"line_total":1097.2},{"sku":"w-cleanser","name":"W.cleanser","qty":7,"unit_price":278.99,"line_total":1464.7},{"sku":"acne","name":"Acne","qty":7,"unit_price":298.99,"line_total":1569.7},{"sku":"w-cream","name":"W.cream","qty":7,"unit_price":228.99,"line_total":1202.2}]'::jsonb, 7166, 0, 7166, 0,
  true, 'old', 'Imported from Excel (total row 91) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0088', 'AHMED MANSOUR', 'Cairo', current_date, null, false,
  'cash', 0.35, '[{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229.23,"line_total":298}]'::jsonb, 298, 0, 298, 298,
  true, 'old', 'Imported from Excel (total row 92) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0089', 'el3awady elkhalifa', 'Cairo', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":2,"unit_price":349,"line_total":558.4},{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209,"line_total":334.4},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279,"line_total":446.4},{"sku":"acne","name":"Acne","qty":2,"unit_price":299,"line_total":478.4},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229,"line_total":366.4}]'::jsonb, 2184, 0, 2184, 0,
  true, 'old', 'Imported from Excel (total row 93) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0090', 'Radwan', 'Cairo', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":3,"unit_price":349,"line_total":837.6},{"sku":"lotion","name":"Lotion","qty":3,"unit_price":209,"line_total":501.6},{"sku":"w-cleanser","name":"W.cleanser","qty":3,"unit_price":279,"line_total":669.6},{"sku":"w-cream","name":"W.cream","qty":3,"unit_price":229,"line_total":549.6}]'::jsonb, 2558.4, 0, 2558.4, 0,
  true, 'old', 'Imported from Excel (total row 94) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0091', 'Elashry', 'Cairo', current_date, null, false,
  'credit', 0.27, '[{"sku":"post-laser","name":"Post-Laser","qty":3,"unit_price":33.93,"line_total":74.31},{"sku":"lotion","name":"Lotion","qty":3,"unit_price":209,"line_total":457.71},{"sku":"w-cleanser","name":"W.cleanser","qty":3,"unit_price":279,"line_total":611.01},{"sku":"acne","name":"Acne","qty":3,"unit_price":299,"line_total":654.81},{"sku":"w-cream","name":"W.cream","qty":3,"unit_price":229,"line_total":501.51}]'::jsonb, 2299.35, 0, 2299.35, 0,
  true, 'old', 'Imported from Excel (total row 95) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0092', 'Abdelrazek Mekkawy', 'Cairo', current_date, null, false,
  'credit', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1308.75},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":783.75},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":1046.25},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":858.75}]'::jsonb, 3997.5, 0, 3997.5, 0,
  true, 'old', 'Imported from Excel (total row 96) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0093', 'Elmadina elmnawra', 'Cairo', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1396},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":836},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":1116},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":916}]'::jsonb, 4264, 0, 4264, 0,
  true, 'old', 'Imported from Excel (total row 97) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0094', 'Mekka Elmokrama', 'Cairo', current_date, null, false,
  'credit', 0.27, '[{"sku":"post-laser","name":"Post-Laser","qty":3,"unit_price":349,"line_total":764.31},{"sku":"lotion","name":"Lotion","qty":3,"unit_price":209,"line_total":457.71},{"sku":"w-cleanser","name":"W.cleanser","qty":3,"unit_price":279,"line_total":611.01},{"sku":"acne","name":"Acne","qty":3,"unit_price":299,"line_total":654.81},{"sku":"w-cream","name":"W.cream","qty":3,"unit_price":229,"line_total":501.51}]'::jsonb, 2989.35, 0, 2989.35, 0,
  true, 'old', 'Imported from Excel (total row 98) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0095', 'Dr Nabil 7ana', 'Cairo', current_date, null, false,
  'credit', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":1,"unit_price":349,"line_total":261.75},{"sku":"lotion","name":"Lotion","qty":1,"unit_price":209,"line_total":156.75},{"sku":"w-cleanser","name":"W.cleanser","qty":1,"unit_price":279,"line_total":209.25},{"sku":"acne","name":"Acne","qty":1,"unit_price":299,"line_total":224.25},{"sku":"w-cream","name":"W.cream","qty":1,"unit_price":229,"line_total":171.75}]'::jsonb, 1023.75, 0, 1023.75, 0,
  true, 'old', 'Imported from Excel (total row 99) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0096', 'Rana Elkady', 'Cairo', current_date, null, false,
  'credit', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":3,"unit_price":349,"line_total":785.25},{"sku":"lotion","name":"Lotion","qty":3,"unit_price":209,"line_total":470.25},{"sku":"w-cleanser","name":"W.cleanser","qty":3,"unit_price":279,"line_total":627.75},{"sku":"acne","name":"Acne","qty":3,"unit_price":299,"line_total":672.75},{"sku":"w-cream","name":"W.cream","qty":3,"unit_price":229,"line_total":515.25}]'::jsonb, 3071.25, 0, 3071.25, 0,
  true, 'old', 'Imported from Excel (total row 100) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0097', 'صيدلية  الجبالي', 'Cairo', current_date, null, false,
  'credit', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1308.75},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":783.75},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":1046.25},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":858.75}]'::jsonb, 3997.5, 0, 3997.5, 0,
  true, 'old', 'Imported from Excel (total row 101) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0098', 'المركز الاسلامي بالزيتون', 'Cairo', current_date, null, false,
  'credit', 0.2, '[{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279,"line_total":446.4},{"sku":"acne","name":"Acne","qty":2,"unit_price":299,"line_total":478.4},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229,"line_total":366.4}]'::jsonb, 1291.2, 0, 1291.2, 0,
  true, 'old', 'Imported from Excel (total row 102) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0099', 'حياة', 'Cairo', current_date, null, false,
  'cash', 0.35, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1134.25},{"sku":"lotion","name":"Lotion","qty":1,"unit_price":209,"line_total":135.85},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279,"line_total":362.7},{"sku":"acne","name":"Acne","qty":2,"unit_price":299,"line_total":388.7},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229,"line_total":297.7}]'::jsonb, 2319.2, 0, 2319.2, 2320,
  true, 'old', 'Imported from Excel (total row 103) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0100', 'حياة', 'Cairo', current_date, null, false,
  'cash', 0.4, '[{"sku":"acne","name":"Acne","qty":5,"unit_price":329,"line_total":987}]'::jsonb, 987, 0, 987, 987,
  true, 'old', 'Imported from Excel (total row 104 · continuation row) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0101', 'حياة', 'Cairo', current_date, null, false,
  'credit', 0.4, '[{"sku":"post-laser","name":"Post-Laser","qty":3,"unit_price":369,"line_total":664.2},{"sku":"lotion","name":"Lotion","qty":1,"unit_price":229,"line_total":137.4},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":299,"line_total":358.8},{"sku":"acne","name":"Acne","qty":5,"unit_price":329,"line_total":987},{"sku":"w-cream","name":"W.cream","qty":3,"unit_price":83,"line_total":149.4}]'::jsonb, 2296.8, 0, 2296.8, 0,
  true, 'old', 'Imported from Excel (total row 105 · continuation row) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0102', 'حياة', 'Cairo', current_date, null, false,
  'credit', 0.4, '[{"sku":"w-cleanser","name":"W.cleanser","qty":3,"unit_price":298.89,"line_total":538},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":249,"line_total":298.8}]'::jsonb, 836.8, 0, 836.8, 0,
  true, 'old', 'Imported from Excel (total row 106 · continuation row) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0103', 'خالد سمير', 'Cairo', current_date, null, false,
  'cash', 0.5, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":872.5},{"sku":"lotion","name":"Lotion","qty":1,"unit_price":209,"line_total":104.5},{"sku":"w-cleanser","name":"W.cleanser","qty":4,"unit_price":279,"line_total":558},{"sku":"w-cream","name":"W.cream","qty":6,"unit_price":229,"line_total":687}]'::jsonb, 2222, 0, 2222, 2222,
  true, 'old', 'Imported from Excel (total row 107) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0104', 'روماني عادل', 'Cairo', current_date, null, false,
  'credit', 0, '[{"sku":"w-cleanser","name":"W.cleanser","qty":3,"unit_price":223.2,"line_total":669.6},{"sku":"acne","name":"Acne","qty":3,"unit_price":239.2,"line_total":717.6}]'::jsonb, 1387.2, 0, 1387.2, 0,
  true, 'old', 'Imported from Excel (total row 108) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0105', 'صيدليه الجزار', 'Cairo', current_date, null, false,
  'credit', 0.3, '[{"sku":"post-laser","name":"Post-Laser","qty":2,"unit_price":349,"line_total":488.6},{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209,"line_total":292.6},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279,"line_total":390.6},{"sku":"acne","name":"Acne","qty":2,"unit_price":299,"line_total":418.6},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229,"line_total":320.6}]'::jsonb, 1911, 0, 1911, 0,
  true, 'old', 'Imported from Excel (total row 109) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0106', 'النعناعي', 'Cairo', current_date, null, false,
  'credit', 0.27, '[{"sku":"post-laser","name":"Post-Laser","qty":2,"unit_price":348.94,"line_total":509.45},{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209,"line_total":305.14},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279,"line_total":407.34},{"sku":"acne","name":"Acne","qty":2,"unit_price":299,"line_total":436.54},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229,"line_total":334.34}]'::jsonb, 1992.81, 0, 1992.81, 0,
  true, 'old', 'Imported from Excel (total row 110) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0107', 'صيدليه فرست كوزماتكس', 'Cairo', current_date, null, false,
  'credit', 0.3, '[{"sku":"post-laser","name":"Post-Laser","qty":3,"unit_price":349,"line_total":732.9},{"sku":"lotion","name":"Lotion","qty":3,"unit_price":209,"line_total":438.9},{"sku":"w-cleanser","name":"W.cleanser","qty":3,"unit_price":279,"line_total":585.9},{"sku":"acne","name":"Acne","qty":3,"unit_price":299,"line_total":627.9},{"sku":"w-cream","name":"W.cream","qty":3,"unit_price":229,"line_total":480.9}]'::jsonb, 2866.5, 0, 2866.5, 0,
  true, 'old', 'Imported from Excel (total row 111) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0108', 'مجدي لمعي', 'Cairo', current_date, null, false,
  'credit', 0.27, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1273.85},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":762.85},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":1018.35},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":835.85}]'::jsonb, 3890.9, 0, 3890.9, 0,
  true, 'old', 'Imported from Excel (total row 112) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0109', 'El Aziz blaah', 'Cairo', current_date, null, false,
  'credit', 0.2, '[{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279,"line_total":446.4},{"sku":"acne","name":"Acne","qty":2,"unit_price":299,"line_total":478.4},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229,"line_total":366.4}]'::jsonb, 1291.2, 0, 1291.2, 0,
  true, 'old', 'Imported from Excel (total row 113) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0110', 'Dr Yehia', 'Cairo', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1396},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":836},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":1116},{"sku":"acne","name":"Acne","qty":2,"unit_price":299,"line_total":478.4},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":916}]'::jsonb, 4742.4, 0, 4742.4, 0,
  true, 'old', 'Imported from Excel (total row 114) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0111', 'Mo7sen', 'Cairo', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":3,"unit_price":349,"line_total":837.6},{"sku":"lotion","name":"Lotion","qty":3,"unit_price":209,"line_total":501.6},{"sku":"w-cleanser","name":"W.cleanser","qty":3,"unit_price":279,"line_total":669.6},{"sku":"w-cream","name":"W.cream","qty":3,"unit_price":229,"line_total":549.6}]'::jsonb, 2558.4, 0, 2558.4, 0,
  true, 'old', 'Imported from Excel (total row 115) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0112', 'H store', 'Cairo', current_date, null, false,
  'credit', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":2,"unit_price":349,"line_total":523.5},{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209,"line_total":313.5},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279,"line_total":418.5},{"sku":"acne","name":"Acne","qty":2,"unit_price":299,"line_total":448.5},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229,"line_total":343.5}]'::jsonb, 2047.5, 0, 2047.5, 0,
  true, 'old', 'Imported from Excel (total row 116) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0113', 'dr hossam', 'Cairo', current_date, null, false,
  'credit', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":2,"unit_price":349,"line_total":523.5},{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209,"line_total":313.5},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279,"line_total":418.5},{"sku":"acne","name":"Acne","qty":2,"unit_price":299,"line_total":448.5},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229,"line_total":343.5}]'::jsonb, 2047.5, 0, 2047.5, 0,
  true, 'old', 'Imported from Excel (total row 117) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0114', 'Ahmed Mokhtar', 'Cairo', current_date, null, false,
  'partial', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1396},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":836},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":1116},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":1196},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":916}]'::jsonb, 5460, 0, 5460, 1028,
  true, 'old', 'Imported from Excel (total row 118) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0115', 'm5zan se77a', 'مخازن Cairo', current_date, null, false,
  'credit', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":10,"unit_price":349,"line_total":2617.5},{"sku":"lotion","name":"Lotion","qty":10,"unit_price":209,"line_total":1567.5},{"sku":"w-cleanser","name":"W.cleanser","qty":10,"unit_price":279,"line_total":2092.5},{"sku":"acne","name":"Acne","qty":10,"unit_price":299,"line_total":2242.5},{"sku":"w-cream","name":"W.cream","qty":10,"unit_price":229,"line_total":1717.5}]'::jsonb, 10237.5, 0, 10237.5, 0,
  true, 'old', 'Imported from Excel (total row 121) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0116', 'm5zan watnia', 'مخازن Cairo', current_date, null, false,
  'credit', 0.3, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1221.5},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":731.5},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":976.5},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":1046.5},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":801.5}]'::jsonb, 4777.5, 0, 4777.5, 0,
  true, 'old', 'Imported from Excel (total row 122) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0117', 'm5zan healthy', 'مخازن Cairo', current_date, null, false,
  'credit', 0.35, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1134.25},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":679.25},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":906.75},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":971.75},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":744.25}]'::jsonb, 4436.25, 0, 4436.25, 0,
  true, 'old', 'Imported from Excel (total row 123) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0118', 'm5zn elra3y', 'مخازن Cairo', current_date, null, false,
  'credit', 0.35, '[{"sku":"post-laser","name":"Post-Laser","qty":10,"unit_price":349,"line_total":2268.5},{"sku":"lotion","name":"Lotion","qty":10,"unit_price":209,"line_total":1358.5},{"sku":"w-cleanser","name":"W.cleanser","qty":10,"unit_price":279,"line_total":1813.5},{"sku":"acne","name":"Acne","qty":10,"unit_price":299,"line_total":1943.5},{"sku":"w-cream","name":"W.cream","qty":10,"unit_price":229,"line_total":1488.5}]'::jsonb, 8872.5, 0, 8872.5, 0,
  true, 'old', 'Imported from Excel (total row 124) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0119', 'm5zan elkwasar', 'مخازن Cairo', current_date, null, false,
  'credit', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":20,"unit_price":349,"line_total":5235},{"sku":"lotion","name":"Lotion","qty":20,"unit_price":209,"line_total":3135},{"sku":"w-cleanser","name":"W.cleanser","qty":20,"unit_price":279,"line_total":4185},{"sku":"acne","name":"Acne","qty":20,"unit_price":299,"line_total":4485},{"sku":"w-cream","name":"W.cream","qty":20,"unit_price":229,"line_total":3435}]'::jsonb, 20475, 0, 20475, 0,
  true, 'old', 'Imported from Excel (total row 125) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0120', 'm5zan elmaleka', 'مخازن Cairo', current_date, null, false,
  'credit', 0.3, '[{"sku":"post-laser","name":"Post-Laser","qty":10,"unit_price":349,"line_total":2443},{"sku":"lotion","name":"Lotion","qty":10,"unit_price":209,"line_total":1463},{"sku":"w-cleanser","name":"W.cleanser","qty":10,"unit_price":279,"line_total":1953},{"sku":"acne","name":"Acne","qty":10,"unit_price":299,"line_total":2093},{"sku":"w-cream","name":"W.cream","qty":10,"unit_price":229,"line_total":1603}]'::jsonb, 9555, 0, 9555, 0,
  true, 'old', 'Imported from Excel (total row 126) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0121', 'Eva store', 'Alex', current_date, null, false,
  'credit', 0.3, '[{"sku":"post-laser","name":"Post-Laser","qty":1,"unit_price":349,"line_total":244.3},{"sku":"lotion","name":"Lotion","qty":1,"unit_price":209,"line_total":146.3},{"sku":"w-cleanser","name":"W.cleanser","qty":1,"unit_price":279,"line_total":195.3},{"sku":"acne","name":"Acne","qty":1,"unit_price":299,"line_total":209.3},{"sku":"w-cream","name":"W.cream","qty":1,"unit_price":229,"line_total":160.3}]'::jsonb, 955.5, 0, 955.5, 0,
  true, 'old', 'Imported from Excel (total row 128) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0122', 'صيدلية دكتورة نهى', 'Alex', current_date, null, false,
  'credit', 0.3, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1221.5},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":731.5},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":976.5},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":1046.5},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":801.5}]'::jsonb, 4777.5, 0, 4777.5, 0,
  true, 'old', 'Imported from Excel (total row 129) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0123', 'صيدلية محمد عطا الله', 'Alex', current_date, null, false,
  'credit', 0.3, '[{"sku":"post-laser","name":"Post-Laser","qty":1,"unit_price":349,"line_total":244.3},{"sku":"lotion","name":"Lotion","qty":1,"unit_price":209,"line_total":146.3},{"sku":"w-cleanser","name":"W.cleanser","qty":1,"unit_price":279,"line_total":195.3},{"sku":"acne","name":"Acne","qty":1,"unit_price":299,"line_total":209.3},{"sku":"w-cream","name":"W.cream","qty":1,"unit_price":229,"line_total":160.3}]'::jsonb, 955.5, 0, 955.5, 0,
  true, 'old', 'Imported from Excel (total row 130) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0124', 'ROCHETTE', 'Fayoum', current_date, null, false,
  'partial', 0.2, '[{"sku":"acne","name":"Acne","qty":1,"unit_price":299,"line_total":239.2},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229,"line_total":366.4}]'::jsonb, 605.6, 0, 605.6, 605,
  true, 'old', 'Imported from Excel (total row 132) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0125', 'GEMMI', 'Fayoum', current_date, null, false,
  'credit', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":6,"unit_price":345,"line_total":1552.5},{"sku":"lotion","name":"Lotion","qty":6,"unit_price":209,"line_total":940.5},{"sku":"acne","name":"Acne","qty":6,"unit_price":299,"line_total":1345.5},{"sku":"w-cream","name":"W.cream","qty":6,"unit_price":229,"line_total":1030.5}]'::jsonb, 4869, 0, 4869, 0,
  true, 'old', 'Imported from Excel (total row 133) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0126', 'NO7', 'Fayoum', current_date, null, false,
  'cash', 0.2, '[{"sku":"acne","name":"Acne","qty":1,"unit_price":300,"line_total":240}]'::jsonb, 240, 0, 240, 240,
  true, 'old', 'Imported from Excel (total row 134) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0127', 'gemmi', 'Fayoum', current_date, null, false,
  'cash', 0, '[{"sku":"misc","name":"Miscellaneous","qty":1,"unit_price":1345,"line_total":1345}]'::jsonb, 1345, 0, 1345, 1345,
  true, 'old', 'Imported from Excel (total row 135) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0128', 'ELLAMONNI', 'Fayoum', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1396},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":836},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":1116},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":1196},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":916}]'::jsonb, 5460, 0, 5460, 0,
  true, 'old', 'Imported from Excel (total row 136) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0129', 'DOKKAN DAWAA', 'Fayoum', current_date, null, false,
  'cash', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1396},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":836},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":1116},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":1196},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":916}]'::jsonb, 5460, 0, 5460, 5460,
  true, 'old', 'Imported from Excel (total row 137) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0130', 'DOKKAN DAWAA', 'Fayoum', current_date, null, false,
  'credit', 0.25, '[{"sku":"post-laser","name":"Post-Laser","qty":2,"unit_price":349,"line_total":523.5},{"sku":"lotion","name":"Lotion","qty":2,"unit_price":209,"line_total":313.5},{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279,"line_total":418.5},{"sku":"acne","name":"Acne","qty":2,"unit_price":299,"line_total":448.5},{"sku":"w-cream","name":"W.cream","qty":2,"unit_price":229,"line_total":343.5}]'::jsonb, 2047.5, 0, 2047.5, 0,
  true, 'old', 'Imported from Excel (total row 138 · continuation row) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0131', 'DOKKAN DAWAA', 'Fayoum', current_date, null, false,
  'credit', 0.3, '[{"sku":"w-cleanser","name":"W.cleanser","qty":2,"unit_price":279,"line_total":390.6},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":1046.5}]'::jsonb, 1437.1, 0, 1437.1, 0,
  true, 'old', 'Imported from Excel (total row 139 · continuation row) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0132', 'Madonna', 'Fayoum', current_date, null, false,
  'cash', 0.1, '[{"sku":"acne","name":"Acne","qty":6,"unit_price":299.07,"line_total":1615}]'::jsonb, 1615, 0, 1615, 1615,
  true, 'old', 'Imported from Excel (total row 140) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0133', 'EBRAM', 'Fayoum', current_date, null, false,
  'credit', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1396},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":836},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":1116},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":1196},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":916}]'::jsonb, 5460, 0, 5460, 0,
  true, 'old', 'Imported from Excel (total row 141) · أسعار قديمة'
);
insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  'PHI-LEGACY-0134', 'ELWAFAA', 'Fayoum', current_date, null, false,
  'partial', 0.2, '[{"sku":"post-laser","name":"Post-Laser","qty":5,"unit_price":349,"line_total":1396},{"sku":"lotion","name":"Lotion","qty":5,"unit_price":209,"line_total":836},{"sku":"w-cleanser","name":"W.cleanser","qty":5,"unit_price":279,"line_total":1116},{"sku":"acne","name":"Acne","qty":5,"unit_price":299,"line_total":1196},{"sku":"w-cream","name":"W.cream","qty":5,"unit_price":229,"line_total":916}]'::jsonb, 5460, 0, 5460, 1310,
  true, 'old', 'Imported from Excel (total row 142) · أسعار قديمة'
);