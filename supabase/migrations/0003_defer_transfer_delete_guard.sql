-- Allow a transfer record and its required detail row to be deleted together.
-- Direct detail-only deletes remain rejected when the transaction commits.

drop trigger if exists transfer_details_delete_guard on public.transfer_details;

create constraint trigger transfer_details_delete_guard
after delete on public.transfer_details
deferrable initially deferred
for each row execute function public.prevent_transfer_details_delete();
