--
-- PostgreSQL database dump
--

\restrict HZjoSdjc6Vo0lOOd4yde3zFZLhiG1I9XyLWd1iFCLohwqoh4oxhr1OgOgal6tXM

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

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
-- Name: arthasync; Type: SCHEMA; Schema: -; Owner: arthasync_user
--

CREATE SCHEMA arthasync;


ALTER SCHEMA arthasync OWNER TO arthasync_user;

--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: create_user_with_bcrypt(text, text, text, text); Type: FUNCTION; Schema: arthasync; Owner: arthasync_user
--

CREATE FUNCTION arthasync.create_user_with_bcrypt(p_username text, p_password text, p_full_name text DEFAULT NULL::text, p_email text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_hash TEXT;
  v_id   UUID;
BEGIN
  v_hash := crypt(p_password, gen_salt('bf', 12));
  INSERT INTO arthasync.users (username, password_hash, full_name, email)
  VALUES (p_username, v_hash, p_full_name, p_email)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;


ALTER FUNCTION arthasync.create_user_with_bcrypt(p_username text, p_password text, p_full_name text, p_email text) OWNER TO arthasync_user;

--
-- Name: prevent_immutable_updates(); Type: FUNCTION; Schema: arthasync; Owner: postgres
--

CREATE FUNCTION arthasync.prevent_immutable_updates() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
  i INT;
  colname TEXT;
  oldval TEXT;
  newval TEXT;
BEGIN
  FOR i IN 0..TG_NARGS-1 LOOP
    colname := TG_ARGV[i];
    EXECUTE format('SELECT ($1).%I::text', colname) INTO oldval USING OLD;
    EXECUTE format('SELECT ($1).%I::text', colname) INTO newval USING NEW;
    IF oldval IS DISTINCT FROM newval THEN
      RAISE EXCEPTION 'Attempt to modify immutable column % on table %', colname, TG_TABLE_NAME;
    END IF;
  END LOOP;
  NEW.updated_at := now();
  RETURN NEW;
END;
$_$;


ALTER FUNCTION arthasync.prevent_immutable_updates() OWNER TO postgres;

--
-- Name: prevent_immutable_updates_users(); Type: FUNCTION; Schema: arthasync; Owner: postgres
--

CREATE FUNCTION arthasync.prevent_immutable_updates_users() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
  i       INT;
  colname TEXT;
  oldval  TEXT;
  newval  TEXT;
BEGIN
  FOR i IN 0..TG_NARGS-1 LOOP
    colname := TG_ARGV[i];
    EXECUTE format('SELECT ($1).%I::text', colname) INTO oldval USING OLD;
    EXECUTE format('SELECT ($1).%I::text', colname) INTO newval USING NEW;
    IF oldval IS DISTINCT FROM newval THEN
      RAISE EXCEPTION 'Attempt to modify immutable column % on table %', colname, TG_TABLE_NAME;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$_$;


ALTER FUNCTION arthasync.prevent_immutable_updates_users() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: expense; Type: TABLE; Schema: arthasync; Owner: postgres
--

CREATE TABLE arthasync.expense (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expense_id text NOT NULL,
    date date NOT NULL,
    due_date date,
    expense_category text,
    expense_description text,
    vendor_name text,
    vendor_phone text,
    vendor_email public.citext,
    vendor_gst_no text,
    expense_amount numeric(15,2) NOT NULL,
    gst_applicable boolean DEFAULT false,
    gst_percent numeric(5,2) DEFAULT 0,
    gst_amount numeric(15,2) DEFAULT 0,
    total_amount numeric(18,2) GENERATED ALWAYS AS ((expense_amount + gst_amount)) STORED,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    payment_method text,
    amount_paid numeric(15,2) DEFAULT 0,
    amount_due numeric(15,2) GENERATED ALWAYS AS (((expense_amount + gst_amount) - amount_paid)) STORED,
    source_type text,
    direction text,
    entry_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archive_status boolean DEFAULT false,
    CONSTRAINT expense_amount_paid_check CHECK ((amount_paid >= (0)::numeric)),
    CONSTRAINT expense_expense_amount_check CHECK ((expense_amount >= (0)::numeric)),
    CONSTRAINT expense_gst_amount_check CHECK ((gst_amount >= (0)::numeric)),
    CONSTRAINT expense_gst_percent_check CHECK (((gst_percent >= (0)::numeric) AND (gst_percent <= (100)::numeric))),
    CONSTRAINT expense_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'partial'::text, 'overdue'::text])))
);


ALTER TABLE arthasync.expense OWNER TO postgres;

--
-- Name: file_uploads; Type: TABLE; Schema: arthasync; Owner: postgres
--

CREATE TABLE arthasync.file_uploads (
    file_id text NOT NULL,
    filename text NOT NULL,
    path text NOT NULL,
    suffix text NOT NULL,
    size_bytes integer NOT NULL,
    extracted_text text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE arthasync.file_uploads OWNER TO postgres;

--
-- Name: ledger; Type: TABLE; Schema: arthasync; Owner: postgres
--

CREATE TABLE arthasync.ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_id text NOT NULL,
    date date NOT NULL,
    source_type text,
    source_id uuid,
    party text,
    party_no text,
    party_mail public.citext,
    direction text,
    payment_method text,
    amount numeric(18,2) NOT NULL,
    reference text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ledger_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT ledger_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'transfer'::text])))
);


ALTER TABLE arthasync.ledger OWNER TO postgres;

--
-- Name: purchase; Type: TABLE; Schema: arthasync; Owner: postgres
--

CREATE TABLE arthasync.purchase (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sr_no bigint NOT NULL,
    invoice_number text NOT NULL,
    invoice_date date NOT NULL,
    due_date date,
    gst_no text,
    vendor_name text NOT NULL,
    vendor_email public.citext,
    vendor_phone text,
    vendor_address text,
    vendor_gstin text,
    items jsonb NOT NULL,
    subtotal numeric(15,2) NOT NULL,
    cgst_percent numeric(5,2) DEFAULT 0,
    cgst_amount numeric(15,2) DEFAULT 0,
    sgst_percent numeric(5,2) DEFAULT 0,
    sgst_amount numeric(15,2) DEFAULT 0,
    total_tax numeric(15,2) GENERATED ALWAYS AS ((cgst_amount + sgst_amount)) STORED,
    grand_total numeric(18,2) NOT NULL,
    currency character(3) DEFAULT 'INR'::bpchar,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    payment_method text,
    amount_paid numeric(15,2) DEFAULT 0,
    amount_due numeric(15,2) GENERATED ALWAYS AS ((grand_total - amount_paid)) STORED,
    pdf_file_url text,
    terms text,
    archive_status boolean DEFAULT false,
    remark text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT purchase_amount_paid_check CHECK ((amount_paid >= (0)::numeric)),
    CONSTRAINT purchase_cgst_amount_check CHECK ((cgst_amount >= (0)::numeric)),
    CONSTRAINT purchase_cgst_percent_check CHECK (((cgst_percent >= (0)::numeric) AND (cgst_percent <= (100)::numeric))),
    CONSTRAINT purchase_grand_total_check CHECK ((grand_total >= (0)::numeric)),
    CONSTRAINT purchase_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'partial'::text, 'overdue'::text]))),
    CONSTRAINT purchase_sgst_amount_check CHECK ((sgst_amount >= (0)::numeric)),
    CONSTRAINT purchase_sgst_percent_check CHECK (((sgst_percent >= (0)::numeric) AND (sgst_percent <= (100)::numeric))),
    CONSTRAINT purchase_subtotal_check CHECK ((subtotal >= (0)::numeric))
);


ALTER TABLE arthasync.purchase OWNER TO postgres;

--
-- Name: purchase_sr_no_seq; Type: SEQUENCE; Schema: arthasync; Owner: postgres
--

ALTER TABLE arthasync.purchase ALTER COLUMN sr_no ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME arthasync.purchase_sr_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: quotation; Type: TABLE; Schema: arthasync; Owner: postgres
--

CREATE TABLE arthasync.quotation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sr_no bigint NOT NULL,
    quotation_no text NOT NULL,
    quotation_date date NOT NULL,
    customer_name text NOT NULL,
    customer_email public.citext,
    customer_phone text,
    customer_address text,
    customer_gstin text,
    items jsonb NOT NULL,
    subtotal numeric(15,2) NOT NULL,
    cgst_percent numeric(5,2) DEFAULT 0,
    cgst_amount numeric(15,2) DEFAULT 0,
    sgst_percent numeric(5,2) DEFAULT 0,
    sgst_amount numeric(15,2) DEFAULT 0,
    total_tax numeric(15,2) GENERATED ALWAYS AS ((cgst_amount + sgst_amount)) STORED,
    grand_total numeric(18,2) NOT NULL,
    pdf_file_url text,
    terms text,
    remark text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text,
    CONSTRAINT quotation_cgst_amount_check CHECK ((cgst_amount >= (0)::numeric)),
    CONSTRAINT quotation_cgst_percent_check CHECK (((cgst_percent >= (0)::numeric) AND (cgst_percent <= (100)::numeric))),
    CONSTRAINT quotation_grand_total_check CHECK ((grand_total >= (0)::numeric)),
    CONSTRAINT quotation_sgst_amount_check CHECK ((sgst_amount >= (0)::numeric)),
    CONSTRAINT quotation_sgst_percent_check CHECK (((sgst_percent >= (0)::numeric) AND (sgst_percent <= (100)::numeric))),
    CONSTRAINT quotation_subtotal_check CHECK ((subtotal >= (0)::numeric))
);


ALTER TABLE arthasync.quotation OWNER TO postgres;

--
-- Name: quotation_sr_no_seq; Type: SEQUENCE; Schema: arthasync; Owner: postgres
--

ALTER TABLE arthasync.quotation ALTER COLUMN sr_no ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME arthasync.quotation_sr_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sales; Type: TABLE; Schema: arthasync; Owner: postgres
--

CREATE TABLE arthasync.sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sr_no bigint NOT NULL,
    invoice_number text NOT NULL,
    invoice_date date NOT NULL,
    due_date date,
    gst_no text,
    customer_name text NOT NULL,
    customer_email public.citext,
    customer_phone text,
    customer_address text,
    customer_gstin text,
    items jsonb NOT NULL,
    subtotal numeric(15,2) NOT NULL,
    cgst_percent numeric(5,2) DEFAULT 0,
    cgst_amount numeric(15,2) DEFAULT 0,
    sgst_percent numeric(5,2) DEFAULT 0,
    sgst_amount numeric(15,2) DEFAULT 0,
    total_tax numeric(15,2) GENERATED ALWAYS AS ((cgst_amount + sgst_amount)) STORED,
    grand_total numeric(18,2) NOT NULL,
    currency character(3) DEFAULT 'INR'::bpchar,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    payment_method text,
    amount_paid numeric(15,2) DEFAULT 0,
    amount_due numeric(15,2) GENERATED ALWAYS AS ((grand_total - amount_paid)) STORED,
    pdf_file_url text,
    terms text,
    archive_status boolean DEFAULT false,
    remark text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_amount_paid_check CHECK ((amount_paid >= (0)::numeric)),
    CONSTRAINT sales_cgst_amount_check CHECK ((cgst_amount >= (0)::numeric)),
    CONSTRAINT sales_cgst_percent_check CHECK (((cgst_percent >= (0)::numeric) AND (cgst_percent <= (100)::numeric))),
    CONSTRAINT sales_grand_total_check CHECK ((grand_total >= (0)::numeric)),
    CONSTRAINT sales_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'partial'::text, 'overdue'::text]))),
    CONSTRAINT sales_sgst_amount_check CHECK ((sgst_amount >= (0)::numeric)),
    CONSTRAINT sales_sgst_percent_check CHECK (((sgst_percent >= (0)::numeric) AND (sgst_percent <= (100)::numeric))),
    CONSTRAINT sales_subtotal_check CHECK ((subtotal >= (0)::numeric))
);


ALTER TABLE arthasync.sales OWNER TO postgres;

--
-- Name: sales_sr_no_seq; Type: SEQUENCE; Schema: arthasync; Owner: postgres
--

ALTER TABLE arthasync.sales ALTER COLUMN sr_no ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME arthasync.sales_sr_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: users; Type: TABLE; Schema: arthasync; Owner: postgres
--

CREATE TABLE arthasync.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username public.citext NOT NULL,
    password_hash text NOT NULL,
    full_name text,
    email public.citext,
    phone text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_login timestamp with time zone,
    CONSTRAINT users_phone_check CHECK ((phone ~ '^\+[1-9]\d{0,2}-\d{7,12}$'::text))
);


ALTER TABLE arthasync.users OWNER TO postgres;

--
-- Name: purchase_ledger_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_ledger_records (
    invoice_number character varying NOT NULL,
    invoice_date character varying NOT NULL,
    vendor_name character varying NOT NULL,
    currency character varying,
    subtotal double precision NOT NULL,
    tax_amount double precision NOT NULL,
    discount double precision,
    shipping_cost double precision,
    total_amount_claimed double precision NOT NULL,
    rmse_error_score double precision NOT NULL,
    extraction_f1_score double precision NOT NULL,
    items_json_blob json NOT NULL,
    ingested_at timestamp without time zone
);


ALTER TABLE public.purchase_ledger_records OWNER TO postgres;

--
-- Data for Name: expense; Type: TABLE DATA; Schema: arthasync; Owner: postgres
--

COPY arthasync.expense (id, expense_id, date, due_date, expense_category, expense_description, vendor_name, vendor_phone, vendor_email, vendor_gst_no, expense_amount, gst_applicable, gst_percent, gst_amount, payment_status, payment_method, amount_paid, source_type, direction, entry_id, created_at, updated_at, archive_status) FROM stdin;
f5908b1f-8b30-4823-8f53-3400603fa4f1	TEST-E-001	2026-04-21	\N	Office	\N	Test Vendor	\N	vendor@example.com	\N	100.00	t	18.00	18.00	pending	\N	20.00	\N	\N	\N	2026-04-21 04:42:23.336051+05:30	2026-04-21 04:42:23.336051+05:30	f
\.


--
-- Data for Name: file_uploads; Type: TABLE DATA; Schema: arthasync; Owner: postgres
--

COPY arthasync.file_uploads (file_id, filename, path, suffix, size_bytes, extracted_text, created_at) FROM stdin;
\.


--
-- Data for Name: ledger; Type: TABLE DATA; Schema: arthasync; Owner: postgres
--

COPY arthasync.ledger (id, entry_id, date, source_type, source_id, party, party_no, party_mail, direction, payment_method, amount, reference, notes, created_at, updated_at) FROM stdin;
c2dfe68d-590b-452e-997d-5707bc097c2c	TEST-L-001	2026-04-21	invoice	\N	Test Party	\N	party@example.com	in	\N	1180.00	\N	\N	2026-04-21 04:42:23.366381+05:30	2026-04-21 04:42:23.366381+05:30
\.


--
-- Data for Name: purchase; Type: TABLE DATA; Schema: arthasync; Owner: postgres
--

COPY arthasync.purchase (id, sr_no, invoice_number, invoice_date, due_date, gst_no, vendor_name, vendor_email, vendor_phone, vendor_address, vendor_gstin, items, subtotal, cgst_percent, cgst_amount, sgst_percent, sgst_amount, grand_total, currency, payment_status, payment_method, amount_paid, pdf_file_url, terms, archive_status, remark, created_at, created_by, updated_at) FROM stdin;
b5cac1bb-a3fb-4553-968e-b4e0ef544bcc	1	TEST-P-001	2026-04-21	\N	\N	Test Vendor	\N	\N	\N	\N	[]	500.00	0.00	45.00	0.00	45.00	590.00	INR	pending	\N	0.00	\N	\N	f	\N	2026-04-21 04:42:23.272832+05:30	\N	2026-04-21 04:42:23.272832+05:30
\.


--
-- Data for Name: quotation; Type: TABLE DATA; Schema: arthasync; Owner: postgres
--

COPY arthasync.quotation (id, sr_no, quotation_no, quotation_date, customer_name, customer_email, customer_phone, customer_address, customer_gstin, items, subtotal, cgst_percent, cgst_amount, sgst_percent, sgst_amount, grand_total, pdf_file_url, terms, remark, created_at, created_by) FROM stdin;
ca8b181f-74d5-4e77-980e-e3a70a220f05	1	TEST-Q-001	2026-04-21	Quote Customer	\N	\N	\N	\N	[]	200.00	0.00	18.00	0.00	18.00	236.00	\N	\N	\N	2026-04-21 04:42:23.306978+05:30	\N
\.


--
-- Data for Name: sales; Type: TABLE DATA; Schema: arthasync; Owner: postgres
--

COPY arthasync.sales (id, sr_no, invoice_number, invoice_date, due_date, gst_no, customer_name, customer_email, customer_phone, customer_address, customer_gstin, items, subtotal, cgst_percent, cgst_amount, sgst_percent, sgst_amount, grand_total, currency, payment_status, payment_method, amount_paid, pdf_file_url, terms, archive_status, remark, created_at, created_by, updated_at) FROM stdin;
ec41dd82-33ea-495a-b449-579e8cca5bb6	1	TEST-S-001	2026-04-21	\N	\N	Test Customer	\N	\N	\N	\N	[]	1000.00	0.00	90.00	0.00	90.00	1180.00	INR	pending	\N	200.00	\N	\N	f	updated remark	2026-04-21 04:42:23.230412+05:30	\N	2026-04-21 04:42:24.259434+05:30
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: arthasync; Owner: postgres
--

COPY arthasync.users (id, username, password_hash, full_name, email, phone, created_at, last_login) FROM stdin;
fda4ef0d-953f-41d5-a7de-e8b39be69017	testuser	$2a$12$CI9Qxwa7DcCYTaZST6QSaO7fYRjX7ywy2tAm927X04dd2Qn1g8iE6	Test User Updated	testuser@example.com	+91-9999999999	2026-04-21 04:42:23.396351+05:30	2026-04-21 04:42:24.303277+05:30
e6f83688-b0ed-488d-91ab-2850ecc1e429	HP07	$2b$12$xA8xzZ8skgGbz6fO4CJsQuP9GasikebZUsFBEudBWUiDtEcLCuYPe	Harry Potter	harry@yahoo.com	+44-101010101	2026-04-21 04:47:02.482981+05:30	\N
12c3df80-789f-4ae8-b6c2-73a53b76a2ee	Boblash	$2b$12$QtcY9ZzdRN3.q3oMeK6ouObuc0PTMFL5NF1gv9Xr4zDAap/q98ZyK	Bobby Lashley	Boblash@gmail.com	+11-8888888888	2026-04-21 06:23:31.406187+05:30	\N
acd3dbd5-8c8d-4aa6-a9b1-485f1cf25924	Kilimanjaro	$2b$12$znXHMCTdeuNgS/UbnqICku9jHXjMffH0Q8ZSt6CpiBTBev4WIqc1S	Kili Bett	kili@outlook.com	+27-8928924839	2026-04-21 05:10:16.974709+05:30	2026-04-21 06:53:21.407547+05:30
46e920ee-e741-4d9a-a41f-65b9012cede0	johndoe	sha256iter$5000$aNKuFhQiIHAF580cOGR3XRdF0F4axVsd$7aa72a7f384f36ef532964967fc5283765d9a2a19c324ce82c50dc1ab39f0787	John Doe	john@example.com	+1-1234567890	2026-04-22 08:15:15.087478+05:30	\N
34fa510d-3724-4a90-9d38-4f9130fdbbc1	jackiechan	sha256iter$5000$NGikCplm5ki1KX5rQum85RepMRG9bBvM$3de7192b4b5d8e540d0eb4f12e37e57499b079b27df88481769d354e7e60054e	Jackie Chan	jcb@example.com	+1-6735258174	2026-04-22 08:33:23.685603+05:30	\N
93b6fd31-03c1-47fc-9e06-235e185007f6	vr	$2a$12$GKrsNzFvMnUUbIDrv2zluutL/YRnfouAIy70V8U5N6dXgXDodusX.	Viking Rising	vr@example.com	+997-3748348034	2026-04-22 15:49:27.39502+05:30	\N
c03c7f85-77e2-46db-8e5c-beb16b55e904	joiplay	$2a$12$70njwTzHbFnjo9IJwImPtuAq2oS3AxOJiQPAUqdLyauNn9NJgXA4y	Joi Playing	jpinfra@yahoo.com	+2-3478348021	2026-04-22 16:14:46.585076+05:30	2026-04-22 16:24:46.133+05:30
\.


--
-- Data for Name: purchase_ledger_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_ledger_records (invoice_number, invoice_date, vendor_name, currency, subtotal, tax_amount, discount, shipping_cost, total_amount_claimed, rmse_error_score, extraction_f1_score, items_json_blob, ingested_at) FROM stdin;
\.


--
-- Name: purchase_sr_no_seq; Type: SEQUENCE SET; Schema: arthasync; Owner: postgres
--

SELECT pg_catalog.setval('arthasync.purchase_sr_no_seq', 1, true);


--
-- Name: quotation_sr_no_seq; Type: SEQUENCE SET; Schema: arthasync; Owner: postgres
--

SELECT pg_catalog.setval('arthasync.quotation_sr_no_seq', 1, true);


--
-- Name: sales_sr_no_seq; Type: SEQUENCE SET; Schema: arthasync; Owner: postgres
--

SELECT pg_catalog.setval('arthasync.sales_sr_no_seq', 1, true);


--
-- Name: expense expense_pkey; Type: CONSTRAINT; Schema: arthasync; Owner: postgres
--

ALTER TABLE ONLY arthasync.expense
    ADD CONSTRAINT expense_pkey PRIMARY KEY (id);


--
-- Name: file_uploads file_uploads_pkey; Type: CONSTRAINT; Schema: arthasync; Owner: postgres
--

ALTER TABLE ONLY arthasync.file_uploads
    ADD CONSTRAINT file_uploads_pkey PRIMARY KEY (file_id);


--
-- Name: ledger ledger_pkey; Type: CONSTRAINT; Schema: arthasync; Owner: postgres
--

ALTER TABLE ONLY arthasync.ledger
    ADD CONSTRAINT ledger_pkey PRIMARY KEY (id);


--
-- Name: purchase purchase_pkey; Type: CONSTRAINT; Schema: arthasync; Owner: postgres
--

ALTER TABLE ONLY arthasync.purchase
    ADD CONSTRAINT purchase_pkey PRIMARY KEY (id);


--
-- Name: quotation quotation_pkey; Type: CONSTRAINT; Schema: arthasync; Owner: postgres
--

ALTER TABLE ONLY arthasync.quotation
    ADD CONSTRAINT quotation_pkey PRIMARY KEY (id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: arthasync; Owner: postgres
--

ALTER TABLE ONLY arthasync.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: arthasync; Owner: postgres
--

ALTER TABLE ONLY arthasync.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: purchase_ledger_records purchase_ledger_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_ledger_records
    ADD CONSTRAINT purchase_ledger_records_pkey PRIMARY KEY (invoice_number);


--
-- Name: ix_expense_date; Type: INDEX; Schema: arthasync; Owner: postgres
--

CREATE INDEX ix_expense_date ON arthasync.expense USING btree (date);


--
-- Name: ix_ledger_date; Type: INDEX; Schema: arthasync; Owner: postgres
--

CREATE INDEX ix_ledger_date ON arthasync.ledger USING btree (date);


--
-- Name: ix_purchase_invoice_date; Type: INDEX; Schema: arthasync; Owner: postgres
--

CREATE INDEX ix_purchase_invoice_date ON arthasync.purchase USING btree (invoice_date);


--
-- Name: ix_purchase_vendor_gstin; Type: INDEX; Schema: arthasync; Owner: postgres
--

CREATE INDEX ix_purchase_vendor_gstin ON arthasync.purchase USING btree (vendor_gstin);


--
-- Name: ix_quotation_date; Type: INDEX; Schema: arthasync; Owner: postgres
--

CREATE INDEX ix_quotation_date ON arthasync.quotation USING btree (quotation_date);


--
-- Name: ix_sales_customer_gstin; Type: INDEX; Schema: arthasync; Owner: postgres
--

CREATE INDEX ix_sales_customer_gstin ON arthasync.sales USING btree (customer_gstin);


--
-- Name: ix_sales_invoice_date; Type: INDEX; Schema: arthasync; Owner: postgres
--

CREATE INDEX ix_sales_invoice_date ON arthasync.sales USING btree (invoice_date);


--
-- Name: ix_users_email; Type: INDEX; Schema: arthasync; Owner: postgres
--

CREATE INDEX ix_users_email ON arthasync.users USING btree (email);


--
-- Name: ix_users_phone; Type: INDEX; Schema: arthasync; Owner: postgres
--

CREATE INDEX ix_users_phone ON arthasync.users USING btree (phone);


--
-- Name: ux_expense_expense_id; Type: INDEX; Schema: arthasync; Owner: postgres
--

CREATE UNIQUE INDEX ux_expense_expense_id ON arthasync.expense USING btree (expense_id);


--
-- Name: ux_ledger_entry_id; Type: INDEX; Schema: arthasync; Owner: postgres
--

CREATE UNIQUE INDEX ux_ledger_entry_id ON arthasync.ledger USING btree (entry_id);


--
-- Name: ux_purchase_invoice_number_vendor; Type: INDEX; Schema: arthasync; Owner: postgres
--

CREATE UNIQUE INDEX ux_purchase_invoice_number_vendor ON arthasync.purchase USING btree (invoice_number, vendor_gstin);


--
-- Name: ux_quotation_no; Type: INDEX; Schema: arthasync; Owner: postgres
--

CREATE UNIQUE INDEX ux_quotation_no ON arthasync.quotation USING btree (quotation_no);


--
-- Name: ux_sales_invoice_number_gstin; Type: INDEX; Schema: arthasync; Owner: postgres
--

CREATE UNIQUE INDEX ux_sales_invoice_number_gstin ON arthasync.sales USING btree (invoice_number, customer_gstin);


--
-- Name: ux_users_username; Type: INDEX; Schema: arthasync; Owner: postgres
--

CREATE UNIQUE INDEX ux_users_username ON arthasync.users USING btree (username);


--
-- Name: ix_purchase_ledger_records_invoice_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_purchase_ledger_records_invoice_number ON public.purchase_ledger_records USING btree (invoice_number);


--
-- Name: expense trg_expense_immutable; Type: TRIGGER; Schema: arthasync; Owner: postgres
--

CREATE TRIGGER trg_expense_immutable BEFORE UPDATE ON arthasync.expense FOR EACH ROW EXECUTE FUNCTION arthasync.prevent_immutable_updates('expense_id', 'date');


--
-- Name: ledger trg_ledger_immutable; Type: TRIGGER; Schema: arthasync; Owner: postgres
--

CREATE TRIGGER trg_ledger_immutable BEFORE UPDATE ON arthasync.ledger FOR EACH ROW EXECUTE FUNCTION arthasync.prevent_immutable_updates('entry_id', 'date');


--
-- Name: purchase trg_purchase_immutable; Type: TRIGGER; Schema: arthasync; Owner: postgres
--

CREATE TRIGGER trg_purchase_immutable BEFORE UPDATE ON arthasync.purchase FOR EACH ROW EXECUTE FUNCTION arthasync.prevent_immutable_updates('invoice_number', 'invoice_date', 'vendor_gstin');


--
-- Name: quotation trg_quotation_immutable; Type: TRIGGER; Schema: arthasync; Owner: postgres
--

CREATE TRIGGER trg_quotation_immutable BEFORE UPDATE ON arthasync.quotation FOR EACH ROW EXECUTE FUNCTION arthasync.prevent_immutable_updates('quotation_no', 'quotation_date');


--
-- Name: sales trg_sales_immutable; Type: TRIGGER; Schema: arthasync; Owner: postgres
--

CREATE TRIGGER trg_sales_immutable BEFORE UPDATE ON arthasync.sales FOR EACH ROW EXECUTE FUNCTION arthasync.prevent_immutable_updates('invoice_number', 'invoice_date', 'customer_gstin');


--
-- Name: users trg_users_immutable; Type: TRIGGER; Schema: arthasync; Owner: postgres
--

CREATE TRIGGER trg_users_immutable BEFORE UPDATE ON arthasync.users FOR EACH ROW EXECUTE FUNCTION arthasync.prevent_immutable_updates_users('username');


--
-- Name: TABLE expense; Type: ACL; Schema: arthasync; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE arthasync.expense TO arthasync_user;


--
-- Name: TABLE file_uploads; Type: ACL; Schema: arthasync; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE arthasync.file_uploads TO arthasync_user;


--
-- Name: TABLE ledger; Type: ACL; Schema: arthasync; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE arthasync.ledger TO arthasync_user;


--
-- Name: TABLE purchase; Type: ACL; Schema: arthasync; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE arthasync.purchase TO arthasync_user;


--
-- Name: TABLE quotation; Type: ACL; Schema: arthasync; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE arthasync.quotation TO arthasync_user;


--
-- Name: TABLE sales; Type: ACL; Schema: arthasync; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE arthasync.sales TO arthasync_user;


--
-- Name: TABLE users; Type: ACL; Schema: arthasync; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE arthasync.users TO arthasync_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: arthasync; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA arthasync GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO arthasync_user;


--
-- PostgreSQL database dump complete
--

\unrestrict HZjoSdjc6Vo0lOOd4yde3zFZLhiG1I9XyLWd1iFCLohwqoh4oxhr1OgOgal6tXM

