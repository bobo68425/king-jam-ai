--
-- PostgreSQL database dump
--

\restrict N9nv7hl4LWcLiLPYgXcXRyNYn5R5KrSB5YsUvhXo3ZJqOmvNaik0sxL1j6V8JrB

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: kingjam
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO kingjam;

--
-- Name: users; Type: TABLE; Schema: public; Owner: kingjam
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying NOT NULL,
    hashed_password character varying,
    full_name character varying,
    avatar_url character varying,
    is_active boolean,
    is_superuser boolean,
    tier character varying,
    credits integer,
    provider character varying,
    social_id character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


ALTER TABLE public.users OWNER TO kingjam;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: kingjam
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO kingjam;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kingjam
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: kingjam
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: kingjam
--

COPY public.alembic_version (version_num) FROM stdin;
fc961a1c48d5
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: kingjam
--

COPY public.users (id, email, hashed_password, full_name, avatar_url, is_active, is_superuser, tier, credits, provider, social_id, created_at, updated_at) FROM stdin;
1	admin@kingjam.com	$2b$12$A9qlm/CtFTW3B.0.B6M6Ou0BuvU8LAzkF6RXysTOMRwZPsllr4Fpy	King Jam Admin	\N	t	f	free	89	local	\N	2026-01-06 21:48:34.687585+00	2026-01-06 22:20:59.413342+00
\.


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kingjam
--

SELECT pg_catalog.setval('public.users_id_seq', 1, true);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: kingjam
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: kingjam
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: kingjam
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: kingjam
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- Name: ix_users_social_id; Type: INDEX; Schema: public; Owner: kingjam
--

CREATE INDEX ix_users_social_id ON public.users USING btree (social_id);


--
-- PostgreSQL database dump complete
--

\unrestrict N9nv7hl4LWcLiLPYgXcXRyNYn5R5KrSB5YsUvhXo3ZJqOmvNaik0sxL1j6V8JrB

