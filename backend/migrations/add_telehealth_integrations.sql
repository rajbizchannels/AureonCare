-- Migration: Add Telehealth Provider Settings and WhatsApp Notifications
-- Created: 2025-11-23

BEGIN;

-- Telehealth Provider Settings
CREATE TABLE IF NOT EXISTS public.telehealth_provider_settings
(
    id serial NOT NULL,
    provider_type character varying(50) COLLATE pg_catalog."default" NOT NULL,
    is_enabled boolean DEFAULT false,
    api_key text COLLATE pg_catalog."default",
    api_secret text COLLATE pg_catalog."default",
    client_id text COLLATE pg_catalog."default",
    client_secret text COLLATE pg_catalog."default",
    webhook_secret text COLLATE pg_catalog."default",
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT telehealth_provider_settings_pkey PRIMARY KEY (id),
    CONSTRAINT telehealth_provider_settings_provider_type_key UNIQUE (provider_type)
);

COMMENT ON TABLE public.telehealth_provider_settings
    IS 'Settings for different telehealth providers (Zoom, Google Meet, Webex)';

-- Add provider_type column to telehealth_sessions if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'telehealth_sessions' AND column_name = 'provider_type'
    ) THEN
        ALTER TABLE public.telehealth_sessions
        ADD COLUMN provider_type character varying(50) DEFAULT 'medflow';
    END IF;
END $$;

-- Notification channels table for tracking patient notification preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences
(
    id serial NOT NULL,
    patient_id uuid NOT NULL,
    channel_type character varying(20) COLLATE pg_catalog."default" NOT NULL,
    is_enabled boolean DEFAULT true,
    contact_info character varying(255) COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT notification_preferences_pkey PRIMARY KEY (id),
    CONSTRAINT notification_preferences_patient_channel_key UNIQUE (patient_id, channel_type),
    CONSTRAINT notification_preferences_patient_id_fkey FOREIGN KEY (patient_id)
        REFERENCES public.patients (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

COMMENT ON TABLE public.notification_preferences
    IS 'Patient notification preferences for different channels (email, sms, whatsapp)';

CREATE INDEX IF NOT EXISTS idx_notification_preferences_patient
    ON public.notification_preferences(patient_id);

COMMIT;
