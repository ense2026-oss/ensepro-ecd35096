CREATE TABLE public._emp_stage (
  match_id uuid,
  prefix text, first_name text, last_name text, nickname text, gender text,
  national_id text, birth_date text, blood_group text, id_expire_date text,
  phone text, address text, home_address text, dept text, position text,
  start_date text, trial_end_date text, contract_end_date text, salary text,
  status text, marital_status text, bank_account text,
  children int, sons int, daughters int
);
GRANT INSERT, SELECT, TRUNCATE, DELETE ON public._emp_stage TO sandbox_exec;
ALTER TABLE public._emp_stage ENABLE ROW LEVEL SECURITY;