--
-- PostgreSQL database dump
--

\restrict He6HRSGV1Wb8Z6GmpS9NTyzXNdP4jEJ8FgxgxwpqXqYQmw9DDGPyPX0IP9F064i

-- Dumped from database version 13.23
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

--
-- Name: notify_log_inserted(); Type: FUNCTION; Schema: optsislog; Owner: optare3
--

CREATE FUNCTION optsislog.notify_log_inserted() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    row_count INTEGER;
    log_type TEXT := TG_ARGV[0];
BEGIN
    SELECT COUNT(*) INTO row_count FROM inserted_rows;

    PERFORM pg_notify(
        'log_inserted',
        json_build_object('log_type', log_type, 'count', row_count)::text
    );

    RETURN NULL;
END;
$$;


ALTER FUNCTION optsislog.notify_log_inserted() OWNER TO optare3;

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
-- Name: marcadores_leitura; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.marcadores_leitura (
    servidor text NOT NULL,
    canal text NOT NULL,
    ultimo_id_registro bigint NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE optsislog.marcadores_leitura OWNER TO optare3;

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
    save_response_body boolean DEFAULT false NOT NULL,
    CONSTRAINT monitored_urls_timeout_seconds_check CHECK ((timeout_seconds > 0))
);
ALTER TABLE ONLY optsislog.monitored_urls ALTER COLUMN save_response_body SET (pg_attver=36863825882000);


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
-- Name: network_client_sessions; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.network_client_sessions (
    id bigint NOT NULL,
    mac text NOT NULL,
    connected_at timestamp with time zone NOT NULL,
    disconnected_at timestamp with time zone,
    uplink_mac text,
    ip_address text
);
ALTER TABLE ONLY optsislog.network_client_sessions ALTER COLUMN id SET (pg_attver=36872251154880);
ALTER TABLE ONLY optsislog.network_client_sessions ALTER COLUMN mac SET (pg_attver=36872251154880);
ALTER TABLE ONLY optsislog.network_client_sessions ALTER COLUMN connected_at SET (pg_attver=36872251154880);
ALTER TABLE ONLY optsislog.network_client_sessions ALTER COLUMN disconnected_at SET (pg_attver=36872251154880);
ALTER TABLE ONLY optsislog.network_client_sessions ALTER COLUMN uplink_mac SET (pg_attver=36872251154880);
ALTER TABLE ONLY optsislog.network_client_sessions ALTER COLUMN ip_address SET (pg_attver=36872251154880);


ALTER TABLE optsislog.network_client_sessions OWNER TO optare3;

--
-- Name: network_client_sessions_id_seq; Type: SEQUENCE; Schema: optsislog; Owner: optare3
--

CREATE SEQUENCE optsislog.network_client_sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE optsislog.network_client_sessions_id_seq OWNER TO optare3;

--
-- Name: network_client_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: optsislog; Owner: optare3
--

ALTER SEQUENCE optsislog.network_client_sessions_id_seq OWNED BY optsislog.network_client_sessions.id;


--
-- Name: network_clients; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.network_clients (
    mac text NOT NULL,
    name text,
    hostname text,
    note text,
    ip_address text,
    vendor text,
    is_wired boolean DEFAULT false NOT NULL,
    is_guest boolean DEFAULT false NOT NULL,
    network_name text,
    uplink_mac text,
    ssid text,
    signal_dbm smallint,
    tx_bytes bigint,
    rx_bytes bigint,
    connected boolean DEFAULT true NOT NULL,
    connected_since timestamp with time zone,
    disconnected_at timestamp with time zone,
    first_seen_at timestamp with time zone,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY optsislog.network_clients ALTER COLUMN mac SET (pg_attver=36864333261448);
ALTER TABLE ONLY optsislog.network_clients ALTER COLUMN name SET (pg_attver=36864333261448);
ALTER TABLE ONLY optsislog.network_clients ALTER COLUMN hostname SET (pg_attver=36864333261448);
ALTER TABLE ONLY optsislog.network_clients ALTER COLUMN note SET (pg_attver=36864333261448);
ALTER TABLE ONLY optsislog.network_clients ALTER COLUMN ip_address SET (pg_attver=36864333261448);
ALTER TABLE ONLY optsislog.network_clients ALTER COLUMN vendor SET (pg_attver=36864333261448);
ALTER TABLE ONLY optsislog.network_clients ALTER COLUMN is_wired SET (pg_attver=36864333261448);
ALTER TABLE ONLY optsislog.network_clients ALTER COLUMN is_guest SET (pg_attver=36864333261448);
ALTER TABLE ONLY optsislog.network_clients ALTER COLUMN network_name SET (pg_attver=36864333261448);
ALTER TABLE ONLY optsislog.network_clients ALTER COLUMN uplink_mac SET (pg_attver=36864333261448);
ALTER TABLE ONLY optsislog.network_clients ALTER COLUMN ssid SET (pg_attver=36864333261448);
ALTER TABLE ONLY optsislog.network_clients ALTER COLUMN signal_dbm SET (pg_attver=36864333261448);
ALTER TABLE ONLY optsislog.network_clients ALTER COLUMN tx_bytes SET (pg_attver=36864333261448);
ALTER TABLE ONLY optsislog.network_clients ALTER COLUMN rx_bytes SET (pg_attver=36864333261448);
ALTER TABLE ONLY optsislog.network_clients ALTER COLUMN connected SET (pg_attver=36864333261448);
ALTER TABLE ONLY optsislog.network_clients ALTER COLUMN connected_since SET (pg_attver=36864333261448);
ALTER TABLE ONLY optsislog.network_clients ALTER COLUMN disconnected_at SET (pg_attver=36864333261448);
ALTER TABLE ONLY optsislog.network_clients ALTER COLUMN first_seen_at SET (pg_attver=36864333261448);
ALTER TABLE ONLY optsislog.network_clients ALTER COLUMN last_seen_at SET (pg_attver=36864333261448);


ALTER TABLE optsislog.network_clients OWNER TO optare3;

--
-- Name: network_devices; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.network_devices (
    mac text NOT NULL,
    unifi_id text,
    name text,
    model text,
    ip_address text,
    state text,
    firmware_version text,
    firmware_updatable boolean,
    features jsonb DEFAULT '[]'::jsonb NOT NULL,
    uptime_sec bigint,
    cpu_pct real,
    memory_pct real,
    uplink_tx_bps bigint,
    uplink_rx_bps bigint,
    last_heartbeat_at timestamp with time zone,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_polled_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY optsislog.network_devices ALTER COLUMN mac SET (pg_attver=36864333151840);
ALTER TABLE ONLY optsislog.network_devices ALTER COLUMN unifi_id SET (pg_attver=36864333151840);
ALTER TABLE ONLY optsislog.network_devices ALTER COLUMN name SET (pg_attver=36864333151840);
ALTER TABLE ONLY optsislog.network_devices ALTER COLUMN model SET (pg_attver=36864333151840);
ALTER TABLE ONLY optsislog.network_devices ALTER COLUMN ip_address SET (pg_attver=36864333151840);
ALTER TABLE ONLY optsislog.network_devices ALTER COLUMN state SET (pg_attver=36864333151840);
ALTER TABLE ONLY optsislog.network_devices ALTER COLUMN firmware_version SET (pg_attver=36864333151840);
ALTER TABLE ONLY optsislog.network_devices ALTER COLUMN firmware_updatable SET (pg_attver=36864333151840);
ALTER TABLE ONLY optsislog.network_devices ALTER COLUMN features SET (pg_attver=36864333151840);
ALTER TABLE ONLY optsislog.network_devices ALTER COLUMN uptime_sec SET (pg_attver=36864333151840);
ALTER TABLE ONLY optsislog.network_devices ALTER COLUMN cpu_pct SET (pg_attver=36864333151840);
ALTER TABLE ONLY optsislog.network_devices ALTER COLUMN memory_pct SET (pg_attver=36864333151840);
ALTER TABLE ONLY optsislog.network_devices ALTER COLUMN uplink_tx_bps SET (pg_attver=36864333151840);
ALTER TABLE ONLY optsislog.network_devices ALTER COLUMN uplink_rx_bps SET (pg_attver=36864333151840);
ALTER TABLE ONLY optsislog.network_devices ALTER COLUMN last_heartbeat_at SET (pg_attver=36864333151840);
ALTER TABLE ONLY optsislog.network_devices ALTER COLUMN first_seen_at SET (pg_attver=36864333151840);
ALTER TABLE ONLY optsislog.network_devices ALTER COLUMN last_polled_at SET (pg_attver=36864333151840);


ALTER TABLE optsislog.network_devices OWNER TO optare3;

--
-- Name: network_events; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.network_events (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    event_time timestamp with time zone,
    source_ip text,
    cef_version text,
    device_vendor text,
    device_product text,
    device_version text,
    signature_id text,
    name text,
    severity smallint,
    extension jsonb DEFAULT '{}'::jsonb NOT NULL,
    raw text NOT NULL
);
ALTER TABLE ONLY optsislog.network_events ALTER COLUMN id SET (pg_attver=36864054902456);
ALTER TABLE ONLY optsislog.network_events ALTER COLUMN created_at SET (pg_attver=36864054902456);
ALTER TABLE ONLY optsislog.network_events ALTER COLUMN event_time SET (pg_attver=36864054902456);
ALTER TABLE ONLY optsislog.network_events ALTER COLUMN source_ip SET (pg_attver=36864054902456);
ALTER TABLE ONLY optsislog.network_events ALTER COLUMN cef_version SET (pg_attver=36864054902456);
ALTER TABLE ONLY optsislog.network_events ALTER COLUMN device_vendor SET (pg_attver=36864054902456);
ALTER TABLE ONLY optsislog.network_events ALTER COLUMN device_product SET (pg_attver=36864054902456);
ALTER TABLE ONLY optsislog.network_events ALTER COLUMN device_version SET (pg_attver=36864054902456);
ALTER TABLE ONLY optsislog.network_events ALTER COLUMN signature_id SET (pg_attver=36864054902456);
ALTER TABLE ONLY optsislog.network_events ALTER COLUMN name SET (pg_attver=36864054902456);
ALTER TABLE ONLY optsislog.network_events ALTER COLUMN severity SET (pg_attver=36864054902456);
ALTER TABLE ONLY optsislog.network_events ALTER COLUMN extension SET (pg_attver=36864054902456);
ALTER TABLE ONLY optsislog.network_events ALTER COLUMN raw SET (pg_attver=36864054902456);


ALTER TABLE optsislog.network_events OWNER TO optare3;

--
-- Name: network_events_id_seq; Type: SEQUENCE; Schema: optsislog; Owner: optare3
--

CREATE SEQUENCE optsislog.network_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE optsislog.network_events_id_seq OWNER TO optare3;

--
-- Name: network_events_id_seq; Type: SEQUENCE OWNED BY; Schema: optsislog; Owner: optare3
--

ALTER SEQUENCE optsislog.network_events_id_seq OWNED BY optsislog.network_events.id;


--
-- Name: network_wan; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.network_wan (
    wan_group text NOT NULL,
    name text,
    isp_name text,
    ip_address text,
    is_up boolean,
    is_enabled boolean,
    failover_only boolean,
    availability_pct real,
    latency_ms real,
    rx_bps bigint,
    tx_bps bigint,
    gateway_mac text,
    last_polled_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY optsislog.network_wan ALTER COLUMN wan_group SET (pg_attver=36872251002664);
ALTER TABLE ONLY optsislog.network_wan ALTER COLUMN name SET (pg_attver=36872251002664);
ALTER TABLE ONLY optsislog.network_wan ALTER COLUMN isp_name SET (pg_attver=36872251002664);
ALTER TABLE ONLY optsislog.network_wan ALTER COLUMN ip_address SET (pg_attver=36872251002664);
ALTER TABLE ONLY optsislog.network_wan ALTER COLUMN is_up SET (pg_attver=36872251002664);
ALTER TABLE ONLY optsislog.network_wan ALTER COLUMN is_enabled SET (pg_attver=36872251002664);
ALTER TABLE ONLY optsislog.network_wan ALTER COLUMN failover_only SET (pg_attver=36872251002664);
ALTER TABLE ONLY optsislog.network_wan ALTER COLUMN availability_pct SET (pg_attver=36872251002664);
ALTER TABLE ONLY optsislog.network_wan ALTER COLUMN latency_ms SET (pg_attver=36872251002664);
ALTER TABLE ONLY optsislog.network_wan ALTER COLUMN rx_bps SET (pg_attver=36872251002664);
ALTER TABLE ONLY optsislog.network_wan ALTER COLUMN tx_bps SET (pg_attver=36872251002664);
ALTER TABLE ONLY optsislog.network_wan ALTER COLUMN gateway_mac SET (pg_attver=36872251002664);
ALTER TABLE ONLY optsislog.network_wan ALTER COLUMN last_polled_at SET (pg_attver=36872251002664);


ALTER TABLE optsislog.network_wan OWNER TO optare3;

--
-- Name: problemas_servidor; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.problemas_servidor (
    id bigint NOT NULL,
    servidor text NOT NULL,
    canal text NOT NULL,
    provedor text NOT NULL,
    id_evento integer NOT NULL,
    severidade smallint NOT NULL,
    status smallint DEFAULT 0 NOT NULL,
    total_ocorrencias integer DEFAULT 0 NOT NULL,
    reincidencias integer DEFAULT 0 NOT NULL,
    primeira_ocorrencia timestamp with time zone NOT NULL,
    ultima_ocorrencia timestamp with time zone NOT NULL,
    ultima_mensagem text,
    nota text,
    resolvido_em timestamp with time zone,
    versao integer DEFAULT 1 NOT NULL
);


ALTER TABLE optsislog.problemas_servidor OWNER TO optare3;

--
-- Name: problemas_servidor_id_seq; Type: SEQUENCE; Schema: optsislog; Owner: optare3
--

ALTER TABLE optsislog.problemas_servidor ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME optsislog.problemas_servidor_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


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
    monitored_url_id integer NOT NULL,
    response_body text
);
ALTER TABLE ONLY optsislog.site_availability ALTER COLUMN response_body SET (pg_attver=36863825851152);


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
-- Name: tokens_renovacao; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.tokens_renovacao (
    id bigint NOT NULL,
    usuario_id bigint NOT NULL,
    hash text NOT NULL,
    criado_em timestamp with time zone NOT NULL,
    expira_em timestamp with time zone NOT NULL,
    revogado_em timestamp with time zone,
    substituido_por_id bigint
);


ALTER TABLE optsislog.tokens_renovacao OWNER TO optare3;

--
-- Name: tokens_renovacao_id_seq; Type: SEQUENCE; Schema: optsislog; Owner: optare3
--

ALTER TABLE optsislog.tokens_renovacao ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME optsislog.tokens_renovacao_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


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
-- Name: usuarios_app; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.usuarios_app (
    id bigint NOT NULL,
    login text NOT NULL,
    nome text NOT NULL,
    hash_senha text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    ultimo_acesso_em timestamp with time zone
);


ALTER TABLE optsislog.usuarios_app OWNER TO optare3;

--
-- Name: usuarios_app_id_seq; Type: SEQUENCE; Schema: optsislog; Owner: optare3
--

ALTER TABLE optsislog.usuarios_app ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME optsislog.usuarios_app_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    record_id bigint
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
-- Name: network_client_sessions id; Type: DEFAULT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.network_client_sessions ALTER COLUMN id SET DEFAULT nextval('optsislog.network_client_sessions_id_seq'::regclass);


--
-- Name: network_events id; Type: DEFAULT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.network_events ALTER COLUMN id SET DEFAULT nextval('optsislog.network_events_id_seq'::regclass);


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
-- Name: marcadores_leitura marcadores_leitura_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.marcadores_leitura
    ADD CONSTRAINT marcadores_leitura_pkey PRIMARY KEY (servidor, canal);


--
-- Name: monitored_urls monitored_urls_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.monitored_urls
    ADD CONSTRAINT monitored_urls_pkey PRIMARY KEY (id);


--
-- Name: network_client_sessions network_client_sessions_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.network_client_sessions
    ADD CONSTRAINT network_client_sessions_pkey PRIMARY KEY (id);


--
-- Name: network_clients network_clients_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.network_clients
    ADD CONSTRAINT network_clients_pkey PRIMARY KEY (mac);


--
-- Name: network_devices network_devices_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.network_devices
    ADD CONSTRAINT network_devices_pkey PRIMARY KEY (mac);


--
-- Name: network_events network_events_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.network_events
    ADD CONSTRAINT network_events_pkey PRIMARY KEY (id);


--
-- Name: network_wan network_wan_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.network_wan
    ADD CONSTRAINT network_wan_pkey PRIMARY KEY (wan_group);


--
-- Name: problemas_servidor problemas_servidor_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.problemas_servidor
    ADD CONSTRAINT problemas_servidor_pkey PRIMARY KEY (id);


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
-- Name: tokens_renovacao tokens_renovacao_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.tokens_renovacao
    ADD CONSTRAINT tokens_renovacao_pkey PRIMARY KEY (id);


--
-- Name: problemas_servidor uq_problemas_servidor_assinatura; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.problemas_servidor
    ADD CONSTRAINT uq_problemas_servidor_assinatura UNIQUE (servidor, canal, provedor, id_evento);


--
-- Name: tokens_renovacao uq_tokens_renovacao_hash; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.tokens_renovacao
    ADD CONSTRAINT uq_tokens_renovacao_hash UNIQUE (hash);


--
-- Name: usuarios_app uq_usuarios_app_login; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.usuarios_app
    ADD CONSTRAINT uq_usuarios_app_login UNIQUE (login);


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
-- Name: usuarios_app usuarios_app_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.usuarios_app
    ADD CONSTRAINT usuarios_app_pkey PRIMARY KEY (id);


--
-- Name: windows_event_logs windows_event_logs_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.windows_event_logs
    ADD CONSTRAINT windows_event_logs_pkey PRIMARY KEY (id);


--
-- Name: idx_network_client_sessions_mac; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX idx_network_client_sessions_mac ON optsislog.network_client_sessions USING btree (mac, connected_at DESC);


--
-- Name: idx_network_clients_connected; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX idx_network_clients_connected ON optsislog.network_clients USING btree (connected, last_seen_at DESC);


--
-- Name: idx_network_events_created_at; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX idx_network_events_created_at ON optsislog.network_events USING btree (created_at DESC);


--
-- Name: idx_network_events_signature_id; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX idx_network_events_signature_id ON optsislog.network_events USING btree (signature_id);


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
-- Name: ix_problemas_servidor_pendentes; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX ix_problemas_servidor_pendentes ON optsislog.problemas_servidor USING btree (status, severidade, ultima_ocorrencia DESC);


--
-- Name: ix_refresh_tokens_token_hash; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX ix_refresh_tokens_token_hash ON optsislog.refresh_tokens USING btree (token_hash);


--
-- Name: ix_tokens_renovacao_usuario_ativos; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX ix_tokens_renovacao_usuario_ativos ON optsislog.tokens_renovacao USING btree (usuario_id) WHERE (revogado_em IS NULL);


--
-- Name: ix_windows_event_logs_assinatura; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX ix_windows_event_logs_assinatura ON optsislog.windows_event_logs USING btree (computer, channel, provider, event_id, time_created DESC);


--
-- Name: uq_network_client_sessions_open; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE UNIQUE INDEX uq_network_client_sessions_open ON optsislog.network_client_sessions USING btree (mac) WHERE (disconnected_at IS NULL);


--
-- Name: ux_windows_event_logs_registro; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE UNIQUE INDEX ux_windows_event_logs_registro ON optsislog.windows_event_logs USING btree (computer, channel, record_id) WHERE (record_id IS NOT NULL);


--
-- Name: app_logs app_logs_notify; Type: TRIGGER; Schema: optsislog; Owner: optare3
--

CREATE TRIGGER app_logs_notify AFTER INSERT ON optsislog.app_logs REFERENCING NEW TABLE AS inserted_rows FOR EACH STATEMENT EXECUTE FUNCTION optsislog.notify_log_inserted('app');


--
-- Name: process_logs process_logs_notify; Type: TRIGGER; Schema: optsislog; Owner: optare3
--

CREATE TRIGGER process_logs_notify AFTER INSERT ON optsislog.process_logs REFERENCING NEW TABLE AS inserted_rows FOR EACH STATEMENT EXECUTE FUNCTION optsislog.notify_log_inserted('process');


--
-- Name: windows_event_logs windows_event_logs_notify; Type: TRIGGER; Schema: optsislog; Owner: optare3
--

CREATE TRIGGER windows_event_logs_notify AFTER INSERT ON optsislog.windows_event_logs REFERENCING NEW TABLE AS inserted_rows FOR EACH STATEMENT EXECUTE FUNCTION optsislog.notify_log_inserted('windows-event');


--
-- Name: site_availability site_availability_monitored_url_id_fkey; Type: FK CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.site_availability
    ADD CONSTRAINT site_availability_monitored_url_id_fkey FOREIGN KEY (monitored_url_id) REFERENCES optsislog.monitored_urls(id);


--
-- Name: tokens_renovacao tokens_renovacao_substituido_por_id_fkey; Type: FK CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.tokens_renovacao
    ADD CONSTRAINT tokens_renovacao_substituido_por_id_fkey FOREIGN KEY (substituido_por_id) REFERENCES optsislog.tokens_renovacao(id);


--
-- Name: tokens_renovacao tokens_renovacao_usuario_id_fkey; Type: FK CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.tokens_renovacao
    ADD CONSTRAINT tokens_renovacao_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES optsislog.usuarios_app(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict He6HRSGV1Wb8Z6GmpS9NTyzXNdP4jEJ8FgxgxwpqXqYQmw9DDGPyPX0IP9F064i

