# Script de inicialización de PostgreSQL para Nexos ERP
# Se ejecuta una sola vez cuando el contenedor es creado por primera vez.

-- Crear base de datos shadow para Prisma Migrate
CREATE DATABASE nexos_shadow
    OWNER nexos
    ENCODING 'UTF8'
    LC_COLLATE 'C'
    LC_CTYPE 'C';

-- Extensiones requeridas en la BD principal
\c nexos;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- Búsqueda fuzzy por nombre/SKU
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid() como alternativa

-- Configuración de búsqueda de texto
ALTER DATABASE nexos SET pg_trgm.similarity_threshold = 0.3;

-- Extensiones en shadow DB
\c nexos_shadow;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
