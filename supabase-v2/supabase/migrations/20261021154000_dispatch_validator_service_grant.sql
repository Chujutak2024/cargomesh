-- Preserve canonical service-role intake after adding the invoker validator.
-- This pure validator has no table writes and does not grant business RPC access.
begin;
grant execute on function private.validate_dispatch_preferences(jsonb) to service_role;
commit;
