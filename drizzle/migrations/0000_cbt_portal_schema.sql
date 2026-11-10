-- ROLES
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users can read own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.admin_exists()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where role = 'admin')
$$;
grant execute on function public.admin_exists() to anon, authenticated;

-- First account ever created becomes the admin
create or replace function public.handle_new_user_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created_role
  after insert on auth.users
  for each row execute function public.handle_new_user_role();

-- COURSES
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  slug text not null unique,
  title text not null,
  description text not null default '',
  reading_plan jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.courses to anon, authenticated;
grant all on public.courses to service_role;
alter table public.courses enable row level security;
create policy "Anyone can view courses" on public.courses for select to anon, authenticated using (true);

-- QUESTIONS (answers hidden from students; served via get_exam)
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  position int not null,
  question text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  correct_option text not null check (correct_option in ('A','B','C')),
  unique (course_id, position)
);
grant select on public.questions to authenticated;
grant all on public.questions to service_role;
alter table public.questions enable row level security;
create policy "Admins can view questions" on public.questions for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- STUDENTS
create table public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  matric_number text,
  created_at timestamptz not null default now()
);
create unique index students_matric_unique on public.students (lower(matric_number)) where matric_number is not null;
grant select on public.students to authenticated;
grant all on public.students to service_role;
alter table public.students enable row level security;
create policy "Admins can view students" on public.students for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- PINS
create table public.pins (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[0-9]{11}$'),
  status text not null default 'active' check (status in ('active','expired')),
  created_by uuid,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_by_student_id uuid references public.students(id) on delete set null,
  used_course_id uuid references public.courses(id) on delete set null
);
grant select on public.pins to authenticated;
grant all on public.pins to service_role;
alter table public.pins enable row level security;
create policy "Admins can view pins" on public.pins for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- EXAM SESSIONS
create table public.exam_sessions (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  pin_id uuid not null references public.pins(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress','submitted','timed_out'))
);
grant select on public.exam_sessions to authenticated;
grant all on public.exam_sessions to service_role;
alter table public.exam_sessions enable row level security;
create policy "Admins can view sessions" on public.exam_sessions for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- SCORES
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.exam_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  score int not null,
  correct_count int not null,
  total_questions int not null,
  auto_submitted boolean not null default false,
  submitted_at timestamptz not null default now()
);
grant select on public.scores to authenticated;
grant all on public.scores to service_role;
alter table public.scores enable row level security;
create policy "Admins can view scores" on public.scores for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ADMIN: generate unique random 11-digit pins
create or replace function public.generate_pins(_count int default 1)
returns setof public.pins language plpgsql volatile security definer set search_path = public as $$
declare
  _i int := 0;
  _code text;
  _row public.pins;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can generate PINs';
  end if;
  if _count < 1 or _count > 100 then
    raise exception 'You can generate between 1 and 100 PINs at a time';
  end if;
  while _i < _count loop
    _code := (10000000000 + (('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 15))::bit(60)::bigint % 90000000000))::text;
    insert into public.pins (code, created_by) values (_code, auth.uid())
      on conflict (code) do nothing
      returning * into _row;
    if _row.id is not null then
      _i := _i + 1;
      return next _row;
      _row := null;
    end if;
  end loop;
  return;
end;
$$;
revoke execute on function public.generate_pins(int) from public, anon;
grant execute on function public.generate_pins(int) to authenticated;

-- STUDENT: redeem a pin, register name, open a 20-minute session
create or replace function public.redeem_pin(_pin text, _full_name text, _matric text, _course_slug text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  _name text := btrim(coalesce(_full_name, ''));
  _mat text := nullif(upper(btrim(coalesce(_matric, ''))), '');
  _code text := btrim(coalesce(_pin, ''));
  _course_id uuid;
  _pin_id uuid;
  _student_id uuid;
  _session public.exam_sessions;
begin
  if length(_name) < 2 or length(_name) > 100 then
    raise exception 'Please enter your full name (2 to 100 characters)';
  end if;
  if _mat is not null and length(_mat) > 30 then
    raise exception 'Matric number is too long';
  end if;
  if _code !~ '^[0-9]{11}$' then
    raise exception 'PIN must be exactly 11 digits';
  end if;

  select id into _course_id from public.courses where slug = _course_slug;
  if _course_id is null then
    raise exception 'Course not found';
  end if;

  update public.pins set status = 'expired', used_at = now(), used_course_id = _course_id
    where code = _code and status = 'active'
    returning id into _pin_id;
  if _pin_id is null then
    raise exception 'This PIN is invalid or has already been used. Please get a new PIN from the admin.';
  end if;

  if _mat is not null then
    select id into _student_id from public.students where lower(matric_number) = lower(_mat);
    if _student_id is not null then
      update public.students set full_name = _name where id = _student_id;
    end if;
  end if;
  if _student_id is null then
    insert into public.students (full_name, matric_number) values (_name, _mat) returning id into _student_id;
  end if;

  update public.pins set used_by_student_id = _student_id where id = _pin_id;

  insert into public.exam_sessions (student_id, course_id, pin_id, expires_at)
    values (_student_id, _course_id, _pin_id, now() + interval '20 minutes')
    returning * into _session;

  return jsonb_build_object('token', _session.token, 'expires_at', _session.expires_at);
end;
$$;
grant execute on function public.redeem_pin(text, text, text, text) to anon, authenticated;

-- INTERNAL: grade a session and record the score (2 points per correct answer)
create or replace function public._finalize_exam(_session_id uuid, _auto boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  _s public.exam_sessions;
  _total int;
  _correct int;
begin
  select * into _s from public.exam_sessions where id = _session_id for update;
  if _s.status <> 'in_progress' then
    select jsonb_build_object('score', score, 'correct_count', correct_count, 'total_questions', total_questions, 'max_score', total_questions * 2, 'auto_submitted', auto_submitted)
      into strict _s.answers from public.scores where session_id = _session_id;
    return _s.answers;
  end if;

  select count(*) into _total from public.questions where course_id = _s.course_id;
  select count(*) into _correct from public.questions q
    where q.course_id = _s.course_id and (_s.answers ->> q.id::text) = q.correct_option;

  insert into public.scores (session_id, student_id, course_id, score, correct_count, total_questions, auto_submitted)
    values (_s.id, _s.student_id, _s.course_id, _correct * 2, _correct, _total, _auto);

  update public.exam_sessions
    set status = case when _auto then 'timed_out' else 'submitted' end, submitted_at = now()
    where id = _s.id;

  return jsonb_build_object('score', _correct * 2, 'correct_count', _correct, 'total_questions', _total, 'max_score', _total * 2, 'auto_submitted', _auto);
end;
$$;
revoke execute on function public._finalize_exam(uuid, boolean) from public, anon, authenticated;

-- STUDENT: load the workspace for an active session
create or replace function public.get_exam(_token uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  _s public.exam_sessions;
  _result jsonb;
begin
  select * into _s from public.exam_sessions where token = _token for update;
  if _s.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if _s.status = 'in_progress' and now() > _s.expires_at + interval '15 seconds' then
    _result := public._finalize_exam(_s.id, true);
    return jsonb_build_object('status', 'timed_out', 'result', _result);
  end if;

  if _s.status <> 'in_progress' then
    return jsonb_build_object('status', _s.status);
  end if;

  return jsonb_build_object(
    'status', 'in_progress',
    'server_now', now(),
    'started_at', _s.started_at,
    'expires_at', _s.expires_at,
    'answers', _s.answers,
    'student', (select jsonb_build_object('full_name', full_name, 'matric_number', matric_number) from public.students where id = _s.student_id),
    'course', (select jsonb_build_object('code', code, 'slug', slug, 'title', title, 'description', description, 'reading_plan', reading_plan) from public.courses where id = _s.course_id),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'position', position, 'question', question, 'a', option_a, 'b', option_b, 'c', option_c) order by position)
      from public.questions where course_id = _s.course_id
    ), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.get_exam(uuid) to anon, authenticated;

-- STUDENT: save one answer while time remains
create or replace function public.save_answer(_token uuid, _question_id uuid, _option text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  _s public.exam_sessions;
begin
  if _option not in ('A','B','C') then
    raise exception 'Invalid option';
  end if;
  select * into _s from public.exam_sessions where token = _token for update;
  if _s.id is null or _s.status <> 'in_progress' then
    raise exception 'This exam session has ended';
  end if;
  if now() > _s.expires_at then
    raise exception 'Time is up';
  end if;
  if not exists (select 1 from public.questions where id = _question_id and course_id = _s.course_id) then
    raise exception 'Question not found';
  end if;
  update public.exam_sessions
    set answers = answers || jsonb_build_object(_question_id::text, _option)
    where id = _s.id;
end;
$$;
grant execute on function public.save_answer(uuid, uuid, text) to anon, authenticated;

-- STUDENT: submit (manually or when the timer hits zero)
create or replace function public.submit_exam(_token uuid, _answers jsonb, _auto boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  _s public.exam_sessions;
  _clean jsonb;
begin
  select * into _s from public.exam_sessions where token = _token for update;
  if _s.id is null then
    raise exception 'Exam session not found';
  end if;

  if _s.status = 'in_progress' and now() <= _s.expires_at + interval '30 seconds' and _answers is not null and jsonb_typeof(_answers) = 'object' then
    select coalesce(jsonb_object_agg(q.id::text, _answers ->> q.id::text), '{}'::jsonb) into _clean
      from public.questions q
      where q.course_id = _s.course_id and (_answers ->> q.id::text) in ('A','B','C');
    update public.exam_sessions set answers = answers || _clean where id = _s.id;
  end if;

  return public._finalize_exam(_s.id, coalesce(_auto, false) or now() > _s.expires_at);
end;
$$;
grant execute on function public.submit_exam(uuid, jsonb, boolean) to anon, authenticated;

-- SEED COURSES
insert into public.courses (code, slug, title, sort_order) values
  ('GST 111', 'gst-111', 'Communication in English Language', 1),
  ('AMS 101', 'ams-101', 'Principles of Management', 2),
  ('AMS 103', 'ams-103', 'Introduction to Computer', 3),
  ('EHR 121', 'ehr-121', 'Introduction to Human Resource Management', 4),
  ('RSU-EHR 123', 'rsu-ehr-123', 'Sociology of Work in Industry', 5),
  ('RSU-EHR 111', 'rsu-ehr-111', 'Introduction to Financial Accounting', 6),
  ('RSU-EHR 113', 'rsu-ehr-113', 'Introduction to Finance', 7),
  ('RSU-EHR 115', 'rsu-ehr-115', 'Elements of Marketing', 8),
  ('RSU-LSM 101', 'rsu-lsm-101', 'Introduction to Logistics & Supply Chain Management', 9);
