-- DMS: select postgres, use AUTOCOMMIT. Execute ONLY this statement.
-- Do not wrap CREATE DATABASE in BEGIN, a DO block, or a transaction batch.
CREATE DATABASE researchhub OWNER researchhub_demo_owner ENCODING 'UTF8' TEMPLATE template0 CONNECTION LIMIT 20;
