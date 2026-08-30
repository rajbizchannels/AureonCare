-- Baseline schema for a from-scratch install.
--
-- This is a pg_dump snapshot of the schema as it stood partway through the numbered
-- migration series. The historical chain (001..043 and friends) cannot be replayed on an
-- empty database -- it contains int->uuid rewrites, duplicate numbers and one-off repair
-- files that only ever made sense against a database in a particular state. Rather than
-- rewrite that history, a fresh install starts here and then applies everything the
-- baseline does not already contain (see contains.txt).
--
-- Applied automatically by run-migrations.js when the target database is empty. An
-- existing database must NEVER run this; the runner refuses unless the database has no
-- public.users table.
--
-- psql meta-commands and the PG18-only transaction_timeout GUC are stripped so this
-- executes through node-postgres on PG 14+.

--
-- PostgreSQL database dump
--


-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: generate_denial_number(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_denial_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    next_num INTEGER;
    year_prefix VARCHAR(4);
    denial_num VARCHAR(50);
BEGIN
    year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');

    SELECT COALESCE(MAX(CAST(SUBSTRING(denial_number FROM 8) AS INTEGER)), 0) + 1
    INTO next_num
    FROM denials
    WHERE denial_number LIKE 'DEN-' || year_prefix || '-%';

    denial_num := 'DEN-' || year_prefix || '-' || LPAD(next_num::TEXT, 6, '0');
    RETURN denial_num;
END;
$$;


ALTER FUNCTION public.generate_denial_number() OWNER TO postgres;

--
-- Name: generate_fhir_tracking_number(character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_fhir_tracking_number(resource_type character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    prefix VARCHAR(4);
    timestamp_part VARCHAR(14);
    random_part VARCHAR(6);
BEGIN
    -- Set prefix based on resource type
    prefix := CASE resource_type
        WHEN 'MedicationRequest' THEN 'RX'
        WHEN 'ServiceRequest' THEN 'LAB'
        ELSE 'FHIR'
    END;

    -- Generate timestamp part (YYYYMMDDHHmmss)
    timestamp_part := TO_CHAR(NOW(), 'YYYYMMDDHH24MISS');

    -- Generate random part
    random_part := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));

    RETURN prefix || '-' || timestamp_part || '-' || random_part;
END;
$$;


ALTER FUNCTION public.generate_fhir_tracking_number(resource_type character varying) OWNER TO postgres;

--
-- Name: generate_posting_number(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_posting_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    next_num INTEGER;
    year_prefix VARCHAR(4);
    posting_num VARCHAR(50);
BEGIN
    year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');

    SELECT COALESCE(MAX(CAST(SUBSTRING(posting_number FROM 9) AS INTEGER)), 0) + 1
    INTO next_num
    FROM payment_postings
    WHERE posting_number LIKE 'POST-' || year_prefix || '-%';

    posting_num := 'POST-' || year_prefix || '-' || LPAD(next_num::TEXT, 6, '0');
    RETURN posting_num;
END;
$$;


ALTER FUNCTION public.generate_posting_number() OWNER TO postgres;

--
-- Name: is_slot_available(uuid, timestamp without time zone, timestamp without time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_slot_available(p_provider_id uuid, p_start_time timestamp without time zone, p_end_time timestamp without time zone) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    conflict_count INTEGER;
    time_off_count INTEGER;
BEGIN
    -- Check for conflicting appointments
    SELECT COUNT(*) INTO conflict_count
    FROM appointments
    WHERE provider_id = p_provider_id
      AND status NOT IN ('cancelled', 'no-show')
      AND (
          (start_time <= p_start_time AND end_time > p_start_time) OR
          (start_time < p_end_time AND end_time >= p_end_time) OR
          (start_time >= p_start_time AND end_time <= p_end_time)
      );

    -- Check for time-off periods
    SELECT COUNT(*) INTO time_off_count
    FROM doctor_time_off
    WHERE provider_id = p_provider_id
      AND (
          (start_date <= p_start_time AND end_date > p_start_time) OR
          (start_date < p_end_time AND end_date >= p_end_time) OR
          (start_date >= p_start_time AND end_date <= p_end_time)
      );

    RETURN (conflict_count = 0 AND time_off_count = 0);
END;
$$;


ALTER FUNCTION public.is_slot_available(p_provider_id uuid, p_start_time timestamp without time zone, p_end_time timestamp without time zone) OWNER TO postgres;

--
-- Name: log_fhir_tracking_event(uuid, character varying, text, character varying, character varying, boolean, character varying, text, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.log_fhir_tracking_event(p_tracking_id uuid, p_event_type character varying, p_event_description text, p_from_status character varying DEFAULT NULL::character varying, p_to_status character varying DEFAULT NULL::character varying, p_is_error boolean DEFAULT false, p_error_code character varying DEFAULT NULL::character varying, p_error_message text DEFAULT NULL::text, p_event_data jsonb DEFAULT NULL::jsonb, p_triggered_by uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    event_id UUID;
BEGIN
    INSERT INTO fhir_tracking_events (
        fhir_tracking_id,
        event_type,
        event_description,
        from_status,
        to_status,
        is_error,
        error_code,
        error_message,
        event_data,
        triggered_by
    ) VALUES (
        p_tracking_id,
        p_event_type,
        p_event_description,
        p_from_status,
        p_to_status,
        p_is_error,
        p_error_code,
        p_error_message,
        p_event_data,
        p_triggered_by
    ) RETURNING id INTO event_id;

    RETURN event_id;
END;
$$;


ALTER FUNCTION public.log_fhir_tracking_event(p_tracking_id uuid, p_event_type character varying, p_event_description text, p_from_status character varying, p_to_status character varying, p_is_error boolean, p_error_code character varying, p_error_message text, p_event_data jsonb, p_triggered_by uuid) OWNER TO postgres;

--
-- Name: set_appeal_deadline(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_appeal_deadline() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.appeal_deadline IS NULL THEN
        NEW.appeal_deadline := NEW.denial_date + INTERVAL '90 days';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_appeal_deadline() OWNER TO postgres;

--
-- Name: set_denial_number(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_denial_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.denial_number IS NULL OR NEW.denial_number = '' THEN
        NEW.denial_number := generate_denial_number();
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_denial_number() OWNER TO postgres;

--
-- Name: set_posting_number(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_posting_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.posting_number IS NULL OR NEW.posting_number = '' THEN
        NEW.posting_number := generate_posting_number();
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_posting_number() OWNER TO postgres;

--
-- Name: trigger_log_fhir_tracking_status_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trigger_log_fhir_tracking_status_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.current_status != NEW.current_status) THEN
        PERFORM log_fhir_tracking_event(
            NEW.id,
            'status_change',
            'Status changed from ' || COALESCE(OLD.current_status, 'NULL') || ' to ' || NEW.current_status,
            OLD.current_status,
            NEW.current_status,
            NEW.has_errors,
            NEW.last_error_code,
            NEW.last_error_message,
            jsonb_build_object(
                'previous_status', OLD.current_status,
                'new_status', NEW.current_status,
                'status_reason', NEW.status_reason
            ),
            NEW.updated_by
        );
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.trigger_log_fhir_tracking_status_change() OWNER TO postgres;

--
-- Name: update_archive_rules_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_archive_rules_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_archive_rules_updated_at() OWNER TO postgres;

--
-- Name: update_claim_submissions_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_claim_submissions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_claim_submissions_updated_at() OWNER TO postgres;

--
-- Name: update_denials_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_denials_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_denials_updated_at() OWNER TO postgres;

--
-- Name: update_insurance_payers_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_insurance_payers_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_insurance_payers_updated_at() OWNER TO postgres;

--
-- Name: update_payment_postings_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_payment_postings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_payment_postings_updated_at() OWNER TO postgres;

--
-- Name: update_preapprovals_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_preapprovals_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_preapprovals_updated_at() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: appointment_reminders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.appointment_reminders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    appointment_id uuid NOT NULL,
    reminder_type character varying(50) NOT NULL,
    scheduled_for timestamp without time zone NOT NULL,
    sent_at timestamp without time zone,
    delivery_status character varying(50) DEFAULT 'pending'::character varying,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.appointment_reminders OWNER TO postgres;

--
-- Name: TABLE appointment_reminders; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.appointment_reminders IS 'Tracks scheduled appointment reminders (email/SMS)';


--
-- Name: appointment_type_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.appointment_type_config (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    provider_id uuid,
    name character varying(100) NOT NULL,
    description text,
    duration_minutes integer DEFAULT 30 NOT NULL,
    buffer_minutes integer DEFAULT 0,
    color character varying(20) DEFAULT '#3B82F6'::character varying,
    price numeric(10,2) DEFAULT 0.00,
    is_active boolean DEFAULT true,
    requires_approval boolean DEFAULT false,
    max_advance_booking_days integer DEFAULT 90,
    min_advance_booking_hours integer DEFAULT 24,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.appointment_type_config OWNER TO postgres;

--
-- Name: TABLE appointment_type_config; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.appointment_type_config IS 'Defines available appointment types with duration and pricing';


--
-- Name: appointment_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.appointment_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    duration_minutes integer DEFAULT 30,
    color character varying(20) DEFAULT '#3B82F6'::character varying,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.appointment_types OWNER TO postgres;

--
-- Name: appointment_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.appointment_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.appointment_types_id_seq OWNER TO postgres;

--
-- Name: appointment_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.appointment_types_id_seq OWNED BY public.appointment_types.id;


--
-- Name: appointment_waitlist; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.appointment_waitlist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    provider_id uuid,
    preferred_date date NOT NULL,
    preferred_time_start time without time zone,
    preferred_time_end time without time zone,
    appointment_type character varying(100),
    reason text,
    priority integer DEFAULT 0,
    status character varying(20) DEFAULT 'active'::character varying,
    notified_at timestamp without time zone,
    expires_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT appointment_waitlist_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'notified'::character varying, 'scheduled'::character varying, 'cancelled'::character varying, 'expired'::character varying])::text[])))
);


ALTER TABLE public.appointment_waitlist OWNER TO postgres;

--
-- Name: TABLE appointment_waitlist; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.appointment_waitlist IS 'Patient waitlist for appointment slots that are fully booked';


--
-- Name: COLUMN appointment_waitlist.priority; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointment_waitlist.priority IS 'Higher priority = contacted first (0 = normal, 1+ = higher priority)';


--
-- Name: COLUMN appointment_waitlist.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointment_waitlist.status IS 'active: waiting, notified: slot available notification sent, scheduled: appointment booked, cancelled: patient cancelled, expired: notification expired';


--
-- Name: COLUMN appointment_waitlist.expires_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointment_waitlist.expires_at IS 'Notification expiry time - if not booked by this time, offer to next person';


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    practice_id uuid,
    patient_id uuid,
    provider_id uuid,
    appointment_type character varying(50),
    status character varying(20) DEFAULT 'scheduled'::character varying,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone NOT NULL,
    duration_minutes integer,
    reason text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    appointment_type_id uuid,
    recurring_appointment_id uuid,
    timezone character varying(100) DEFAULT 'UTC'::character varying,
    booking_source character varying(50) DEFAULT 'staff'::character varying,
    confirmation_sent_at timestamp without time zone,
    reminder_sent_at timestamp without time zone,
    cancelled_at timestamp without time zone,
    cancelled_by uuid,
    cancellation_reason text,
    rescheduled_from uuid,
    no_show_notified_at timestamp without time zone,
    custom_form_data jsonb DEFAULT '{}'::jsonb,
    offering_id uuid,
    package_enrollment_id uuid
);


ALTER TABLE public.appointments OWNER TO postgres;

--
-- Name: TABLE appointments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.appointments IS 'Patient appointments with healthcare providers';


--
-- Name: archive_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.archive_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_name character varying(255) NOT NULL,
    description text,
    enabled boolean DEFAULT true,
    selected_modules text[] NOT NULL,
    schedule_type character varying(50) NOT NULL,
    schedule_cron character varying(100),
    schedule_time time without time zone DEFAULT '02:00:00'::time without time zone,
    schedule_day_of_week integer,
    schedule_day_of_month integer,
    retention_days integer,
    retention_criteria jsonb,
    last_run_at timestamp with time zone,
    last_run_status character varying(50),
    last_run_details jsonb,
    next_run_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.archive_rules OWNER TO postgres;

--
-- Name: TABLE archive_rules; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.archive_rules IS 'Defines automatic archiving rules with schedules';


--
-- Name: COLUMN archive_rules.schedule_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.archive_rules.schedule_type IS 'Type of schedule: daily, weekly, monthly, or custom (cron)';


--
-- Name: COLUMN archive_rules.schedule_cron; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.archive_rules.schedule_cron IS 'Cron expression for custom schedules (e.g., "0 2 * * *")';


--
-- Name: COLUMN archive_rules.retention_days; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.archive_rules.retention_days IS 'Archive data older than this many days (null = archive all)';


--
-- Name: COLUMN archive_rules.retention_criteria; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.archive_rules.retention_criteria IS 'Additional filtering criteria for data to archive';


--
-- Name: COLUMN archive_rules.last_run_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.archive_rules.last_run_status IS 'Status of last execution: success, failed, or running';


--
-- Name: archives; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.archives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    archive_name character varying(255) NOT NULL,
    description text,
    modules text[] NOT NULL,
    archive_data jsonb NOT NULL,
    metadata jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    size_bytes integer,
    record_count integer,
    status character varying(50) DEFAULT 'active'::character varying
);


ALTER TABLE public.archives OWNER TO postgres;

--
-- Name: TABLE archives; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.archives IS 'Stores archived data with module selection and deduplication support';


--
-- Name: COLUMN archives.modules; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.archives.modules IS 'Array of module names included in this archive (e.g., patients, appointments, medical_records)';


--
-- Name: COLUMN archives.archive_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.archives.archive_data IS 'Complete archived data organized by module name as keys';


--
-- Name: COLUMN archives.metadata; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.archives.metadata IS 'Statistics and metadata about the archive including record counts per module and timestamp';


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    user_email character varying(255),
    user_name character varying(255),
    user_role character varying(100),
    session_id character varying(255),
    ip_address character varying(45),
    user_agent text,
    action_type character varying(50) NOT NULL,
    resource_type character varying(100) NOT NULL,
    resource_name character varying(255) NOT NULL,
    resource_id character varying(255),
    action_description text,
    module character varying(100),
    old_values jsonb,
    new_values jsonb,
    changed_fields text[],
    patient_id uuid,
    provider_id uuid,
    appointment_id uuid,
    claim_id uuid,
    status character varying(50) DEFAULT 'success'::character varying,
    error_message text,
    duration_ms integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    retention_days integer DEFAULT 90
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: TABLE audit_logs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.audit_logs IS 'Comprehensive audit trail for all forms, modals, and views in the system';


--
-- Name: COLUMN audit_logs.action_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.audit_logs.action_type IS 'Type of action: view, create, update, delete, submit, open, close';


--
-- Name: COLUMN audit_logs.resource_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.audit_logs.resource_type IS 'Type of resource: form, modal, view';


--
-- Name: COLUMN audit_logs.resource_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.audit_logs.resource_name IS 'Name of the specific form/modal/view component';


--
-- Name: COLUMN audit_logs.changed_fields; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.audit_logs.changed_fields IS 'Array of field names that were modified during update actions';


--
-- Name: COLUMN audit_logs.metadata; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.audit_logs.metadata IS 'Additional context like form validation errors, navigation path, etc.';


--
-- Name: backup_provider_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.backup_provider_settings (
    id integer NOT NULL,
    provider_type character varying(50) NOT NULL,
    is_enabled boolean DEFAULT false,
    client_id character varying(255),
    client_secret character varying(255),
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.backup_provider_settings OWNER TO postgres;

--
-- Name: backup_provider_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.backup_provider_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.backup_provider_settings_id_seq OWNER TO postgres;

--
-- Name: backup_provider_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.backup_provider_settings_id_seq OWNED BY public.backup_provider_settings.id;


--
-- Name: booking_analytics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.booking_analytics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    provider_id uuid,
    event_type character varying(50) NOT NULL,
    appointment_id uuid,
    appointment_type_id uuid,
    patient_id uuid,
    session_id character varying(100),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.booking_analytics OWNER TO postgres;

--
-- Name: TABLE booking_analytics; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.booking_analytics IS 'Booking funnel analytics for insights and reporting';


--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.campaigns (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    subject character varying(500),
    email_content text,
    target_audience character varying(100),
    status character varying(50) DEFAULT 'draft'::character varying,
    scheduled_date timestamp without time zone,
    offering_id text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.campaigns OWNER TO postgres;

--
-- Name: campaigns_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.campaigns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.campaigns_id_seq OWNER TO postgres;

--
-- Name: campaigns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.campaigns_id_seq OWNED BY public.campaigns.id;


--
-- Name: claim_submissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.claim_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    claim_id uuid,
    submission_type character varying(50) DEFAULT 'EDI_837'::character varying,
    submission_date timestamp without time zone NOT NULL,
    submission_id character varying(100),
    clearinghouse_name character varying(255),
    status character varying(50) DEFAULT 'pending'::character varying,
    edi_content text,
    response_code character varying(50),
    response_message text,
    response_date timestamp without time zone,
    acknowledgment_number character varying(100),
    batch_number character varying(100),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT claim_submissions_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'submitted'::character varying, 'accepted'::character varying, 'rejected'::character varying, 'acknowledged'::character varying])::text[]))),
    CONSTRAINT claim_submissions_submission_type_check CHECK (((submission_type)::text = ANY ((ARRAY['EDI_837'::character varying, 'Manual'::character varying, 'Portal'::character varying, 'Fax'::character varying, 'Mail'::character varying])::text[])))
);


ALTER TABLE public.claim_submissions OWNER TO postgres;

--
-- Name: TABLE claim_submissions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.claim_submissions IS 'Tracks EDI 837 and other claim submissions to clearinghouses';


--
-- Name: COLUMN claim_submissions.submission_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.claim_submissions.submission_type IS 'Type of submission (EDI_837, Manual, Portal, etc.)';


--
-- Name: COLUMN claim_submissions.submission_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.claim_submissions.submission_id IS 'Unique submission ID from clearinghouse';


--
-- Name: COLUMN claim_submissions.edi_content; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.claim_submissions.edi_content IS 'Full EDI 837 file content for record keeping';


--
-- Name: COLUMN claim_submissions.acknowledgment_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.claim_submissions.acknowledgment_number IS '997 Functional Acknowledgment number';


--
-- Name: claims; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    practice_id uuid,
    patient_id uuid,
    claim_number character varying(50) NOT NULL,
    payer character varying(255),
    service_date date NOT NULL,
    amount numeric(10,2),
    status character varying(20) DEFAULT 'pending'::character varying,
    diagnosis_codes text[],
    procedure_codes text[],
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    clearinghouse_claim_id character varying(255),
    clearinghouse_status character varying(50),
    submitted_to_clearinghouse_at timestamp without time zone,
    clearinghouse_response jsonb,
    preapproval_id uuid
);


ALTER TABLE public.claims OWNER TO postgres;

--
-- Name: clinic_appointment_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clinic_appointment_settings (
    id integer NOT NULL,
    default_duration integer DEFAULT 30,
    slot_interval integer DEFAULT 15,
    max_advance_booking integer DEFAULT 90,
    cancellation_deadline integer DEFAULT 24,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.clinic_appointment_settings OWNER TO postgres;

--
-- Name: clinic_appointment_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.clinic_appointment_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clinic_appointment_settings_id_seq OWNER TO postgres;

--
-- Name: clinic_appointment_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.clinic_appointment_settings_id_seq OWNED BY public.clinic_appointment_settings.id;


--
-- Name: clinic_info; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clinic_info (
    id integer NOT NULL,
    name character varying(255) DEFAULT 'Medical Practice'::character varying,
    address text,
    phone character varying(50),
    email character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.clinic_info OWNER TO postgres;

--
-- Name: clinic_info_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.clinic_info_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clinic_info_id_seq OWNER TO postgres;

--
-- Name: clinic_info_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.clinic_info_id_seq OWNED BY public.clinic_info.id;


--
-- Name: clinic_working_hours; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clinic_working_hours (
    id integer NOT NULL,
    day character varying(20) NOT NULL,
    is_working boolean DEFAULT true,
    start_time time without time zone,
    end_time time without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.clinic_working_hours OWNER TO postgres;

--
-- Name: clinic_working_hours_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.clinic_working_hours_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clinic_working_hours_id_seq OWNER TO postgres;

--
-- Name: clinic_working_hours_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.clinic_working_hours_id_seq OWNED BY public.clinic_working_hours.id;


--
-- Name: denials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.denials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    denial_number character varying(50) NOT NULL,
    claim_id uuid,
    patient_id uuid,
    insurance_payer_id uuid,
    denial_date date NOT NULL,
    denial_amount numeric(10,2) NOT NULL,
    denied_service_date date,
    denial_reason_code character varying(50),
    denial_reason_description text,
    denial_category character varying(100),
    appeal_status character varying(50) DEFAULT 'not_appealed'::character varying,
    appeal_deadline date,
    appeal_submitted_date date,
    appeal_decision_date date,
    appeal_outcome character varying(50),
    appeal_amount_recovered numeric(10,2) DEFAULT 0,
    status character varying(50) DEFAULT 'open'::character varying,
    resolution_date date,
    resolution_notes text,
    eob_number character varying(100),
    era_number character varying(100),
    supporting_documents jsonb,
    assigned_to character varying(255),
    priority character varying(20) DEFAULT 'medium'::character varying,
    notes text,
    internal_notes text,
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT denials_appeal_status_check CHECK (((appeal_status)::text = ANY ((ARRAY['not_appealed'::character varying, 'appeal_pending'::character varying, 'appeal_submitted'::character varying, 'appeal_approved'::character varying, 'appeal_denied'::character varying, 'appeal_withdrawn'::character varying])::text[]))),
    CONSTRAINT denials_denial_category_check CHECK (((denial_category)::text = ANY ((ARRAY['Medical Necessity'::character varying, 'Prior Authorization Required'::character varying, 'Timely Filing'::character varying, 'Coordination of Benefits'::character varying, 'Duplicate Claim'::character varying, 'Invalid/Missing Information'::character varying, 'Non-Covered Service'::character varying, 'Patient Eligibility'::character varying, 'Coding Error'::character varying, 'Other'::character varying])::text[]))),
    CONSTRAINT denials_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT denials_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'under_review'::character varying, 'appealing'::character varying, 'resolved'::character varying, 'written_off'::character varying, 'patient_responsibility'::character varying])::text[])))
);


ALTER TABLE public.denials OWNER TO postgres;

--
-- Name: TABLE denials; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.denials IS 'Tracks claim denials and appeal management';


--
-- Name: COLUMN denials.denial_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.denials.denial_number IS 'Unique identifier for the denial (e.g., DEN-2024-000001)';


--
-- Name: COLUMN denials.denial_category; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.denials.denial_category IS 'Category of denial reason for reporting and analysis';


--
-- Name: COLUMN denials.appeal_deadline; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.denials.appeal_deadline IS 'Deadline for submitting appeal (auto-calculated as 90 days from denial date)';


--
-- Name: COLUMN denials.supporting_documents; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.denials.supporting_documents IS 'JSON array of document references for appeal';


--
-- Name: COLUMN denials.priority; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.denials.priority IS 'Priority level for denial management';


--
-- Name: diagnoses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.diagnoses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    provider_id uuid,
    diagnosis_name character varying(255),
    diagnosis_code character varying(50),
    description text,
    severity character varying(50),
    status character varying(50) DEFAULT 'Active'::character varying,
    diagnosed_date date,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.diagnoses OWNER TO postgres;

--
-- Name: diagnosis; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.diagnosis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid,
    provider_id uuid,
    appointment_id uuid,
    diagnosis_code character varying(20),
    diagnosis_name character varying(255) NOT NULL,
    severity character varying(50),
    status character varying(50) DEFAULT 'Active'::character varying,
    diagnosed_date date DEFAULT CURRENT_DATE,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    soap_notes text
);


ALTER TABLE public.diagnosis OWNER TO postgres;

--
-- Name: TABLE diagnosis; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.diagnosis IS 'Stores patient diagnoses with ICD codes and severity';


--
-- Name: COLUMN diagnosis.soap_notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.diagnosis.soap_notes IS 'SOAP notes: Subjective, Objective, Assessment, and Plan documentation for the diagnosis';


--
-- Name: doctor_availability; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.doctor_availability (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    provider_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_available boolean DEFAULT true,
    timezone character varying(100) DEFAULT 'UTC'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_time_order CHECK ((end_time > start_time)),
    CONSTRAINT doctor_availability_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


ALTER TABLE public.doctor_availability OWNER TO postgres;

--
-- Name: TABLE doctor_availability; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.doctor_availability IS 'Stores doctor weekly availability schedule (working hours)';


--
-- Name: doctor_time_off; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.doctor_time_off (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    provider_id uuid NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    reason character varying(500),
    is_recurring boolean DEFAULT false,
    recurrence_rule character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_date_order CHECK ((end_date >= start_date))
);


ALTER TABLE public.doctor_time_off OWNER TO postgres;

--
-- Name: TABLE doctor_time_off; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.doctor_time_off IS 'Tracks doctor time-off, vacations, and schedule exceptions';


--
-- Name: drug_interactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drug_interactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    drug1_ndc character varying(20) NOT NULL,
    drug2_ndc character varying(20) NOT NULL,
    interaction_severity character varying(50) NOT NULL,
    interaction_type character varying(100),
    description text NOT NULL,
    clinical_effects text,
    management_recommendations text,
    reference_sources text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.drug_interactions OWNER TO postgres;

--
-- Name: TABLE drug_interactions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.drug_interactions IS 'Known drug-drug interactions database';


--
-- Name: erx_message_queue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.erx_message_queue (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    prescription_id uuid,
    message_type character varying(50) NOT NULL,
    message_direction character varying(20) NOT NULL,
    pharmacy_id uuid,
    message_payload jsonb NOT NULL,
    message_status character varying(50) DEFAULT 'pending'::character varying,
    retry_count integer DEFAULT 0,
    max_retries integer DEFAULT 3,
    error_message text,
    sent_date timestamp without time zone,
    delivered_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.erx_message_queue OWNER TO postgres;

--
-- Name: TABLE erx_message_queue; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.erx_message_queue IS 'Queue for electronic prescription messages to/from pharmacies';


--
-- Name: fhir_error_actions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fhir_error_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    error_code character varying(50) NOT NULL,
    error_pattern text,
    resource_type character varying(50),
    vendor_name character varying(50),
    error_title character varying(255) NOT NULL,
    error_description text,
    error_severity character varying(20) DEFAULT 'error'::character varying,
    suggested_actions jsonb NOT NULL,
    auto_retry boolean DEFAULT false,
    max_retry_attempts integer DEFAULT 0,
    retry_delay_seconds integer DEFAULT 60,
    requires_manual_intervention boolean DEFAULT false,
    escalation_required boolean DEFAULT false,
    resolution_guide text,
    documentation_url character varying(500),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.fhir_error_actions OWNER TO postgres;

--
-- Name: TABLE fhir_error_actions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.fhir_error_actions IS 'Predefined actions and resolution guides for common FHIR errors';


--
-- Name: fhir_resources; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fhir_resources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id character varying(100) NOT NULL,
    patient_id uuid,
    fhir_version character varying(10) DEFAULT 'R4'::character varying,
    resource_data jsonb NOT NULL,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.fhir_resources OWNER TO postgres;

--
-- Name: fhir_tracking; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fhir_tracking (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fhir_resource_id uuid,
    resource_type character varying(50) NOT NULL,
    resource_reference character varying(255) NOT NULL,
    current_status character varying(50) NOT NULL,
    previous_status character varying(50),
    status_reason text,
    fhir_status character varying(50),
    intent character varying(50),
    priority character varying(20),
    tracking_number character varying(100),
    vendor_name character varying(50),
    vendor_tracking_id character varying(255),
    vendor_status character varying(50),
    sent_to_vendor_at timestamp without time zone,
    vendor_last_updated timestamp without time zone,
    has_errors boolean DEFAULT false,
    error_count integer DEFAULT 0,
    last_error_message text,
    last_error_code character varying(50),
    last_error_at timestamp without time zone,
    error_details jsonb,
    suggested_actions jsonb,
    action_required boolean DEFAULT false,
    action_deadline timestamp without time zone,
    initiated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    cancelled_at timestamp without time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_resource_type CHECK (((resource_type)::text = ANY ((ARRAY['MedicationRequest'::character varying, 'ServiceRequest'::character varying])::text[])))
);


ALTER TABLE public.fhir_tracking OWNER TO postgres;

--
-- Name: TABLE fhir_tracking; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.fhir_tracking IS 'End-to-end tracking for FHIR resources (MedicationRequest and ServiceRequest)';


--
-- Name: fhir_tracking_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fhir_tracking_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fhir_tracking_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    event_category character varying(50),
    from_status character varying(50),
    to_status character varying(50),
    event_description text NOT NULL,
    event_data jsonb,
    is_error boolean DEFAULT false,
    error_code character varying(50),
    error_message text,
    error_severity character varying(20),
    vendor_name character varying(50),
    vendor_response jsonb,
    action_taken text,
    action_result character varying(50),
    triggered_by uuid,
    triggered_by_system character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_event_type CHECK (((event_type)::text = ANY ((ARRAY['status_change'::character varying, 'vendor_sync'::character varying, 'error'::character varying, 'retry'::character varying, 'manual_intervention'::character varying, 'created'::character varying, 'updated'::character varying, 'cancelled'::character varying, 'completed'::character varying, 'sent_to_vendor'::character varying, 'vendor_response'::character varying, 'error_resolved'::character varying, 'action_applied'::character varying])::text[])))
);


ALTER TABLE public.fhir_tracking_events OWNER TO postgres;

--
-- Name: TABLE fhir_tracking_events; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.fhir_tracking_events IS 'Event log for all FHIR tracking status changes and interactions';


--
-- Name: healthcare_offerings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.healthcare_offerings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category_id uuid,
    duration_minutes integer,
    requires_preparation boolean DEFAULT false,
    preparation_instructions text,
    is_active boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    available_online boolean DEFAULT true,
    requires_referral boolean DEFAULT false,
    cpt_codes text[],
    icd_codes text[],
    hcpcs_codes text[],
    min_age integer,
    max_age integer,
    gender_restriction character varying(20),
    contraindications text,
    prerequisites text,
    allowed_provider_specializations text[],
    image_url text,
    video_url text,
    brochure_url text,
    consent_form_required boolean DEFAULT false,
    consent_form_url text,
    seo_title character varying(255),
    seo_description text,
    seo_keywords text[],
    view_count integer DEFAULT 0,
    booking_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.healthcare_offerings OWNER TO postgres;

--
-- Name: TABLE healthcare_offerings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.healthcare_offerings IS 'Individual medical services and procedures available to patients';


--
-- Name: insurance_payers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_payers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    payer_id character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    payer_type character varying(50) DEFAULT 'insurance'::character varying,
    phone character varying(50),
    email character varying(255),
    website character varying(255),
    address text,
    city character varying(100),
    state character varying(50),
    zip_code character varying(20),
    contact_person character varying(255),
    contact_phone character varying(50),
    contact_email character varying(255),
    claim_submission_method character varying(50),
    claim_submission_address text,
    electronic_payer_id character varying(100),
    timely_filing_limit integer DEFAULT 365,
    prior_authorization_required boolean DEFAULT false,
    accepts_assignment boolean DEFAULT true,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.insurance_payers OWNER TO postgres;

--
-- Name: TABLE insurance_payers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.insurance_payers IS 'Insurance payers and organizations for claims submission';


--
-- Name: COLUMN insurance_payers.payer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.insurance_payers.payer_id IS 'Unique identifier for the payer (e.g., BC001)';


--
-- Name: COLUMN insurance_payers.electronic_payer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.insurance_payers.electronic_payer_id IS 'EDI payer ID for electronic claims submission';


--
-- Name: COLUMN insurance_payers.timely_filing_limit; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.insurance_payers.timely_filing_limit IS 'Number of days within which claims must be filed';


--
-- Name: lab_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lab_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    order_number character varying(100),
    order_type character varying(50) DEFAULT 'lab_test'::character varying,
    priority character varying(20) DEFAULT 'routine'::character varying,
    status character varying(50) DEFAULT 'pending'::character varying,
    vendor_order_id character varying(255),
    vendor_status character varying(50),
    sent_to_vendor_at timestamp without time zone,
    vendor_response jsonb,
    diagnosis_codes jsonb,
    test_codes jsonb,
    clinical_notes text,
    special_instructions text,
    specimen_type character varying(100),
    collection_date timestamp without time zone,
    collection_site character varying(255),
    results_data jsonb,
    results_received_at timestamp without time zone,
    results_reviewed_by uuid,
    results_reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    laboratory_id uuid,
    linked_diagnosis_id uuid,
    order_status character varying(50) DEFAULT 'one-time'::character varying,
    order_status_date date,
    frequency character varying(50),
    collection_class character varying(50) DEFAULT 'clinic-collect'::character varying,
    result_recipients jsonb DEFAULT '[]'::jsonb,
    fhir_tracking_id uuid
);


ALTER TABLE public.lab_orders OWNER TO postgres;

--
-- Name: TABLE lab_orders; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.lab_orders IS 'Laboratory test orders with Labcorp integration support';


--
-- Name: laboratories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.laboratories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lab_name character varying(255) NOT NULL,
    address_line1 character varying(255),
    address_line2 character varying(255),
    city character varying(100),
    state character varying(2),
    zip_code character varying(10),
    phone character varying(20),
    fax character varying(20),
    email character varying(255),
    website character varying(255),
    clia_number character varying(50),
    npi character varying(20),
    is_active boolean DEFAULT true,
    accepts_electronic_orders boolean DEFAULT true,
    specialty character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.laboratories OWNER TO postgres;

--
-- Name: medical_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.medical_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(20) NOT NULL,
    description text NOT NULL,
    code_type character varying(20) NOT NULL,
    category character varying(100),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    pa_type integer
);


ALTER TABLE public.medical_codes OWNER TO postgres;

--
-- Name: TABLE medical_codes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.medical_codes IS 'Stores all medical codes including ICD-10 diagnosis codes and CPT procedure codes';


--
-- Name: COLUMN medical_codes.code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.medical_codes.code IS 'The medical code (e.g., I10, 99213)';


--
-- Name: COLUMN medical_codes.description; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.medical_codes.description IS 'Full description of the medical code';


--
-- Name: COLUMN medical_codes.code_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.medical_codes.code_type IS 'Type of code: ICD-10 for diagnoses, CPT for procedures';


--
-- Name: COLUMN medical_codes.category; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.medical_codes.category IS 'Category for grouping codes (e.g., Primary Care, Chronic Conditions)';


--
-- Name: COLUMN medical_codes.is_active; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.medical_codes.is_active IS 'Whether this code is currently active/valid';


--
-- Name: medical_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.medical_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid,
    provider_id uuid,
    record_type character varying(50) NOT NULL,
    record_date date NOT NULL,
    title character varying(255),
    description text,
    diagnosis text,
    treatment text,
    medications jsonb,
    attachments jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.medical_records OWNER TO postgres;

--
-- Name: medication_alternatives; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.medication_alternatives (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    original_ndc character varying(20),
    alternative_ndc character varying(20),
    relationship_type character varying(50) NOT NULL,
    cost_difference numeric(10,2),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.medication_alternatives OWNER TO postgres;

--
-- Name: TABLE medication_alternatives; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.medication_alternatives IS 'Generic and therapeutic alternatives for cost savings';


--
-- Name: medications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.medications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    ndc_code character varying(500),
    drug_name character varying(500),
    generic_name character varying(500),
    brand_name character varying(500),
    drug_class character varying(500),
    strength character varying(1000),
    dosage_form character varying(500),
    route character varying(500),
    manufacturer character varying(500),
    controlled_substance boolean DEFAULT false,
    dea_schedule character varying(10),
    requires_prior_auth boolean DEFAULT false,
    formulary_status character varying(500) DEFAULT 'preferred'::character varying,
    average_cost numeric(10,2),
    common_dosages text[],
    indications text[],
    contraindications text[],
    warnings text,
    side_effects text[],
    drug_interactions text,
    pregnancy_category character varying(5),
    is_generic boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.medications OWNER TO postgres;

--
-- Name: TABLE medications; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.medications IS 'Drug formulary database with NDC codes and drug information';


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_preferences (
    id integer NOT NULL,
    patient_id uuid NOT NULL,
    channel_type character varying(20) NOT NULL,
    is_enabled boolean DEFAULT true,
    contact_info character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notification_preferences OWNER TO postgres;

--
-- Name: TABLE notification_preferences; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.notification_preferences IS 'Patient notification preferences for different channels (email, sms, whatsapp)';


--
-- Name: notification_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notification_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_preferences_id_seq OWNER TO postgres;

--
-- Name: notification_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_preferences_id_seq OWNED BY public.notification_preferences.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    type character varying(50),
    message text NOT NULL,
    read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id uuid
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: offering_insurance_mappings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.offering_insurance_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offering_id uuid,
    insurance_provider character varying(255) NOT NULL,
    insurance_plan character varying(255),
    is_covered boolean DEFAULT true,
    coverage_percentage numeric(5,2),
    copay_amount numeric(10,2),
    deductible_applies boolean DEFAULT false,
    requires_preauthorization boolean DEFAULT false,
    preauth_phone character varying(50),
    preauth_instructions text,
    primary_cpt_code character varying(20),
    modifier_codes text[],
    diagnosis_codes_required text[],
    coverage_notes text,
    billing_notes text,
    is_active boolean DEFAULT true,
    effective_from date,
    effective_until date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.offering_insurance_mappings OWNER TO postgres;

--
-- Name: TABLE offering_insurance_mappings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.offering_insurance_mappings IS 'Insurance coverage details for specific offerings';


--
-- Name: offering_packages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.offering_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category_id uuid,
    package_type character varying(50) DEFAULT 'bundle'::character varying,
    validity_days integer,
    max_uses integer,
    base_price numeric(10,2),
    discount_percentage numeric(5,2),
    final_price numeric(10,2),
    is_active boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    available_from date,
    available_until date,
    benefits text[],
    features text[],
    image_url text,
    terms_and_conditions text,
    enrollment_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.offering_packages OWNER TO postgres;

--
-- Name: TABLE offering_packages; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.offering_packages IS 'Bundled healthcare service packages and memberships';


--
-- Name: offering_pricing; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.offering_pricing (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offering_id uuid,
    pricing_type character varying(50) NOT NULL,
    pricing_name character varying(255),
    base_price numeric(10,2) NOT NULL,
    discount_percentage numeric(5,2) DEFAULT 0,
    final_price numeric(10,2),
    insurance_provider character varying(255),
    copay_amount numeric(10,2),
    requires_preauthorization boolean DEFAULT false,
    effective_from date,
    effective_until date,
    is_active boolean DEFAULT true,
    additional_fees jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.offering_pricing OWNER TO postgres;

--
-- Name: TABLE offering_pricing; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.offering_pricing IS 'Multiple pricing tiers for offerings (cash, insurance, membership)';


--
-- Name: offering_promotions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.offering_promotions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    promo_code character varying(50),
    discount_type character varying(20),
    discount_value numeric(10,2),
    applicable_to character varying(20) DEFAULT 'all'::character varying,
    offering_ids uuid[],
    package_ids uuid[],
    category_ids uuid[],
    valid_from timestamp without time zone,
    valid_until timestamp without time zone,
    max_uses integer,
    max_uses_per_patient integer DEFAULT 1,
    current_uses integer DEFAULT 0,
    min_purchase_amount numeric(10,2),
    new_patients_only boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.offering_promotions OWNER TO postgres;

--
-- Name: TABLE offering_promotions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.offering_promotions IS 'Promotional campaigns and discount codes for offerings';


--
-- Name: offering_reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.offering_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offering_id uuid,
    patient_id uuid,
    appointment_id uuid,
    rating integer,
    review_text text,
    is_approved boolean DEFAULT false,
    is_featured boolean DEFAULT false,
    moderated_by uuid,
    moderated_at timestamp without time zone,
    provider_response text,
    response_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.offering_reviews OWNER TO postgres;

--
-- Name: TABLE offering_reviews; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.offering_reviews IS 'Patient reviews and ratings for healthcare offerings';


--
-- Name: organization_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_settings (
    id integer NOT NULL,
    organization_name character varying(255),
    current_plan_id integer,
    plan_start_date date,
    plan_end_date date,
    auto_renew boolean DEFAULT true,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.organization_settings OWNER TO postgres;

--
-- Name: TABLE organization_settings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.organization_settings IS 'Organization-level settings including current plan';


--
-- Name: organization_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.organization_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.organization_settings_id_seq OWNER TO postgres;

--
-- Name: organization_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.organization_settings_id_seq OWNED BY public.organization_settings.id;


--
-- Name: package_offerings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.package_offerings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    package_id uuid,
    offering_id uuid,
    quantity_included integer DEFAULT 1,
    is_optional boolean DEFAULT false,
    display_order integer DEFAULT 0,
    price_override numeric(10,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.package_offerings OWNER TO postgres;

--
-- Name: TABLE package_offerings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.package_offerings IS 'Junction table linking packages to individual offerings';


--
-- Name: patient_allergies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.patient_allergies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid,
    allergen_type character varying(50) NOT NULL,
    allergen_name character varying(255) NOT NULL,
    ndc_code character varying(20),
    reaction_type character varying(100),
    severity character varying(50),
    onset_date date,
    reported_date date DEFAULT CURRENT_DATE,
    reported_by uuid,
    verified boolean DEFAULT false,
    verified_by uuid,
    verified_date timestamp without time zone,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.patient_allergies OWNER TO postgres;

--
-- Name: TABLE patient_allergies; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.patient_allergies IS 'Patient allergy and adverse reaction tracking';


--
-- Name: patient_consent_forms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.patient_consent_forms (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    consent_type character varying(100) NOT NULL,
    consent_title character varying(255) NOT NULL,
    consent_description text,
    consent_content text NOT NULL,
    version character varying(50) DEFAULT '1.0'::character varying,
    status character varying(50) DEFAULT 'pending'::character varying,
    signed_at timestamp without time zone,
    signature_data text,
    signature_method character varying(50),
    witness_name character varying(255),
    witness_signature text,
    ip_address character varying(45),
    user_agent text,
    expires_at timestamp without time zone,
    revoked_at timestamp without time zone,
    revocation_reason text,
    parent_guardian_name character varying(255),
    parent_guardian_relation character varying(100),
    attachments jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.patient_consent_forms OWNER TO postgres;

--
-- Name: TABLE patient_consent_forms; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.patient_consent_forms IS 'Manages patient consent forms with digital signatures and audit trail';


--
-- Name: patient_intake_flows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.patient_intake_flows (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    flow_name character varying(255) NOT NULL,
    flow_type character varying(100) NOT NULL,
    current_step integer DEFAULT 1,
    total_steps integer NOT NULL,
    steps_completed jsonb DEFAULT '[]'::jsonb,
    step_data jsonb DEFAULT '{}'::jsonb,
    status character varying(50) DEFAULT 'in_progress'::character varying,
    started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    expires_at timestamp without time zone,
    reminder_sent boolean DEFAULT false,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.patient_intake_flows OWNER TO postgres;

--
-- Name: TABLE patient_intake_flows; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.patient_intake_flows IS 'Tracks multi-step intake workflows and patient progress';


--
-- Name: patient_intake_forms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.patient_intake_forms (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    form_type character varying(100) NOT NULL,
    form_name character varying(255) NOT NULL,
    form_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying,
    submitted_at timestamp without time zone,
    reviewed_at timestamp without time zone,
    reviewed_by uuid,
    notes text,
    attachments jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.patient_intake_forms OWNER TO postgres;

--
-- Name: TABLE patient_intake_forms; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.patient_intake_forms IS 'Stores patient intake forms with flexible JSON data structure';


--
-- Name: patient_offering_enrollments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.patient_offering_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid,
    package_id uuid,
    offering_id uuid,
    enrollment_date date DEFAULT CURRENT_DATE NOT NULL,
    expiry_date date,
    status character varying(50) DEFAULT 'active'::character varying,
    total_allowed_uses integer DEFAULT 1,
    used_count integer DEFAULT 0,
    remaining_uses integer,
    amount_paid numeric(10,2),
    payment_method character varying(50),
    payment_status character varying(50) DEFAULT 'pending'::character varying,
    payment_id uuid,
    notes text,
    cancellation_reason text,
    cancelled_at timestamp without time zone,
    cancelled_by uuid,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.patient_offering_enrollments OWNER TO postgres;

--
-- Name: TABLE patient_offering_enrollments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.patient_offering_enrollments IS 'Track patient enrollments in packages and offerings';


--
-- Name: patient_pharmacies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.patient_pharmacies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid,
    pharmacy_id uuid,
    is_preferred boolean DEFAULT false,
    added_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.patient_pharmacies OWNER TO postgres;

--
-- Name: TABLE patient_pharmacies; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.patient_pharmacies IS 'Patient preferred pharmacy selections';


--
-- Name: patient_portal_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.patient_portal_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid,
    session_token character varying(255) NOT NULL,
    ip_address character varying(45),
    user_agent text,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.patient_portal_sessions OWNER TO postgres;

--
-- Name: patients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.patients (
    practice_id uuid,
    mrn character varying(50) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    date_of_birth date NOT NULL,
    gender character varying(20),
    phone character varying(20),
    email character varying(255),
    address text,
    emergency_contact jsonb,
    insurance_info jsonb,
    status character varying(20) DEFAULT 'active'::character varying,
    portal_enabled boolean DEFAULT false,
    portal_password_hash character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    height character varying(20),
    weight character varying(20),
    blood_type character varying(10),
    allergies text,
    past_history text,
    family_history text,
    current_medications text,
    id uuid NOT NULL,
    country character varying(2),
    timezone character varying(100),
    insurance_payer_id uuid,
    city character varying(100),
    state character varying(2),
    zip character varying(10),
    insurance character varying(100),
    insurance_id character varying(100),
    telehealth_preference character varying(50) DEFAULT NULL
);


ALTER TABLE public.patients OWNER TO postgres;

--
-- Name: TABLE patients; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.patients IS 'Patient records. Users with patient role will have entries here. Users can have multiple roles.';


--
-- Name: COLUMN patients.height; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.patients.height IS 'Patient height (e.g., 5''10", 178cm)';


--
-- Name: COLUMN patients.weight; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.patients.weight IS 'Patient weight (e.g., 180 lbs, 82kg)';


--
-- Name: COLUMN patients.blood_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.patients.blood_type IS 'Patient blood type (e.g., O+, A-, AB+)';


--
-- Name: COLUMN patients.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.patients.id IS 'Primary key - references users.id directly (no separate user_id column)';


--
-- Name: COLUMN patients.country; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.patients.country IS 'ISO 3166-1 alpha-2 country code (e.g., US, CA, GB)';


--
-- Name: COLUMN patients.timezone; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.patients.timezone IS 'IANA timezone string (e.g., America/New_York)';


--
-- Name: COLUMN patients.insurance_payer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.patients.insurance_payer_id IS 'Foreign key to insurance_payers table - patients default/primary insurance payer';


--
-- Name: COLUMN patients.city; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.patients.city IS 'Patient city';


--
-- Name: COLUMN patients.state; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.patients.state IS 'Patient state (2-letter code)';


--
-- Name: COLUMN patients.zip; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.patients.zip IS 'Patient ZIP/postal code';


--
-- Name: COLUMN patients.insurance; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.patients.insurance IS 'Insurance provider name';


--
-- Name: COLUMN patients.insurance_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.patients.insurance_id IS 'Insurance member ID';


--
-- Name: COLUMN patients.telehealth_preference; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.patients.telehealth_preference IS 'Preferred telehealth provider (zoom, google_meet, microsoft_teams, webex). NULL = clinic default.';


--
-- Name: payment_postings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_postings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    posting_number character varying(50) NOT NULL,
    claim_id uuid,
    patient_id uuid,
    insurance_payer_id uuid,
    check_number character varying(100),
    check_date date,
    payment_amount numeric(10,2) NOT NULL,
    allowed_amount numeric(10,2),
    deductible_amount numeric(10,2) DEFAULT 0,
    coinsurance_amount numeric(10,2) DEFAULT 0,
    copay_amount numeric(10,2) DEFAULT 0,
    adjustment_amount numeric(10,2) DEFAULT 0,
    adjustment_reason character varying(255),
    adjustment_code character varying(50),
    posting_date date NOT NULL,
    status character varying(50) DEFAULT 'posted'::character varying,
    payment_method character varying(50) DEFAULT 'check'::character varying,
    era_number character varying(100),
    eob_number character varying(100),
    notes text,
    internal_notes text,
    posted_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payment_postings_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['check'::character varying, 'eft'::character varying, 'credit_card'::character varying, 'cash'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT payment_postings_status_check CHECK (((status)::text = ANY ((ARRAY['posted'::character varying, 'pending'::character varying, 'reversed'::character varying, 'voided'::character varying])::text[])))
);


ALTER TABLE public.payment_postings OWNER TO postgres;

--
-- Name: TABLE payment_postings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.payment_postings IS 'Tracks insurance payment postings to claims';


--
-- Name: COLUMN payment_postings.posting_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payment_postings.posting_number IS 'Unique identifier for the payment posting (e.g., POST-2024-000001)';


--
-- Name: COLUMN payment_postings.allowed_amount; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payment_postings.allowed_amount IS 'Amount allowed by insurance for the claim';


--
-- Name: COLUMN payment_postings.adjustment_amount; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payment_postings.adjustment_amount IS 'Amount adjusted (write-off)';


--
-- Name: COLUMN payment_postings.era_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payment_postings.era_number IS 'Electronic Remittance Advice number';


--
-- Name: COLUMN payment_postings.eob_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payment_postings.eob_number IS 'Explanation of Benefits number';


--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    payment_number character varying(50),
    patient_id uuid,
    claim_id uuid,
    amount numeric(10,2) NOT NULL,
    payment_method character varying(50) NOT NULL,
    payment_status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    transaction_id character varying(100),
    card_last_four character varying(4),
    card_brand character varying(20),
    payment_date timestamp without time zone,
    description text,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    status text
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: TABLE payments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.payments IS 'Payment tracking with UUID primary key';


--
-- Name: COLUMN payments.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payments.id IS 'UUID primary key for payments';


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    display_name character varying(100) NOT NULL,
    description text,
    module character varying(50),
    action character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.permissions OWNER TO postgres;

--
-- Name: TABLE permissions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.permissions IS 'RBAC permissions including offerings management permissions';


--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permissions_id_seq OWNER TO postgres;

--
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- Name: pharmacies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pharmacies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    ncpdp_id character varying(20),
    npi character varying(20),
    pharmacy_name character varying(255) NOT NULL,
    chain_name character varying(255),
    address_line1 character varying(255),
    address_line2 character varying(255),
    city character varying(100),
    state character varying(2),
    zip_code character varying(10),
    phone character varying(20),
    fax character varying(20),
    email character varying(255),
    website character varying(255),
    is_24_hours boolean DEFAULT false,
    accepts_erx boolean DEFAULT true,
    erx_endpoint_url character varying(500),
    erx_system_type character varying(50),
    delivery_available boolean DEFAULT false,
    drive_through boolean DEFAULT false,
    accepts_insurance boolean DEFAULT true,
    preferred_network boolean DEFAULT false,
    distance_miles numeric(10,2),
    latitude numeric(10,8),
    longitude numeric(11,8),
    operating_hours jsonb,
    services jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.pharmacies OWNER TO postgres;

--
-- Name: TABLE pharmacies; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.pharmacies IS 'Network of pharmacies that accept electronic prescriptions';


--
-- Name: practices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.practices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    tax_id character varying(20),
    phone character varying(20),
    email character varying(255),
    address jsonb,
    plan_tier character varying(20) DEFAULT 'professional'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    country character varying(2),
    timezone character varying(100)
);


ALTER TABLE public.practices OWNER TO postgres;

--
-- Name: COLUMN practices.country; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.practices.country IS 'ISO 3166-1 alpha-2 country code (e.g., US, CA, GB)';


--
-- Name: COLUMN practices.timezone; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.practices.timezone IS 'IANA timezone string (e.g., America/New_York)';


--
-- Name: preapprovals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.preapprovals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    preapproval_number character varying(100) NOT NULL,
    patient_id uuid,
    insurance_payer_id uuid,
    requested_service character varying(255) NOT NULL,
    diagnosis_codes jsonb,
    procedure_codes jsonb,
    service_start_date date,
    service_end_date date,
    estimated_cost numeric(10,2),
    authorization_number character varying(100),
    status character varying(50) DEFAULT 'Pending'::character varying,
    clearinghouse_request_id character varying(255),
    clearinghouse_status character varying(50),
    submitted_to_clearinghouse_at timestamp without time zone,
    clearinghouse_response jsonb,
    approved_by character varying(255),
    approved_at timestamp without time zone,
    approval_valid_until date,
    denied_reason text,
    clinical_notes text,
    supporting_documents jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.preapprovals OWNER TO postgres;

--
-- Name: prescription_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.prescription_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    prescription_id uuid,
    action character varying(50) NOT NULL,
    action_by uuid,
    action_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    old_status character varying(50),
    new_status character varying(50),
    pharmacy_id uuid,
    fill_number integer,
    quantity_dispensed integer,
    pharmacist_name character varying(255),
    pharmacist_license character varying(50),
    notes text,
    metadata jsonb
);


ALTER TABLE public.prescription_history OWNER TO postgres;

--
-- Name: TABLE prescription_history; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.prescription_history IS 'Audit log of all prescription actions and fills';


--
-- Name: prescriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.prescriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid,
    provider_id uuid,
    appointment_id uuid,
    medication_name character varying(255),
    dosage character varying(100) NOT NULL,
    frequency character varying(100) NOT NULL,
    duration character varying(100),
    instructions text,
    refills integer DEFAULT 0,
    status character varying(50) DEFAULT 'Active'::character varying,
    prescribed_date date DEFAULT CURRENT_DATE,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ndc_code character varying(20),
    drug_strength character varying(50),
    drug_form character varying(50),
    quantity integer,
    days_supply integer,
    daw_code integer DEFAULT 0,
    prior_auth_required boolean DEFAULT false,
    prior_auth_number character varying(50),
    pharmacy_id uuid,
    erx_message_id character varying(100),
    erx_status character varying(50) DEFAULT 'draft'::character varying,
    erx_sent_date timestamp without time zone,
    erx_response_date timestamp without time zone,
    erx_error_message text,
    controlled_substance_class character varying(10),
    prescriber_dea_number character varying(20),
    diagnosis_code character varying(20),
    substitution_allowed boolean DEFAULT true,
    sig_code text,
    notes_to_pharmacist text,
    refills_remaining integer DEFAULT 0,
    last_filled_date date,
    cancelled_reason text,
    cancelled_date timestamp without time zone,
    cancelled_by uuid,
    vendor_prescription_id character varying(255),
    vendor_status character varying(50),
    sent_to_vendor_at timestamp without time zone,
    vendor_response jsonb,
    diagnosis_id uuid,
    fhir_tracking_id uuid
);


ALTER TABLE public.prescriptions OWNER TO postgres;

--
-- Name: TABLE prescriptions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.prescriptions IS 'Stores patient prescriptions with medication details';


--
-- Name: provider_booking_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.provider_booking_config (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    provider_id uuid NOT NULL,
    booking_url_slug character varying(100),
    timezone character varying(100) DEFAULT 'UTC'::character varying,
    slot_interval_minutes integer DEFAULT 15,
    max_concurrent_bookings integer DEFAULT 1,
    allow_public_booking boolean DEFAULT true,
    require_patient_account boolean DEFAULT false,
    send_confirmation_email boolean DEFAULT true,
    send_reminder_email boolean DEFAULT true,
    reminder_hours_before integer DEFAULT 24,
    allow_cancellation boolean DEFAULT true,
    cancellation_hours_before integer DEFAULT 24,
    allow_rescheduling boolean DEFAULT true,
    reschedule_hours_before integer DEFAULT 24,
    booking_instructions text,
    custom_fields jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.provider_booking_config OWNER TO postgres;

--
-- Name: TABLE provider_booking_config; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.provider_booking_config IS 'Provider-specific booking settings and public booking URLs';


--
-- Name: providers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.providers (
    id uuid NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    specialization character varying(100),
    email character varying(255),
    phone character varying(20),
    license_number character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.providers OWNER TO postgres;

--
-- Name: TABLE providers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.providers IS 'Provider records. id directly references users.id (provider IS a user). Users can have multiple roles.';


--
-- Name: COLUMN providers.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.providers.id IS 'Primary key - references users.id directly (provider IS a user)';


--
-- Name: recurring_appointments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recurring_appointments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    appointment_type_id uuid,
    recurrence_rule character varying(255) NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone,
    duration_minutes integer NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.recurring_appointments OWNER TO postgres;

--
-- Name: TABLE recurring_appointments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.recurring_appointments IS 'Manages recurring appointment series';


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    role_id integer NOT NULL,
    permission_id integer NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: TABLE role_permissions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.role_permissions IS 'Mapping between roles and their permissions';


--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    display_name character varying(100) NOT NULL,
    description text,
    is_system_role boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: TABLE roles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.roles IS 'System and custom user roles';


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: service_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.service_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    icon character varying(100),
    color character varying(50),
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.service_categories OWNER TO postgres;

--
-- Name: TABLE service_categories; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.service_categories IS 'Categories for organizing healthcare offerings';


--
-- Name: social_auth; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.social_auth (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    patient_id uuid,
    provider character varying(20) NOT NULL,
    provider_user_id character varying(255) NOT NULL,
    access_token text,
    refresh_token text,
    token_expires_at timestamp without time zone,
    profile_data jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.social_auth OWNER TO postgres;

--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscription_plans (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    display_name character varying(100) NOT NULL,
    description text,
    price numeric(10,2),
    billing_cycle character varying(20),
    max_users integer,
    max_patients integer,
    features jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.subscription_plans OWNER TO postgres;

--
-- Name: TABLE subscription_plans; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.subscription_plans IS 'Available subscription plans';


--
-- Name: subscription_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subscription_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subscription_plans_id_seq OWNER TO postgres;

--
-- Name: subscription_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.subscription_plans_id_seq OWNED BY public.subscription_plans.id;


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id integer NOT NULL,
    title text NOT NULL,
    priority character varying(50) DEFAULT 'Medium'::character varying,
    due_date date,
    status character varying(50) DEFAULT 'Pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    description text,
    assigned_to uuid
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tasks_id_seq OWNER TO postgres;

--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: telehealth_provider_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.telehealth_provider_settings (
    id integer NOT NULL,
    provider_type character varying(50) NOT NULL,
    is_enabled boolean DEFAULT false,
    api_key text,
    api_secret text,
    client_id text,
    client_secret text,
    webhook_secret text,
    access_token text,
    refresh_token text,
    token_type character varying(50) DEFAULT 'Bearer',
    token_scope text,
    token_expires_at bigint,
    account_id character varying(255),
    zoom_user_id character varying(255),
    zoom_user_email character varying(255),
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.telehealth_provider_settings OWNER TO postgres;

--
-- Name: TABLE telehealth_provider_settings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.telehealth_provider_settings IS 'Settings for different telehealth providers (Zoom, Google Meet, Webex)';


--
-- Name: telehealth_provider_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.telehealth_provider_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.telehealth_provider_settings_id_seq OWNER TO postgres;

--
-- Name: telehealth_provider_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.telehealth_provider_settings_id_seq OWNED BY public.telehealth_provider_settings.id;


--
-- Name: telehealth_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.telehealth_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    appointment_id uuid,
    patient_id uuid,
    provider_id uuid,
    session_status character varying(20) DEFAULT 'scheduled'::character varying,
    room_id character varying(100) NOT NULL,
    meeting_url text,
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    duration_minutes integer,
    recording_url text,
    recording_enabled boolean DEFAULT false,
    participants jsonb DEFAULT '[]'::jsonb,
    session_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    provider_type character varying(50) DEFAULT 'medflow'::character varying
);


ALTER TABLE public.telehealth_sessions OWNER TO postgres;

--
-- Name: user_role_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_role_history (
    id integer NOT NULL,
    user_id uuid,
    old_role character varying(50),
    new_role character varying(50),
    changed_at timestamp without time zone DEFAULT now(),
    changed_by uuid
);


ALTER TABLE public.user_role_history OWNER TO postgres;

--
-- Name: user_role_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_role_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_role_history_id_seq OWNER TO postgres;

--
-- Name: user_role_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_role_history_id_seq OWNED BY public.user_role_history.id;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    role_id integer NOT NULL,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id uuid,
    assigned_by uuid
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: TABLE user_roles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_roles IS 'Users can have multiple roles';


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    name character varying(255),
    role character varying(100) DEFAULT 'user'::character varying,
    practice character varying(255),
    avatar character varying(10),
    email character varying(255),
    phone character varying(20),
    license character varying(50),
    specialty character varying(100),
    preferences jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    password_hash character varying(255),
    reset_token character varying(255),
    reset_token_expires timestamp without time zone,
    status character varying(20) DEFAULT 'active'::character varying,
    language character varying(10) DEFAULT 'en'::character varying,
    active_role character varying(100),
    id uuid NOT NULL,
    country character varying(2),
    timezone character varying(100),
    license_number character varying(100)
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: COLUMN users.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.status IS 'User account status: active (can login), blocked (cannot login), pending (awaiting approval)';


--
-- Name: COLUMN users.language; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.language IS 'User preferred language (en, es, fr, etc.)';


--
-- Name: COLUMN users.active_role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.active_role IS 'Currently active role when user has multiple roles';


--
-- Name: COLUMN users.country; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.country IS 'ISO 3166-1 alpha-2 country code (e.g., US, CA, GB)';


--
-- Name: COLUMN users.timezone; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.timezone IS 'IANA timezone string (e.g., America/New_York)';


--
-- Name: v_fhir_tracking_errors; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_fhir_tracking_errors AS
 SELECT ft.id,
    ft.resource_type,
    ft.resource_reference,
    ft.tracking_number,
    ft.current_status,
    ft.has_errors,
    ft.error_count,
    ft.last_error_code,
    ft.last_error_message,
    ft.last_error_at,
    ft.suggested_actions,
    ft.action_required,
    ft.action_deadline,
    ea.error_title,
    ea.error_description,
    ea.error_severity,
    ea.requires_manual_intervention,
    ea.resolution_guide,
    ft.vendor_name,
    ft.vendor_tracking_id
   FROM (public.fhir_tracking ft
     LEFT JOIN public.fhir_error_actions ea ON (((ft.last_error_code)::text = (ea.error_code)::text)))
  WHERE (ft.has_errors = true);


ALTER VIEW public.v_fhir_tracking_errors OWNER TO postgres;

--
-- Name: v_fhir_tracking_timeline; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_fhir_tracking_timeline AS
 SELECT ft.id AS tracking_id,
    ft.tracking_number,
    ft.resource_type,
    ft.resource_reference,
    fte.id AS event_id,
    fte.event_type,
    fte.event_description,
    fte.from_status,
    fte.to_status,
    fte.is_error,
    fte.error_code,
    fte.error_message,
    fte.error_severity,
    fte.vendor_name,
    fte.action_taken,
    fte.action_result,
    fte.created_at AS event_time
   FROM (public.fhir_tracking ft
     LEFT JOIN public.fhir_tracking_events fte ON ((ft.id = fte.fhir_tracking_id)))
  ORDER BY ft.created_at DESC, fte.created_at DESC;


ALTER VIEW public.v_fhir_tracking_timeline OWNER TO postgres;

--
-- Name: v_lab_order_tracking; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_lab_order_tracking AS
 SELECT lo.id AS lab_order_id,
    lo.patient_id,
    lo.provider_id,
    lo.order_number,
    lo.order_type,
    lo.status AS lab_order_status,
    ft.id AS tracking_id,
    ft.tracking_number,
    ft.current_status AS tracking_status,
    ft.fhir_status,
    ft.priority,
    ft.vendor_name,
    ft.vendor_tracking_id,
    ft.vendor_status,
    ft.has_errors,
    ft.error_count,
    ft.last_error_message,
    ft.suggested_actions,
    ft.action_required,
    ft.initiated_at,
    ft.completed_at,
    lo.created_at AS order_created_at
   FROM (public.lab_orders lo
     LEFT JOIN public.fhir_tracking ft ON ((lo.fhir_tracking_id = ft.id)));


ALTER VIEW public.v_lab_order_tracking OWNER TO postgres;

--
-- Name: v_prescription_tracking; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_prescription_tracking AS
 SELECT p.id AS prescription_id,
    p.patient_id,
    p.provider_id,
    p.medication_name,
    p.status AS prescription_status,
    ft.id AS tracking_id,
    ft.tracking_number,
    ft.current_status AS tracking_status,
    ft.fhir_status,
    ft.vendor_name,
    ft.vendor_tracking_id,
    ft.vendor_status,
    ft.has_errors,
    ft.error_count,
    ft.last_error_message,
    ft.suggested_actions,
    ft.action_required,
    ft.initiated_at,
    ft.completed_at,
    p.created_at AS prescription_created_at
   FROM (public.prescriptions p
     LEFT JOIN public.fhir_tracking ft ON ((p.fhir_tracking_id = ft.id)))
  WHERE ((p.status)::text <> 'Deleted'::text);


ALTER VIEW public.v_prescription_tracking OWNER TO postgres;

--
-- Name: vendor_integration_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendor_integration_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_type character varying(50) NOT NULL,
    is_enabled boolean DEFAULT false,
    api_key character varying(500),
    api_secret character varying(500),
    client_id character varying(500),
    client_secret character varying(500),
    username character varying(255),
    password character varying(500),
    base_url character varying(500),
    sandbox_mode boolean DEFAULT true,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_tested_at timestamp without time zone,
    test_status character varying(50),
    test_message text
);


ALTER TABLE public.vendor_integration_settings OWNER TO postgres;

--
-- Name: TABLE vendor_integration_settings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.vendor_integration_settings IS 'Stores configuration and credentials for healthcare vendor integrations (Surescripts, Labcorp, Optum)';


--
-- Name: vendor_transaction_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendor_transaction_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_type character varying(50) NOT NULL,
    transaction_type character varying(100) NOT NULL,
    request_data jsonb,
    response_data jsonb,
    status character varying(50),
    error_message text,
    external_id character varying(255),
    internal_reference_id uuid,
    patient_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone
);


ALTER TABLE public.vendor_transaction_log OWNER TO postgres;

--
-- Name: TABLE vendor_transaction_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.vendor_transaction_log IS 'Audit log for all vendor API transactions';


--
-- Name: appointment_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointment_types ALTER COLUMN id SET DEFAULT nextval('public.appointment_types_id_seq'::regclass);


--
-- Name: backup_provider_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backup_provider_settings ALTER COLUMN id SET DEFAULT nextval('public.backup_provider_settings_id_seq'::regclass);


--
-- Name: campaigns id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns ALTER COLUMN id SET DEFAULT nextval('public.campaigns_id_seq'::regclass);


--
-- Name: clinic_appointment_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clinic_appointment_settings ALTER COLUMN id SET DEFAULT nextval('public.clinic_appointment_settings_id_seq'::regclass);


--
-- Name: clinic_info id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clinic_info ALTER COLUMN id SET DEFAULT nextval('public.clinic_info_id_seq'::regclass);


--
-- Name: clinic_working_hours id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clinic_working_hours ALTER COLUMN id SET DEFAULT nextval('public.clinic_working_hours_id_seq'::regclass);


--
-- Name: notification_preferences id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences ALTER COLUMN id SET DEFAULT nextval('public.notification_preferences_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: organization_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_settings ALTER COLUMN id SET DEFAULT nextval('public.organization_settings_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: subscription_plans id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_plans ALTER COLUMN id SET DEFAULT nextval('public.subscription_plans_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: telehealth_provider_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telehealth_provider_settings ALTER COLUMN id SET DEFAULT nextval('public.telehealth_provider_settings_id_seq'::regclass);


--
-- Name: user_role_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_role_history ALTER COLUMN id SET DEFAULT nextval('public.user_role_history_id_seq'::regclass);


--
-- Name: appointment_reminders appointment_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointment_reminders
    ADD CONSTRAINT appointment_reminders_pkey PRIMARY KEY (id);


--
-- Name: appointment_type_config appointment_type_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointment_type_config
    ADD CONSTRAINT appointment_type_config_pkey PRIMARY KEY (id);


--
-- Name: appointment_types appointment_types_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointment_types
    ADD CONSTRAINT appointment_types_name_key UNIQUE (name);


--
-- Name: appointment_types appointment_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointment_types
    ADD CONSTRAINT appointment_types_pkey PRIMARY KEY (id);


--
-- Name: appointment_waitlist appointment_waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointment_waitlist
    ADD CONSTRAINT appointment_waitlist_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: archive_rules archive_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.archive_rules
    ADD CONSTRAINT archive_rules_pkey PRIMARY KEY (id);


--
-- Name: archive_rules archive_rules_rule_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.archive_rules
    ADD CONSTRAINT archive_rules_rule_name_key UNIQUE (rule_name);


--
-- Name: archives archives_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.archives
    ADD CONSTRAINT archives_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: backup_provider_settings backup_provider_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backup_provider_settings
    ADD CONSTRAINT backup_provider_settings_pkey PRIMARY KEY (id);


--
-- Name: backup_provider_settings backup_provider_settings_provider_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backup_provider_settings
    ADD CONSTRAINT backup_provider_settings_provider_type_key UNIQUE (provider_type);


--
-- Name: booking_analytics booking_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_analytics
    ADD CONSTRAINT booking_analytics_pkey PRIMARY KEY (id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: claim_submissions claim_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claim_submissions
    ADD CONSTRAINT claim_submissions_pkey PRIMARY KEY (id);


--
-- Name: claims claims_claim_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_claim_number_key UNIQUE (claim_number);


--
-- Name: claims claims_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_pkey PRIMARY KEY (id);


--
-- Name: clinic_appointment_settings clinic_appointment_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clinic_appointment_settings
    ADD CONSTRAINT clinic_appointment_settings_pkey PRIMARY KEY (id);


--
-- Name: clinic_info clinic_info_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clinic_info
    ADD CONSTRAINT clinic_info_pkey PRIMARY KEY (id);


--
-- Name: clinic_working_hours clinic_working_hours_day_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clinic_working_hours
    ADD CONSTRAINT clinic_working_hours_day_key UNIQUE (day);


--
-- Name: clinic_working_hours clinic_working_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clinic_working_hours
    ADD CONSTRAINT clinic_working_hours_pkey PRIMARY KEY (id);


--
-- Name: denials denials_denial_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.denials
    ADD CONSTRAINT denials_denial_number_key UNIQUE (denial_number);


--
-- Name: denials denials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.denials
    ADD CONSTRAINT denials_pkey PRIMARY KEY (id);


--
-- Name: diagnoses diagnoses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diagnoses
    ADD CONSTRAINT diagnoses_pkey PRIMARY KEY (id);


--
-- Name: diagnosis diagnosis_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diagnosis
    ADD CONSTRAINT diagnosis_pkey PRIMARY KEY (id);


--
-- Name: doctor_availability doctor_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor_availability
    ADD CONSTRAINT doctor_availability_pkey PRIMARY KEY (id);


--
-- Name: doctor_time_off doctor_time_off_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor_time_off
    ADD CONSTRAINT doctor_time_off_pkey PRIMARY KEY (id);


--
-- Name: drug_interactions drug_interactions_drug1_ndc_drug2_ndc_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drug_interactions
    ADD CONSTRAINT drug_interactions_drug1_ndc_drug2_ndc_key UNIQUE (drug1_ndc, drug2_ndc);


--
-- Name: drug_interactions drug_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drug_interactions
    ADD CONSTRAINT drug_interactions_pkey PRIMARY KEY (id);


--
-- Name: erx_message_queue erx_message_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.erx_message_queue
    ADD CONSTRAINT erx_message_queue_pkey PRIMARY KEY (id);


--
-- Name: fhir_error_actions fhir_error_actions_error_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fhir_error_actions
    ADD CONSTRAINT fhir_error_actions_error_code_key UNIQUE (error_code);


--
-- Name: fhir_error_actions fhir_error_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fhir_error_actions
    ADD CONSTRAINT fhir_error_actions_pkey PRIMARY KEY (id);


--
-- Name: fhir_resources fhir_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fhir_resources
    ADD CONSTRAINT fhir_resources_pkey PRIMARY KEY (id);


--
-- Name: fhir_resources fhir_resources_resource_type_resource_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fhir_resources
    ADD CONSTRAINT fhir_resources_resource_type_resource_id_key UNIQUE (resource_type, resource_id);


--
-- Name: fhir_tracking_events fhir_tracking_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fhir_tracking_events
    ADD CONSTRAINT fhir_tracking_events_pkey PRIMARY KEY (id);


--
-- Name: fhir_tracking fhir_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fhir_tracking
    ADD CONSTRAINT fhir_tracking_pkey PRIMARY KEY (id);


--
-- Name: fhir_tracking fhir_tracking_tracking_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fhir_tracking
    ADD CONSTRAINT fhir_tracking_tracking_number_key UNIQUE (tracking_number);


--
-- Name: healthcare_offerings healthcare_offerings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.healthcare_offerings
    ADD CONSTRAINT healthcare_offerings_pkey PRIMARY KEY (id);


--
-- Name: insurance_payers insurance_payers_payer_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_payers
    ADD CONSTRAINT insurance_payers_payer_id_key UNIQUE (payer_id);


--
-- Name: insurance_payers insurance_payers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_payers
    ADD CONSTRAINT insurance_payers_pkey PRIMARY KEY (id);


--
-- Name: lab_orders lab_orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_order_number_key UNIQUE (order_number);


--
-- Name: lab_orders lab_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_pkey PRIMARY KEY (id);


--
-- Name: laboratories laboratories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.laboratories
    ADD CONSTRAINT laboratories_pkey PRIMARY KEY (id);


--
-- Name: medical_codes medical_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medical_codes
    ADD CONSTRAINT medical_codes_code_key UNIQUE (code);


--
-- Name: medical_codes medical_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medical_codes
    ADD CONSTRAINT medical_codes_pkey PRIMARY KEY (id);


--
-- Name: medical_records medical_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medical_records
    ADD CONSTRAINT medical_records_pkey PRIMARY KEY (id);


--
-- Name: medication_alternatives medication_alternatives_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medication_alternatives
    ADD CONSTRAINT medication_alternatives_pkey PRIMARY KEY (id);


--
-- Name: medications medications_ndc_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medications
    ADD CONSTRAINT medications_ndc_code_key UNIQUE (ndc_code);


--
-- Name: medications medications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medications
    ADD CONSTRAINT medications_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_patient_channel_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_patient_channel_key UNIQUE (patient_id, channel_type);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: offering_insurance_mappings offering_insurance_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offering_insurance_mappings
    ADD CONSTRAINT offering_insurance_mappings_pkey PRIMARY KEY (id);


--
-- Name: offering_packages offering_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offering_packages
    ADD CONSTRAINT offering_packages_pkey PRIMARY KEY (id);


--
-- Name: offering_pricing offering_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offering_pricing
    ADD CONSTRAINT offering_pricing_pkey PRIMARY KEY (id);


--
-- Name: offering_promotions offering_promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offering_promotions
    ADD CONSTRAINT offering_promotions_pkey PRIMARY KEY (id);


--
-- Name: offering_promotions offering_promotions_promo_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offering_promotions
    ADD CONSTRAINT offering_promotions_promo_code_key UNIQUE (promo_code);


--
-- Name: offering_reviews offering_reviews_offering_id_patient_id_appointment_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offering_reviews
    ADD CONSTRAINT offering_reviews_offering_id_patient_id_appointment_id_key UNIQUE (offering_id, patient_id, appointment_id);


--
-- Name: offering_reviews offering_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offering_reviews
    ADD CONSTRAINT offering_reviews_pkey PRIMARY KEY (id);


--
-- Name: organization_settings organization_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_pkey PRIMARY KEY (id);


--
-- Name: package_offerings package_offerings_package_id_offering_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_offerings
    ADD CONSTRAINT package_offerings_package_id_offering_id_key UNIQUE (package_id, offering_id);


--
-- Name: package_offerings package_offerings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_offerings
    ADD CONSTRAINT package_offerings_pkey PRIMARY KEY (id);


--
-- Name: patient_allergies patient_allergies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_allergies
    ADD CONSTRAINT patient_allergies_pkey PRIMARY KEY (id);


--
-- Name: patient_consent_forms patient_consent_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_consent_forms
    ADD CONSTRAINT patient_consent_forms_pkey PRIMARY KEY (id);


--
-- Name: patient_intake_flows patient_intake_flows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_intake_flows
    ADD CONSTRAINT patient_intake_flows_pkey PRIMARY KEY (id);


--
-- Name: patient_intake_forms patient_intake_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_intake_forms
    ADD CONSTRAINT patient_intake_forms_pkey PRIMARY KEY (id);


--
-- Name: patient_offering_enrollments patient_offering_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_offering_enrollments
    ADD CONSTRAINT patient_offering_enrollments_pkey PRIMARY KEY (id);


--
-- Name: patient_pharmacies patient_pharmacies_patient_id_pharmacy_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_pharmacies
    ADD CONSTRAINT patient_pharmacies_patient_id_pharmacy_id_key UNIQUE (patient_id, pharmacy_id);


--
-- Name: patient_pharmacies patient_pharmacies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_pharmacies
    ADD CONSTRAINT patient_pharmacies_pkey PRIMARY KEY (id);


--
-- Name: patient_portal_sessions patient_portal_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_portal_sessions
    ADD CONSTRAINT patient_portal_sessions_pkey PRIMARY KEY (id);


--
-- Name: patient_portal_sessions patient_portal_sessions_session_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_portal_sessions
    ADD CONSTRAINT patient_portal_sessions_session_token_key UNIQUE (session_token);


--
-- Name: patients patients_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_email_unique UNIQUE (email);


--
-- Name: patients patients_mrn_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_mrn_key UNIQUE (mrn);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: payment_postings payment_postings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_postings
    ADD CONSTRAINT payment_postings_pkey PRIMARY KEY (id);


--
-- Name: payment_postings payment_postings_posting_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_postings
    ADD CONSTRAINT payment_postings_posting_number_key UNIQUE (posting_number);


--
-- Name: payments payments_payment_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_payment_number_key UNIQUE (payment_number);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: pharmacies pharmacies_ncpdp_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pharmacies
    ADD CONSTRAINT pharmacies_ncpdp_id_key UNIQUE (ncpdp_id);


--
-- Name: pharmacies pharmacies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pharmacies
    ADD CONSTRAINT pharmacies_pkey PRIMARY KEY (id);


--
-- Name: practices practices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practices
    ADD CONSTRAINT practices_pkey PRIMARY KEY (id);


--
-- Name: preapprovals preapprovals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.preapprovals
    ADD CONSTRAINT preapprovals_pkey PRIMARY KEY (id);


--
-- Name: preapprovals preapprovals_preapproval_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.preapprovals
    ADD CONSTRAINT preapprovals_preapproval_number_key UNIQUE (preapproval_number);


--
-- Name: prescription_history prescription_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescription_history
    ADD CONSTRAINT prescription_history_pkey PRIMARY KEY (id);


--
-- Name: prescriptions prescriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);


--
-- Name: provider_booking_config provider_booking_config_booking_url_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_booking_config
    ADD CONSTRAINT provider_booking_config_booking_url_slug_key UNIQUE (booking_url_slug);


--
-- Name: provider_booking_config provider_booking_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_booking_config
    ADD CONSTRAINT provider_booking_config_pkey PRIMARY KEY (id);


--
-- Name: provider_booking_config provider_booking_config_provider_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_booking_config
    ADD CONSTRAINT provider_booking_config_provider_id_key UNIQUE (provider_id);


--
-- Name: providers providers_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_email_unique UNIQUE (email);


--
-- Name: providers providers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_pkey PRIMARY KEY (id);


--
-- Name: recurring_appointments recurring_appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recurring_appointments
    ADD CONSTRAINT recurring_appointments_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: service_categories service_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_pkey PRIMARY KEY (id);


--
-- Name: social_auth social_auth_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.social_auth
    ADD CONSTRAINT social_auth_pkey PRIMARY KEY (id);


--
-- Name: social_auth social_auth_provider_provider_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.social_auth
    ADD CONSTRAINT social_auth_provider_provider_user_id_key UNIQUE (provider, provider_user_id);


--
-- Name: subscription_plans subscription_plans_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_name_key UNIQUE (name);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: telehealth_provider_settings telehealth_provider_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telehealth_provider_settings
    ADD CONSTRAINT telehealth_provider_settings_pkey PRIMARY KEY (id);


--
-- Name: telehealth_provider_settings telehealth_provider_settings_provider_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telehealth_provider_settings
    ADD CONSTRAINT telehealth_provider_settings_provider_type_key UNIQUE (provider_type);


--
-- Name: telehealth_sessions telehealth_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telehealth_sessions
    ADD CONSTRAINT telehealth_sessions_pkey PRIMARY KEY (id);


--
-- Name: telehealth_sessions telehealth_sessions_room_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telehealth_sessions
    ADD CONSTRAINT telehealth_sessions_room_id_key UNIQUE (room_id);


--
-- Name: user_role_history user_role_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_role_history
    ADD CONSTRAINT user_role_history_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendor_integration_settings vendor_integration_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_integration_settings
    ADD CONSTRAINT vendor_integration_settings_pkey PRIMARY KEY (id);


--
-- Name: vendor_integration_settings vendor_integration_settings_vendor_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_integration_settings
    ADD CONSTRAINT vendor_integration_settings_vendor_type_key UNIQUE (vendor_type);


--
-- Name: vendor_transaction_log vendor_transaction_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_transaction_log
    ADD CONSTRAINT vendor_transaction_log_pkey PRIMARY KEY (id);


--
-- Name: idx_analytics_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_analytics_created ON public.booking_analytics USING btree (created_at);


--
-- Name: idx_analytics_event; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_analytics_event ON public.booking_analytics USING btree (event_type);


--
-- Name: idx_analytics_provider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_analytics_provider ON public.booking_analytics USING btree (provider_id);


--
-- Name: idx_appointment_type_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointment_type_active ON public.appointment_type_config USING btree (is_active);


--
-- Name: idx_appointment_type_provider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointment_type_provider ON public.appointment_type_config USING btree (provider_id);


--
-- Name: idx_appointment_types_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointment_types_active ON public.appointment_types USING btree (is_active);


--
-- Name: idx_appointment_types_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointment_types_order ON public.appointment_types USING btree (display_order);


--
-- Name: idx_appointments_booking_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_booking_source ON public.appointments USING btree (booking_source);


--
-- Name: idx_appointments_cancelled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_cancelled ON public.appointments USING btree (cancelled_at);


--
-- Name: idx_appointments_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_patient ON public.appointments USING btree (patient_id);


--
-- Name: idx_appointments_provider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_provider ON public.appointments USING btree (provider_id);


--
-- Name: idx_appointments_recurring; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_recurring ON public.appointments USING btree (recurring_appointment_id);


--
-- Name: idx_appointments_start_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_start_time ON public.appointments USING btree (start_time);


--
-- Name: idx_appointments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_status ON public.appointments USING btree (status);


--
-- Name: idx_appointments_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_type ON public.appointments USING btree (appointment_type_id);


--
-- Name: idx_archive_rules_enabled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_archive_rules_enabled ON public.archive_rules USING btree (enabled);


--
-- Name: idx_archive_rules_next_run; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_archive_rules_next_run ON public.archive_rules USING btree (next_run_at) WHERE (enabled = true);


--
-- Name: idx_archive_rules_schedule_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_archive_rules_schedule_type ON public.archive_rules USING btree (schedule_type);


--
-- Name: idx_archives_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_archives_created_at ON public.archives USING btree (created_at);


--
-- Name: idx_archives_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_archives_created_by ON public.archives USING btree (created_by);


--
-- Name: idx_archives_modules; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_archives_modules ON public.archives USING gin (modules);


--
-- Name: idx_archives_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_archives_status ON public.archives USING btree (status);


--
-- Name: idx_audit_logs_action_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_action_type ON public.audit_logs USING btree (action_type);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_module; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_module ON public.audit_logs USING btree (module);


--
-- Name: idx_audit_logs_patient_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_patient_id ON public.audit_logs USING btree (patient_id);


--
-- Name: idx_audit_logs_provider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_provider_id ON public.audit_logs USING btree (provider_id);


--
-- Name: idx_audit_logs_resource_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_resource_date ON public.audit_logs USING btree (resource_type, resource_name, created_at DESC);


--
-- Name: idx_audit_logs_resource_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_resource_name ON public.audit_logs USING btree (resource_name);


--
-- Name: idx_audit_logs_resource_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_resource_type ON public.audit_logs USING btree (resource_type);


--
-- Name: idx_audit_logs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_status ON public.audit_logs USING btree (status);


--
-- Name: idx_audit_logs_user_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_user_date ON public.audit_logs USING btree (user_id, created_at DESC);


--
-- Name: idx_audit_logs_user_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_user_email ON public.audit_logs USING btree (user_email);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_booking_config_provider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_booking_config_provider ON public.provider_booking_config USING btree (provider_id);


--
-- Name: idx_booking_config_url; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_booking_config_url ON public.provider_booking_config USING btree (booking_url_slug);


--
-- Name: idx_claim_submissions_claim_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_claim_submissions_claim_id ON public.claim_submissions USING btree (claim_id);


--
-- Name: idx_claim_submissions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_claim_submissions_status ON public.claim_submissions USING btree (status);


--
-- Name: idx_claim_submissions_submission_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_claim_submissions_submission_date ON public.claim_submissions USING btree (submission_date);


--
-- Name: idx_claim_submissions_submission_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_claim_submissions_submission_id ON public.claim_submissions USING btree (submission_id);


--
-- Name: idx_claims_preapproval_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_claims_preapproval_id ON public.claims USING btree (preapproval_id);


--
-- Name: idx_consent_forms_consent_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consent_forms_consent_type ON public.patient_consent_forms USING btree (consent_type);


--
-- Name: idx_consent_forms_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consent_forms_expires_at ON public.patient_consent_forms USING btree (expires_at);


--
-- Name: idx_consent_forms_patient_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consent_forms_patient_id ON public.patient_consent_forms USING btree (patient_id);


--
-- Name: idx_consent_forms_signed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consent_forms_signed_at ON public.patient_consent_forms USING btree (signed_at DESC);


--
-- Name: idx_consent_forms_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consent_forms_status ON public.patient_consent_forms USING btree (status);


--
-- Name: idx_denials_appeal_deadline; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_denials_appeal_deadline ON public.denials USING btree (appeal_deadline);


--
-- Name: idx_denials_appeal_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_denials_appeal_status ON public.denials USING btree (appeal_status);


--
-- Name: idx_denials_assigned_to; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_denials_assigned_to ON public.denials USING btree (assigned_to);


--
-- Name: idx_denials_claim_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_denials_claim_id ON public.denials USING btree (claim_id);


--
-- Name: idx_denials_denial_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_denials_denial_date ON public.denials USING btree (denial_date);


--
-- Name: idx_denials_insurance_payer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_denials_insurance_payer_id ON public.denials USING btree (insurance_payer_id);


--
-- Name: idx_denials_patient_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_denials_patient_id ON public.denials USING btree (patient_id);


--
-- Name: idx_denials_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_denials_priority ON public.denials USING btree (priority);


--
-- Name: idx_denials_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_denials_status ON public.denials USING btree (status);


--
-- Name: idx_diagnosis_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_diagnosis_patient ON public.diagnosis USING btree (patient_id);


--
-- Name: idx_diagnosis_provider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_diagnosis_provider ON public.diagnosis USING btree (provider_id);


--
-- Name: idx_diagnosis_soap_notes; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_diagnosis_soap_notes ON public.diagnosis USING gin (to_tsvector('english'::regconfig, COALESCE(soap_notes, ''::text)));


--
-- Name: idx_doctor_availability_day; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_doctor_availability_day ON public.doctor_availability USING btree (day_of_week);


--
-- Name: idx_doctor_availability_provider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_doctor_availability_provider ON public.doctor_availability USING btree (provider_id);


--
-- Name: idx_doctor_time_off_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_doctor_time_off_dates ON public.doctor_time_off USING btree (start_date, end_date);


--
-- Name: idx_doctor_time_off_provider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_doctor_time_off_provider ON public.doctor_time_off USING btree (provider_id);


--
-- Name: idx_drug_interactions_drug1; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_drug_interactions_drug1 ON public.drug_interactions USING btree (drug1_ndc);


--
-- Name: idx_drug_interactions_drug2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_drug_interactions_drug2 ON public.drug_interactions USING btree (drug2_ndc);


--
-- Name: idx_enrollments_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_enrollments_patient ON public.patient_offering_enrollments USING btree (patient_id);


--
-- Name: idx_erx_queue_pharmacy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_erx_queue_pharmacy ON public.erx_message_queue USING btree (pharmacy_id);


--
-- Name: idx_erx_queue_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_erx_queue_status ON public.erx_message_queue USING btree (message_status);


--
-- Name: idx_fhir_error_actions_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fhir_error_actions_code ON public.fhir_error_actions USING btree (error_code);


--
-- Name: idx_fhir_error_actions_resource; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fhir_error_actions_resource ON public.fhir_error_actions USING btree (resource_type);


--
-- Name: idx_fhir_error_actions_vendor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fhir_error_actions_vendor ON public.fhir_error_actions USING btree (vendor_name);


--
-- Name: idx_fhir_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fhir_patient ON public.fhir_resources USING btree (patient_id);


--
-- Name: idx_fhir_tracking_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fhir_tracking_created_at ON public.fhir_tracking USING btree (created_at);


--
-- Name: idx_fhir_tracking_errors; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fhir_tracking_errors ON public.fhir_tracking USING btree (has_errors, action_required);


--
-- Name: idx_fhir_tracking_events_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fhir_tracking_events_created_at ON public.fhir_tracking_events USING btree (created_at);


--
-- Name: idx_fhir_tracking_events_errors; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fhir_tracking_events_errors ON public.fhir_tracking_events USING btree (is_error, error_severity);


--
-- Name: idx_fhir_tracking_events_tracking_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fhir_tracking_events_tracking_id ON public.fhir_tracking_events USING btree (fhir_tracking_id);


--
-- Name: idx_fhir_tracking_events_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fhir_tracking_events_type ON public.fhir_tracking_events USING btree (event_type);


--
-- Name: idx_fhir_tracking_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fhir_tracking_number ON public.fhir_tracking USING btree (tracking_number);


--
-- Name: idx_fhir_tracking_reference; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fhir_tracking_reference ON public.fhir_tracking USING btree (resource_type, resource_reference);


--
-- Name: idx_fhir_tracking_resource; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fhir_tracking_resource ON public.fhir_tracking USING btree (fhir_resource_id);


--
-- Name: idx_fhir_tracking_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fhir_tracking_status ON public.fhir_tracking USING btree (current_status);


--
-- Name: idx_fhir_tracking_vendor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fhir_tracking_vendor ON public.fhir_tracking USING btree (vendor_name, vendor_tracking_id);


--
-- Name: idx_insurance_mappings_offering; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_insurance_mappings_offering ON public.offering_insurance_mappings USING btree (offering_id);


--
-- Name: idx_insurance_payers_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_insurance_payers_active ON public.insurance_payers USING btree (is_active);


--
-- Name: idx_insurance_payers_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_insurance_payers_name ON public.insurance_payers USING btree (name);


--
-- Name: idx_insurance_payers_payer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_insurance_payers_payer_id ON public.insurance_payers USING btree (payer_id);


--
-- Name: idx_intake_flows_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_intake_flows_created_at ON public.patient_intake_flows USING btree (created_at DESC);


--
-- Name: idx_intake_flows_flow_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_intake_flows_flow_type ON public.patient_intake_flows USING btree (flow_type);


--
-- Name: idx_intake_flows_patient_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_intake_flows_patient_id ON public.patient_intake_flows USING btree (patient_id);


--
-- Name: idx_intake_flows_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_intake_flows_status ON public.patient_intake_flows USING btree (status);


--
-- Name: idx_intake_forms_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_intake_forms_created_at ON public.patient_intake_forms USING btree (created_at DESC);


--
-- Name: idx_intake_forms_form_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_intake_forms_form_type ON public.patient_intake_forms USING btree (form_type);


--
-- Name: idx_intake_forms_patient_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_intake_forms_patient_id ON public.patient_intake_forms USING btree (patient_id);


--
-- Name: idx_intake_forms_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_intake_forms_status ON public.patient_intake_forms USING btree (status);


--
-- Name: idx_lab_orders_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lab_orders_created ON public.lab_orders USING btree (created_at);


--
-- Name: idx_lab_orders_fhir_tracking; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lab_orders_fhir_tracking ON public.lab_orders USING btree (fhir_tracking_id);


--
-- Name: idx_lab_orders_order_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lab_orders_order_number ON public.lab_orders USING btree (order_number);


--
-- Name: idx_lab_orders_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lab_orders_patient ON public.lab_orders USING btree (patient_id);


--
-- Name: idx_lab_orders_provider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lab_orders_provider ON public.lab_orders USING btree (provider_id);


--
-- Name: idx_lab_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lab_orders_status ON public.lab_orders USING btree (status);


--
-- Name: idx_lab_orders_vendor_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lab_orders_vendor_order ON public.lab_orders USING btree (vendor_order_id);


--
-- Name: idx_medical_codes_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_medical_codes_category ON public.medical_codes USING btree (category);


--
-- Name: idx_medical_codes_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_medical_codes_code ON public.medical_codes USING btree (code);


--
-- Name: idx_medical_codes_code_prefix; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_medical_codes_code_prefix ON public.medical_codes USING btree (code text_pattern_ops);


--
-- Name: idx_medical_codes_description; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_medical_codes_description ON public.medical_codes USING gin (to_tsvector('english'::regconfig, description));


--
-- Name: idx_medical_codes_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_medical_codes_type ON public.medical_codes USING btree (code_type);


--
-- Name: idx_medical_records_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_medical_records_patient ON public.medical_records USING btree (patient_id);


--
-- Name: idx_medications_drug_class; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_medications_drug_class ON public.medications USING btree (drug_class);


--
-- Name: idx_medications_drug_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_medications_drug_name ON public.medications USING btree (drug_name);


--
-- Name: idx_medications_generic_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_medications_generic_name ON public.medications USING btree (generic_name);


--
-- Name: idx_medications_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_medications_id ON public.medications USING btree (id);


--
-- Name: idx_medications_ndc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_medications_ndc ON public.medications USING btree (ndc_code);


--
-- Name: idx_notification_preferences_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_preferences_patient ON public.notification_preferences USING btree (patient_id);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


--
-- Name: idx_offerings_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_offerings_category ON public.healthcare_offerings USING btree (category_id);


--
-- Name: idx_package_offerings_offering; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_package_offerings_offering ON public.package_offerings USING btree (offering_id);


--
-- Name: idx_package_offerings_package; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_package_offerings_package ON public.package_offerings USING btree (package_id);


--
-- Name: idx_patient_allergies_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patient_allergies_patient ON public.patient_allergies USING btree (patient_id);


--
-- Name: idx_patient_pharmacies_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patient_pharmacies_patient ON public.patient_pharmacies USING btree (patient_id);


--
-- Name: idx_patient_pharmacies_pharmacy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patient_pharmacies_pharmacy ON public.patient_pharmacies USING btree (pharmacy_id);


--
-- Name: idx_patients_country; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_country ON public.patients USING btree (country);


--
-- Name: idx_patients_insurance_payer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_insurance_payer_id ON public.patients USING btree (insurance_payer_id);


--
-- Name: idx_patients_timezone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_timezone ON public.patients USING btree (timezone);


--
-- Name: idx_patients_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_user_id ON public.patients USING btree (id);


--
-- Name: idx_payment_postings_check_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_postings_check_number ON public.payment_postings USING btree (check_number);


--
-- Name: idx_payment_postings_claim_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_postings_claim_id ON public.payment_postings USING btree (claim_id);


--
-- Name: idx_payment_postings_insurance_payer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_postings_insurance_payer_id ON public.payment_postings USING btree (insurance_payer_id);


--
-- Name: idx_payment_postings_patient_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_postings_patient_id ON public.payment_postings USING btree (patient_id);


--
-- Name: idx_payment_postings_posting_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_postings_posting_date ON public.payment_postings USING btree (posting_date);


--
-- Name: idx_payment_postings_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_postings_status ON public.payment_postings USING btree (status);


--
-- Name: idx_payments_claim_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_claim_id ON public.payments USING btree (claim_id);


--
-- Name: idx_payments_patient_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_patient_id ON public.payments USING btree (patient_id);


--
-- Name: idx_pharmacies_city_state; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pharmacies_city_state ON public.pharmacies USING btree (city, state);


--
-- Name: idx_pharmacies_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pharmacies_id ON public.pharmacies USING btree (id);


--
-- Name: idx_pharmacies_ncpdp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pharmacies_ncpdp ON public.pharmacies USING btree (ncpdp_id);


--
-- Name: idx_pharmacies_zip; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pharmacies_zip ON public.pharmacies USING btree (zip_code);


--
-- Name: idx_portal_sessions_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_sessions_patient ON public.patient_portal_sessions USING btree (patient_id);


--
-- Name: idx_practices_country; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_practices_country ON public.practices USING btree (country);


--
-- Name: idx_practices_timezone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_practices_timezone ON public.practices USING btree (timezone);


--
-- Name: idx_preapprovals_insurance_payer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_preapprovals_insurance_payer_id ON public.preapprovals USING btree (insurance_payer_id);


--
-- Name: idx_preapprovals_patient_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_preapprovals_patient_id ON public.preapprovals USING btree (patient_id);


--
-- Name: idx_preapprovals_preapproval_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_preapprovals_preapproval_number ON public.preapprovals USING btree (preapproval_number);


--
-- Name: idx_preapprovals_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_preapprovals_status ON public.preapprovals USING btree (status);


--
-- Name: idx_prescription_history_pharmacy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prescription_history_pharmacy ON public.prescription_history USING btree (pharmacy_id);


--
-- Name: idx_prescription_history_prescription; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prescription_history_prescription ON public.prescription_history USING btree (prescription_id);


--
-- Name: idx_prescriptions_erx_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prescriptions_erx_status ON public.prescriptions USING btree (erx_status);


--
-- Name: idx_prescriptions_fhir_tracking; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prescriptions_fhir_tracking ON public.prescriptions USING btree (fhir_tracking_id);


--
-- Name: idx_prescriptions_ndc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prescriptions_ndc ON public.prescriptions USING btree (ndc_code);


--
-- Name: idx_prescriptions_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prescriptions_patient ON public.prescriptions USING btree (patient_id);


--
-- Name: idx_prescriptions_pharmacy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prescriptions_pharmacy ON public.prescriptions USING btree (pharmacy_id);


--
-- Name: idx_prescriptions_provider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prescriptions_provider ON public.prescriptions USING btree (provider_id);


--
-- Name: idx_pricing_offering; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pricing_offering ON public.offering_pricing USING btree (offering_id);


--
-- Name: idx_recurring_appointments_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_recurring_appointments_patient ON public.recurring_appointments USING btree (patient_id);


--
-- Name: idx_recurring_appointments_provider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_recurring_appointments_provider ON public.recurring_appointments USING btree (provider_id);


--
-- Name: idx_recurring_appointments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_recurring_appointments_status ON public.recurring_appointments USING btree (status);


--
-- Name: idx_reminders_appointment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reminders_appointment ON public.appointment_reminders USING btree (appointment_id);


--
-- Name: idx_reminders_scheduled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reminders_scheduled ON public.appointment_reminders USING btree (scheduled_for);


--
-- Name: idx_reminders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reminders_status ON public.appointment_reminders USING btree (delivery_status);


--
-- Name: idx_reviews_offering; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_offering ON public.offering_reviews USING btree (offering_id);


--
-- Name: idx_reviews_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_patient ON public.offering_reviews USING btree (patient_id);


--
-- Name: idx_role_permissions_role_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_role_permissions_role_id ON public.role_permissions USING btree (role_id);


--
-- Name: idx_social_auth_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_social_auth_patient ON public.social_auth USING btree (patient_id);


--
-- Name: idx_telehealth_appointment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_telehealth_appointment ON public.telehealth_sessions USING btree (appointment_id);


--
-- Name: idx_user_roles_role_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_roles_role_id ON public.user_roles USING btree (role_id);


--
-- Name: idx_users_country; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_country ON public.users USING btree (country);


--
-- Name: idx_users_timezone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_timezone ON public.users USING btree (timezone);


--
-- Name: idx_vendor_integration_enabled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendor_integration_enabled ON public.vendor_integration_settings USING btree (is_enabled);


--
-- Name: idx_vendor_integration_vendor_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendor_integration_vendor_type ON public.vendor_integration_settings USING btree (vendor_type);


--
-- Name: idx_vendor_transaction_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendor_transaction_created ON public.vendor_transaction_log USING btree (created_at);


--
-- Name: idx_vendor_transaction_internal_ref; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendor_transaction_internal_ref ON public.vendor_transaction_log USING btree (internal_reference_id);


--
-- Name: idx_vendor_transaction_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendor_transaction_patient ON public.vendor_transaction_log USING btree (patient_id);


--
-- Name: idx_vendor_transaction_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendor_transaction_status ON public.vendor_transaction_log USING btree (status);


--
-- Name: idx_vendor_transaction_vendor_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendor_transaction_vendor_type ON public.vendor_transaction_log USING btree (vendor_type);


--
-- Name: idx_waitlist_active_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_waitlist_active_lookup ON public.appointment_waitlist USING btree (provider_id, preferred_date, status) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_waitlist_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_waitlist_date ON public.appointment_waitlist USING btree (preferred_date);


--
-- Name: idx_waitlist_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_waitlist_patient ON public.appointment_waitlist USING btree (patient_id);


--
-- Name: idx_waitlist_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_waitlist_priority ON public.appointment_waitlist USING btree (priority DESC);


--
-- Name: idx_waitlist_provider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_waitlist_provider ON public.appointment_waitlist USING btree (provider_id);


--
-- Name: idx_waitlist_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_waitlist_status ON public.appointment_waitlist USING btree (status);


--
-- Name: archive_rules archive_rules_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER archive_rules_updated_at BEFORE UPDATE ON public.archive_rules FOR EACH ROW EXECUTE FUNCTION public.update_archive_rules_updated_at();


--
-- Name: fhir_tracking fhir_tracking_status_change_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER fhir_tracking_status_change_trigger AFTER UPDATE ON public.fhir_tracking FOR EACH ROW EXECUTE FUNCTION public.trigger_log_fhir_tracking_status_change();


--
-- Name: insurance_payers insurance_payers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER insurance_payers_updated_at BEFORE UPDATE ON public.insurance_payers FOR EACH ROW EXECUTE FUNCTION public.update_insurance_payers_updated_at();


--
-- Name: denials trigger_set_appeal_deadline; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_set_appeal_deadline BEFORE INSERT ON public.denials FOR EACH ROW EXECUTE FUNCTION public.set_appeal_deadline();


--
-- Name: denials trigger_set_denial_number; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_set_denial_number BEFORE INSERT ON public.denials FOR EACH ROW EXECUTE FUNCTION public.set_denial_number();


--
-- Name: payment_postings trigger_set_posting_number; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_set_posting_number BEFORE INSERT ON public.payment_postings FOR EACH ROW EXECUTE FUNCTION public.set_posting_number();


--
-- Name: claim_submissions trigger_update_claim_submissions_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_claim_submissions_updated_at BEFORE UPDATE ON public.claim_submissions FOR EACH ROW EXECUTE FUNCTION public.update_claim_submissions_updated_at();


--
-- Name: denials trigger_update_denials_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_denials_updated_at BEFORE UPDATE ON public.denials FOR EACH ROW EXECUTE FUNCTION public.update_denials_updated_at();


--
-- Name: payment_postings trigger_update_payment_postings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_payment_postings_updated_at BEFORE UPDATE ON public.payment_postings FOR EACH ROW EXECUTE FUNCTION public.update_payment_postings_updated_at();


--
-- Name: preapprovals trigger_update_preapprovals_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_preapprovals_updated_at BEFORE UPDATE ON public.preapprovals FOR EACH ROW EXECUTE FUNCTION public.update_preapprovals_updated_at();


--
-- Name: appointment_reminders update_appointment_reminders_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_appointment_reminders_updated_at BEFORE UPDATE ON public.appointment_reminders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: appointment_type_config update_appointment_type_config_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_appointment_type_config_updated_at BEFORE UPDATE ON public.appointment_type_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: doctor_availability update_doctor_availability_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_doctor_availability_updated_at BEFORE UPDATE ON public.doctor_availability FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: doctor_time_off update_doctor_time_off_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_doctor_time_off_updated_at BEFORE UPDATE ON public.doctor_time_off FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: provider_booking_config update_provider_booking_config_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_provider_booking_config_updated_at BEFORE UPDATE ON public.provider_booking_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: providers update_providers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON public.providers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: recurring_appointments update_recurring_appointments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_recurring_appointments_updated_at BEFORE UPDATE ON public.recurring_appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: appointment_reminders appointment_reminders_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointment_reminders
    ADD CONSTRAINT appointment_reminders_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: appointment_type_config appointment_type_config_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointment_type_config
    ADD CONSTRAINT appointment_type_config_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- Name: appointment_waitlist appointment_waitlist_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointment_waitlist
    ADD CONSTRAINT appointment_waitlist_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: appointment_waitlist appointment_waitlist_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointment_waitlist
    ADD CONSTRAINT appointment_waitlist_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE SET NULL;


--
-- Name: archives archives_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.archives
    ADD CONSTRAINT archives_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: audit_logs audit_logs_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: booking_analytics booking_analytics_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_analytics
    ADD CONSTRAINT booking_analytics_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: booking_analytics booking_analytics_appointment_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_analytics
    ADD CONSTRAINT booking_analytics_appointment_type_id_fkey FOREIGN KEY (appointment_type_id) REFERENCES public.appointment_type_config(id) ON DELETE SET NULL;


--
-- Name: booking_analytics booking_analytics_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_analytics
    ADD CONSTRAINT booking_analytics_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL;


--
-- Name: booking_analytics booking_analytics_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_analytics
    ADD CONSTRAINT booking_analytics_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- Name: claim_submissions claim_submissions_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claim_submissions
    ADD CONSTRAINT claim_submissions_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.claims(id) ON DELETE CASCADE;


--
-- Name: claims claims_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: claims claims_practice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: claims claims_preapproval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_preapproval_id_fkey FOREIGN KEY (preapproval_id) REFERENCES public.preapprovals(id) ON DELETE SET NULL;


--
-- Name: denials denials_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.denials
    ADD CONSTRAINT denials_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.claims(id) ON DELETE SET NULL;


--
-- Name: denials denials_insurance_payer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.denials
    ADD CONSTRAINT denials_insurance_payer_id_fkey FOREIGN KEY (insurance_payer_id) REFERENCES public.insurance_payers(id) ON DELETE SET NULL;


--
-- Name: denials denials_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.denials
    ADD CONSTRAINT denials_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: diagnosis diagnosis_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diagnosis
    ADD CONSTRAINT diagnosis_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: doctor_availability doctor_availability_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor_availability
    ADD CONSTRAINT doctor_availability_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- Name: doctor_time_off doctor_time_off_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor_time_off
    ADD CONSTRAINT doctor_time_off_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- Name: erx_message_queue erx_message_queue_pharmacy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.erx_message_queue
    ADD CONSTRAINT erx_message_queue_pharmacy_id_fkey FOREIGN KEY (pharmacy_id) REFERENCES public.pharmacies(id);


--
-- Name: erx_message_queue erx_message_queue_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.erx_message_queue
    ADD CONSTRAINT erx_message_queue_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE CASCADE;


--
-- Name: fhir_tracking fhir_tracking_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fhir_tracking
    ADD CONSTRAINT fhir_tracking_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: fhir_tracking_events fhir_tracking_events_fhir_tracking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fhir_tracking_events
    ADD CONSTRAINT fhir_tracking_events_fhir_tracking_id_fkey FOREIGN KEY (fhir_tracking_id) REFERENCES public.fhir_tracking(id) ON DELETE CASCADE;


--
-- Name: fhir_tracking_events fhir_tracking_events_triggered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fhir_tracking_events
    ADD CONSTRAINT fhir_tracking_events_triggered_by_fkey FOREIGN KEY (triggered_by) REFERENCES public.users(id);


--
-- Name: fhir_tracking fhir_tracking_fhir_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fhir_tracking
    ADD CONSTRAINT fhir_tracking_fhir_resource_id_fkey FOREIGN KEY (fhir_resource_id) REFERENCES public.fhir_resources(id) ON DELETE CASCADE;


--
-- Name: fhir_tracking fhir_tracking_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fhir_tracking
    ADD CONSTRAINT fhir_tracking_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: appointments fk_appointments_recurring; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT fk_appointments_recurring FOREIGN KEY (recurring_appointment_id) REFERENCES public.recurring_appointments(id) ON DELETE SET NULL;


--
-- Name: appointments fk_appointments_rescheduled_from; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT fk_appointments_rescheduled_from FOREIGN KEY (rescheduled_from) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: appointments fk_appointments_type; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT fk_appointments_type FOREIGN KEY (appointment_type_id) REFERENCES public.appointment_type_config(id) ON DELETE SET NULL;


--
-- Name: healthcare_offerings healthcare_offerings_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.healthcare_offerings
    ADD CONSTRAINT healthcare_offerings_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.service_categories(id) ON DELETE SET NULL;


--
-- Name: lab_orders lab_orders_fhir_tracking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_fhir_tracking_id_fkey FOREIGN KEY (fhir_tracking_id) REFERENCES public.fhir_tracking(id);


--
-- Name: lab_orders lab_orders_laboratory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_laboratory_id_fkey FOREIGN KEY (laboratory_id) REFERENCES public.laboratories(id);


--
-- Name: lab_orders lab_orders_linked_diagnosis_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_linked_diagnosis_id_fkey FOREIGN KEY (linked_diagnosis_id) REFERENCES public.diagnoses(id) ON DELETE SET NULL;


--
-- Name: lab_orders lab_orders_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: lab_orders lab_orders_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.users(id);


--
-- Name: lab_orders lab_orders_results_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_results_reviewed_by_fkey FOREIGN KEY (results_reviewed_by) REFERENCES public.users(id);


--
-- Name: medical_records medical_records_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medical_records
    ADD CONSTRAINT medical_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: medication_alternatives medication_alternatives_alternative_ndc_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medication_alternatives
    ADD CONSTRAINT medication_alternatives_alternative_ndc_fkey FOREIGN KEY (alternative_ndc) REFERENCES public.medications(ndc_code);


--
-- Name: medication_alternatives medication_alternatives_original_ndc_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medication_alternatives
    ADD CONSTRAINT medication_alternatives_original_ndc_fkey FOREIGN KEY (original_ndc) REFERENCES public.medications(ndc_code);


--
-- Name: notification_preferences notification_preferences_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: offering_insurance_mappings offering_insurance_mappings_offering_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offering_insurance_mappings
    ADD CONSTRAINT offering_insurance_mappings_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES public.healthcare_offerings(id) ON DELETE CASCADE;


--
-- Name: offering_packages offering_packages_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offering_packages
    ADD CONSTRAINT offering_packages_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.service_categories(id) ON DELETE SET NULL;


--
-- Name: offering_pricing offering_pricing_offering_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offering_pricing
    ADD CONSTRAINT offering_pricing_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES public.healthcare_offerings(id) ON DELETE CASCADE;


--
-- Name: offering_reviews offering_reviews_offering_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offering_reviews
    ADD CONSTRAINT offering_reviews_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES public.healthcare_offerings(id) ON DELETE CASCADE;


--
-- Name: organization_settings organization_settings_current_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_current_plan_id_fkey FOREIGN KEY (current_plan_id) REFERENCES public.subscription_plans(id);


--
-- Name: package_offerings package_offerings_offering_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_offerings
    ADD CONSTRAINT package_offerings_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES public.healthcare_offerings(id) ON DELETE CASCADE;


--
-- Name: package_offerings package_offerings_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_offerings
    ADD CONSTRAINT package_offerings_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.offering_packages(id) ON DELETE CASCADE;


--
-- Name: patient_allergies patient_allergies_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_allergies
    ADD CONSTRAINT patient_allergies_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: patient_allergies patient_allergies_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_allergies
    ADD CONSTRAINT patient_allergies_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id);


--
-- Name: patient_allergies patient_allergies_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_allergies
    ADD CONSTRAINT patient_allergies_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: patient_consent_forms patient_consent_forms_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_consent_forms
    ADD CONSTRAINT patient_consent_forms_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: patient_intake_flows patient_intake_flows_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_intake_flows
    ADD CONSTRAINT patient_intake_flows_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: patient_intake_forms patient_intake_forms_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_intake_forms
    ADD CONSTRAINT patient_intake_forms_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: patient_intake_forms patient_intake_forms_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_intake_forms
    ADD CONSTRAINT patient_intake_forms_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: patient_offering_enrollments patient_offering_enrollments_offering_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_offering_enrollments
    ADD CONSTRAINT patient_offering_enrollments_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES public.healthcare_offerings(id) ON DELETE SET NULL;


--
-- Name: patient_offering_enrollments patient_offering_enrollments_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_offering_enrollments
    ADD CONSTRAINT patient_offering_enrollments_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.offering_packages(id) ON DELETE SET NULL;


--
-- Name: patient_pharmacies patient_pharmacies_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_pharmacies
    ADD CONSTRAINT patient_pharmacies_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: patient_pharmacies patient_pharmacies_pharmacy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_pharmacies
    ADD CONSTRAINT patient_pharmacies_pharmacy_id_fkey FOREIGN KEY (pharmacy_id) REFERENCES public.pharmacies(id) ON DELETE CASCADE;


--
-- Name: patients patients_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_id_fkey FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: patients patients_insurance_payer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_insurance_payer_id_fkey FOREIGN KEY (insurance_payer_id) REFERENCES public.insurance_payers(id) ON DELETE SET NULL;


--
-- Name: patients patients_practice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: patients patients_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_user_id_fkey FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payment_postings payment_postings_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_postings
    ADD CONSTRAINT payment_postings_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.claims(id) ON DELETE SET NULL;


--
-- Name: payment_postings payment_postings_insurance_payer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_postings
    ADD CONSTRAINT payment_postings_insurance_payer_id_fkey FOREIGN KEY (insurance_payer_id) REFERENCES public.insurance_payers(id) ON DELETE SET NULL;


--
-- Name: payment_postings payment_postings_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_postings
    ADD CONSTRAINT payment_postings_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: payments payments_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.claims(id) ON DELETE SET NULL;


--
-- Name: payments payments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: preapprovals preapprovals_insurance_payer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.preapprovals
    ADD CONSTRAINT preapprovals_insurance_payer_id_fkey FOREIGN KEY (insurance_payer_id) REFERENCES public.insurance_payers(id) ON DELETE SET NULL;


--
-- Name: preapprovals preapprovals_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.preapprovals
    ADD CONSTRAINT preapprovals_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: prescription_history prescription_history_action_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescription_history
    ADD CONSTRAINT prescription_history_action_by_fkey FOREIGN KEY (action_by) REFERENCES public.users(id);


--
-- Name: prescription_history prescription_history_pharmacy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescription_history
    ADD CONSTRAINT prescription_history_pharmacy_id_fkey FOREIGN KEY (pharmacy_id) REFERENCES public.pharmacies(id);


--
-- Name: prescription_history prescription_history_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescription_history
    ADD CONSTRAINT prescription_history_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE CASCADE;


--
-- Name: prescriptions prescriptions_diagnosis_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_diagnosis_id_fkey FOREIGN KEY (diagnosis_id) REFERENCES public.diagnosis(id) ON DELETE SET NULL;


--
-- Name: prescriptions prescriptions_fhir_tracking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_fhir_tracking_id_fkey FOREIGN KEY (fhir_tracking_id) REFERENCES public.fhir_tracking(id);


--
-- Name: prescriptions prescriptions_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: provider_booking_config provider_booking_config_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_booking_config
    ADD CONSTRAINT provider_booking_config_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- Name: providers providers_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_id_fkey FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: recurring_appointments recurring_appointments_appointment_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recurring_appointments
    ADD CONSTRAINT recurring_appointments_appointment_type_id_fkey FOREIGN KEY (appointment_type_id) REFERENCES public.appointment_type_config(id) ON DELETE SET NULL;


--
-- Name: recurring_appointments recurring_appointments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recurring_appointments
    ADD CONSTRAINT recurring_appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: recurring_appointments recurring_appointments_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recurring_appointments
    ADD CONSTRAINT recurring_appointments_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: vendor_transaction_log vendor_transaction_log_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_transaction_log
    ADD CONSTRAINT vendor_transaction_log_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.users(id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--


