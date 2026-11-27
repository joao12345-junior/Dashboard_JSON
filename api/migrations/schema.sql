--
-- PostgreSQL database dump
--

\restrict ckrrZ4WQcTmKhegeyz2joiv7LKod0aqXXQ1RbpyCF2CGQhgR13OX82Fd8BDqOW0

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
-- Name: app_programs; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.app_programs (
    programa text NOT NULL,
    visibility text,
    visibility_changed_at timestamp with time zone,
    last_log_at timestamp with time zone,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT app_programs_visibility_check CHECK ((visibility = ANY (ARRAY['shown'::text, 'hidden'::text])))
);
ALTER TABLE ONLY optsislog.app_programs ALTER COLUMN programa SET (pg_attver=36872836695424);
ALTER TABLE ONLY optsislog.app_programs ALTER COLUMN visibility SET (pg_attver=36872836695424);
ALTER TABLE ONLY optsislog.app_programs ALTER COLUMN visibility_changed_at SET (pg_attver=36872836695424);
ALTER TABLE ONLY optsislog.app_programs ALTER COLUMN last_log_at SET (pg_attver=36872836695424);
ALTER TABLE ONLY optsislog.app_programs ALTER COLUMN first_seen_at SET (pg_attver=36872836695424);


ALTER TABLE optsislog.app_programs OWNER TO optare3;

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
-- Name: network_device_samples; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.network_device_samples (
    mac text NOT NULL,
    sampled_at timestamp with time zone NOT NULL,
    cpu_pct real,
    memory_pct real
);
ALTER TABLE ONLY optsislog.network_device_samples ALTER COLUMN mac SET (pg_attver=36873725560720);
ALTER TABLE ONLY optsislog.network_device_samples ALTER COLUMN sampled_at SET (pg_attver=36873725560720);
ALTER TABLE ONLY optsislog.network_device_samples ALTER COLUMN cpu_pct SET (pg_attver=36873725560720);
ALTER TABLE ONLY optsislog.network_device_samples ALTER COLUMN memory_pct SET (pg_attver=36873725560720);


ALTER TABLE optsislog.network_device_samples OWNER TO optare3;

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
-- Name: network_top_apps; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.network_top_apps (
    period text NOT NULL,
    rank smallint NOT NULL,
    application_id integer NOT NULL,
    category_id integer NOT NULL,
    name text,
    category text,
    bytes bigint NOT NULL,
    fetched_at timestamp with time zone NOT NULL,
    CONSTRAINT network_top_apps_period_check CHECK ((period = ANY (ARRAY['hour'::text, 'day'::text])))
);
ALTER TABLE ONLY optsislog.network_top_apps ALTER COLUMN period SET (pg_attver=36873506264560);
ALTER TABLE ONLY optsislog.network_top_apps ALTER COLUMN rank SET (pg_attver=36873506264560);
ALTER TABLE ONLY optsislog.network_top_apps ALTER COLUMN application_id SET (pg_attver=36873506264560);
ALTER TABLE ONLY optsislog.network_top_apps ALTER COLUMN category_id SET (pg_attver=36873506264560);
ALTER TABLE ONLY optsislog.network_top_apps ALTER COLUMN name SET (pg_attver=36873506264560);
ALTER TABLE ONLY optsislog.network_top_apps ALTER COLUMN category SET (pg_attver=36873506264560);
ALTER TABLE ONLY optsislog.network_top_apps ALTER COLUMN bytes SET (pg_attver=36873506264560);
ALTER TABLE ONLY optsislog.network_top_apps ALTER COLUMN fetched_at SET (pg_attver=36873506264560);


ALTER TABLE optsislog.network_top_apps OWNER TO optare3;

--
-- Name: network_vpn_clients; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.network_vpn_clients (
    client_key text NOT NULL,
    username text NOT NULL,
    vpn_type text,
    interface text,
    tunnel_ip text,
    remote_ip text,
    rx_bytes bigint,
    tx_bytes bigint,
    connected boolean DEFAULT true NOT NULL,
    connected_since timestamp with time zone,
    disconnected_at timestamp with time zone,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone NOT NULL
);
ALTER TABLE ONLY optsislog.network_vpn_clients ALTER COLUMN client_key SET (pg_attver=36873475270312);
ALTER TABLE ONLY optsislog.network_vpn_clients ALTER COLUMN username SET (pg_attver=36873475270312);
ALTER TABLE ONLY optsislog.network_vpn_clients ALTER COLUMN vpn_type SET (pg_attver=36873475270312);
ALTER TABLE ONLY optsislog.network_vpn_clients ALTER COLUMN interface SET (pg_attver=36873475270312);
ALTER TABLE ONLY optsislog.network_vpn_clients ALTER COLUMN tunnel_ip SET (pg_attver=36873475270312);
ALTER TABLE ONLY optsislog.network_vpn_clients ALTER COLUMN remote_ip SET (pg_attver=36873475270312);
ALTER TABLE ONLY optsislog.network_vpn_clients ALTER COLUMN rx_bytes SET (pg_attver=36873475270312);
ALTER TABLE ONLY optsislog.network_vpn_clients ALTER COLUMN tx_bytes SET (pg_attver=36873475270312);
ALTER TABLE ONLY optsislog.network_vpn_clients ALTER COLUMN connected SET (pg_attver=36873475270312);
ALTER TABLE ONLY optsislog.network_vpn_clients ALTER COLUMN connected_since SET (pg_attver=36873475270312);
ALTER TABLE ONLY optsislog.network_vpn_clients ALTER COLUMN disconnected_at SET (pg_attver=36873475270312);
ALTER TABLE ONLY optsislog.network_vpn_clients ALTER COLUMN first_seen_at SET (pg_attver=36873475270312);
ALTER TABLE ONLY optsislog.network_vpn_clients ALTER COLUMN last_seen_at SET (pg_attver=36873475270312);


ALTER TABLE optsislog.network_vpn_clients OWNER TO optare3;

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
-- Name: network_wan_quality; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.network_wan_quality (
    wan_group text NOT NULL,
    sampled_at timestamp with time zone NOT NULL,
    packet_loss_pct real,
    latency_avg_ms real,
    latency_min_ms real,
    latency_max_ms real
);
ALTER TABLE ONLY optsislog.network_wan_quality ALTER COLUMN wan_group SET (pg_attver=36873778569752);
ALTER TABLE ONLY optsislog.network_wan_quality ALTER COLUMN sampled_at SET (pg_attver=36873778569752);
ALTER TABLE ONLY optsislog.network_wan_quality ALTER COLUMN packet_loss_pct SET (pg_attver=36873778569752);
ALTER TABLE ONLY optsislog.network_wan_quality ALTER COLUMN latency_avg_ms SET (pg_attver=36873778569752);
ALTER TABLE ONLY optsislog.network_wan_quality ALTER COLUMN latency_min_ms SET (pg_attver=36873778569752);
ALTER TABLE ONLY optsislog.network_wan_quality ALTER COLUMN latency_max_ms SET (pg_attver=36873778569752);


ALTER TABLE optsislog.network_wan_quality OWNER TO optare3;

--
-- Name: network_wan_samples; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.network_wan_samples (
    wan_group text NOT NULL,
    sampled_at timestamp with time zone NOT NULL,
    is_up boolean,
    latency_ms real,
    rx_bps bigint,
    tx_bps bigint
);
ALTER TABLE ONLY optsislog.network_wan_samples ALTER COLUMN wan_group SET (pg_attver=36873315125824);
ALTER TABLE ONLY optsislog.network_wan_samples ALTER COLUMN sampled_at SET (pg_attver=36873315125824);
ALTER TABLE ONLY optsislog.network_wan_samples ALTER COLUMN is_up SET (pg_attver=36873315125824);
ALTER TABLE ONLY optsislog.network_wan_samples ALTER COLUMN latency_ms SET (pg_attver=36873315125824);
ALTER TABLE ONLY optsislog.network_wan_samples ALTER COLUMN rx_bps SET (pg_attver=36873315125824);
ALTER TABLE ONLY optsislog.network_wan_samples ALTER COLUMN tx_bps SET (pg_attver=36873315125824);


ALTER TABLE optsislog.network_wan_samples OWNER TO optare3;

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
-- Name: rustdesk_audit_raw; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.rustdesk_audit_raw (
    line_hash text NOT NULL,
    received_at timestamp with time zone NOT NULL,
    source_ip text,
    path text NOT NULL,
    kind text NOT NULL,
    machine_id text,
    conn_id integer,
    action text,
    peer_id text,
    peer_name text,
    peer_ip text,
    primary_auth smallint,
    conn_type smallint,
    session_id numeric(20,0),
    alarm_type smallint,
    body jsonb NOT NULL,
    collected_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY optsislog.rustdesk_audit_raw ALTER COLUMN line_hash SET (pg_attver=36899214506336);
ALTER TABLE ONLY optsislog.rustdesk_audit_raw ALTER COLUMN received_at SET (pg_attver=36899214506336);
ALTER TABLE ONLY optsislog.rustdesk_audit_raw ALTER COLUMN source_ip SET (pg_attver=36899214506336);
ALTER TABLE ONLY optsislog.rustdesk_audit_raw ALTER COLUMN path SET (pg_attver=36899214506336);
ALTER TABLE ONLY optsislog.rustdesk_audit_raw ALTER COLUMN kind SET (pg_attver=36899214506336);
ALTER TABLE ONLY optsislog.rustdesk_audit_raw ALTER COLUMN machine_id SET (pg_attver=36899214506336);
ALTER TABLE ONLY optsislog.rustdesk_audit_raw ALTER COLUMN conn_id SET (pg_attver=36899214506336);
ALTER TABLE ONLY optsislog.rustdesk_audit_raw ALTER COLUMN action SET (pg_attver=36899214506336);
ALTER TABLE ONLY optsislog.rustdesk_audit_raw ALTER COLUMN peer_id SET (pg_attver=36899214506336);
ALTER TABLE ONLY optsislog.rustdesk_audit_raw ALTER COLUMN peer_name SET (pg_attver=36899214506336);
ALTER TABLE ONLY optsislog.rustdesk_audit_raw ALTER COLUMN peer_ip SET (pg_attver=36899214506336);
ALTER TABLE ONLY optsislog.rustdesk_audit_raw ALTER COLUMN primary_auth SET (pg_attver=36899214506336);
ALTER TABLE ONLY optsislog.rustdesk_audit_raw ALTER COLUMN conn_type SET (pg_attver=36899214506336);
ALTER TABLE ONLY optsislog.rustdesk_audit_raw ALTER COLUMN session_id SET (pg_attver=36899214506336);
ALTER TABLE ONLY optsislog.rustdesk_audit_raw ALTER COLUMN alarm_type SET (pg_attver=36899214506336);
ALTER TABLE ONLY optsislog.rustdesk_audit_raw ALTER COLUMN body SET (pg_attver=36899214506336);
ALTER TABLE ONLY optsislog.rustdesk_audit_raw ALTER COLUMN collected_at SET (pg_attver=36899214506336);


ALTER TABLE optsislog.rustdesk_audit_raw OWNER TO optare3;

--
-- Name: rustdesk_file_state; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.rustdesk_file_state (
    file_name text NOT NULL,
    read_offset bigint NOT NULL,
    head_hash text,
    head_len integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY optsislog.rustdesk_file_state ALTER COLUMN file_name SET (pg_attver=36899214718736);
ALTER TABLE ONLY optsislog.rustdesk_file_state ALTER COLUMN read_offset SET (pg_attver=36899214718736);
ALTER TABLE ONLY optsislog.rustdesk_file_state ALTER COLUMN head_hash SET (pg_attver=36899214718736);
ALTER TABLE ONLY optsislog.rustdesk_file_state ALTER COLUMN head_len SET (pg_attver=36899214718736);
ALTER TABLE ONLY optsislog.rustdesk_file_state ALTER COLUMN updated_at SET (pg_attver=36899214718736);


ALTER TABLE optsislog.rustdesk_file_state OWNER TO optare3;

--
-- Name: rustdesk_machines; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.rustdesk_machines (
    machine_id text NOT NULL,
    hostname text,
    username text,
    last_username text,
    os text,
    version text,
    cpu text,
    memory text,
    uuid text,
    source_ip text,
    is_test boolean DEFAULT false NOT NULL,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_sysinfo_at timestamp with time zone
);
ALTER TABLE ONLY optsislog.rustdesk_machines ALTER COLUMN machine_id SET (pg_attver=36899214697800);
ALTER TABLE ONLY optsislog.rustdesk_machines ALTER COLUMN hostname SET (pg_attver=36899214697800);
ALTER TABLE ONLY optsislog.rustdesk_machines ALTER COLUMN username SET (pg_attver=36899214697800);
ALTER TABLE ONLY optsislog.rustdesk_machines ALTER COLUMN last_username SET (pg_attver=36899214697800);
ALTER TABLE ONLY optsislog.rustdesk_machines ALTER COLUMN os SET (pg_attver=36899214697800);
ALTER TABLE ONLY optsislog.rustdesk_machines ALTER COLUMN version SET (pg_attver=36899214697800);
ALTER TABLE ONLY optsislog.rustdesk_machines ALTER COLUMN cpu SET (pg_attver=36899214697800);
ALTER TABLE ONLY optsislog.rustdesk_machines ALTER COLUMN memory SET (pg_attver=36899214697800);
ALTER TABLE ONLY optsislog.rustdesk_machines ALTER COLUMN uuid SET (pg_attver=36899214697800);
ALTER TABLE ONLY optsislog.rustdesk_machines ALTER COLUMN source_ip SET (pg_attver=36899214697800);
ALTER TABLE ONLY optsislog.rustdesk_machines ALTER COLUMN is_test SET (pg_attver=36899214697800);
ALTER TABLE ONLY optsislog.rustdesk_machines ALTER COLUMN first_seen_at SET (pg_attver=36899214697800);
ALTER TABLE ONLY optsislog.rustdesk_machines ALTER COLUMN last_sysinfo_at SET (pg_attver=36899214697800);


ALTER TABLE optsislog.rustdesk_machines OWNER TO optare3;

--
-- Name: rustdesk_sessions; Type: TABLE; Schema: optsislog; Owner: optare3
--

CREATE TABLE optsislog.rustdesk_sessions (
    machine_id text NOT NULL,
    conn_id integer NOT NULL,
    started_at timestamp with time zone NOT NULL,
    authenticated_at timestamp with time zone,
    ended_at timestamp with time zone,
    peer_id text,
    peer_name text,
    peer_ip text,
    primary_auth smallint,
    conn_type smallint,
    session_id numeric(20,0),
    alarm_type smallint,
    status text NOT NULL,
    CONSTRAINT rustdesk_sessions_status_check CHECK ((status = ANY (ARRAY['concluida'::text, 'aberta'::text, 'bloqueada'::text, 'tentativa'::text])))
);
ALTER TABLE ONLY optsislog.rustdesk_sessions ALTER COLUMN machine_id SET (pg_attver=36899214674712);
ALTER TABLE ONLY optsislog.rustdesk_sessions ALTER COLUMN conn_id SET (pg_attver=36899214674712);
ALTER TABLE ONLY optsislog.rustdesk_sessions ALTER COLUMN started_at SET (pg_attver=36899214674712);
ALTER TABLE ONLY optsislog.rustdesk_sessions ALTER COLUMN authenticated_at SET (pg_attver=36899214674712);
ALTER TABLE ONLY optsislog.rustdesk_sessions ALTER COLUMN ended_at SET (pg_attver=36899214674712);
ALTER TABLE ONLY optsislog.rustdesk_sessions ALTER COLUMN peer_id SET (pg_attver=36899214674712);
ALTER TABLE ONLY optsislog.rustdesk_sessions ALTER COLUMN peer_name SET (pg_attver=36899214674712);
ALTER TABLE ONLY optsislog.rustdesk_sessions ALTER COLUMN peer_ip SET (pg_attver=36899214674712);
ALTER TABLE ONLY optsislog.rustdesk_sessions ALTER COLUMN primary_auth SET (pg_attver=36899214674712);
ALTER TABLE ONLY optsislog.rustdesk_sessions ALTER COLUMN conn_type SET (pg_attver=36899214674712);
ALTER TABLE ONLY optsislog.rustdesk_sessions ALTER COLUMN session_id SET (pg_attver=36899214674712);
ALTER TABLE ONLY optsislog.rustdesk_sessions ALTER COLUMN alarm_type SET (pg_attver=36899214674712);
ALTER TABLE ONLY optsislog.rustdesk_sessions ALTER COLUMN status SET (pg_attver=36899214674712);


ALTER TABLE optsislog.rustdesk_sessions OWNER TO optare3;

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
-- Name: app_programs app_programs_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.app_programs
    ADD CONSTRAINT app_programs_pkey PRIMARY KEY (programa);


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
-- Name: network_device_samples network_device_samples_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.network_device_samples
    ADD CONSTRAINT network_device_samples_pkey PRIMARY KEY (mac, sampled_at);


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
-- Name: network_top_apps network_top_apps_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.network_top_apps
    ADD CONSTRAINT network_top_apps_pkey PRIMARY KEY (period, rank);


--
-- Name: network_vpn_clients network_vpn_clients_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.network_vpn_clients
    ADD CONSTRAINT network_vpn_clients_pkey PRIMARY KEY (client_key);


--
-- Name: network_wan network_wan_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.network_wan
    ADD CONSTRAINT network_wan_pkey PRIMARY KEY (wan_group);


--
-- Name: network_wan_quality network_wan_quality_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.network_wan_quality
    ADD CONSTRAINT network_wan_quality_pkey PRIMARY KEY (wan_group, sampled_at);


--
-- Name: network_wan_samples network_wan_samples_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.network_wan_samples
    ADD CONSTRAINT network_wan_samples_pkey PRIMARY KEY (wan_group, sampled_at);


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
-- Name: rustdesk_audit_raw rustdesk_audit_raw_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.rustdesk_audit_raw
    ADD CONSTRAINT rustdesk_audit_raw_pkey PRIMARY KEY (line_hash);


--
-- Name: rustdesk_file_state rustdesk_file_state_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.rustdesk_file_state
    ADD CONSTRAINT rustdesk_file_state_pkey PRIMARY KEY (file_name);


--
-- Name: rustdesk_machines rustdesk_machines_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.rustdesk_machines
    ADD CONSTRAINT rustdesk_machines_pkey PRIMARY KEY (machine_id);


--
-- Name: rustdesk_sessions rustdesk_sessions_pkey; Type: CONSTRAINT; Schema: optsislog; Owner: optare3
--

ALTER TABLE ONLY optsislog.rustdesk_sessions
    ADD CONSTRAINT rustdesk_sessions_pkey PRIMARY KEY (machine_id, conn_id, started_at);


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
-- Name: idx_network_device_samples_sampled_at; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX idx_network_device_samples_sampled_at ON optsislog.network_device_samples USING btree (sampled_at);


--
-- Name: idx_network_events_created_at; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX idx_network_events_created_at ON optsislog.network_events USING btree (created_at DESC);


--
-- Name: idx_network_events_signature_id; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX idx_network_events_signature_id ON optsislog.network_events USING btree (signature_id);


--
-- Name: idx_network_wan_quality_sampled_at; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX idx_network_wan_quality_sampled_at ON optsislog.network_wan_quality USING btree (sampled_at);


--
-- Name: idx_network_wan_samples_sampled_at; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX idx_network_wan_samples_sampled_at ON optsislog.network_wan_samples USING btree (sampled_at);


--
-- Name: idx_process_logs_date_time; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX idx_process_logs_date_time ON optsislog.process_logs USING btree (log_date DESC, log_time DESC);


--
-- Name: idx_process_logs_source_name; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX idx_process_logs_source_name ON optsislog.process_logs USING btree (source_name);


--
-- Name: idx_rustdesk_raw_machine; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX idx_rustdesk_raw_machine ON optsislog.rustdesk_audit_raw USING btree (machine_id, received_at);


--
-- Name: idx_rustdesk_raw_received; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX idx_rustdesk_raw_received ON optsislog.rustdesk_audit_raw USING btree (received_at);


--
-- Name: idx_rustdesk_sessions_started; Type: INDEX; Schema: optsislog; Owner: optare3
--

CREATE INDEX idx_rustdesk_sessions_started ON optsislog.rustdesk_sessions USING btree (started_at DESC);


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

\unrestrict ckrrZ4WQcTmKhegeyz2joiv7LKod0aqXXQ1RbpyCF2CGQhgR13OX82Fd8BDqOW0

