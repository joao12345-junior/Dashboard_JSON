--
-- PostgreSQL database dump
--

\restrict NsdPA5Oa47Be9CDsunXkLhv1VUq0iaEE0I9FumdQI6AIN7bkKSLOqDH58o20tL5

-- Dumped from database version 13.20
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: optsislog; Type: SCHEMA; Schema: -; Owner: optare3
--

CREATE SCHEMA optsislog;


ALTER SCHEMA optsislog OWNER TO optare3;

--
-- Name: criticality_level; Type: TYPE; Schema: optsislog; Owner: optare3
--

CREATE TYPE optsislog.criticality_level AS ENUM (
    'High',
    'Medium',
    'Low',
    'Unknown'
);


ALTER TYPE optsislog.criticality_level OWNER TO optare3;

--
-- Name: cleanup_refresh_tokens(); Type: FUNCTION; Schema: optsislog; Owner: optare3
--

CREATE FUNCTION optsislog.cleanup_refresh_tokens() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM optsislog.refresh_tokens
    WHERE expires_at < now()
       OR revoked_at < now() - INTERVAL '30 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION optsislog.cleanup_refresh_tokens() OWNER TO optare3;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_logs; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.app_logs (
    id bigint NOT NULL,
    classe character varying(100) NOT NULL,
    tipo character varying(10) NOT NULL,
    mensagem text NOT NULL,
    detalhes text,
    ocorrido_em timestamp with time zone NOT NULL,
    coletado_em timestamp with time zone DEFAULT now() NOT NULL,
    programa text,
    CONSTRAINT app_logs_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['debug'::character varying, 'info'::character varying, 'aviso'::character varying, 'erro'::character varying])::text[])))
);


ALTER TABLE optsislog.app_logs OWNER TO optare3;

--
-- Name: app_logs_id_seq; Type: SEQUENCE; Schema: optsislog; Owner: optare3
--

CREATE SEQUENCE optsislog.app_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE optsislog.app_logs_id_seq OWNER TO optare3;

--
-- Name: app_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: optsislog; Owner: optare3
--

ALTER SEQUENCE optsislog.app_logs_id_seq OWNED BY optsislog.app_logs.id;


--
-- Name: monitored_urls; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.monitored_urls (
    id integer NOT NULL,
    label text NOT NULL,
    url character varying(500) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    timeout_seconds integer DEFAULT 10 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    has_sentry boolean DEFAULT false NOT NULL,
    CONSTRAINT monitored_urls_timeout_seconds_check CHECK ((timeout_seconds > 0))
);


ALTER TABLE optsislog.monitored_urls OWNER TO optare3;

--
-- Name: monitored_urls_id_seq; Type: SEQUENCE; Schema: optsislog; Owner: optare3
--

CREATE SEQUENCE optsislog.monitored_urls_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE optsislog.monitored_urls_id_seq OWNER TO optare3;

--
-- Name: monitored_urls_id_seq; Type: SEQUENCE OWNED BY; Schema: optsislog; Owner: optare3
--

ALTER SEQUENCE optsislog.monitored_urls_id_seq OWNED BY optsislog.monitored_urls.id;


--
-- Name: process_logs; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.process_logs (
    id bigint NOT NULL,
    message text NOT NULL,
    log_date date NOT NULL,
    log_time time without time zone NOT NULL,
    start smallint NOT NULL,
    source_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE optsislog.process_logs OWNER TO optare3;

--
-- Name: process_logs_id_seq; Type: SEQUENCE; Schema: optsislog; Owner: optare3
--

CREATE SEQUENCE optsislog.process_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE optsislog.process_logs_id_seq OWNER TO optare3;

--
-- Name: process_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: optsislog; Owner: optare3
--

ALTER SEQUENCE optsislog.process_logs_id_seq OWNED BY optsislog.process_logs.id;


--
-- Name: refresh_tokens; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.refresh_tokens (
    id bigint NOT NULL,
    username character varying(100) NOT NULL,
    token_hash character varying(64) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone
);


ALTER TABLE optsislog.refresh_tokens OWNER TO optare3;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: optsislog; Owner: optare3
--

CREATE SEQUENCE optsislog.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE optsislog.refresh_tokens_id_seq OWNER TO optare3;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: optsislog; Owner: optare3
--

ALTER SEQUENCE optsislog.refresh_tokens_id_seq OWNED BY optsislog.refresh_tokens.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.schema_migrations (
    filename text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE optsislog.schema_migrations OWNER TO optare3;

--
-- Name: sentry_events; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.sentry_events (
    id text NOT NULL,
    title text,
    level text,
    culprit text,
    first_seen timestamp with time zone,
    last_seen timestamp with time zone,
    count integer,
    synced_at timestamp with time zone DEFAULT now() NOT NULL,
    permalink text
);


ALTER TABLE optsislog.sentry_events OWNER TO optare3;

--
-- Name: site_availability; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.site_availability (
    id bigint NOT NULL,
    url text NOT NULL,
    status_code integer,
    response_time_ms integer,
    is_up boolean NOT NULL,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    monitored_url_id integer NOT NULL
);


ALTER TABLE optsislog.site_availability OWNER TO optare3;

--
-- Name: site_availability_id_seq; Type: SEQUENCE; Schema: optsislog; Owner: optare3
--

CREATE SEQUENCE optsislog.site_availability_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE optsislog.site_availability_id_seq OWNER TO optare3;

--
-- Name: site_availability_id_seq; Type: SEQUENCE OWNED BY; Schema: optsislog; Owner: optare3
--

ALTER SEQUENCE optsislog.site_availability_id_seq OWNED BY optsislog.site_availability.id;


--
-- Name: users; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.users (
    id bigint NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE optsislog.users OWNER TO optare3;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: optsislog; Owner: optare3
--

CREATE SEQUENCE optsislog.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE optsislog.users_id_seq OWNER TO optare3;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: optsislog; Owner: optare3
--

ALTER SEQUENCE optsislog.users_id_seq OWNED BY optsislog.users.id;


--
-- Name: windows_event_logs; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.windows_event_logs (
    id bigint NOT NULL,
    event_id integer NOT NULL,
    level smallint,
    level_label text,
    provider text,
    computer text,
    channel text,
    time_created timestamp with time zone NOT NULL,
    message text,
    criticality optsislog.criticality_level,
    summary text,
    source_file text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE optsislog.windows_event_logs OWNER TO optare3;

--
-- Name: windows_event_logs_id_seq; Type: SEQUENCE; Schema: optsislog; Owner: optare3
--

CREATE SEQUENCE optsislog.windows_event_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE optsislog.windows_event_logs_id_seq OWNER TO optare3;

--
-- Name: windows_event_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: optsislog; Owner: optare3
--

ALTER SEQUENCE optsislog.windows_event_logs_id_seq OWNED BY optsislog.windows_event_logs.id;


--
-- Name: app_logs id; Type: DEFAULT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.app_logs ALTER COLUMN id SET DEFAULT nextval('optsislog.app_logs_id_seq'::regclass);


--
-- Name: monitored_urls id; Type: DEFAULT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.monitored_urls ALTER COLUMN id SET DEFAULT nextval('optsislog.monitored_urls_id_seq'::regclass);


--
-- Name: process_logs id; Type: DEFAULT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.process_logs ALTER COLUMN id SET DEFAULT nextval('optsislog.process_logs_id_seq'::regclass);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('optsislog.refresh_tokens_id_seq'::regclass);


--
-- Name: site_availability id; Type: DEFAULT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.site_availability ALTER COLUMN id SET DEFAULT nextval('optsislog.site_availability_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.users ALTER COLUMN id SET DEFAULT nextval('optsislog.users_id_seq'::regclass);


--
-- Name: windows_event_logs id; Type: DEFAULT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.windows_event_logs ALTER COLUMN id SET DEFAULT nextval('optsislog.windows_event_logs_id_seq'::regclass);


--
-- Name: app_logs app_logs_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.app_logs
    ADD CONSTRAINT app_logs_pkey PRIMARY KEY (id);


--
-- Name: monitored_urls monitored_urls_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.monitored_urls
    ADD CONSTRAINT monitored_urls_pkey PRIMARY KEY (id);


--
-- Name: process_logs process_logs_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.process_logs
    ADD CONSTRAINT process_logs_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (filename);


--
-- Name: sentry_events sentry_events_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.sentry_events
    ADD CONSTRAINT sentry_events_pkey PRIMARY KEY (id);


--
-- Name: site_availability site_availability_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.site_availability
    ADD CONSTRAINT site_availability_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: windows_event_logs windows_event_logs_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.windows_event_logs
    ADD CONSTRAINT windows_event_logs_pkey PRIMARY KEY (id);


--
-- Name: idx_process_logs_date_time; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX idx_process_logs_date_time ON optsislog.process_logs USING btree (log_date DESC, log_time DESC);


--
-- Name: idx_process_logs_source_name; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX idx_process_logs_source_name ON optsislog.process_logs USING btree (source_name);


--
-- Name: idx_site_availability_checked_at; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX idx_site_availability_checked_at ON optsislog.site_availability USING btree (checked_at DESC);


--
-- Name: idx_site_availability_monitored_url_id; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX idx_site_availability_monitored_url_id ON optsislog.site_availability USING btree (monitored_url_id);


--
-- Name: idx_windows_event_logs_time_created; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX idx_windows_event_logs_time_created ON optsislog.windows_event_logs USING btree (time_created DESC);


--
-- Name: ix_app_logs_ocorrido; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX ix_app_logs_ocorrido ON optsislog.app_logs USING btree (ocorrido_em DESC);


--
-- Name: ix_refresh_tokens_token_hash; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX ix_refresh_tokens_token_hash ON optsislog.refresh_tokens USING btree (token_hash);


--
-- Name: site_availability site_availability_monitored_url_id_fkey; Type: FK CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.site_availability
    ADD CONSTRAINT site_availability_monitored_url_id_fkey FOREIGN KEY (monitored_url_id) REFERENCES optsislog.monitored_urls(id);


--
-- PostgreSQL database dump complete
--

\unrestrict NsdPA5Oa47Be9CDsunXkLhv1VUq0iaEE0I9FumdQI6AIN7bkKSLOqDH58o20tL5

