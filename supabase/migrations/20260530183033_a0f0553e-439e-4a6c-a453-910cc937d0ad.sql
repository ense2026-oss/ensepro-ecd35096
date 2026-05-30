-- 1) Overwrite the 58 matched employees with Excel data (source of truth)
UPDATE public.employees e SET
  prefix=COALESCE(s.prefix,''), first_name=COALESCE(s.first_name,''), last_name=COALESCE(s.last_name,''),
  nickname=COALESCE(s.nickname,''), gender=COALESCE(s.gender,''), national_id=COALESCE(s.national_id,''),
  birth_date=COALESCE(s.birth_date,''), blood_group=COALESCE(s.blood_group,''), id_expire_date=COALESCE(s.id_expire_date,''),
  phone=COALESCE(s.phone,''), address=COALESCE(s.address,''), home_address=COALESCE(s.home_address,''),
  dept=COALESCE(s.dept,''), position=COALESCE(s.position,''), start_date=COALESCE(s.start_date,''),
  trial_end_date=COALESCE(s.trial_end_date,''), contract_end_date=COALESCE(s.contract_end_date,''),
  salary=COALESCE(s.salary,''), status=COALESCE(s.status,'active'), marital_status=COALESCE(s.marital_status,''),
  bank_account=COALESCE(s.bank_account,''), children=s.children, sons=COALESCE(s.sons,0), daughters=COALESCE(s.daughters,0),
  updated_at=now()
FROM public._emp_stage s
WHERE s.match_id = e.id;

-- 2) Overwrite any pre-existing "new" rows matched by national_id
UPDATE public.employees e SET
  prefix=COALESCE(s.prefix,''), first_name=COALESCE(s.first_name,''), last_name=COALESCE(s.last_name,''),
  nickname=COALESCE(s.nickname,''), gender=COALESCE(s.gender,''), birth_date=COALESCE(s.birth_date,''),
  blood_group=COALESCE(s.blood_group,''), id_expire_date=COALESCE(s.id_expire_date,''), phone=COALESCE(s.phone,''),
  address=COALESCE(s.address,''), home_address=COALESCE(s.home_address,''), dept=COALESCE(s.dept,''),
  position=COALESCE(s.position,''), start_date=COALESCE(s.start_date,''), trial_end_date=COALESCE(s.trial_end_date,''),
  contract_end_date=COALESCE(s.contract_end_date,''), salary=COALESCE(s.salary,''), status=COALESCE(s.status,'active'),
  marital_status=COALESCE(s.marital_status,''), bank_account=COALESCE(s.bank_account,''),
  children=s.children, sons=COALESCE(s.sons,0), daughters=COALESCE(s.daughters,0), updated_at=now()
FROM public._emp_stage s
WHERE s.match_id IS NULL AND s.national_id IS NOT NULL AND e.national_id = s.national_id;

-- 3) Overwrite any pre-existing "new" rows without national_id, matched by name
UPDATE public.employees e SET
  prefix=COALESCE(s.prefix,''), nickname=COALESCE(s.nickname,''), gender=COALESCE(s.gender,''),
  birth_date=COALESCE(s.birth_date,''), blood_group=COALESCE(s.blood_group,''), id_expire_date=COALESCE(s.id_expire_date,''),
  phone=COALESCE(s.phone,''), address=COALESCE(s.address,''), home_address=COALESCE(s.home_address,''),
  dept=COALESCE(s.dept,''), position=COALESCE(s.position,''), start_date=COALESCE(s.start_date,''),
  trial_end_date=COALESCE(s.trial_end_date,''), contract_end_date=COALESCE(s.contract_end_date,''),
  salary=COALESCE(s.salary,''), status=COALESCE(s.status,'active'), marital_status=COALESCE(s.marital_status,''),
  bank_account=COALESCE(s.bank_account,''), children=s.children, sons=COALESCE(s.sons,0), daughters=COALESCE(s.daughters,0),
  updated_at=now()
FROM public._emp_stage s
WHERE s.match_id IS NULL AND s.national_id IS NULL
  AND e.first_name = s.first_name AND e.last_name = s.last_name;

-- 4) Insert genuinely new employees not yet present
INSERT INTO public.employees (
  prefix, first_name, last_name, nickname, gender, national_id, birth_date, blood_group,
  id_expire_date, phone, address, home_address, dept, position, start_date, trial_end_date,
  contract_end_date, salary, status, marital_status, bank_account, children, sons, daughters)
SELECT COALESCE(s.prefix,''), COALESCE(s.first_name,''), COALESCE(s.last_name,''), COALESCE(s.nickname,''),
  COALESCE(s.gender,''), COALESCE(s.national_id,''), COALESCE(s.birth_date,''), COALESCE(s.blood_group,''),
  COALESCE(s.id_expire_date,''), COALESCE(s.phone,''), COALESCE(s.address,''), COALESCE(s.home_address,''),
  COALESCE(s.dept,''), COALESCE(s.position,''), COALESCE(s.start_date,''), COALESCE(s.trial_end_date,''),
  COALESCE(s.contract_end_date,''), COALESCE(s.salary,''), COALESCE(s.status,'active'), COALESCE(s.marital_status,''),
  COALESCE(s.bank_account,''), s.children, COALESCE(s.sons,0), COALESCE(s.daughters,0)
FROM public._emp_stage s
WHERE s.match_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE (s.national_id IS NOT NULL AND e.national_id = s.national_id)
       OR (s.national_id IS NULL AND e.first_name = s.first_name AND e.last_name = s.last_name)
  );

-- 5) Clean up staging table
DROP TABLE public._emp_stage;