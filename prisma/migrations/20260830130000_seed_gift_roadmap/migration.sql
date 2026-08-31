-- Seed the published gift roadmap from the company's prize table.
--
-- Content, not machinery: these rows are what /gifts renders as a table and
-- nothing here decides who wins anything. Seeded rather than hardcoded so the
-- company can revise its own roadmap in /admin/gifts without a deploy — this
-- migration only establishes the starting point.
--
-- Three deliberate departures from the source table:
--
--   * Prize names are normalised where the source used two spellings for one
--     thing ("Fridge"/"Refrigerator", "Surprise Gift"/"Surprise Gift Box",
--     "Fan (Remote Control)"/"Remote Control Fan"), so the catalogue holds one
--     row per actual prize and a draw cannot offer the same item under two
--     names.
--   * NO VALUE FIGURES ARE SEEDED. Every amount in the source is in Indian
--     rupees and this store prices in AED, so printing them unconverted would
--     misstate what a prize is worth to a UAE customer. Both columns still
--     exist — an admin fills in real AED figures from /admin/gifts once the
--     prizes have been priced locally.
--   * The per-tier "T = ..." totals are dropped for a second reason on top of
--     the currency: they are the company's own prize-pool COST, which was never
--     a figure to show a customer.
--
-- Two villa prizes were renamed for the same currency reason ("25 Lakh Villa"
-- -> "Villa", "Mega Prize: 1.5 CR Villa in Dubai" -> "Mega Prize: Villa in
-- Dubai"); the two stay distinct rows, so the tiers that award them still
-- differ. The three "Cash Prize N" entries keep their numerals because the
-- amount IS the prize — those need restating in dirhams before the roadmap goes
-- live, and only the business can say what the AED figure should be.
--
-- Ids are fixed, readable strings rather than generated cuids so this migration
-- is re-readable and its rows are recognisable in the admin UI. Prisma only
-- applies @default(cuid()) to rows the application inserts.
--
-- Guarded with ON CONFLICT DO NOTHING throughout: re-running it is a no-op, and
-- it will not fight an admin who has since edited the roadmap by hand.

-- Prize catalogue
INSERT INTO "GiftPrize" ("id", "name", "slug", "valueNote", "isActive", "sortOrder", "createdAt", "updatedAt") VALUES
  ('gp_smart_watch', 'Smart Watch', 'smart-watch', NULL, true, 0, NOW(), NOW()),
  ('gp_mobile_phone', 'Mobile Phone', 'mobile-phone', NULL, true, 1, NOW(), NOW()),
  ('gp_non_stick_fry_pan', 'Non Stick Fry Pan', 'non-stick-fry-pan', NULL, true, 2, NOW(), NOW()),
  ('gp_bluetooth_speaker', 'Bluetooth Speaker', 'bluetooth-speaker', NULL, true, 3, NOW(), NOW()),
  ('gp_tablet', 'Tablet', 'tablet', NULL, true, 4, NOW(), NOW()),
  ('gp_power_bank', 'Power Bank', 'power-bank', NULL, true, 5, NOW(), NOW()),
  ('gp_munnar_family_trip_1_day', 'Munnar Family Trip (1 Day)', 'munnar-family-trip-1-day', NULL, true, 6, NOW(), NOW()),
  ('gp_ladies_bag', 'Ladies Bag', 'ladies-bag', NULL, true, 7, NOW(), NOW()),
  ('gp_cash_prize_1_000', 'Cash Prize 1,000', 'cash-prize-1-000', NULL, true, 8, NOW(), NOW()),
  ('gp_ear_buds', 'Ear Buds', 'ear-buds', NULL, true, 9, NOW(), NOW()),
  ('gp_iron_box', 'Iron Box', 'iron-box', NULL, true, 10, NOW(), NOW()),
  ('gp_electric_kettle', 'Electric Kettle', 'electric-kettle', NULL, true, 11, NOW(), NOW()),
  ('gp_surprise_gift_box', 'Surprise Gift Box', 'surprise-gift-box', NULL, true, 12, NOW(), NOW()),
  ('gp_sweet_hamper', 'Sweet Hamper', 'sweet-hamper', NULL, true, 13, NOW(), NOW()),
  ('gp_cash_prize_1_500', 'Cash Prize 1,500', 'cash-prize-1-500', NULL, true, 14, NOW(), NOW()),
  ('gp_gift_hamper', 'Gift Hamper', 'gift-hamper', NULL, true, 15, NOW(), NOW()),
  ('gp_swift_car', 'Swift Car', 'swift-car', NULL, true, 16, NOW(), NOW()),
  ('gp_electric_scooter', 'Electric Scooter', 'electric-scooter', NULL, true, 17, NOW(), NOW()),
  ('gp_washing_machine', 'Washing Machine', 'washing-machine', NULL, true, 18, NOW(), NOW()),
  ('gp_refrigerator', 'Refrigerator', 'refrigerator', NULL, true, 19, NOW(), NOW()),
  ('gp_1_gram_gold_coin', '1 Gram Gold Coin', '1-gram-gold-coin', NULL, true, 20, NOW(), NOW()),
  ('gp_sofa_set', 'Sofa Set', 'sofa-set', NULL, true, 21, NOW(), NOW()),
  ('gp_cash_prize_10_000', 'Cash Prize 10,000', 'cash-prize-10-000', NULL, true, 22, NOW(), NOW()),
  ('gp_remote_control_fan', 'Remote Control Fan', 'remote-control-fan', NULL, true, 23, NOW(), NOW()),
  ('gp_pressure_cooker', 'Pressure Cooker', 'pressure-cooker', NULL, true, 24, NOW(), NOW()),
  ('gp_villa', 'Villa', 'villa', NULL, true, 25, NOW(), NOW()),
  ('gp_dining_table_set', 'Dining Table Set', 'dining-table-set', NULL, true, 26, NOW(), NOW()),
  ('gp_air_conditioner', 'Air Conditioner', 'air-conditioner', NULL, true, 27, NOW(), NOW()),
  ('gp_mega_prize_villa_in_dubai', 'Mega Prize: Villa in Dubai', 'mega-prize-villa-in-dubai', NULL, true, 28, NOW(), NOW()),
  ('gp_mega_prize_bmw_car', 'Mega Prize: BMW Car', 'mega-prize-bmw-car', NULL, true, 29, NOW(), NOW()),
  ('gp_laptop', 'Laptop', 'laptop', NULL, true, 30, NOW(), NOW()),
  ('gp_dubai_trip_4_persons', 'Dubai Trip (4 Persons)', 'dubai-trip-4-persons', NULL, true, 31, NOW(), NOW()),
  ('gp_malaysia_trip_4_persons', 'Malaysia Trip (4 Persons)', 'malaysia-trip-4-persons', NULL, true, 32, NOW(), NOW()),
  ('gp_automatic_gas_stove', 'Automatic Gas Stove', 'automatic-gas-stove', NULL, true, 33, NOW(), NOW()),
  ('gp_solar_emergency_light', 'Solar Emergency Light', 'solar-emergency-light', NULL, true, 34, NOW(), NOW())
ON CONFLICT ("slug") DO NOTHING;

-- Roadmap rungs
INSERT INTO "GiftTier" ("id", "sortOrder", "memberCount", "totalMembers", "targetDays", "totalValueNote", "isActive", "createdAt", "updatedAt") VALUES
  ('gt_01', 0, 1, NULL, NULL, NULL, true, NOW(), NOW()),
  ('gt_02', 1, 10, 11, 15, NULL, true, NOW(), NOW()),
  ('gt_03', 2, 100, 111, 30, NULL, true, NOW(), NOW()),
  ('gt_04', 3, 1000, 1111, 60, NULL, true, NOW(), NOW()),
  ('gt_05', 4, 2000, NULL, 90, NULL, true, NOW(), NOW()),
  ('gt_06', 5, 3000, NULL, NULL, NULL, true, NOW(), NOW()),
  ('gt_07', 6, 4000, NULL, NULL, NULL, true, NOW(), NOW()),
  ('gt_08', 7, 5000, NULL, NULL, NULL, true, NOW(), NOW()),
  ('gt_09', 8, 6000, NULL, NULL, NULL, true, NOW(), NOW()),
  ('gt_10', 9, 7000, NULL, NULL, NULL, true, NOW(), NOW()),
  ('gt_11', 10, 8000, NULL, NULL, NULL, true, NOW(), NOW()),
  ('gt_12', 11, 9000, NULL, NULL, NULL, true, NOW(), NOW()),
  ('gt_13', 12, 10000, 11111, 120, NULL, true, NOW(), NOW()),
  ('gt_14', 13, 100000, 111111, 150, NULL, true, NOW(), NOW()),
  ('gt_15', 14, 1000000, 1111111, 180, NULL, true, NOW(), NOW()),
  ('gt_16', 15, 10000000, 11111111, 210, NULL, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- Prize lines within each rung
INSERT INTO "GiftTierItem" ("id", "tierId", "prizeId", "quantity", "sortOrder") VALUES
  ('gti_03_01', 'gt_03', 'gp_smart_watch', 1, 0),
  ('gti_04_01', 'gt_04', 'gp_mobile_phone', 1, 0),
  ('gti_04_02', 'gt_04', 'gp_smart_watch', 5, 1),
  ('gti_04_03', 'gt_04', 'gp_non_stick_fry_pan', 5, 2),
  ('gti_05_01', 'gt_05', 'gp_smart_watch', 3, 0),
  ('gti_05_02', 'gt_05', 'gp_bluetooth_speaker', 3, 1),
  ('gti_05_03', 'gt_05', 'gp_tablet', 3, 2),
  ('gti_06_01', 'gt_06', 'gp_power_bank', 3, 0),
  ('gti_06_02', 'gt_06', 'gp_munnar_family_trip_1_day', 1, 1),
  ('gti_06_03', 'gt_06', 'gp_ladies_bag', 3, 2),
  ('gti_06_04', 'gt_06', 'gp_smart_watch', 3, 3),
  ('gti_06_05', 'gt_06', 'gp_cash_prize_1_000', 3, 4),
  ('gti_07_01', 'gt_07', 'gp_ear_buds', 5, 0),
  ('gti_07_02', 'gt_07', 'gp_iron_box', 3, 1),
  ('gti_07_03', 'gt_07', 'gp_electric_kettle', 3, 2),
  ('gti_07_04', 'gt_07', 'gp_surprise_gift_box', 3, 3),
  ('gti_07_05', 'gt_07', 'gp_sweet_hamper', 3, 4),
  ('gti_08_01', 'gt_08', 'gp_cash_prize_1_500', 5, 0),
  ('gti_08_02', 'gt_08', 'gp_smart_watch', 5, 1),
  ('gti_08_03', 'gt_08', 'gp_power_bank', 5, 2),
  ('gti_08_04', 'gt_08', 'gp_ear_buds', 5, 3),
  ('gti_09_01', 'gt_09', 'gp_iron_box', 3, 0),
  ('gti_09_02', 'gt_09', 'gp_ladies_bag', 3, 1),
  ('gti_09_03', 'gt_09', 'gp_surprise_gift_box', 3, 2),
  ('gti_09_04', 'gt_09', 'gp_sweet_hamper', 3, 3),
  ('gti_09_05', 'gt_09', 'gp_electric_kettle', 3, 4),
  ('gti_10_01', 'gt_10', 'gp_mobile_phone', 1, 0),
  ('gti_10_02', 'gt_10', 'gp_tablet', 1, 1),
  ('gti_10_03', 'gt_10', 'gp_ear_buds', 3, 2),
  ('gti_10_04', 'gt_10', 'gp_cash_prize_1_000', 3, 3),
  ('gti_11_01', 'gt_11', 'gp_tablet', 2, 0),
  ('gti_11_02', 'gt_11', 'gp_gift_hamper', 3, 1),
  ('gti_11_03', 'gt_11', 'gp_surprise_gift_box', 3, 2),
  ('gti_11_04', 'gt_11', 'gp_non_stick_fry_pan', 3, 3),
  ('gti_11_05', 'gt_11', 'gp_ladies_bag', 4, 4),
  ('gti_12_01', 'gt_12', 'gp_tablet', 2, 0),
  ('gti_12_02', 'gt_12', 'gp_power_bank', 2, 1),
  ('gti_12_03', 'gt_12', 'gp_surprise_gift_box', 3, 2),
  ('gti_12_04', 'gt_12', 'gp_ear_buds', 5, 3),
  ('gti_12_05', 'gt_12', 'gp_non_stick_fry_pan', 5, 4),
  ('gti_13_01', 'gt_13', 'gp_tablet', 2, 0),
  ('gti_13_02', 'gt_13', 'gp_power_bank', 2, 1),
  ('gti_13_03', 'gt_13', 'gp_cash_prize_1_000', 5, 2),
  ('gti_13_04', 'gt_13', 'gp_ear_buds', 5, 3),
  ('gti_13_05', 'gt_13', 'gp_non_stick_fry_pan', 5, 4),
  ('gti_14_01', 'gt_14', 'gp_swift_car', 1, 0),
  ('gti_14_02', 'gt_14', 'gp_electric_scooter', 5, 1),
  ('gti_14_03', 'gt_14', 'gp_non_stick_fry_pan', 10, 2),
  ('gti_14_04', 'gt_14', 'gp_smart_watch', 10, 3),
  ('gti_14_05', 'gt_14', 'gp_washing_machine', 5, 4),
  ('gti_14_06', 'gt_14', 'gp_refrigerator', 5, 5),
  ('gti_14_07', 'gt_14', 'gp_1_gram_gold_coin', 5, 6),
  ('gti_14_08', 'gt_14', 'gp_sofa_set', 2, 7),
  ('gti_14_09', 'gt_14', 'gp_tablet', 6, 8),
  ('gti_14_10', 'gt_14', 'gp_cash_prize_10_000', 10, 9),
  ('gti_14_11', 'gt_14', 'gp_remote_control_fan', 10, 10),
  ('gti_14_12', 'gt_14', 'gp_pressure_cooker', 10, 11),
  ('gti_15_01', 'gt_15', 'gp_villa', 3, 0),
  ('gti_15_02', 'gt_15', 'gp_swift_car', 10, 1),
  ('gti_15_03', 'gt_15', 'gp_electric_scooter', 25, 2),
  ('gti_15_04', 'gt_15', 'gp_dining_table_set', 3, 3),
  ('gti_15_05', 'gt_15', 'gp_air_conditioner', 1, 4),
  ('gti_15_06', 'gt_15', 'gp_sofa_set', 3, 5),
  ('gti_15_07', 'gt_15', 'gp_mobile_phone', 25, 6),
  ('gti_16_01', 'gt_16', 'gp_mega_prize_villa_in_dubai', 1, 0),
  ('gti_16_02', 'gt_16', 'gp_mega_prize_bmw_car', 1, 1),
  ('gti_16_03', 'gt_16', 'gp_villa', 25, 2),
  ('gti_16_04', 'gt_16', 'gp_swift_car', 50, 3),
  ('gti_16_05', 'gt_16', 'gp_electric_scooter', 30, 4),
  ('gti_16_06', 'gt_16', 'gp_laptop', 10, 5),
  ('gti_16_07', 'gt_16', 'gp_dubai_trip_4_persons', 1, 6),
  ('gti_16_08', 'gt_16', 'gp_malaysia_trip_4_persons', 1, 7),
  ('gti_16_09', 'gt_16', 'gp_mobile_phone', 250, 8),
  ('gti_16_10', 'gt_16', 'gp_refrigerator', 40, 9),
  ('gti_16_11', 'gt_16', 'gp_washing_machine', 40, 10),
  ('gti_16_12', 'gt_16', 'gp_air_conditioner', 10, 11),
  ('gti_16_13', 'gt_16', 'gp_1_gram_gold_coin', 25, 12),
  ('gti_16_14', 'gt_16', 'gp_automatic_gas_stove', 10, 13),
  ('gti_16_15', 'gt_16', 'gp_remote_control_fan', 20, 14),
  ('gti_16_16', 'gt_16', 'gp_solar_emergency_light', 10, 15)
ON CONFLICT ("tierId", "prizeId") DO NOTHING;
