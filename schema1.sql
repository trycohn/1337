--
-- PostgreSQL database cluster dump
--

-- Started on 2025-03-09 11:58:22

SET default_transaction_read_only = off;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

--
-- Roles
--

CREATE ROLE postgres;
ALTER ROLE postgres WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:ARpnyBB2jf7+JmLimvnn0A==$xfPaPfCj3miYTwHOc5YuY0W2GK8nsy7gRrjPGJnwuW0=:LlIIfppCY3zfOfDB+RaUIilpigWSpIzeCDyoGsPETHg=';
CREATE ROLE userdb;
ALTER ROLE userdb WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN NOREPLICATION NOBYPASSRLS;

--
-- User Configurations
--






--
-- Databases
--

--
-- Database "template1" dump
--

\connect template1

