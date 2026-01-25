--
-- PostgreSQL database dump
--

\restrict HEMATT4HavA954NNQkGuyLGKtkAfsmdJDlLQa6kCWiEu603iQNEyjReY4dJJ9qE

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
-- Name: posts; Type: TABLE; Schema: public; Owner: kingjam
--

CREATE TABLE public.posts (
    id integer NOT NULL,
    title character varying,
    content text,
    status character varying,
    user_id integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


ALTER TABLE public.posts OWNER TO kingjam;

--
-- Name: posts_id_seq; Type: SEQUENCE; Schema: public; Owner: kingjam
--

CREATE SEQUENCE public.posts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.posts_id_seq OWNER TO kingjam;

--
-- Name: posts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kingjam
--

ALTER SEQUENCE public.posts_id_seq OWNED BY public.posts.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: kingjam
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying NOT NULL,
    hashed_password character varying,
    full_name character varying,
    is_active boolean,
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
-- Name: posts id; Type: DEFAULT; Schema: public; Owner: kingjam
--

ALTER TABLE ONLY public.posts ALTER COLUMN id SET DEFAULT nextval('public.posts_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: kingjam
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: kingjam
--

COPY public.alembic_version (version_num) FROM stdin;
f49eac87126b
\.


--
-- Data for Name: posts; Type: TABLE DATA; Schema: public; Owner: kingjam
--

COPY public.posts (id, title, content, status, user_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: kingjam
--

COPY public.users (id, email, hashed_password, full_name, is_active, tier, credits, provider, social_id, created_at, updated_at) FROM stdin;
1	admin@kingjam.com	$2b$12$XoMuGBGOWLH4JN8Sfj5nCeq6FCHWwIDop0S3E8BzchlbVk2c0PJNC	Admin	t	free	15389	local	\N	2026-01-08 10:46:32.290115+00	2026-01-08 22:17:53.339671+00
\.


--
-- Name: posts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kingjam
--

SELECT pg_catalog.setval('public.posts_id_seq', 9, true);


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
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: kingjam
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: kingjam
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ix_posts_id; Type: INDEX; Schema: public; Owner: kingjam
--

CREATE INDEX ix_posts_id ON public.posts USING btree (id);


--
-- Name: ix_posts_title; Type: INDEX; Schema: public; Owner: kingjam
--

CREATE INDEX ix_posts_title ON public.posts USING btree (title);


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
-- Name: posts posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kingjam
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict HEMATT4HavA954NNQkGuyLGKtkAfsmdJDlLQa6kCWiEu603iQNEyjReY4dJJ9qE

