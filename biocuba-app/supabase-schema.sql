-- Colaboradores
create table if not exists colaboradores (
  id serial primary key,
  nombre text not null,
  apellido text,
  rut text,
  telefono text,
  local text,
  rol text default 'auxiliar',
  contrato text default 'indefinido',
  vencimiento_contrato date,
  fecha_ingreso date,
  horario text,
  tramos jsonb default '[]',
  hist_tramos jsonb default '[]',
  estado text default 'activo',
  ausencia text,
  ausencia_hasta date,
  nota text,
  bono_local_desde bigint,
  bono_local_incremento bigint,
  bono_local_monto bigint,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Períodos (meses)
create table if not exists periodos (
  id serial primary key,
  mes text not null,
  año int not null,
  mes_label text not null unique,
  cerrado boolean default false,
  created_at timestamptz default now()
);

-- Ventas auxiliares
create table if not exists ventas (
  id serial primary key,
  periodo_id int references periodos(id),
  colaborador_id int references colaboradores(id),
  local text,
  venta_bruta bigint default 0,
  venta_neta bigint default 0,
  bono bigint default 0,
  ticket_promedio bigint default 0,
  observacion text,
  created_at timestamptz default now()
);

-- Bonos QF titulares
create table if not exists bonos_qf (
  id serial primary key,
  periodo_id int references periodos(id),
  colaborador_id int references colaboradores(id),
  local text,
  meta_local bigint default 0,
  bono bigint default 0,
  pct_cumplimiento int,
  observacion text,
  created_at timestamptz default now()
);

-- QF complementarios
create table if not exists bonos_qfc (
  id serial primary key,
  periodo_id int references periodos(id),
  nombre text,
  local text,
  tipo text,
  cantidad numeric,
  monto bigint default 0,
  observacion text,
  created_at timestamptz default now()
);

-- Anticipos
create table if not exists anticipos (
  id serial primary key,
  periodo_id int references periodos(id),
  colaborador_id int references colaboradores(id),
  local text,
  tipo text,
  monto bigint default 0,
  observacion text,
  created_at timestamptz default now()
);

-- Horas extra
create table if not exists horas_extra (
  id serial primary key,
  periodo_id int references periodos(id),
  colaborador_id int references colaboradores(id),
  local text,
  cantidad numeric default 0,
  observacion text,
  created_at timestamptz default now()
);

-- Documentos por colaborador
create table if not exists documentos (
  id serial primary key,
  colaborador_id int references colaboradores(id),
  periodo_id int references periodos(id),
  tipo text, -- 'liquidacion', 'contrato', 'anexo', 'licencia', 'finiquito'
  nombre text,
  url text,
  storage_path text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table colaboradores enable row level security;
alter table periodos enable row level security;
alter table ventas enable row level security;
alter table bonos_qf enable row level security;
alter table bonos_qfc enable row level security;
alter table anticipos enable row level security;
alter table horas_extra enable row level security;
alter table documentos enable row level security;

-- Policies (allow all for now - will restrict with auth later)
create policy "Allow all" on colaboradores for all using (true);
create policy "Allow all" on periodos for all using (true);
create policy "Allow all" on ventas for all using (true);
create policy "Allow all" on bonos_qf for all using (true);
create policy "Allow all" on bonos_qfc for all using (true);
create policy "Allow all" on anticipos for all using (true);
create policy "Allow all" on horas_extra for all using (true);
create policy "Allow all" on documentos for all using (true);
