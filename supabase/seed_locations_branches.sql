-- Emirat Uniform WhatsApp Bot — seed data
-- 7 locations, 13 branches. gmb_review_link is left NULL and must be filled
-- in per branch once the Google My Business review links are available.

insert into locations (name) values
  ('Abu Dhabi'),
  ('Al Ain'),
  ('Dubai'),
  ('Sharjah'),
  ('Ajman'),
  ('RAK'),
  ('Fujairah')
on conflict (name) do nothing;

insert into branches (location_id, name, gmb_review_link)
select l.id, b.name, null
from (values
  ('Abu Dhabi', 'Bawabat Al Sharq Mall'),
  ('Abu Dhabi', 'Makani Shamkha'),
  ('Al Ain', 'Emirates Complex'),
  ('Al Ain', 'Aliah Mall'),
  ('Al Ain', 'Souq Extra'),
  ('Al Ain', 'Hili'),
  ('Al Ain', 'Bawadi Mall'),
  ('Dubai', 'Al Khawaneej'),
  ('Sharjah', 'Rahmania Mall'),
  ('Sharjah', 'Kalba Mall'),
  ('Ajman', 'Al Jurf'),
  ('RAK', 'Al Dhait'),
  ('Fujairah', 'Century Mall')
) as b(location_name, name)
join locations l on l.name = b.location_name;
