-- SYNTHETIC DEMO ONLY. Apply explicitly to a reviewed demo database, never as a migration.
-- Adds facilities only to the existing synthetic organization. No users, offers or capacity.
begin;
select pg_advisory_xact_lock(hashtextextended('cargomesh:v2-international-client-demo',0));
do $$ begin
 if not exists(select 1 from public.organizations where id='52000000-0000-4000-8000-000000000001' and code='HAC52_PE' and name like '[SYNTHETIC]%' and status='ACTIVE') then
  raise exception 'REVIEWED_SYNTHETIC_CLIENT_REQUIRED';
 end if;
 if (select count(*) from public.facilities where organization_id='52000000-0000-4000-8000-000000000001' and active and id in ('52010000-0000-4000-8000-000000000001'::uuid,'52010000-0000-4000-8000-000000000002'::uuid,'52010000-0000-4000-8000-000000000003'::uuid))<>3 then
  raise exception 'BASE_PERU_FACILITIES_REQUIRED';
 end if;
 -- Only these reviewed pre-existing C01 identities are allowed; never modify them.
 if exists(
  select 1 from public.facilities f join (values
   ('ec63f447-95ab-46ca-85c1-e9b8953ed475'::uuid,'C01_SIM_V1_A'),
   ('2c967237-69d6-4e5b-9586-c825d64c993d'::uuid,'C01_SIM_V1_B')
  ) as expected(id,code) on f.id=expected.id or (f.organization_id='52000000-0000-4000-8000-000000000001' and f.code=expected.code)
  where f.id<>expected.id or f.code<>expected.code or f.organization_id<>'52000000-0000-4000-8000-000000000001'
 ) then
  raise exception 'DEMO_CATALOG_CHANGED_REVIEW_FIRST';
 end if;
 if exists(select 1 from public.facilities where organization_id='52000000-0000-4000-8000-000000000001' and active and id not in ('52010000-0000-4000-8000-000000000001'::uuid,'52010000-0000-4000-8000-000000000002'::uuid,'52010000-0000-4000-8000-000000000003'::uuid,'276f4290-1f8e-513f-9fdc-f0017d6e1904'::uuid,'fcb2ca56-862c-5eb4-afce-a78474c0589d'::uuid,'b24f8178-2fc0-5b20-a0b8-e2962e2b9232'::uuid,'b731ce77-152c-537f-b4e6-d303c9ae42aa'::uuid,'3e8b9f92-4802-50c1-a837-69e3c3b3c601'::uuid,'59628405-6388-5b8b-a77d-701b6b40b0c9'::uuid,'29224693-249f-5886-b455-acf7cee7fd09'::uuid,'af5745ff-8aa9-5a07-a7dc-294d4c3bf75d'::uuid,'4c3735f2-78cc-546a-a686-063eba7b028f'::uuid,'adb5fec1-798f-5888-89f5-fcd083f14b13'::uuid,'d461e1c3-16b4-5281-8334-0628a98705fb'::uuid,'7d82098e-69dd-5621-93f8-55fc03428ddf'::uuid,'a97494da-f946-5ba8-a54f-1cf9eda46910'::uuid,'331eb1a5-59b1-5d5f-967b-95a5dd505e0d'::uuid,'7651bd03-54d2-55dc-9744-87a6c62f0835'::uuid,'47767567-1a33-599b-ba27-3932caa476ca'::uuid,'12f440ff-79bc-59c5-b35b-47f5458e425d'::uuid,'eca28f55-c3b6-58b5-978f-3e6967e753cb'::uuid,'9f748147-ec12-53d2-acfc-31cbaf993cb7'::uuid,'a08594d3-0516-53b2-9741-c6ea1585e2a8'::uuid,'90bacd7d-75eb-5430-9688-a18def02888d'::uuid,'e091b364-6772-5e24-869d-de62e9e0da94'::uuid,'f4b27da1-7e88-55b9-af14-c6b4285490ef'::uuid,'6f254c50-ae42-5dac-a644-add89e9ca2c1'::uuid,'16c59e5c-425b-5562-8a6c-090e6e8d631b'::uuid,'0659c09c-8774-5f60-a017-9df2ef59b1cc'::uuid,'17bc1140-6e5a-5422-894c-083ce8106fa8'::uuid,'1e028107-a682-5b2a-a49b-b93753328140'::uuid,'44179533-f1f9-5acd-9e87-9163846221e3'::uuid,'cf87cda4-8c08-5cc1-8908-d43daebd76ae'::uuid,'e446c45d-81bf-5b59-b06e-38fcf0bba9dc'::uuid,'804df0ab-1a26-50c8-854e-8758270bb503'::uuid) and not (
  (id='ec63f447-95ab-46ca-85c1-e9b8953ed475' and code='C01_SIM_V1_A' and organization_id='52000000-0000-4000-8000-000000000001')
  or (id='2c967237-69d6-4e5b-9586-c825d64c993d' and code='C01_SIM_V1_B' and organization_id='52000000-0000-4000-8000-000000000001')
 )) then
  raise exception 'DEMO_CATALOG_CHANGED_REVIEW_FIRST';
 end if;
end $$;
create temporary table international_demo_facilities(id uuid,code text,name text,country_code text,region_code text,city text,address_line text,latitude double precision,longitude double precision) on commit drop;
insert into international_demo_facilities values
('276f4290-1f8e-513f-9fdc-f0017d6e1904','JUDGES_US_NEW_YORK','[SYNTHETIC] New York demo warehouse','US','New York','New York','Fictional Demo Street 100',40.71,-74.01),
('fcb2ca56-862c-5eb4-afce-a78474c0589d','JUDGES_US_LOS_ANGELES','[SYNTHETIC] Los Angeles demo warehouse','US','California','Los Angeles','Fictional Demo Street 100',34.05,-118.24),
('b24f8178-2fc0-5b20-a0b8-e2962e2b9232','JUDGES_CA_TORONTO','[SYNTHETIC] Toronto demo warehouse','CA','Ontario','Toronto','Fictional Demo Street 100',43.65,-79.38),
('b731ce77-152c-537f-b4e6-d303c9ae42aa','JUDGES_CA_MONTREAL','[SYNTHETIC] Montreal demo warehouse','CA','Quebec','Montreal','Fictional Demo Street 100',45.5,-73.57),
('3e8b9f92-4802-50c1-a837-69e3c3b3c601','JUDGES_MX_MEXICO_CITY','[SYNTHETIC] Mexico City demo warehouse','MX','Ciudad de Mexico','Mexico City','Fictional Demo Street 100',19.43,-99.13),
('59628405-6388-5b8b-a77d-701b6b40b0c9','JUDGES_MX_MONTERREY','[SYNTHETIC] Monterrey demo warehouse','MX','Nuevo Leon','Monterrey','Fictional Demo Street 100',25.69,-100.32),
('29224693-249f-5886-b455-acf7cee7fd09','JUDGES_CO_BOGOTA','[SYNTHETIC] Bogota demo warehouse','CO','Bogota','Bogota','Fictional Demo Street 100',4.71,-74.07),
('af5745ff-8aa9-5a07-a7dc-294d4c3bf75d','JUDGES_CO_MEDELLIN','[SYNTHETIC] Medellin demo warehouse','CO','Antioquia','Medellin','Fictional Demo Street 100',6.24,-75.58),
('4c3735f2-78cc-546a-a686-063eba7b028f','JUDGES_EC_QUITO','[SYNTHETIC] Quito demo warehouse','EC','Pichincha','Quito','Fictional Demo Street 100',-0.18,-78.47),
('adb5fec1-798f-5888-89f5-fcd083f14b13','JUDGES_EC_GUAYAQUIL','[SYNTHETIC] Guayaquil demo warehouse','EC','Guayas','Guayaquil','Fictional Demo Street 100',-2.17,-79.92),
('d461e1c3-16b4-5281-8334-0628a98705fb','JUDGES_CL_SANTIAGO','[SYNTHETIC] Santiago demo warehouse','CL','Region Metropolitana','Santiago','Fictional Demo Street 100',-33.45,-70.67),
('7d82098e-69dd-5621-93f8-55fc03428ddf','JUDGES_CL_VALPARAISO','[SYNTHETIC] Valparaiso demo warehouse','CL','Valparaiso','Valparaiso','Fictional Demo Street 100',-33.05,-71.61),
('a97494da-f946-5ba8-a54f-1cf9eda46910','JUDGES_BR_SAO_PAULO','[SYNTHETIC] Sao Paulo demo warehouse','BR','Sao Paulo','Sao Paulo','Fictional Demo Street 100',-23.55,-46.63),
('331eb1a5-59b1-5d5f-967b-95a5dd505e0d','JUDGES_BR_RIO_DE_JANEIRO','[SYNTHETIC] Rio de Janeiro demo warehouse','BR','Rio de Janeiro','Rio de Janeiro','Fictional Demo Street 100',-22.91,-43.17),
('7651bd03-54d2-55dc-9744-87a6c62f0835','JUDGES_AR_BUENOS_AIRES','[SYNTHETIC] Buenos Aires demo warehouse','AR','Buenos Aires','Buenos Aires','Fictional Demo Street 100',-34.6,-58.38),
('47767567-1a33-599b-ba27-3932caa476ca','JUDGES_AR_CORDOBA','[SYNTHETIC] Cordoba demo warehouse','AR','Cordoba','Cordoba','Fictional Demo Street 100',-31.42,-64.19),
('12f440ff-79bc-59c5-b35b-47f5458e425d','JUDGES_ES_MADRID','[SYNTHETIC] Madrid demo warehouse','ES','Madrid','Madrid','Fictional Demo Street 100',40.42,-3.7),
('eca28f55-c3b6-58b5-978f-3e6967e753cb','JUDGES_ES_BARCELONA','[SYNTHETIC] Barcelona demo warehouse','ES','Catalonia','Barcelona','Fictional Demo Street 100',41.39,2.17),
('9f748147-ec12-53d2-acfc-31cbaf993cb7','JUDGES_FR_PARIS','[SYNTHETIC] Paris demo warehouse','FR','Ile-de-France','Paris','Fictional Demo Street 100',48.86,2.35),
('a08594d3-0516-53b2-9741-c6ea1585e2a8','JUDGES_FR_LYON','[SYNTHETIC] Lyon demo warehouse','FR','Auvergne-Rhone-Alpes','Lyon','Fictional Demo Street 100',45.76,4.84),
('90bacd7d-75eb-5430-9688-a18def02888d','JUDGES_DE_BERLIN','[SYNTHETIC] Berlin demo warehouse','DE','Berlin','Berlin','Fictional Demo Street 100',52.52,13.41),
('e091b364-6772-5e24-869d-de62e9e0da94','JUDGES_DE_HAMBURG','[SYNTHETIC] Hamburg demo warehouse','DE','Hamburg','Hamburg','Fictional Demo Street 100',53.55,10.0),
('f4b27da1-7e88-55b9-af14-c6b4285490ef','JUDGES_GB_LONDON','[SYNTHETIC] London demo warehouse','GB','England','London','Fictional Demo Street 100',51.51,-0.13),
('6f254c50-ae42-5dac-a644-add89e9ca2c1','JUDGES_GB_MANCHESTER','[SYNTHETIC] Manchester demo warehouse','GB','England','Manchester','Fictional Demo Street 100',53.48,-2.24),
('16c59e5c-425b-5562-8a6c-090e6e8d631b','JUDGES_IN_MUMBAI','[SYNTHETIC] Mumbai demo warehouse','IN','Maharashtra','Mumbai','Fictional Demo Street 100',19.08,72.88),
('0659c09c-8774-5f60-a017-9df2ef59b1cc','JUDGES_IN_DELHI','[SYNTHETIC] Delhi demo warehouse','IN','Delhi','Delhi','Fictional Demo Street 100',28.61,77.21),
('17bc1140-6e5a-5422-894c-083ce8106fa8','JUDGES_JP_TOKYO','[SYNTHETIC] Tokyo demo warehouse','JP','Tokyo','Tokyo','Fictional Demo Street 100',35.68,139.69),
('1e028107-a682-5b2a-a49b-b93753328140','JUDGES_JP_OSAKA','[SYNTHETIC] Osaka demo warehouse','JP','Osaka','Osaka','Fictional Demo Street 100',34.69,135.5),
('44179533-f1f9-5acd-9e87-9163846221e3','JUDGES_AU_SYDNEY','[SYNTHETIC] Sydney demo warehouse','AU','New South Wales','Sydney','Fictional Demo Street 100',-33.87,151.21),
('cf87cda4-8c08-5cc1-8908-d43daebd76ae','JUDGES_AU_MELBOURNE','[SYNTHETIC] Melbourne demo warehouse','AU','Victoria','Melbourne','Fictional Demo Street 100',-37.81,144.96),
('e446c45d-81bf-5b59-b06e-38fcf0bba9dc','JUDGES_ZA_JOHANNESBURG','[SYNTHETIC] Johannesburg demo warehouse','ZA','Gauteng','Johannesburg','Fictional Demo Street 100',-26.2,28.04),
('804df0ab-1a26-50c8-854e-8758270bb503','JUDGES_ZA_CAPE_TOWN','[SYNTHETIC] Cape Town demo warehouse','ZA','Western Cape','Cape Town','Fictional Demo Street 100',-33.92,18.42);
do $$ begin
 if exists(select 1 from public.facilities f join international_demo_facilities d on f.id=d.id or (f.organization_id='52000000-0000-4000-8000-000000000001' and f.code=d.code)
  where f.id<>d.id or f.organization_id<>'52000000-0000-4000-8000-000000000001' or f.code<>d.code or f.name<>d.name or f.country_code<>d.country_code or f.city<>d.city
   or f.region_code is distinct from d.region_code or f.address_line is distinct from d.address_line
   or f.latitude is distinct from d.latitude or f.longitude is distinct from d.longitude or not f.active) then
  raise exception 'FACILITY_COLLISION_INSPECT_BEFORE_RETRY';
 end if;
end $$;
insert into public.facilities(id,organization_id,code,name,facility_type,country_code,region_code,city,address_line,latitude,longitude,active,access_restrictions,operating_hours)
select d.id,'52000000-0000-4000-8000-000000000001',d.code,d.name,'WAREHOUSE',d.country_code,d.region_code,d.city,d.address_line,d.latitude,d.longitude,true,'[]'::jsonb,null
from international_demo_facilities d where not exists(select 1 from public.facilities f where f.id=d.id);
do $$ begin
 if (select count(*) from public.facilities f join international_demo_facilities d on f.id=d.id and f.organization_id='52000000-0000-4000-8000-000000000001')<>32 then raise exception 'INCOMPLETE_INTERNATIONAL_SCENARIO';end if;
end $$;
commit;
