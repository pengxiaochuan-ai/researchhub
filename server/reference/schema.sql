CREATE SCHEMA rh_reference
-- statement
CREATE TABLE rh_reference.administrative_division (
 dataset_version text NOT NULL,
 code char(6) NOT NULL CHECK(code ~ '^[0-9]{6}$'),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 source_name text NOT NULL,
 parent_code char(6),
 level smallint NOT NULL CHECK(level IN (1,2,3)),
 source_url text NOT NULL,
 source_sha256 char(64) NOT NULL CHECK(source_sha256 ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY(dataset_version,code),
 FOREIGN KEY(dataset_version,parent_code) REFERENCES rh_reference.administrative_division(dataset_version,code) DEFERRABLE INITIALLY DEFERRED,
 CHECK((level=1 AND parent_code IS NULL) OR (level IN (2,3) AND parent_code IS NOT NULL AND parent_code<>code))
)
-- statement
CREATE INDEX administrative_division_parent ON rh_reference.administrative_division(dataset_version,parent_code,code)
-- statement
REVOKE ALL ON rh_reference.administrative_division FROM PUBLIC
-- statement
GRANT USAGE ON SCHEMA rh_reference TO aisci_app
-- statement
GRANT SELECT ON rh_reference.administrative_division TO aisci_app
