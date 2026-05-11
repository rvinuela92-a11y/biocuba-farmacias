# BioCuba Farmacia — Sistema de Gestión de Sueldos

## Configuración inicial

### 1. Crear las tablas en Supabase
1. Vaya a https://supabase.com/dashboard/project/pvttkbweqgjbrhwvabnp/sql/new
2. Copie y pegue el contenido de `supabase-schema.sql`
3. Clic en "Run"

### 2. Variables de entorno en Vercel
Al conectar con Vercel agregar:
- `NEXT_PUBLIC_SUPABASE_URL` = https://pvttkbweqgjbrhwvabnp.supabase.co
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (su clave anon de Supabase)

## Desarrollo local
```bash
npm install
npm run dev
```

## Despliegue
Conectar este repositorio a Vercel y se despliega automáticamente.
