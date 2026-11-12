-- Only the designated portal owner email can ever hold the admin role
create or replace function public.handle_new_user_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) = 'eminentbusinesshubhotmail@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

-- Strip admin from any account that is not the designated email
delete from public.user_roles r
using auth.users u
where r.user_id = u.id
  and r.role = 'admin'
  and lower(u.email) <> 'eminentbusinesshubhotmail@gmail.com';

-- Make sure the designated account (if it exists) is admin
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where lower(email) = 'eminentbusinesshubhotmail@gmail.com'
on conflict (user_id, role) do nothing;