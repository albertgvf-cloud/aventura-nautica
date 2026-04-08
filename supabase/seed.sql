-- =====================================================================
-- AVENTURA NAUTICA — SEED DATA
-- Run this AFTER schema.sql in Supabase SQL Editor
-- =====================================================================

-- ACTIVITIES (5 families)
insert into activities (name, description, display_order) values
  ('Actividades Náuticas',   'Monster, Crazy Sofa, Banana',                   1),
  ('Parasailing',            'Parachute ride pulled by boat',                 2),
  ('Boat Rentals',           'Self-drive boat rentals (license / no license)', 3),
  ('Jet Ski Rentals',        'Individual or group jet ski rentals',           4),
  ('Catamaran Excursions',   'Bliss 45 and Bliss 70 excursions',              5);

-- ACTIVITY VARIANTS
-- Nautic activities
insert into activity_variants (activity_id, name, duration_minutes, max_participants, min_participants)
select id, 'Monster',      20, 10, 1 from activities where name = 'Actividades Náuticas';
insert into activity_variants (activity_id, name, duration_minutes, max_participants, min_participants)
select id, 'Crazy Sofa',   15,  6, 1 from activities where name = 'Actividades Náuticas';
insert into activity_variants (activity_id, name, duration_minutes, max_participants, min_participants)
select id, 'Banana',       15, 12, 1 from activities where name = 'Actividades Náuticas';

-- Parasailing
insert into activity_variants (activity_id, name, duration_minutes, max_participants, min_participants)
select id, 'Parasailing (boat trip)', 60, 10, 2 from activities where name = 'Parasailing';

-- Boat rentals
insert into activity_variants (activity_id, name, duration_minutes, max_participants, requires_license)
select id, 'Boat rental – with license',    60, 8, true  from activities where name = 'Boat Rentals';
insert into activity_variants (activity_id, name, duration_minutes, max_participants, requires_license)
select id, 'Boat rental – without license', 60, 5, false from activities where name = 'Boat Rentals';

-- Jet ski rentals
insert into activity_variants (activity_id, name, duration_minutes, max_participants)
select id, 'Jet Ski – individual',        30, 2 from activities where name = 'Jet Ski Rentals';
insert into activity_variants (activity_id, name, duration_minutes, max_participants)
select id, 'Jet Ski – group (4+guide)',   60, 8 from activities where name = 'Jet Ski Rentals';

-- Catamaran excursions
insert into activity_variants (activity_id, name, duration_minutes, max_participants)
select id, 'Bliss 45 – Private excursion',    240,  12 from activities where name = 'Catamaran Excursions';
insert into activity_variants (activity_id, name, duration_minutes, max_participants)
select id, 'Bliss 45 – Sunset excursion',     180,  12 from activities where name = 'Catamaran Excursions';
insert into activity_variants (activity_id, name, duration_minutes, max_participants)
select id, 'Bliss 70 – Morning excursion',    270, 120 from activities where name = 'Catamaran Excursions';
insert into activity_variants (activity_id, name, duration_minutes, max_participants)
select id, 'Bliss 70 – Afternoon excursion',  240, 120 from activities where name = 'Catamaran Excursions';
insert into activity_variants (activity_id, name, duration_minutes, max_participants)
select id, 'Bliss 70 – Sunset excursion',     120, 120 from activities where name = 'Catamaran Excursions';

-- ---------------------------------------------------------------
-- RESOURCES: physical assets
-- ---------------------------------------------------------------

-- 22 boats WITH license
insert into resources (name, type, model, capacity, requires_license)
select 'Boat w/license #'||i, 'boat', 'with_license', 8, true
from generate_series(1,22) as i;

-- 22 boats WITHOUT license
insert into resources (name, type, model, capacity, requires_license)
select 'Boat no-license #'||i, 'boat', 'without_license', 5, false
from generate_series(1,22) as i;

-- Jet skis: 18 VX
insert into resources (name, type, model, capacity)
select 'Jet VX #'||i, 'jet_ski', 'VX', 2
from generate_series(1,18) as i;

-- Jet skis: 2 EX100
insert into resources (name, type, model, capacity)
select 'Jet EX100 #'||i, 'jet_ski', 'EX100', 2
from generate_series(1,2) as i;

-- Jet skis: 1 Jetblaster, 1 X180
insert into resources (name, type, model, capacity) values
  ('Jet Jetblaster #1', 'jet_ski', 'Jetblaster', 2),
  ('Jet X180 #1',       'jet_ski', 'X180',       2);

-- Catamarans
insert into resources (name, type, model, capacity) values
  ('Bliss 45', 'catamaran', 'Bliss 45',  12),
  ('Bliss 70', 'catamaran', 'Bliss 70', 120);

-- Nautic / Parasailing boats (placeholders, edit later)
insert into resources (name, type, model, capacity) values
  ('Monster Boat #1',  'nautic_boat',   'Monster',  10),
  ('Inflatable Tow #1','nautic_boat',   'Tow',      12),
  ('Parasail Boat #1', 'parasail_boat', 'Parasail', 10);
