CREATE OR REPLACE FUNCTION after_test_func(integer) RETURNS integer
AS $$
  SELECT $1;
$$
LANGUAGE SQL
IMMUTABLE
RETURNS NULL ON NULL INPUT;