
-- Clean up any pre-existing objects from fresh Supabase projects
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all tables
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
    -- Drop all sequences
    FOR r IN (SELECT sequencename FROM pg_sequences WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.sequencename) || ' CASCADE';
    END LOOP;
    -- Drop all functions
    FOR r IN (SELECT proname, pg_get_function_identity_arguments(oid) as args
              FROM pg_proc WHERE pronamespace = 'public'::regnamespace) LOOP
        BEGIN
            EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname) || '(' || r.args || ') CASCADE';
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END LOOP;
    -- Drop all types
    FOR r IN (SELECT typname FROM pg_type WHERE typtype = 'e' AND typnamespace = 'public'::regnamespace) LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
    END LOOP;
END $$;

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

CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";

-- CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";

ALTER SCHEMA "public" OWNER TO "postgres";

CREATE EXTENSION IF NOT EXISTS "moddatetime" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";

CREATE OR REPLACE FUNCTION "public"."add_them"("a" integer, "b" integer) RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    AS $$
 SELECT a + b;
$$;

ALTER FUNCTION "public"."add_them"("a" integer, "b" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_exercises"() RETURNS TABLE("course_id" "uuid", "lesson_id" "uuid", "exercise_id" "uuid", "exercise_title" character varying, "points" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  Return query
  select lesson.course_id course_id, lesson.id lesson_id, exercise.id exercise_id, exercise.title exercise_title, sum(question.points)::int points
  from exercise
  join lesson on exercise.lesson_id = lesson.id
  right join question on question.exercise_id = exercise.id
  GROUP BY lesson.course_id, lesson.id, exercise.id, exercise.title
  ORDER BY lesson.created_at ASC;
END;
$$;

ALTER FUNCTION "public"."get_exercises"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_marks"() RETURNS TABLE("course_id" "uuid", "exercise_id" "uuid", "exercise_title" character varying, "exercise_points" integer, "lesson_id" "uuid", "lesson_title" character varying, "status_id" bigint, "total_points_gotten" bigint, "groupmember_id" "uuid", "fullname" "text", "assigned_student_id" character varying, "avatar_url" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  Return query
  select lesson.course_id course_id, exercise.id exercise_id, exercise.title exercise_title, sum(question.points)::int exercise_points, lesson.id lesson_id, lesson.title lesson_title, submission.status_id, submission.total total_points_gotten, submission.submitted_by groupmember_id, profile.fullname, groupmember.assigned_student_id, profile.avatar_url
  from exercise
  join lesson on exercise.lesson_id = lesson.id
  left join submission on exercise.id = submission.exercise_id
  join groupmember on groupmember.id = submission.submitted_by
  right join question on question.exercise_id = exercise.id
  join profile on profile.id = groupmember.profile_id
  GROUP BY exercise.id, lesson.id, submission.status_id, submission.total, submission.submitted_by, profile.fullname, groupmember.assigned_student_id, profile.avatar_url
  ORDER BY lesson.created_at ASC;
END;
$$;

ALTER FUNCTION "public"."get_marks"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_student_exercises"("org_id_arg" "uuid", "profile_id_arg" "uuid") RETURNS TABLE("exercise_id" "uuid", "exercise_title" character varying, "lesson_id" "uuid", "lesson_title" character varying, "status_id" integer, "total" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  Return query
  select exercise.id as exercise_id, exercise.title as exercise_title, lesson.id as lesson_id, lesson.title as lesson_title, submission.status_id, submission.total
  from exercise
  inner join lesson on lesson.id = exercise.lesson_id
  inner join course on course.id = lesson.course_id
  inner join "group" on "group".id = course.group_id
  inner join organization on "group".organization_id = organization.id
  inner join groupmember on groupmember.group_id = course.group_id
  inner join profile on groupmember.profile_id = profile.id
  left join submission on submission.submitted_by = groupmember.id
  where course.status = 'ACTIVE' AND organization.id = org_id_arg AND profile.id = profile_id_arg;
END;
$$;

ALTER FUNCTION "public"."get_student_exercises"("org_id_arg" "uuid", "profile_id_arg" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_user_upcoming_lessons"("profile_id_arg" "uuid", "org_id_arg" "uuid") RETURNS TABLE("course_id" "uuid", "course_title" character varying, "lesson_id" "uuid", "lesson_title" character varying, "call_url" "text", "lesson_at" timestamp with time zone, "is_complete" boolean)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  Return query
  select course.id course_id, course.title course_title, lesson.id lesson_id, lesson.title lesson_title, lesson.call_url call_url, lesson.lesson_at lesson_at, lesson.is_complete is_complete
  from lesson
  join course on course.id = lesson.course_id
  join "group" on "group".id = course.group_id
  join groupmember on groupmember.group_id = course.group_id
  where course.status = 'ACTIVE' AND groupmember.profile_id = profile_id_arg AND "group".organization_id = org_id_arg
  ORDER BY lesson_at ASC;
END
$$;

ALTER FUNCTION "public"."get_user_upcoming_lessons"("profile_id_arg" "uuid", "org_id_arg" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."apps_poll" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "question" "text",
    "authorId" "uuid",
    "isPublic" boolean,
    "status" character varying DEFAULT 'draft'::character varying,
    "expiration" timestamp with time zone,
    "courseId" "uuid"
);

ALTER TABLE "public"."apps_poll" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."apps_poll_option" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "poll_id" "uuid",
    "label" character varying
);

ALTER TABLE "public"."apps_poll_option" OWNER TO "postgres";

ALTER TABLE "public"."apps_poll_option" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."apps_poll_option_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."apps_poll_submission" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "poll_option_id" bigint,
    "selected_by_id" "uuid",
    "poll_id" "uuid"
);

ALTER TABLE "public"."apps_poll_submission" OWNER TO "postgres";

ALTER TABLE "public"."apps_poll_submission" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."apps_poll_submision_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."community_answer" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "question_id" bigint,
    "body" character varying,
    "author_id" bigint,
    "votes" bigint
);

ALTER TABLE "public"."community_answer" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."community_question" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "title" character varying,
    "body" "text",
    "author_id" bigint,
    "votes" bigint DEFAULT '0'::bigint,
    "organization_id" "uuid",
    "slug" "text"
);

ALTER TABLE "public"."community_question" OWNER TO "postgres";

ALTER TABLE "public"."community_question" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."community_question_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."course" (
    "title" character varying NOT NULL,
    "description" character varying NOT NULL,
    "overview" character varying DEFAULT 'Welcome to this amazing course 🚀 '::character varying,
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "group_id" "uuid",
    "is_template" boolean DEFAULT true,
    "logo" "text" DEFAULT ''::"text" NOT NULL,
    "slug" character varying,
    "metadata" "jsonb" DEFAULT '{"goals": "", "description": "", "requirements": ""}'::"jsonb" NOT NULL,
    "cost" bigint DEFAULT '0'::bigint,
    "currency" character varying DEFAULT 'NGN'::character varying NOT NULL,
    "banner_image" "text",
    "is_published" boolean DEFAULT false,
    "is_certificate_downloadable" boolean DEFAULT false,
    "certificate_theme" "text",
    "status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL
);

ALTER TABLE "public"."course" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."currency" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "name" character varying
);

ALTER TABLE "public"."currency" OWNER TO "postgres";

ALTER TABLE "public"."currency" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."currency_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."exercise" (
    "title" character varying NOT NULL,
    "description" character varying,
    "lesson_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "due_by" timestamp without time zone
);

ALTER TABLE "public"."exercise" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."group" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid"
);

ALTER TABLE "public"."group" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."group_attendance" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "course_id" "uuid",
    "student_id" "uuid",
    "is_present" boolean DEFAULT false,
    "lesson_id" "uuid" NOT NULL
);

ALTER TABLE "public"."group_attendance" OWNER TO "postgres";

ALTER TABLE "public"."group_attendance" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."group_attendance_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."groupmember" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "role_id" bigint NOT NULL,
    "profile_id" "uuid",
    "email" character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "assigned_student_id" character varying
);

ALTER TABLE "public"."groupmember" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."lesson" (
    "note" character varying,
    "video_url" character varying,
    "slide_url" character varying,
    "course_id" "uuid" NOT NULL,
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "title" character varying NOT NULL,
    "public" boolean DEFAULT false,
    "lesson_at" timestamp with time zone DEFAULT "now"(),
    "teacher_id" "uuid",
    "is_complete" boolean DEFAULT false,
    "call_url" "text",
    "order" bigint,
    "is_unlocked" boolean DEFAULT false,
    "videos" "jsonb" DEFAULT '[]'::"jsonb"
);

ALTER TABLE "public"."lesson" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."lesson_comment" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "lesson_id" "uuid",
    "groupmember_id" "uuid",
    "comment" "text"
);

ALTER TABLE "public"."lesson_comment" OWNER TO "postgres";

ALTER TABLE "public"."lesson_comment" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."lesson_comment_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."lesson_completion" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lesson_id" "uuid",
    "profile_id" "uuid",
    "is_complete" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."lesson_completion" OWNER TO "postgres";

ALTER TABLE "public"."lesson_completion" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."lesson_completion_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."option" (
    "id" bigint NOT NULL,
    "label" character varying NOT NULL,
    "is_correct" boolean DEFAULT false NOT NULL,
    "question_id" bigint NOT NULL,
    "value" "uuid" DEFAULT "extensions"."gen_random_uuid"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."option" OWNER TO "postgres";

ALTER TABLE "public"."option" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."option_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."organization" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying NOT NULL,
    "siteName" "text",
    "avatar_url" "text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "landingpage" "jsonb" DEFAULT '{}'::"jsonb",
    "theme" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."organization" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."organization_contacts" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text",
    "phone" "text",
    "name" "text",
    "message" "text",
    "organization_id" "uuid"
);

ALTER TABLE "public"."organization_contacts" OWNER TO "postgres";

ALTER TABLE "public"."organization_contacts" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."organization_contacts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."organization_emaillist" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text",
    "organization_id" "uuid"
);

ALTER TABLE "public"."organization_emaillist" OWNER TO "postgres";

ALTER TABLE "public"."organization_emaillist" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."organization_emaillist_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."organizationmember" (
    "id" bigint NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "role_id" bigint NOT NULL,
    "profile_id" "uuid",
    "email" "text",
    "verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."organizationmember" OWNER TO "postgres";

ALTER TABLE "public"."organizationmember" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."organizationmember_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."quiz_play" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "quiz_id" "uuid",
    "players" "json" DEFAULT '[]'::"json",
    "started" boolean DEFAULT false,
    "currentQuestionId" bigint DEFAULT '0'::bigint,
    "showCurrentQuestionAnswer" boolean DEFAULT false,
    "isLastQuestion" boolean,
    "step" "text" DEFAULT 'CONNECT_TO_PLAY'::"text",
    "studentStep" "text" DEFAULT 'PIN_SETUP'::"text",
    "pin" "text"
);

ALTER TABLE "public"."quiz_play" OWNER TO "postgres";

ALTER TABLE "public"."quiz_play" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."play_quiz_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."profile" (
    "id" "uuid" NOT NULL,
    "fullname" "text" NOT NULL,
    "username" "text" NOT NULL,
    "avatar_url" "text" NULL DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "email" character varying,
    "can_add_course" boolean DEFAULT true,
    "role" character varying,
    "goal" character varying,
    "source" character varying,
    "metadata" "json",
    "telegram_chat_id" bigint
);

ALTER TABLE "public"."profile" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."question" (
    "id" bigint NOT NULL,
    "question_type_id" bigint NOT NULL,
    "title" character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "exercise_id" "uuid" NOT NULL,
    "name" "uuid" DEFAULT "extensions"."gen_random_uuid"(),
    "points" double precision,
    "order" bigint
);

ALTER TABLE "public"."question" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."question_answer" (
    "id" bigint NOT NULL,
    "answers" character varying[],
    "question_id" bigint NOT NULL,
    "open_answer" "text",
    "group_member_id" "uuid" NOT NULL,
    "submission_id" "uuid",
    "point" bigint DEFAULT '0'::bigint
);

ALTER TABLE "public"."question_answer" OWNER TO "postgres";

ALTER TABLE "public"."question_answer" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."question_answer_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE "public"."question" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."question_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."question_type" (
    "id" bigint NOT NULL,
    "label" character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "typename" character varying
);

ALTER TABLE "public"."question_type" OWNER TO "postgres";

ALTER TABLE "public"."question_type" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."question_type_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."quiz" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "title" "text",
    "questions" "json",
    "timelimit" character varying DEFAULT '10s'::character varying,
    "theme" character varying DEFAULT 'standard'::character varying,
    "organization_id" "uuid" NOT NULL
);

ALTER TABLE "public"."quiz" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."role" (
    "type" character varying NOT NULL,
    "description" character varying,
    "id" bigint NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."role" OWNER TO "postgres";

ALTER TABLE "public"."role" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."role_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."submission" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "reviewer_id" bigint,
    "status_id" bigint DEFAULT '1'::bigint,
    "total" bigint DEFAULT '0'::bigint,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "exercise_id" "uuid" NOT NULL,
    "submitted_by" "uuid",
    "course_id" "uuid"
);

ALTER TABLE "public"."submission" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."submissionstatus" (
    "id" bigint NOT NULL,
    "label" character varying NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."submissionstatus" OWNER TO "postgres";

ALTER TABLE "public"."submissionstatus" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."submission_status_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."video_transcripts" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "muse_svid" "text",
    "transcript" "text",
    "downloaded" boolean DEFAULT false,
    "link" "text"
);

ALTER TABLE "public"."video_transcripts" OWNER TO "postgres";

ALTER TABLE "public"."video_transcripts" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."video_transcripts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."waitinglist" (
    "id" bigint NOT NULL,
    "email" character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."waitinglist" OWNER TO "postgres";

ALTER TABLE "public"."waitinglist" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."waitinglist_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE ONLY "public"."apps_poll_option"
    ADD CONSTRAINT "apps_poll_option_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."apps_poll"
    ADD CONSTRAINT "apps_poll_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."apps_poll_submission"
    ADD CONSTRAINT "apps_poll_submision_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."community_answer"
    ADD CONSTRAINT "community_answer_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."community_question"
    ADD CONSTRAINT "community_question_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."waitinglist"
    ADD CONSTRAINT "constraint_name" UNIQUE ("email");

ALTER TABLE ONLY "public"."course"
    ADD CONSTRAINT "course_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."course"
    ADD CONSTRAINT "course_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."currency"
    ADD CONSTRAINT "currency_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."exercise"
    ADD CONSTRAINT "exercise_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."group_attendance"
    ADD CONSTRAINT "group_attendance_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."group"
    ADD CONSTRAINT "group_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."groupmember"
    ADD CONSTRAINT "groupmember_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."lesson_comment"
    ADD CONSTRAINT "lesson_comment_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."lesson_completion"
    ADD CONSTRAINT "lesson_completion_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."lesson"
    ADD CONSTRAINT "lesson_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."option"
    ADD CONSTRAINT "option_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."organization_contacts"
    ADD CONSTRAINT "organization_contacts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."organization_emaillist"
    ADD CONSTRAINT "organization_emaillist_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."organization"
    ADD CONSTRAINT "organization_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."organization"
    ADD CONSTRAINT "organization_siteName_key" UNIQUE ("siteName");

ALTER TABLE ONLY "public"."organizationmember"
    ADD CONSTRAINT "organizationmember_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."quiz_play"
    ADD CONSTRAINT "play_quiz_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profile"
    ADD CONSTRAINT "profile_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profile"
    ADD CONSTRAINT "profile_username_key" UNIQUE ("username");

ALTER TABLE ONLY "public"."question_answer"
    ADD CONSTRAINT "question_answer_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."question"
    ADD CONSTRAINT "question_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."question_type"
    ADD CONSTRAINT "question_type_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."quiz"
    ADD CONSTRAINT "quiz_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."quiz_play"
    ADD CONSTRAINT "quiz_play_pin_key" UNIQUE ("pin");

ALTER TABLE ONLY "public"."role"
    ADD CONSTRAINT "role_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."submission"
    ADD CONSTRAINT "submission_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."submissionstatus"
    ADD CONSTRAINT "submission_status_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."groupmember"
    ADD CONSTRAINT "unique_entries" UNIQUE ("group_id", "profile_id", "email");

ALTER TABLE ONLY "public"."groupmember"
    ADD CONSTRAINT "unique_group_email" UNIQUE ("group_id", "email");

ALTER TABLE ONLY "public"."groupmember"
    ADD CONSTRAINT "unique_group_profile" UNIQUE ("group_id", "profile_id");

ALTER TABLE ONLY "public"."video_transcripts"
    ADD CONSTRAINT "video_transcripts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."waitinglist"
    ADD CONSTRAINT "waitinglist_pkey" PRIMARY KEY ("id");

CREATE OR REPLACE TRIGGER "handle_exercise_updated_at" BEFORE UPDATE ON "public"."exercise" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');

CREATE OR REPLACE TRIGGER "handle_lesson_updated_at" BEFORE UPDATE ON "public"."lesson" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');

CREATE OR REPLACE TRIGGER "handle_question_type_updated_at" BEFORE UPDATE ON "public"."question_type" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');

CREATE OR REPLACE TRIGGER "handle_question_updated_at" BEFORE UPDATE ON "public"."question" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');

CREATE OR REPLACE TRIGGER "handle_role_updated_at" BEFORE UPDATE ON "public"."role" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');

CREATE OR REPLACE TRIGGER "handle_submission_updated_at" BEFORE UPDATE ON "public"."submission" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');

CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."exercise" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');

CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."lesson" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');

CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."question" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');

ALTER TABLE ONLY "public"."apps_poll"
    ADD CONSTRAINT "apps_poll_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."groupmember"("id");

ALTER TABLE ONLY "public"."apps_poll"
    ADD CONSTRAINT "apps_poll_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."course"("id");

ALTER TABLE ONLY "public"."apps_poll_option"
    ADD CONSTRAINT "apps_poll_option_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."apps_poll"("id");

ALTER TABLE ONLY "public"."apps_poll_submission"
    ADD CONSTRAINT "apps_poll_submission_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."apps_poll"("id");

ALTER TABLE ONLY "public"."apps_poll_submission"
    ADD CONSTRAINT "apps_poll_submission_poll_option_id_fkey" FOREIGN KEY ("poll_option_id") REFERENCES "public"."apps_poll_option"("id");

ALTER TABLE ONLY "public"."apps_poll_submission"
    ADD CONSTRAINT "apps_poll_submission_selected_by_id_fkey" FOREIGN KEY ("selected_by_id") REFERENCES "public"."groupmember"("id");

ALTER TABLE ONLY "public"."community_answer"
    ADD CONSTRAINT "community_answer_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."organizationmember"("id");

ALTER TABLE ONLY "public"."community_answer"
    ADD CONSTRAINT "community_answer_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."community_question"("id");

ALTER TABLE ONLY "public"."community_question"
    ADD CONSTRAINT "community_question_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."organizationmember"("id");

ALTER TABLE ONLY "public"."community_question"
    ADD CONSTRAINT "community_question_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id");

ALTER TABLE ONLY "public"."course"
    ADD CONSTRAINT "course_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id");

ALTER TABLE ONLY "public"."exercise"
    ADD CONSTRAINT "exercise_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id");

ALTER TABLE ONLY "public"."group_attendance"
    ADD CONSTRAINT "group_attendance_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id");

ALTER TABLE ONLY "public"."group_attendance"
    ADD CONSTRAINT "group_attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."groupmember"("id");

ALTER TABLE ONLY "public"."group"
    ADD CONSTRAINT "group_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id");

ALTER TABLE ONLY "public"."groupmember"
    ADD CONSTRAINT "groupmember_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id");

ALTER TABLE ONLY "public"."groupmember"
    ADD CONSTRAINT "groupmember_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id");

ALTER TABLE ONLY "public"."groupmember"
    ADD CONSTRAINT "groupmember_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id");

ALTER TABLE ONLY "public"."lesson_comment"
    ADD CONSTRAINT "lesson_comment_groupmember_id_fkey" FOREIGN KEY ("groupmember_id") REFERENCES "public"."groupmember"("id");

ALTER TABLE ONLY "public"."lesson_comment"
    ADD CONSTRAINT "lesson_comment_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id");

ALTER TABLE ONLY "public"."lesson_completion"
    ADD CONSTRAINT "lesson_completion_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id");

ALTER TABLE ONLY "public"."lesson_completion"
    ADD CONSTRAINT "lesson_completion_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id");

ALTER TABLE ONLY "public"."lesson"
    ADD CONSTRAINT "lesson_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id");

ALTER TABLE ONLY "public"."lesson"
    ADD CONSTRAINT "lesson_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."profile"("id");

ALTER TABLE ONLY "public"."option"
    ADD CONSTRAINT "option_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id");

ALTER TABLE ONLY "public"."organization_contacts"
    ADD CONSTRAINT "organization_contacts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id");

ALTER TABLE ONLY "public"."organization_emaillist"
    ADD CONSTRAINT "organization_emaillist_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id");

ALTER TABLE ONLY "public"."organizationmember"
    ADD CONSTRAINT "organizationmember_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id");

ALTER TABLE ONLY "public"."organizationmember"
    ADD CONSTRAINT "organizationmember_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id");

ALTER TABLE ONLY "public"."organizationmember"
    ADD CONSTRAINT "organizationmember_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id");

ALTER TABLE ONLY "public"."profile"
    ADD CONSTRAINT "profile_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."question_answer"
    ADD CONSTRAINT "question_answer_group_member_id_fkey" FOREIGN KEY ("group_member_id") REFERENCES "public"."groupmember"("id");

ALTER TABLE ONLY "public"."question_answer"
    ADD CONSTRAINT "question_answer_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id");

ALTER TABLE ONLY "public"."question_answer"
    ADD CONSTRAINT "question_answer_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."submission"("id");

ALTER TABLE ONLY "public"."question"
    ADD CONSTRAINT "question_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id");

ALTER TABLE ONLY "public"."question"
    ADD CONSTRAINT "question_question_type_id_fkey" FOREIGN KEY ("question_type_id") REFERENCES "public"."question_type"("id");

ALTER TABLE ONLY "public"."quiz"
    ADD CONSTRAINT "quiz_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id");

ALTER TABLE ONLY "public"."quiz_play"
    ADD CONSTRAINT "quiz_play_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quiz"("id");

ALTER TABLE ONLY "public"."submission"
    ADD CONSTRAINT "submission_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id");

ALTER TABLE ONLY "public"."submission"
    ADD CONSTRAINT "submission_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id");

ALTER TABLE ONLY "public"."submission"
    ADD CONSTRAINT "submission_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "public"."submissionstatus"("id");

ALTER TABLE ONLY "public"."submission"
    ADD CONSTRAINT "submission_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."groupmember"("id");

CREATE POLICY "Enable access to all users" ON "public"."course" FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON "public"."community_question" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Enable insert for authenticated users only" ON "public"."course" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));

CREATE POLICY "Enable insert for authenticated users only" ON "public"."lesson_comment" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON "public"."lesson_comment" FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."organization_contacts" FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON "public"."organization_emaillist" FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users only" ON "public"."course" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));

CREATE POLICY "Public profiles are viewable by everyone." ON "public"."profile" FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile." ON "public"."profile" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));

CREATE POLICY "Users can update own profile." ON "public"."profile" FOR UPDATE USING (("auth"."uid"() = "id"));

ALTER TABLE "public"."currency" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."lesson_comment" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."organization_contacts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."organization_emaillist" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profile" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."video_transcripts" ENABLE ROW LEVEL SECURITY;

REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT ALL ON SCHEMA "public" TO PUBLIC;

GRANT ALL ON FUNCTION "public"."add_them"("a" integer, "b" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."add_them"("a" integer, "b" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_them"("a" integer, "b" integer) TO "service_role";


GRANT ALL ON FUNCTION "public"."get_exercises"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_exercises"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_exercises"() TO "service_role";

GRANT ALL ON FUNCTION "public"."get_marks"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_marks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_marks"() TO "service_role";

GRANT ALL ON FUNCTION "public"."get_student_exercises"("org_id_arg" "uuid", "profile_id_arg" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_student_exercises"("org_id_arg" "uuid", "profile_id_arg" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_student_exercises"("org_id_arg" "uuid", "profile_id_arg" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_user_upcoming_lessons"("profile_id_arg" "uuid", "org_id_arg" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_upcoming_lessons"("profile_id_arg" "uuid", "org_id_arg" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_upcoming_lessons"("profile_id_arg" "uuid", "org_id_arg" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."apps_poll" TO "anon";
GRANT ALL ON TABLE "public"."apps_poll" TO "authenticated";
GRANT ALL ON TABLE "public"."apps_poll" TO "service_role";

GRANT ALL ON TABLE "public"."apps_poll_option" TO "anon";
GRANT ALL ON TABLE "public"."apps_poll_option" TO "authenticated";
GRANT ALL ON TABLE "public"."apps_poll_option" TO "service_role";

GRANT ALL ON SEQUENCE "public"."apps_poll_option_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."apps_poll_option_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."apps_poll_option_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."apps_poll_submission" TO "anon";
GRANT ALL ON TABLE "public"."apps_poll_submission" TO "authenticated";
GRANT ALL ON TABLE "public"."apps_poll_submission" TO "service_role";

GRANT ALL ON SEQUENCE "public"."apps_poll_submision_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."apps_poll_submision_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."apps_poll_submision_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."community_answer" TO "anon";
GRANT ALL ON TABLE "public"."community_answer" TO "authenticated";
GRANT ALL ON TABLE "public"."community_answer" TO "service_role";

GRANT ALL ON TABLE "public"."community_question" TO "anon";
GRANT ALL ON TABLE "public"."community_question" TO "authenticated";
GRANT ALL ON TABLE "public"."community_question" TO "service_role";

GRANT ALL ON SEQUENCE "public"."community_question_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."community_question_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."community_question_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."course" TO "anon";
GRANT ALL ON TABLE "public"."course" TO "authenticated";
GRANT ALL ON TABLE "public"."course" TO "service_role";

GRANT ALL ON TABLE "public"."currency" TO "anon";
GRANT ALL ON TABLE "public"."currency" TO "authenticated";
GRANT ALL ON TABLE "public"."currency" TO "service_role";

GRANT ALL ON SEQUENCE "public"."currency_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."currency_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."currency_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."exercise" TO "anon";
GRANT ALL ON TABLE "public"."exercise" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise" TO "service_role";

GRANT ALL ON TABLE "public"."group" TO "anon";
GRANT ALL ON TABLE "public"."group" TO "authenticated";
GRANT ALL ON TABLE "public"."group" TO "service_role";

GRANT ALL ON TABLE "public"."group_attendance" TO "anon";
GRANT ALL ON TABLE "public"."group_attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."group_attendance" TO "service_role";

GRANT ALL ON SEQUENCE "public"."group_attendance_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."group_attendance_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."group_attendance_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."groupmember" TO "anon";
GRANT ALL ON TABLE "public"."groupmember" TO "authenticated";
GRANT ALL ON TABLE "public"."groupmember" TO "service_role";

GRANT ALL ON TABLE "public"."lesson" TO "anon";
GRANT ALL ON TABLE "public"."lesson" TO "authenticated";
GRANT ALL ON TABLE "public"."lesson" TO "service_role";

GRANT ALL ON TABLE "public"."lesson_comment" TO "anon";
GRANT ALL ON TABLE "public"."lesson_comment" TO "authenticated";
GRANT ALL ON TABLE "public"."lesson_comment" TO "service_role";

GRANT ALL ON SEQUENCE "public"."lesson_comment_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."lesson_comment_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lesson_comment_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."lesson_completion" TO "anon";
GRANT ALL ON TABLE "public"."lesson_completion" TO "authenticated";
GRANT ALL ON TABLE "public"."lesson_completion" TO "service_role";

GRANT ALL ON SEQUENCE "public"."lesson_completion_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."lesson_completion_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lesson_completion_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."option" TO "anon";
GRANT ALL ON TABLE "public"."option" TO "authenticated";
GRANT ALL ON TABLE "public"."option" TO "service_role";

GRANT ALL ON SEQUENCE "public"."option_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."option_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."option_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."organization" TO "anon";
GRANT ALL ON TABLE "public"."organization" TO "authenticated";
GRANT ALL ON TABLE "public"."organization" TO "service_role";

GRANT ALL ON TABLE "public"."organization_contacts" TO "anon";
GRANT ALL ON TABLE "public"."organization_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_contacts" TO "service_role";

GRANT ALL ON SEQUENCE "public"."organization_contacts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."organization_contacts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."organization_contacts_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."organization_emaillist" TO "anon";
GRANT ALL ON TABLE "public"."organization_emaillist" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_emaillist" TO "service_role";

GRANT ALL ON SEQUENCE "public"."organization_emaillist_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."organization_emaillist_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."organization_emaillist_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."organizationmember" TO "anon";
GRANT ALL ON TABLE "public"."organizationmember" TO "authenticated";
GRANT ALL ON TABLE "public"."organizationmember" TO "service_role";

GRANT ALL ON SEQUENCE "public"."organizationmember_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."organizationmember_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."organizationmember_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."quiz_play" TO "anon";
GRANT ALL ON TABLE "public"."quiz_play" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_play" TO "service_role";

GRANT ALL ON SEQUENCE "public"."play_quiz_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."play_quiz_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."play_quiz_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."profile" TO "anon";
GRANT ALL ON TABLE "public"."profile" TO "authenticated";
GRANT ALL ON TABLE "public"."profile" TO "service_role";

GRANT ALL ON TABLE "public"."question" TO "anon";
GRANT ALL ON TABLE "public"."question" TO "authenticated";
GRANT ALL ON TABLE "public"."question" TO "service_role";

GRANT ALL ON TABLE "public"."question_answer" TO "anon";
GRANT ALL ON TABLE "public"."question_answer" TO "authenticated";
GRANT ALL ON TABLE "public"."question_answer" TO "service_role";

GRANT ALL ON SEQUENCE "public"."question_answer_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."question_answer_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."question_answer_id_seq" TO "service_role";

GRANT ALL ON SEQUENCE "public"."question_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."question_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."question_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."question_type" TO "anon";
GRANT ALL ON TABLE "public"."question_type" TO "authenticated";
GRANT ALL ON TABLE "public"."question_type" TO "service_role";

GRANT ALL ON SEQUENCE "public"."question_type_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."question_type_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."question_type_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."quiz" TO "anon";
GRANT ALL ON TABLE "public"."quiz" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz" TO "service_role";

GRANT ALL ON TABLE "public"."role" TO "anon";
GRANT ALL ON TABLE "public"."role" TO "authenticated";
GRANT ALL ON TABLE "public"."role" TO "service_role";

GRANT ALL ON SEQUENCE "public"."role_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."role_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."role_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."submission" TO "anon";
GRANT ALL ON TABLE "public"."submission" TO "authenticated";
GRANT ALL ON TABLE "public"."submission" TO "service_role";

GRANT ALL ON TABLE "public"."submissionstatus" TO "anon";
GRANT ALL ON TABLE "public"."submissionstatus" TO "authenticated";
GRANT ALL ON TABLE "public"."submissionstatus" TO "service_role";

GRANT ALL ON SEQUENCE "public"."submission_status_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."submission_status_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."submission_status_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."video_transcripts" TO "anon";
GRANT ALL ON TABLE "public"."video_transcripts" TO "authenticated";
GRANT ALL ON TABLE "public"."video_transcripts" TO "service_role";

GRANT ALL ON SEQUENCE "public"."video_transcripts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."video_transcripts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."video_transcripts_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."waitinglist" TO "anon";
GRANT ALL ON TABLE "public"."waitinglist" TO "authenticated";
GRANT ALL ON TABLE "public"."waitinglist" TO "service_role";

GRANT ALL ON SEQUENCE "public"."waitinglist_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."waitinglist_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."waitinglist_id_seq" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";

INSERT INTO "public"."role" (type, description) VALUES ('ADMIN', 'The main controller');
INSERT INTO "public"."role" (type, description) VALUES ('TUTOR', 'Can make changes to content, courses, but cant control passwords and cant add other tutors');
INSERT INTO "public"."role" (type, description) VALUES ('STUDENT', 'A student role, can interact with application but cant make changes');
INSERT INTO "public"."submissionstatus" (label) VALUES ('Submitted');
INSERT INTO "public"."submissionstatus" (label) VALUES ('In Progress');
INSERT INTO "public"."submissionstatus" (label) VALUES ('Graded');

INSERT INTO "public"."question_type" (label, created_at, updated_at, typename) VALUES ('Single answer', '2021-08-07 18:49:46.246529+00', '2021-08-15 00:57:08.12069+00', 'RADIO');
INSERT INTO "public"."question_type" (label, created_at, updated_at, typename) VALUES ('Multiple answers', '2021-08-07 18:49:46.246529+00', '2021-08-15 00:57:27.935478+00', 'CHECKBOX');
INSERT INTO "public"."question_type" (label, created_at, updated_at, typename) VALUES ('Paragraph', '2021-08-07 18:49:46.246529+00', '2021-08-15 00:57:38.634665+00', 'TEXTAREA');


-- First, let's check if the constraint 'buckets_owner_fkey' exists before trying to drop it.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.constraint_column_usage 
               WHERE table_schema = 'storage' 
               AND table_name = 'buckets' 
               AND constraint_name = 'buckets_owner_fkey') THEN
        ALTER TABLE "storage"."buckets" DROP CONSTRAINT "buckets_owner_fkey";
    END IF;
END
$$;

-- Now, we check if the column 'owner_id' exists in 'buckets' before trying to add it.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'storage' 
                   AND table_name = 'buckets' 
                   AND column_name = 'owner_id') THEN
        ALTER TABLE "storage"."buckets" ADD COLUMN "owner_id" text;
    END IF;
END
$$;

-- Similarly, check if 'owner_id' exists in 'objects' before adding it.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'storage' 
                   AND table_name = 'objects' 
                   AND column_name = 'owner_id') THEN
        ALTER TABLE "storage"."objects" ADD COLUMN "owner_id" text;
    END IF;
END
$$;


create policy "Anyone can update an avatar. 1oj01fe_0"
on "storage"."objects"
as permissive
for select
to public
using ((bucket_id = 'avatars'::text));


create policy "Anyone can update an avatar. 1oj01fe_1"
on "storage"."objects"
as permissive
for insert
to public
with check ((bucket_id = 'avatars'::text));


create policy "Avatar images are publicly accessible 1oj01fe_0"
on "storage"."objects"
as permissive
for select
to public
using ((bucket_id = 'avatars'::text));

RESET ALL;


alter table "public"."profile" alter column "avatar_url" set default 'https://placeholder-cdn.5gnumultimedia.com/storage/v1/object/public/avatars/avatar.png'::text;




alter table "public"."course" alter column "metadata" set default '{"goals": "", "description": "", "requirements": ""}'::jsonb;

alter table "public"."community_answer" add column "author_profile_id" uuid;

alter table "public"."community_question" add column "author_profile_id" uuid;

alter table "public"."community_answer" add constraint "community_answer_author_profile_id_fkey" FOREIGN KEY (author_profile_id) REFERENCES profile(id) not valid;

alter table "public"."community_answer" validate constraint "community_answer_author_profile_id_fkey";

alter table "public"."community_question" add constraint "community_question_author_profile_id_fkey" FOREIGN KEY (author_profile_id) REFERENCES profile(id) not valid;

alter table "public"."community_question" validate constraint "community_question_author_profile_id_fkey";

create table "public"."course_newsfeed" (
    "created_at" timestamp with time zone not null default now(),
    "author_id" uuid,
    "content" text,
    "id" uuid not null default gen_random_uuid(),
    "course_id" uuid,
    "reaction" jsonb default '{"clap": [], "smile": [], "thumbsup": [], "thumbsdown": []}'::jsonb,
    "is_pinned" boolean not null default false
);


create table "public"."course_newsfeed_comment" (
    "created_at" timestamp with time zone not null default now(),
    "author_id" uuid,
    "content" text,
    "id" bigint generated by default as identity not null,
    "course_newsfeed_id" uuid
);


CREATE UNIQUE INDEX course_newsfeed_comment_id_key ON public.course_newsfeed_comment USING btree (id);

CREATE UNIQUE INDEX course_newsfeed_comment_pkey ON public.course_newsfeed_comment USING btree (id);

CREATE UNIQUE INDEX course_newsfeed_pkey ON public.course_newsfeed USING btree (id);

alter table "public"."course_newsfeed" add constraint "course_newsfeed_pkey" PRIMARY KEY using index "course_newsfeed_pkey";

alter table "public"."course_newsfeed_comment" add constraint "course_newsfeed_comment_pkey" PRIMARY KEY using index 
"course_newsfeed_comment_pkey";

alter table "public"."course_newsfeed" add constraint "course_newsfeed_author_id_fkey" FOREIGN KEY (author_id) REFERENCES groupmember(id) not valid;

alter table "public"."course_newsfeed" validate constraint "course_newsfeed_author_id_fkey";

alter table "public"."course_newsfeed" add constraint "course_newsfeed_course_id_fkey" FOREIGN KEY (course_id) REFERENCES course(id) not valid;

alter table "public"."course_newsfeed" validate constraint "course_newsfeed_course_id_fkey";

alter table "public"."course_newsfeed_comment" add constraint "course_newsfeed_comment_id_key" UNIQUE using index "course_newsfeed_comment_id_key";

alter table "public"."course_newsfeed_comment" add constraint "course_newsfeed_comment_author_id_fkey" FOREIGN KEY (author_id) REFERENCES groupmember(id) not valid;

alter table "public"."course_newsfeed_comment" validate constraint "course_newsfeed_comment_author_id_fkey";

alter table "public"."course_newsfeed_comment" add constraint "course_newsfeed_comment_course_newsfeed_id_fkey" FOREIGN KEY (course_newsfeed_id) REFERENCES course_newsfeed(id) not valid;

alter table "public"."course_newsfeed_comment" validate constraint "course_newsfeed_comment_course_newsfeed_id_fkey";

create sequence "public"."test_tenant_id_seq";

create table "public"."test_tenant" (
    "id" integer not null default nextval('test_tenant_id_seq'::regclass),
    "details" text
);

truncate "public"."community_question" cascade;

alter table "public"."community_question" add column "course_id" uuid not null;

alter sequence "public"."test_tenant_id_seq" owned by "public"."test_tenant"."id";

CREATE UNIQUE INDEX test_tenant_pkey ON public.test_tenant USING btree (id);

alter table "public"."test_tenant" add constraint "test_tenant_pkey" PRIMARY KEY using index "test_tenant_pkey";

alter table "public"."community_question" add constraint "community_question_course_id_fkey" FOREIGN KEY (course_id) REFERENCES course(id) not valid;

alter table "public"."community_question" validate constraint "community_question_course_id_fkey";

alter table "public"."profile" add column "is_email_verified" boolean default false;
alter table "public"."profile" add column "verified_at" timestamp with time zone;

CREATE UNIQUE INDEX profile_email_key ON public.profile USING btree (email);

alter table "public"."profile" add constraint "profile_email_key" UNIQUE using index "profile_email_key";

create type "public"."LOCALE" as enum ('en', 'hi', 'fr', 'pt', 'de', 'vi', 'ru', 'es');

create table
  public.lesson_language (
    id bigint generated by default as identity,
    content text null,
    lesson_id uuid null default gen_random_uuid (),
    locale "LOCALE" default 'en'::"LOCALE",
    constraint lesson_language_pkey primary key (id),
    constraint public_lesson_language_lesson_id_fkey foreign key (lesson_id) references lesson (id)
  ) tablespace pg_default;

alter table "public"."profile" add column "locale" "LOCALE" default 'en'::"LOCALE";

create type "public"."PLAN" as enum ('EARLY_ADOPTER', 'ENTERPRISE', 'BASIC');

create table "public"."organization_plan" (
    "id" bigint generated by default as identity not null,
    "activated_at" timestamp with time zone not null default now(),
    "org_id" uuid,
    "plan_name" "PLAN",
    "is_active" boolean,
    "deactivated_at" timestamp with time zone,
    "updated_at" timestamp with time zone default now(),
    "payload" jsonb,
    "triggered_by" bigint
);


CREATE UNIQUE INDEX organization_plan_pkey ON public.organization_plan USING btree (id);

alter table "public"."organization_plan" add constraint "organization_plan_pkey" PRIMARY KEY using index "organization_plan_pkey";

alter table "public"."organization_plan" add constraint "organization_plan_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organization(id) not valid;

alter table "public"."organization_plan" validate constraint "organization_plan_org_id_fkey";

alter table "public"."organization_plan" add constraint "organization_plan_triggered_by_fkey" FOREIGN KEY (triggered_by) REFERENCES organizationmember(id) not valid;

alter table "public"."organization_plan" validate constraint "organization_plan_triggered_by_fkey";


alter table "public"."submission" add column "feedback" text;

alter table "public"."organization" add column "customization" json not null default '{"apps":{"poll":true,"comments":true},"course":{"grading":true,"newsfeed":true},"dashboard":{"exercise":true,"community":true,"bannerText":"","bannerImage":""}}'::json;

create type "public"."COURSE_TYPE" as enum ('SELF_PACED', 'LIVE_CLASS');

alter table "public"."course" add column "type" "COURSE_TYPE" default 'LIVE_CLASS'::"COURSE_TYPE";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_course_progress(course_id_arg uuid, profile_id_arg uuid)
 RETURNS TABLE(lessons_count bigint, lessons_completed bigint, exercises_count bigint, exercises_completed bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
RETURN QUERY
select
  count(lesson.id) as lessons_count,
  count(lesson_completion.id) as lessons_completed,
  count(exercise.id) as exercises_count,
  count(submission.id) as exercises_completed
from
  course
  join "group" on "group".id = course.group_id
  join groupmember on groupmember.group_id = course.group_id
  join profile on profile.id = groupmember.profile_id
  left join lesson on lesson.course_id = course.id
  left join lesson_completion on lesson_completion.lesson_id = lesson.id
  and lesson_completion.is_complete = true
  and lesson_completion.profile_id = profile.id
  left join exercise on exercise.lesson_id = lesson.id
  left join submission on submission.exercise_id = exercise.id
  and submission.submitted_by = groupmember.id
where
  course.id = course_id_arg
  and profile.id = profile_id_arg;
END;
$function$
;


create
or replace function public.get_courses (org_id_arg uuid, profile_id_arg uuid) returns table (
  id uuid,
  org_id uuid,
  title character varying,
  slug character varying,
  description character varying,
  logo text,
  banner_image text,
  cost bigint,
  currency character varying,
  is_published boolean,
  total_lessons bigint,
  total_students bigint,
  progress_rate bigint,
  type "COURSE_TYPE",
  member_profile_id uuid
) language plpgsql as $function$
BEGIN
  Return query
  select course.id, organization.id AS org_id, course.title, course.slug, course.description, course.logo, course.banner_image, course.cost, course.currency, course.is_published, (select COUNT(*) from lesson as l where l.course_id = course.id) AS total_lessons, (select COUNT(*) from groupmember as gm where gm.group_id = course.group_id AND gm.role_id = 3) as total_students, (select COUNT(*) from lesson_completion as lc join lesson as l on l.id = lc.lesson_id where l.course_id = course.id and lc.is_complete = true and lc.profile_id = profile_id_arg) AS progress_rate, course.type as type, (select groupmember.profile_id from groupmember where groupmember.group_id = "group".id and groupmember.profile_id =  profile_id_arg) as member_profile_id
  from course
  join "group" on "group".id = course.group_id
  join organization on organization.id = "group".organization_id
  where course.status = 'ACTIVE' AND organization.id = org_id_arg
  -- GROUP BY course.id, groupmember.profile_id
  ORDER BY course.created_at DESC;
END;
$function$;

-- Drop table cause it was never used
drop table if exists public.lesson_progress;

alter table public.exercise
drop constraint exercise_lesson_id_fkey,
add constraint exercise_lesson_id_fkey foreign key (lesson_id) references lesson (id)
on delete cascade;

alter table public.lesson_comment
drop constraint lesson_comment_lesson_id_fkey,
add constraint lesson_comment_lesson_id_fkey foreign key (lesson_id) references lesson (id)
on delete cascade;

alter table public.question
drop constraint question_exercise_id_fkey,
add constraint question_exercise_id_fkey foreign key (exercise_id) references exercise (id)
on delete cascade;

alter table public.option
drop constraint option_question_id_fkey,
add constraint option_question_id_fkey foreign key (question_id) references question (id)
on delete cascade;

alter table public.question_answer
drop constraint question_answer_question_id_fkey,
add constraint question_answer_question_id_fkey foreign key (question_id) references question (id)
on delete cascade;

alter table public.submission
drop constraint submission_exercise_id_fkey,
add constraint submission_exercise_id_fkey foreign key (exercise_id) references exercise (id)
on delete cascade;

alter table public.submission
drop constraint submission_course_id_fkey,
add constraint submission_course_id_fkey foreign key (course_id) references course (id)
on delete cascade;

alter table public.question_answer
drop constraint question_answer_submission_id_fkey,
add constraint question_answer_submission_id_fkey foreign key (submission_id) references submission (id)
on delete cascade;

alter table public.lesson_completion
drop constraint lesson_completion_lesson_id_fkey,
add constraint lesson_completion_lesson_id_fkey foreign key (lesson_id) references lesson (id)
on delete cascade;


CREATE TABLE lesson_language_history (
  id SERIAL PRIMARY KEY,
  lesson_language_id INTEGER REFERENCES lesson_language(id),
  old_content TEXT,
  new_content TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE FUNCTION update_lesson_language_history()
  RETURNS trigger AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    INSERT INTO lesson_language_history (lesson_language_id, old_content, new_content)
    VALUES (NEW.id, COALESCE(OLD.content, ''), NEW.content);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER update_lesson_language_history_trigger
AFTER INSERT
OR
UPDATE ON lesson_language for each row
EXECUTE PROCEDURE update_lesson_language_history();

create or replace view "public"."lesson_versions" as SELECT llh.old_content,
    llh.new_content,
    llh."timestamp",
    ll.locale,
    ll.lesson_id
   FROM (lesson_language_history llh
     JOIN lesson_language ll ON ((ll.id = llh.lesson_language_id)));

CREATE OR REPLACE FUNCTION public.get_explore_courses(org_id_arg uuid, profile_id_arg uuid)
 RETURNS TABLE(id uuid, org_id uuid, title character varying, slug character varying, description character varying, logo text, banner_image text, cost bigint, currency character varying, is_published boolean, total_lessons bigint, total_students bigint, progress_rate bigint, type "COURSE_TYPE", other_profile_id uuid)
 LANGUAGE plpgsql
AS $function$
BEGIN
  Return query
  select course.id, organization.id AS org_id, course.title, course.slug, course.description, course.logo, course.banner_image, course.cost, course.currency, course.is_published, (select COUNT(*) from lesson 
as l where l.course_id = course.id) AS total_lessons, (select COUNT(*) from groupmember as gm where gm.group_id = course.group_id AND gm.role_id = 3) as total_students, (select COUNT(*) from lesson_completion as lc join lesson as l on l.id = lc.lesson_id where l.course_id = course.id and lc.is_complete = true and lc.profile_id = profile_id_arg) AS progress_rate, course.type as type, (select groupmember.profile_id from groupmember where groupmember.group_id = "group".id and groupmember.profile_id !=  profile_id_arg 
limit 1) as other_profile_id
  from course
  join "group" on "group".id = course.group_id
  join organization on organization.id = "group".organization_id
  where course.status = 'ACTIVE' AND course.is_published = true AND organization.id = org_id_arg AND profile_id_arg NOT IN (SELECT groupmember.profile_id FROM groupmember WHERE groupmember.group_id = course.group_id)
  ORDER BY course.created_at DESC;
END;
$function$
;

drop policy "Enable insert for authenticated users only" on "public"."course";

drop policy "Enable update for authenticated users only" on "public"."course";

drop policy "Enable insert for authenticated users only" on "public"."lesson_comment";

alter table "public"."apps_poll" enable row level security;

alter table "public"."apps_poll_option" enable row level security;

alter table "public"."apps_poll_submission" enable row level security;

alter table "public"."community_answer" enable row level security;

alter table "public"."community_question" enable row level security;

alter table "public"."course" enable row level security;

alter table "public"."course_newsfeed" enable row level security;

alter table "public"."course_newsfeed_comment" enable row level security;

alter table "public"."exercise" enable row level security;

alter table "public"."group" enable row level security;

alter table "public"."group_attendance" enable row level security;

alter table "public"."groupmember" enable row level security;

alter table "public"."lesson" enable row level security;

alter table "public"."lesson_completion" enable row level security;

alter table "public"."lesson_language" enable row level security;

alter table "public"."lesson_language_history" enable row level security;

alter table "public"."option" enable row level security;

alter table "public"."organization" enable row level security;

alter table "public"."organization_plan" enable row level security;

alter table "public"."organizationmember" enable row level security;

alter table "public"."question" enable row level security;

alter table "public"."question_answer" enable row level security;

alter table "public"."question_type" enable row level security;

alter table "public"."quiz" enable row level security;

alter table "public"."quiz_play" enable row level security;

alter table "public"."role" enable row level security;

alter table "public"."submission" enable row level security;

alter table "public"."submissionstatus" enable row level security;

alter table "public"."test_tenant" enable row level security;

alter table "public"."waitinglist" enable row level security;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.is_org_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM organizationmember
        WHERE organization_id = organization_id
        AND profile_id = (select auth.uid())
        AND role_id = 1
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM organizationmember
        WHERE organization_id = org_id
        AND profile_id = (select auth.uid())
        AND role_id = 1
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_org_member()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM organizationmember
        WHERE organization_id = organization_id
        AND profile_id = (select auth.uid())
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_user_in_course_group(group_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$ begin return exists 
(SELECT 1 FROM groupmember member
JOIN "group" g ON g.id = member.group_id
WHERE member.role_id IS NOT NULL
AND member.profile_id = auth.uid()
AND g.id = $1
);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_user_in_group_with_role(group_id integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  return exists (
    SELECT 1
    FROM organizationmember m
    JOIN organization o ON o.organization_id = m.organization_id
    WHERE m.role_id IS NOT NULL
    AND m.profile_id = auth.uid ()
      AND EXISTS (
        SELECT 1
        FROM "group" g
        WHERE g.group_id = $1
          AND g.organization_id = o.organization_id
      )
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_user_in_group_with_role(group_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  return exists (
    SELECT 1
    FROM organizationmember member
    JOIN organization o ON o.id = member.organization_id
    WHERE member.role_id IS NOT NULL
    AND member.profile_id = auth.uid ()
      AND EXISTS (
        SELECT 1
        FROM "group" g
        WHERE g.id = $1
          AND g.organization_id = o.id
      )
  );
END;
$function$
;

create policy "Delete only your own poll"
on "public"."apps_poll"
as permissive
for delete
to public
using ((auth.uid() = ( SELECT groupmember.profile_id
   FROM groupmember
  WHERE (groupmember.id = apps_poll."authorId"))));


create policy "Update only your own"
on "public"."apps_poll"
as permissive
for update
to public
using ((auth.uid() = ( SELECT groupmember.profile_id
   FROM groupmember
  WHERE (groupmember.id = apps_poll."authorId"))))
with check ((auth.uid() = ( SELECT groupmember.profile_id
   FROM groupmember
  WHERE (groupmember.id = apps_poll."authorId"))));


create policy "User must be a course member to INSERT"
on "public"."apps_poll"
as permissive
for insert
to public
with check (is_user_in_course_group(( SELECT groupmember.group_id
   FROM groupmember
  WHERE (groupmember.id = apps_poll."authorId")
 LIMIT 1)));


create policy "User must be course member to SELECT"
on "public"."apps_poll"
as permissive
for select
to public
using (is_user_in_course_group(( SELECT groupmember.group_id
   FROM groupmember
  WHERE (groupmember.id = apps_poll."authorId")
 LIMIT 1)));


create policy "User must be a course member to INSERT"
on "public"."apps_poll_option"
as permissive
for insert
to public
with check (is_user_in_course_group(( SELECT groupmember.group_id
   FROM groupmember
  WHERE (groupmember.id = ( SELECT apps_poll."authorId"
           FROM apps_poll
          WHERE (apps_poll.id = apps_poll_option.poll_id)
         LIMIT 1))
 LIMIT 1)));


create policy "User must be a course member to UPDATE"
on "public"."apps_poll_option"
as permissive
for update
to public
using (is_user_in_course_group(( SELECT groupmember.group_id
   FROM groupmember
  WHERE (groupmember.id = ( SELECT apps_poll."authorId"
           FROM apps_poll
          WHERE (apps_poll.id = apps_poll_option.poll_id)
         LIMIT 1))
 LIMIT 1)))
with check (is_user_in_course_group(( SELECT groupmember.group_id
   FROM groupmember
  WHERE (groupmember.id = ( SELECT apps_poll."authorId"
           FROM apps_poll
          WHERE (apps_poll.id = apps_poll_option.poll_id)
         LIMIT 1))
 LIMIT 1)));


create policy "User must be a teacher to DELETE"
on "public"."apps_poll_option"
as permissive
for delete
to public
using (is_user_in_group_with_role(( SELECT groupmember.group_id
   FROM groupmember
  WHERE (groupmember.id = ( SELECT apps_poll."authorId"
           FROM apps_poll
          WHERE (apps_poll.id = apps_poll_option.poll_id)
         LIMIT 1))
 LIMIT 1)));


create policy "User must be course member to SELECT"
on "public"."apps_poll_option"
as permissive
for select
to public
using (is_user_in_course_group(( SELECT groupmember.group_id
   FROM groupmember
  WHERE (groupmember.id = ( SELECT apps_poll."authorId"
           FROM apps_poll
          WHERE (apps_poll.id = apps_poll_option.poll_id)
         LIMIT 1))
 LIMIT 1)));


create policy "Authenticated users can read"
on "public"."apps_poll_submission"
as permissive
for select
to public
using ((auth.uid() IS NOT NULL));


create policy "Delete your own submission"
on "public"."apps_poll_submission"
as permissive
for delete
to public
using ((auth.uid() = ( SELECT groupmember.profile_id
   FROM groupmember
  WHERE (groupmember.id = apps_poll_submission.selected_by_id))));


create policy "Enable insert for authenticated users only"
on "public"."apps_poll_submission"
as permissive
for insert
to authenticated
with check (true);


create policy "Update your own submission"
on "public"."apps_poll_submission"
as permissive
for update
to public
using ((auth.uid() = ( SELECT groupmember.profile_id
   FROM groupmember
  WHERE (groupmember.id = apps_poll_submission.selected_by_id))))
with check ((auth.uid() = ( SELECT groupmember.profile_id
   FROM groupmember
  WHERE (groupmember.id = apps_poll_submission.selected_by_id))));


create policy "Authenticated users can SELECT"
on "public"."community_answer"
as permissive
for select
to public
using ((auth.uid() IS NOT NULL));


create policy "Delete your own answer"
on "public"."community_answer"
as permissive
for delete
to public
using ((auth.uid() = author_profile_id));


create policy "Enable insert for authenticated users only"
on "public"."community_answer"
as permissive
for insert
to authenticated
with check (true);


create policy "Update your own answer"
on "public"."community_answer"
as permissive
for update
to public
using ((auth.uid() = author_profile_id))
with check ((auth.uid() = author_profile_id));


create policy "Authenticated users can SELECT"
on "public"."community_question"
as permissive
for select
to public
using ((auth.uid() IS NOT NULL));


create policy "Delete your own question"
on "public"."community_question"
as permissive
for delete
to public
using ((auth.uid() = author_profile_id));


create policy "Update your own question"
on "public"."community_question"
as permissive
for update
to public
using ((auth.uid() = author_profile_id))
with check ((auth.uid() = author_profile_id));


create policy "User must be an org member to DELETE"
on "public"."course"
as permissive
for delete
to public
using (is_user_in_group_with_role(group_id));


create policy "User must be an org member to INSERT"
on "public"."course"
as permissive
for insert
to public
with check (is_user_in_group_with_role(group_id));


create policy "User must be an org member to UPDATE"
on "public"."course"
as permissive
for update
to public
using (is_user_in_group_with_role(group_id))
with check (is_user_in_group_with_role(group_id));


create policy "Delete your own comment"
on "public"."course_newsfeed"
as permissive
for delete
to public
using ((auth.uid() = ( SELECT groupmember.profile_id
   FROM groupmember
  WHERE (groupmember.id = course_newsfeed.author_id))));


create policy "Update only your own"
on "public"."course_newsfeed"
as permissive
for update
to public
using ((auth.uid() = ( SELECT groupmember.profile_id
   FROM groupmember
  WHERE (groupmember.id = course_newsfeed.author_id))))
with check ((auth.uid() = ( SELECT groupmember.profile_id
   FROM groupmember
  WHERE (groupmember.id = course_newsfeed.author_id))));


create policy "User must be a course member to INSERT"
on "public"."course_newsfeed"
as permissive
for insert
to public
with check (is_user_in_course_group(( SELECT course.group_id
   FROM course
  WHERE (course.id = course_newsfeed.course_id)
 LIMIT 1)));


create policy "User must be a course member to SELECT"
on "public"."course_newsfeed"
as permissive
for select
to public
using (is_user_in_course_group(( SELECT course.group_id
   FROM course
  WHERE (course.id = course_newsfeed.course_id)
 LIMIT 1)));


create policy "Delete your own"
on "public"."course_newsfeed_comment"
as permissive
for delete
to public
using ((auth.uid() = ( SELECT groupmember.profile_id
   FROM groupmember
  WHERE (groupmember.id = course_newsfeed_comment.author_id))));


create policy "Update only your own"
on "public"."course_newsfeed_comment"
as permissive
for update
to public
using ((auth.uid() = ( SELECT groupmember.profile_id
   FROM groupmember
  WHERE (groupmember.id = course_newsfeed_comment.author_id))))
with check ((auth.uid() = ( SELECT groupmember.profile_id
   FROM groupmember
  WHERE (groupmember.id = course_newsfeed_comment.author_id))));


create policy "User must be a course member to INSERT"
on "public"."course_newsfeed_comment"
as permissive
for insert
to public
with check (is_user_in_course_group(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT course_newsfeed.course_id
           FROM course_newsfeed
          WHERE (course_newsfeed.id = course_newsfeed_comment.course_newsfeed_id)))
 LIMIT 1)));


create policy "User must be a course member to SELECT"
on "public"."course_newsfeed_comment"
as permissive
for select
to public
using (is_user_in_course_group(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT course_newsfeed.course_id
           FROM course_newsfeed
          WHERE (course_newsfeed.id = course_newsfeed_comment.course_newsfeed_id)))
 LIMIT 1)));


create policy "Enable read access for all users"
on "public"."exercise"
as permissive
for select
to public
using (true);


create policy "User must be an org member to DELETE"
on "public"."exercise"
as permissive
for delete
to public
using (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = exercise.lesson_id)
         LIMIT 1))
 LIMIT 1)));


create policy "User must be an org member to INSERT"
on "public"."exercise"
as permissive
for insert
to public
with check (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = exercise.lesson_id)
         LIMIT 1))
 LIMIT 1)));


create policy "User must be an org member to UPDATE"
on "public"."exercise"
as permissive
for update
to public
using (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = exercise.lesson_id)
         LIMIT 1))
 LIMIT 1)))
with check (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = exercise.lesson_id)
         LIMIT 1))
 LIMIT 1)));


create policy "Enable insert for authenticated users only"
on "public"."group"
as permissive
for insert
to authenticated
with check (true);


create policy "Enable read access for all users"
on "public"."group"
as permissive
for select
to public
using (true);


create policy "Only org admins can delete"
on "public"."group"
as permissive
for delete
to public
using (is_org_admin());


create policy "Only org admins can update"
on "public"."group"
as permissive
for update
to public
using (is_org_admin())
with check (is_org_admin());


create policy "User must be a course member to INSERT"
on "public"."group_attendance"
as permissive
for insert
to public
with check (is_user_in_course_group(( SELECT course.group_id
   FROM course
  WHERE (course.id = group_attendance.course_id)
 LIMIT 1)));


create policy "User must be a course member to SELECT"
on "public"."group_attendance"
as permissive
for select
to public
using (is_user_in_course_group(( SELECT course.group_id
   FROM course
  WHERE (course.id = group_attendance.course_id)
 LIMIT 1)));


create policy "User must be a course member to UPDATE"
on "public"."group_attendance"
as permissive
for update
to public
using (is_user_in_course_group(( SELECT course.group_id
   FROM course
  WHERE (course.id = group_attendance.course_id)
 LIMIT 1)))
with check (is_user_in_course_group(( SELECT course.group_id
   FROM course
  WHERE (course.id = group_attendance.course_id)
 LIMIT 1)));


create policy "User must be an org member to DELETE"
on "public"."group_attendance"
as permissive
for delete
to public
using (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = group_attendance.course_id)
 LIMIT 1)));


create policy "Enable insert for authenticated users only"
on "public"."groupmember"
as permissive
for insert
to authenticated
with check (true);


create policy "Enable read access for all users"
on "public"."groupmember"
as permissive
for select
to public
using (true);


create policy "User must be an org member to DELETE"
on "public"."groupmember"
as permissive
for delete
to public
using (is_user_in_group_with_role(group_id));


create policy "User must be an org member to UPDATE"
on "public"."groupmember"
as permissive
for update
to public
using (is_user_in_group_with_role(group_id))
with check (is_user_in_group_with_role(group_id));


create policy "Enable read access for all users"
on "public"."lesson"
as permissive
for select
to public
using (true);


create policy "User must be an org member to DELETE"
on "public"."lesson"
as permissive
for delete
to public
using (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = lesson.course_id)
 LIMIT 1)));


create policy "User must be an org member to INSERT"
on "public"."lesson"
as permissive
for insert
to public
with check (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = lesson.course_id)
 LIMIT 1)));


create policy "User must be an org member to UPDATE"
on "public"."lesson"
as permissive
for update
to public
using (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = lesson.course_id)
 LIMIT 1)))
with check (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = lesson.course_id)
 LIMIT 1)));


create policy "Delete only your own comment"
on "public"."lesson_comment"
as permissive
for delete
to public
using ((auth.uid() = ( SELECT groupmember.profile_id
   FROM groupmember
  WHERE (groupmember.id = lesson_comment.groupmember_id))));


create policy "Update only your own"
on "public"."lesson_comment"
as permissive
for update
to public
using ((auth.uid() = ( SELECT groupmember.profile_id
   FROM groupmember
  WHERE (groupmember.id = lesson_comment.groupmember_id))))
with check ((auth.uid() = ( SELECT groupmember.profile_id
   FROM groupmember
  WHERE (groupmember.id = lesson_comment.groupmember_id))));


create policy "User must be in course group to INSERT"
on "public"."lesson_comment"
as permissive
for insert
to public
with check (is_user_in_course_group(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = lesson_comment.lesson_id)
         LIMIT 1))
 LIMIT 1)));


create policy "Enable read access for all users"
on "public"."lesson_completion"
as permissive
for select
to public
using (true);


create policy "User must be an course member to INSERT"
on "public"."lesson_completion"
as permissive
for all
to public
with check (is_user_in_course_group(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = lesson_completion.lesson_id)
         LIMIT 1))
 LIMIT 1)));


create policy "User must be an org member to DELETE"
on "public"."lesson_completion"
as permissive
for delete
to public
using (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = lesson_completion.lesson_id)
         LIMIT 1))
 LIMIT 1)));


create policy "User must be an org member to UPDATE"
on "public"."lesson_completion"
as permissive
for update
to public
using (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = lesson_completion.lesson_id)
         LIMIT 1))
 LIMIT 1)))
with check (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = lesson_completion.lesson_id)
         LIMIT 1))
 LIMIT 1)));


create policy "Enable read access for all users"
on "public"."lesson_language"
as permissive
for select
to public
using (true);


create policy "User must be an org member to DELETE"
on "public"."lesson_language"
as permissive
for delete
to public
using (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = lesson_language.lesson_id)
         LIMIT 1))
 LIMIT 1)));


create policy "User must be an org member to INSERT"
on "public"."lesson_language"
as permissive
for insert
to public
with check (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = lesson_language.lesson_id)
         LIMIT 1))
 LIMIT 1)));


create policy "User must be an org member to UPDATE"
on "public"."lesson_language"
as permissive
for update
to public
using (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = lesson_language.lesson_id)
         LIMIT 1))
 LIMIT 1)))
with check (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = lesson_language.lesson_id)
         LIMIT 1))
 LIMIT 1)));


create policy "Authenticated users can SELECT"
on "public"."lesson_language_history"
as permissive
for select
to public
using ((auth.uid() IS NOT NULL));


create policy "Allow authenticated users to SELECT"
on "public"."option"
as permissive
for select
to public
using ((auth.uid() IS NOT NULL));


create policy "User must be an org member to DELETE"
on "public"."option"
as permissive
for delete
to public
using (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = ( SELECT exercise.lesson_id
                   FROM exercise
                  WHERE (exercise.id = ( SELECT question.exercise_id
                           FROM question
                          WHERE (question.id = option.question_id)
                         LIMIT 1))
                 LIMIT 1))
         LIMIT 1))
 LIMIT 1)));


create policy "User must be an org member to INSERT"
on "public"."option"
as permissive
for insert
to public
with check (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = ( SELECT exercise.lesson_id
                   FROM exercise
                  WHERE (exercise.id = ( SELECT question.exercise_id
                           FROM question
                          WHERE (question.id = option.question_id)
                         LIMIT 1))
                 LIMIT 1))
         LIMIT 1))
 LIMIT 1)));


create policy "User must be an org member to UPDATE"
on "public"."option"
as permissive
for update
to public
using (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = ( SELECT exercise.lesson_id
                   FROM exercise
                  WHERE (exercise.id = ( SELECT question.exercise_id
                           FROM question
                          WHERE (question.id = option.question_id)
                         LIMIT 1))
                 LIMIT 1))
         LIMIT 1))
 LIMIT 1)))
with check (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = ( SELECT exercise.lesson_id
                   FROM exercise
                  WHERE (exercise.id = ( SELECT question.exercise_id
                           FROM question
                          WHERE (question.id = option.question_id)
                         LIMIT 1))
                 LIMIT 1))
         LIMIT 1))
 LIMIT 1)));


create policy "Authenticated users can delete"
on "public"."organization"
as permissive
for delete
to public
using ((auth.uid() IS NOT NULL));


create policy "Enable read access for all users"
on "public"."organization"
as permissive
for select
to public
using (true);


create policy "User must be an admin to INSERT"
on "public"."organization"
as permissive
for insert
to public
with check ((id = ( SELECT organizationmember.organization_id
   FROM organizationmember
  WHERE ((organizationmember.profile_id = ( SELECT auth.uid() AS uid)) AND (organizationmember.role_id = 1))
 LIMIT 1)));


create policy "User must be admin to UPDATE"
on "public"."organization"
as permissive
for update
to public
using ((id in ( SELECT organizationmember.organization_id
   FROM organizationmember
  WHERE ((organizationmember.profile_id = ( SELECT auth.uid() AS uid)) AND (organizationmember.role_id = 1)))))
with check ((id in ( SELECT organizationmember.organization_id
   FROM organizationmember
  WHERE ((organizationmember.profile_id = ( SELECT auth.uid() AS uid)) AND (organizationmember.role_id = 1)))));

create policy "User must be an org member to DELETE"
on "public"."organization_plan"
as permissive
for delete
to public
using (is_org_member());


create policy "User must be an org member to INSERT"
on "public"."organization_plan"
as permissive
for insert
to public
with check (is_org_member());


create policy "User must be an org member to SELECT"
on "public"."organization_plan"
as permissive
for select
to public
using (is_org_member());


create policy "User must be an org member to UPDATE"
on "public"."organization_plan"
as permissive
for update
to public
using (is_org_member())
with check (is_org_member());


create policy "Allow authenticated users to read."
on "public"."organizationmember"
as permissive
for select
to public
using ((auth.uid() IS NOT NULL));


create policy "Enable insert for authenticated users only"
on "public"."organizationmember"
as permissive
for insert
to authenticated
with check (true);


create policy "Only admin can delete"
on "public"."organizationmember"
as permissive
for delete
to public
using (is_org_admin());


create policy "Only admin can update"
on "public"."organizationmember"
as permissive
for update
to public
using (is_org_admin())
with check (is_org_admin());

create policy "Only user can update their account via email"
on "public"."organizationmember"
as PERMISSIVE
for UPDATE
to public
using (
  (select auth.jwt()) ->> 'email' = email
)
with check (
  (select auth.jwt()) ->> 'email' = email
);

create policy "Only auth users can read profile"
on "public"."profile"
as permissive
for select
to authenticated, anon
using (true);


create policy "User can only delete their profiles"
on "public"."profile"
as permissive
for delete
to public
using ((auth.uid() = id));


create policy "Allow authenticated users to SELECT"
on "public"."question"
as permissive
for select
to public
using ((auth.uid() IS NOT NULL));


create policy "User must be an org member to DELETE"
on "public"."question"
as permissive
for delete
to public
using (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = ( SELECT exercise.lesson_id
                   FROM exercise
                  WHERE (exercise.id = question.exercise_id)))
         LIMIT 1))
 LIMIT 1)));


create policy "User must be an org member to INSERT"
on "public"."question"
as permissive
for insert
to public
with check (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = ( SELECT exercise.lesson_id
                   FROM exercise
                  WHERE (exercise.id = question.exercise_id)))
         LIMIT 1))
 LIMIT 1)));


create policy "User must be an org member to UPDATE"
on "public"."question"
as permissive
for update
to public
using (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = ( SELECT exercise.lesson_id
                   FROM exercise
                  WHERE (exercise.id = question.exercise_id)))
         LIMIT 1))
 LIMIT 1)))
with check (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = ( SELECT exercise.lesson_id
                   FROM exercise
                  WHERE (exercise.id = question.exercise_id)))
         LIMIT 1))
 LIMIT 1)));


create policy "Only authenticated users can select."
on "public"."question_answer"
as permissive
for select
to public
using ((auth.uid() IS NOT NULL));


create policy "User must be an course member to DELETE"
on "public"."question_answer"
as permissive
for delete
to public
using (is_user_in_course_group(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = ( SELECT exercise.lesson_id
                   FROM exercise
                  WHERE (exercise.id = ( SELECT question.exercise_id
                           FROM question
                          WHERE (question.id = question_answer.question_id)
                         LIMIT 1))
                 LIMIT 1))
         LIMIT 1))
 LIMIT 1)));


create policy "User must be an course member to INSERT"
on "public"."question_answer"
as permissive
for insert
to public
with check (is_user_in_course_group(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = ( SELECT exercise.lesson_id
                   FROM exercise
                  WHERE (exercise.id = ( SELECT question.exercise_id
                           FROM question
                          WHERE (question.id = question_answer.question_id)
                         LIMIT 1))
                 LIMIT 1))
         LIMIT 1))
 LIMIT 1)));


create policy "User must be an course member to UPDATE"
on "public"."question_answer"
as permissive
for update
to public
using (is_user_in_course_group(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = ( SELECT exercise.lesson_id
                   FROM exercise
                  WHERE (exercise.id = ( SELECT question.exercise_id
                           FROM question
                          WHERE (question.id = question_answer.question_id)
                         LIMIT 1))
                 LIMIT 1))
         LIMIT 1))
 LIMIT 1)))
with check (is_user_in_course_group(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = ( SELECT exercise.lesson_id
                   FROM exercise
                  WHERE (exercise.id = ( SELECT question.exercise_id
                           FROM question
                          WHERE (question.id = question_answer.question_id)
                         LIMIT 1))
                 LIMIT 1))
         LIMIT 1))
 LIMIT 1)));


create policy "Enable read access for all users"
on "public"."question_type"
as permissive
for select
to public
using (true);


create policy "Authenticated users can SELECT"
on "public"."quiz"
as permissive
for select
to authenticated
using (true);


create policy "Authenticated users can SELECT"
on "public"."quiz_play"
as permissive
for select
to authenticated
using (true);


create policy "Enable read access for all users"
on "public"."role"
as permissive
for select
to public
using (true);


create policy "Only authenticated users can SELECT"
on "public"."submission"
as permissive
for select
to authenticated
using (true);


create policy "User must be a course member to DELETE"
on "public"."submission"
as permissive
for delete
to public
using (is_user_in_course_group(( SELECT course.group_id
   FROM course
  WHERE (course.id = submission.course_id)
 LIMIT 1)));


create policy "User must be a course member to INSERT"
on "public"."submission"
as permissive
for insert
to public
with check (is_user_in_course_group(( SELECT course.group_id
   FROM course
  WHERE (course.id = submission.course_id)
 LIMIT 1)));


create policy "User must be a course member to UPDATE"
on "public"."submission"
as permissive
for update
to public
using (is_user_in_course_group(( SELECT course.group_id
   FROM course
  WHERE (course.id = submission.course_id)
 LIMIT 1)))
with check (is_user_in_course_group(( SELECT course.group_id
   FROM course
  WHERE (course.id = submission.course_id)
 LIMIT 1)));


create policy "Authenticated users can SELECT"
on "public"."submissionstatus"
as permissive
for select
to authenticated
using (true);

alter table "public"."course" alter column "currency" set default 'USD'::character varying;


drop policy "User must be an admin to INSERT" on "public"."organization";

create policy "Enable insert for authenticated users only"
on "public"."organization"
as permissive
for insert
to authenticated
with check (true);


create policy "User must be an org member to DELETE"
on "public"."lesson_language_history"
as permissive
for delete
to public
using (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = ( SELECT lesson_language.lesson_id
                   FROM lesson_language
                  WHERE (lesson_language.id = lesson_language_history.lesson_language_id)))
         LIMIT 1))
 LIMIT 1)));


create policy "User must be an org member to INSERT"
on "public"."lesson_language_history"
as permissive
for insert
to public
with check (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = ( SELECT lesson_language.lesson_id
                   FROM lesson_language
                  WHERE (lesson_language.id = lesson_language_history.lesson_language_id)))
         LIMIT 1))
 LIMIT 1)));


create policy "User must be an org member to UPDATE"
on "public"."lesson_language_history"
as permissive
for update
to public
using (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = ( SELECT lesson_language.lesson_id
                   FROM lesson_language
                  WHERE (lesson_language.id = lesson_language_history.lesson_language_id)))
         LIMIT 1))
 LIMIT 1)))
with check (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = ( SELECT lesson_language.lesson_id
                   FROM lesson_language
                  WHERE (lesson_language.id = lesson_language_history.lesson_language_id)))
         LIMIT 1))
 LIMIT 1)));






create type "public"."COURSE_VERSION" as enum ('V1', 'V2');

alter table "public"."lesson_language_history" drop constraint "lesson_language_history_lesson_language_id_fkey";

alter table "public"."lesson_language" drop constraint "public_lesson_language_lesson_id_fkey";

create table "public"."lesson_section" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone default now(),
    "title" character varying,
    "order" bigint default '0'::bigint,
    "course_id" uuid
);


alter table "public"."lesson_section" enable row level security;

alter table "public"."course" add column "version" "COURSE_VERSION" not null default 'V1'::"COURSE_VERSION";

alter table "public"."lesson" add column "section_id" uuid;

CREATE UNIQUE INDEX lesson_section_pkey ON public.lesson_section USING btree (id);

alter table "public"."lesson_section" add constraint "lesson_section_pkey" PRIMARY KEY using index "lesson_section_pkey";

alter table "public"."lesson" add constraint "public_lesson_section_id_fkey" FOREIGN KEY (section_id) REFERENCES lesson_section(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."lesson" validate constraint "public_lesson_section_id_fkey";

alter table "public"."lesson_language_history" add constraint "public_lesson_language_history_lesson_language_id_fkey" FOREIGN KEY (lesson_language_id) REFERENCES lesson_language(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."lesson_language_history" validate constraint "public_lesson_language_history_lesson_language_id_fkey";

alter table "public"."lesson_section" add constraint "public_lesson_section_course_id_fkey" FOREIGN KEY (course_id) REFERENCES course(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."lesson_section" validate constraint "public_lesson_section_course_id_fkey";

alter table "public"."lesson_language" add constraint "public_lesson_language_lesson_id_fkey" FOREIGN KEY (lesson_id) REFERENCES lesson(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."lesson_language" validate constraint "public_lesson_language_lesson_id_fkey";

grant delete on table "public"."lesson_section" to "anon";

grant insert on table "public"."lesson_section" to "anon";

grant references on table "public"."lesson_section" to "anon";

grant select on table "public"."lesson_section" to "anon";

grant trigger on table "public"."lesson_section" to "anon";

grant truncate on table "public"."lesson_section" to "anon";

grant update on table "public"."lesson_section" to "anon";

grant delete on table "public"."lesson_section" to "authenticated";

grant insert on table "public"."lesson_section" to "authenticated";

grant references on table "public"."lesson_section" to "authenticated";

grant select on table "public"."lesson_section" to "authenticated";

grant trigger on table "public"."lesson_section" to "authenticated";

grant truncate on table "public"."lesson_section" to "authenticated";

grant update on table "public"."lesson_section" to "authenticated";

grant delete on table "public"."lesson_section" to "service_role";

grant insert on table "public"."lesson_section" to "service_role";

grant references on table "public"."lesson_section" to "service_role";

grant select on table "public"."lesson_section" to "service_role";

grant trigger on table "public"."lesson_section" to "service_role";

grant truncate on table "public"."lesson_section" to "service_role";

grant update on table "public"."lesson_section" to "service_role";

create policy "Enable read access for all users"
on "public"."lesson_section"
as permissive
for select
to public
using (true);


create policy "User must be an org member to DELETE"
on "public"."lesson_section"
as permissive
for delete
to public
using (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = lesson_section.course_id)
 LIMIT 1)));


create policy "User must be an org member to INSERT"
on "public"."lesson_section"
as permissive
for insert
to public
with check (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = lesson_section.course_id)
 LIMIT 1)));


create policy "User must be an org member to UPDATE"
on "public"."lesson_section"
as permissive
for update
to public
using (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = lesson_section.course_id)
 LIMIT 1)))
with check (is_user_in_group_with_role(( SELECT course.group_id
   FROM course
  WHERE (course.id = lesson_section.course_id)
 LIMIT 1)));

CREATE
OR REPLACE FUNCTION convert_course_to_v2 (course_id uuid) RETURNS void AS $$
DECLARE
    new_section_id bigint;
BEGIN
    UPDATE course
    SET version = 'V2'
    WHERE id = course_id;

    INSERT INTO lesson_section (title, course_id) VALUES ('First Section [edit me]', course_id) RETURNING id INTO new_section_id;
    
    UPDATE lesson
    SET section_id = new_section_id
    WHERE course_id = course_id;
END;
$$ LANGUAGE plpgsql;



drop function if exists "public"."convert_course_to_v2"(course_id uuid);

alter table "public"."organization" add column "is_restricted" boolean not null default false;

alter table "public"."profile" add column "is_restricted" boolean not null default false;

set check_function_bodies = off;

CREATE
OR REPLACE FUNCTION convert_course_to_v2 (course_id_arg uuid) RETURNS void AS $$
DECLARE
    new_section_id uuid;
BEGIN
    UPDATE course
    SET version = 'V2'
    WHERE id = course_id_arg;

    INSERT INTO lesson_section (title, course_id) VALUES ('First Section [edit me]', course_id_arg) RETURNING id INTO new_section_id;

    UPDATE lesson
    SET section_id = new_section_id
    WHERE lesson.course_id = course_id_arg;
END;
$$ LANGUAGE plpgsql;





alter table "public"."organization" add column "customCode" text;

alter table "public"."organization" add column "customDomain" text;

alter table "public"."organization" add column "favicon" text;

alter table "public"."organization" add column "isCustomDomainVerified" boolean default false;

CREATE UNIQUE INDEX "organization_customDomain_key" ON public.organization USING btree ("customDomain");

alter table "public"."organization" add constraint "organization_customDomain_key" UNIQUE using index "organization_customDomain_key";


drop policy "User must be an org member to SELECT" on "public"."organization_plan";

create policy "Enable read access for all users"
on "public"."organization_plan"
as permissive
for select
to public
using (true);


create table "public"."analytics_login_events" (
    "id" uuid not null default uuid_generate_v4(),
    "user_id" uuid not null,
    "logged_in_at" timestamp with time zone default now()
);

alter table "public"."analytics_login_events" enable row level security;

CREATE UNIQUE INDEX analytics_login_events_pkey ON public.analytics_login_events USING btree (id);

CREATE INDEX idx_analytics_login_events_logged_in_at ON public.analytics_login_events USING btree (logged_in_at);

CREATE INDEX idx_analytics_login_events_user_id ON public.analytics_login_events USING btree (user_id);

CREATE UNIQUE INDEX analytics_login_events_user_id_unique ON public.analytics_login_events USING btree (user_id);

alter table "public"."analytics_login_events" add constraint "analytics_login_events_pkey" PRIMARY KEY using index "analytics_login_events_pkey";

alter table "public"."analytics_login_events" add constraint "analytics_login_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."analytics_login_events" validate constraint "analytics_login_events_user_id_fkey";

alter table "public"."analytics_login_events" add constraint "analytics_login_events_user_id_unique" UNIQUE using index "analytics_login_events_user_id_unique";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.insert_login_event_on_user_login()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF (NEW.last_sign_in_at IS NOT NULL) THEN
    INSERT INTO public.analytics_login_events (logged_in_at, user_id)
    VALUES (NEW.last_sign_in_at, NEW.id)
    ON CONFLICT (user_id) DO UPDATE
    SET logged_in_at = NEW.last_sign_in_at;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE TRIGGER insert_login_event_on_user_login_trigger
AFTER UPDATE OF last_sign_in_at ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.insert_login_event_on_user_login();

CREATE OR REPLACE FUNCTION public.insert_login_event_on_user_session_update()
  RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF (NEW.updated_at IS NOT NULL AND NEW.updated_at != OLD.updated_at) THEN
    INSERT INTO public.analytics_login_events (logged_in_at, user_id)
    VALUES (NEW.updated_at, NEW.user_id)
    ON CONFLICT (user_id) DO UPDATE
    SET logged_in_at = EXCLUDED.logged_in_at
    WHERE analytics_login_events.logged_in_at < EXCLUDED.logged_in_at;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE TRIGGER insert_login_event_on_user_session_update_trigger
AFTER UPDATE OF updated_at ON auth.sessions
FOR EACH ROW
EXECUTE FUNCTION public.insert_login_event_on_user_session_update();

grant delete on table "public"."analytics_login_events" to "anon";

grant insert on table "public"."analytics_login_events" to "anon";

grant references on table "public"."analytics_login_events" to "anon";

grant select on table "public"."analytics_login_events" to "anon";

grant trigger on table "public"."analytics_login_events" to "anon";

grant truncate on table "public"."analytics_login_events" to "anon";

grant update on table "public"."analytics_login_events" to "anon";

grant delete on table "public"."analytics_login_events" to "authenticated";

grant insert on table "public"."analytics_login_events" to "authenticated";

grant references on table "public"."analytics_login_events" to "authenticated";

grant select on table "public"."analytics_login_events" to "authenticated";

grant trigger on table "public"."analytics_login_events" to "authenticated";

grant truncate on table "public"."analytics_login_events" to "authenticated";

grant update on table "public"."analytics_login_events" to "authenticated";

grant delete on table "public"."analytics_login_events" to "service_role";

grant insert on table "public"."analytics_login_events" to "service_role";

grant references on table "public"."analytics_login_events" to "service_role";

grant select on table "public"."analytics_login_events" to "service_role";

grant trigger on table "public"."analytics_login_events" to "service_role";

grant truncate on table "public"."analytics_login_events" to "service_role";

grant update on table "public"."analytics_login_events" to "service_role";

create policy "Users can insert their own login events"
on "public"."analytics_login_events"
as permissive
for insert
to authenticated
with check ((auth.uid() = user_id));

CREATE POLICY "Enable delete for users based on user_id"
ON "public"."analytics_login_events"
AS PERMISSIVE FOR DELETE
TO public
USING (auth.uid() = user_id);



-- Drop existing objects first to ensure clean migration
DROP TABLE IF EXISTS "public"."email_verification_tokens" CASCADE;
DROP TRIGGER IF EXISTS profile_email_verification_protection ON "public"."profile";
DROP FUNCTION IF EXISTS prevent_email_verification_manipulation();
-- Drop all versions of verify_email_with_token function
DROP FUNCTION IF EXISTS "public"."verify_email_with_token"(text, text);
DROP FUNCTION IF EXISTS "public"."verify_email_with_token"(text, inet);
DROP FUNCTION IF EXISTS "public"."verify_email_with_token"(text);
-- Drop all versions of create_email_verification_token function
DROP FUNCTION IF EXISTS "public"."create_email_verification_token"(uuid, text, text);
DROP FUNCTION IF EXISTS "public"."create_email_verification_token"(uuid, text, inet);
DROP FUNCTION IF EXISTS "public"."create_email_verification_token"(uuid, text);
DROP FUNCTION IF EXISTS "public"."cleanup_expired_verification_tokens"();

CREATE TABLE IF NOT EXISTS "public"."email_verification_tokens" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "profile_id" uuid REFERENCES "public"."profile"("id") ON DELETE CASCADE,
    "token" text UNIQUE NOT NULL,
    "email" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT timezone('utc', now()),
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_by_ip" inet,
    "used_by_ip" inet
);

-- Drop existing policies and create secure profile update policy
DROP POLICY IF EXISTS "Users can update own profile." ON "public"."profile";
DROP POLICY IF EXISTS "Users can update own profile safely" ON "public"."profile";

-- Create a restrictive policy that prevents email verification manipulation
CREATE POLICY "Users can update own profile safely" ON "public"."profile" 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Create a trigger to prevent direct email verification status changes
CREATE OR REPLACE FUNCTION prevent_email_verification_manipulation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow email verification changes via our secure function
  IF (OLD.is_email_verified != NEW.is_email_verified OR 
      OLD.verified_at IS DISTINCT FROM NEW.verified_at) THEN
    
    -- Check if this is being called by our secure verification function
    IF current_setting('app.verification_context', true) != 'secure_verify' THEN
      RAISE EXCEPTION 'Email verification status can only be changed through secure verification process';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER profile_email_verification_protection
  BEFORE UPDATE ON "public"."profile"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_email_verification_manipulation();

CREATE OR REPLACE FUNCTION "public"."verify_email_with_token"(
  token_input text,
  user_ip text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token_record RECORD;
  result jsonb;
  ip_addr inet;
BEGIN
  -- Safely convert IP string to inet, handle invalid IPs
  BEGIN
    IF user_ip IS NOT NULL AND user_ip != 'unknown' AND user_ip != '' THEN
      ip_addr := user_ip::inet;
    ELSE
      ip_addr := NULL;
    END IF;
  EXCEPTION WHEN others THEN
    ip_addr := NULL;
  END;
  SELECT 
    evt.id, 
    evt.profile_id, 
    evt.email,
    evt.expires_at,
    evt.used_at,
    p.email as current_email
  INTO token_record
  FROM email_verification_tokens evt
  JOIN profile p ON p.id = evt.profile_id
  WHERE evt.token = token_input;

  -- Check if token exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'INVALID_TOKEN',
      'message', 'Verification token not found or invalid'
    );
  END IF;

  -- Check if token already used
  IF token_record.used_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'TOKEN_ALREADY_USED',
      'message', 'This verification link has already been used'
    );
  END IF;

  -- Check if token expired
  IF token_record.expires_at < NOW() THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'TOKEN_EXPIRED',
      'message', 'Verification link has expired. Please request a new one.'
    );
  END IF;

  -- Verify email matches current profile email
  IF token_record.email != token_record.current_email THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'EMAIL_MISMATCH',
      'message', 'Email address has been changed. Please request a new verification link.'
    );
  END IF;

  -- Mark token as used
  UPDATE email_verification_tokens 
  SET 
    used_at = NOW(),
    used_by_ip = ip_addr
  WHERE id = token_record.id;

  -- Set context for secure verification
  PERFORM set_config('app.verification_context', 'secure_verify', true);

  -- Update profile as verified
  UPDATE profile 
  SET 
    is_email_verified = true, 
    verified_at = NOW()
  WHERE id = token_record.profile_id;

  -- Reset context
  PERFORM set_config('app.verification_context', '', true);

  -- Clean up old/expired tokens for this profile
  DELETE FROM email_verification_tokens 
  WHERE 
    profile_id = token_record.profile_id 
    AND id != token_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Email successfully verified',
    'profile_id', token_record.profile_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION "public"."create_email_verification_token"(
  profile_id_input uuid,
  email_input text,
  creator_ip text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_token text;
  token_id uuid;
  profile_exists boolean;
  ip_addr inet;
BEGIN
  -- Safely convert IP string to inet, handle invalid IPs
  BEGIN
    IF creator_ip IS NOT NULL AND creator_ip != 'unknown' AND creator_ip != '' THEN
      ip_addr := creator_ip::inet;
    ELSE
      ip_addr := NULL;
    END IF;
  EXCEPTION WHEN others THEN
    ip_addr := NULL;
  END;
  -- Verify profile exists and email matches
  SELECT EXISTS(
    SELECT 1 FROM profile 
    WHERE id = profile_id_input 
    AND email = email_input
  ) INTO profile_exists;

  IF NOT profile_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_PROFILE',
      'message', 'Profile not found or email mismatch'
    );
  END IF;

  -- Generate cryptographically secure token
  new_token := encode(gen_random_bytes(32), 'base64');
  new_token := replace(replace(replace(new_token, '/', '-'), '+', '_'), '=', '');

  -- Clean up any existing tokens for this profile
  DELETE FROM email_verification_tokens 
  WHERE profile_id = profile_id_input;

  -- Insert new token
  INSERT INTO email_verification_tokens (
    profile_id, 
    token, 
    email, 
    expires_at,
    created_by_ip
  ) VALUES (
    profile_id_input,
    new_token,
    email_input,
    NOW() + INTERVAL '1 hour', -- 1 hour expiration
    ip_addr
  ) RETURNING id INTO token_id;

  RETURN jsonb_build_object(
    'success', true,
    'token', new_token,
    'token_id', token_id,
    'expires_at', NOW() + INTERVAL '1 hour'
  );
END;
$$;

-- Step 5: Add indexes for performance
CREATE INDEX idx_email_verification_tokens_token ON email_verification_tokens(token);
CREATE INDEX idx_email_verification_tokens_profile_id ON email_verification_tokens(profile_id);
CREATE INDEX idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);

-- Step 6: Add RLS for verification tokens table
ALTER TABLE "public"."email_verification_tokens" ENABLE ROW LEVEL SECURITY;

-- Only allow service role to manage verification tokens
CREATE POLICY "Service role can manage verification tokens" ON "public"."email_verification_tokens"
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- Step 7: Clean up expired tokens periodically (via cron job or manual cleanup)
CREATE OR REPLACE FUNCTION "public"."cleanup_expired_verification_tokens"()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM email_verification_tokens 
  WHERE expires_at < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Step 8: Grant necessary permissions
GRANT EXECUTE ON FUNCTION "public"."verify_email_with_token"(text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION "public"."create_email_verification_token"(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION "public"."cleanup_expired_verification_tokens"() TO service_role;

-- Security audit log
COMMENT ON TABLE "public"."email_verification_tokens" IS 'Secure email verification tokens - CVE fix for email verification bypass';
COMMENT ON FUNCTION "public"."verify_email_with_token" IS 'Securely verify email with cryptographic token validation';
COMMENT ON FUNCTION "public"."create_email_verification_token" IS 'Generate secure verification tokens with expiration';

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.check_if_student_completed_exercises(lesson_id_arg uuid, groupmember_id_arg uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
    all_exercises_exist boolean;
BEGIN
    SELECT COUNT(*) = COUNT(s.id) INTO all_exercises_exist
    FROM exercise e
    LEFT JOIN submission s ON e.id = s.exercise_id AND s.submitted_by = groupmember_id_arg
    WHERE e.lesson_id = lesson_id_arg;

    RETURN all_exercises_exist;
END;
$function$
;

set check_function_bodies = off;

create or replace view "public"."dash_org_stats" as  SELECT gp.organization_id AS org_id,
    count(DISTINCT course.id) AS no_of_courses,
    count(DISTINCT gm.profile_id) AS enrolled_students
   FROM ((course
     JOIN "group" gp ON ((gp.id = course.group_id)))
     LEFT JOIN groupmember gm ON (((gm.group_id = gp.id) AND (gm.role_id = 3))))
  WHERE (course.status = 'ACTIVE'::text)
  GROUP BY gp.organization_id;


CREATE OR REPLACE FUNCTION public.get_dash_org_recent_enrollments(org_id_arg uuid)
 RETURNS TABLE(profile_id uuid, avatar_url text, fullname text, course_id uuid, course_title character varying, enrolled_at timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.avatar_url,
        p.fullname,
        course.id,
        course.title,
        gm.created_at as enrolled_at
    FROM
        course
        JOIN "group" as gp ON gp.id = course.group_id
        LEFT JOIN groupmember as gm ON gm.group_id = gp.id AND gm.role_id = 3
        JOIN profile as p ON p.id = gm.profile_id
    WHERE 
        course.status = 'ACTIVE' 
        AND gp.organization_id = org_id_arg
    GROUP BY 
        p.id,
        course.id,
        course.title,
        enrolled_at
    ORDER BY 
        enrolled_at DESC
    LIMIT 5;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_dash_org_top_courses(org_id_arg uuid)
 RETURNS TABLE(course_id uuid, course_title character varying, total_students integer, completion_percentage integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
SELECT 
    course_stats.course_id,
    course_stats.course_title,
    course_stats.total_students::integer,
    CASE 
      WHEN course_stats.total_students * course_stats.total_lessons = 0 THEN 0
      ELSE ROUND((course_stats.completed_lessons::numeric / (course_stats.total_students * course_stats.total_lessons)) * 100)::integer
    END as completion_percentage
  FROM (
    SELECT 
      c.id as course_id,
      c.title as course_title,
      COUNT(DISTINCT gm.id) as total_students,
      COUNT(DISTINCT l.id) as total_lessons,
      COUNT(DISTINCT lc.id) FILTER (WHERE lc.is_complete = true) as completed_lessons
    FROM course c
    JOIN "group" g ON g.id = c.group_id
    LEFT JOIN groupmember gm ON gm.group_id = g.id and gm.role_id = 3
    LEFT JOIN lesson l ON l.course_id = c.id
    LEFT JOIN lesson_completion lc ON lc.lesson_id = l.id 
      AND lc.profile_id = gm.profile_id
    WHERE c.status = 'ACTIVE'  AND g.organization_id = org_id_arg
    GROUP BY c.id, c.title
    ORDER BY completed_lessons DESC
  ) as course_stats
  LIMIT 5;
END;
$function$
;


alter table "public"."organization_plan" add column "provider" text default 'lmz'::text;

alter table "public"."organization_plan" add column "subscription_id" text;

CREATE UNIQUE INDEX organization_plan_subscription_id_key ON public.organization_plan USING btree (subscription_id);

alter table "public"."organization_plan" add constraint "organization_plan_subscription_id_key" UNIQUE using index "organization_plan_subscription_id_key";

-- Disable email verification requirement
-- Date: 2026-05-18
-- All existing users are marked as email-verified so they can log in without verification.

-- Temporarily disable the verification protection trigger so we can update profiles
ALTER TABLE "public"."profile" DISABLE TRIGGER profile_email_verification_protection;

-- Mark all existing unverified users as verified
UPDATE "public"."profile"
SET
  is_email_verified = true,
  verified_at = COALESCE(verified_at, NOW())
WHERE is_email_verified = false OR is_email_verified IS NULL;

-- Re-enable the protection trigger (it won't block updates from now on because all users are verified)
ALTER TABLE "public"."profile" ENABLE TRIGGER profile_email_verification_protection;


drop policy "Enable access to all users" on "public"."course";

drop policy "User must be an course member to INSERT" on "public"."lesson_completion";

drop policy "User must be a course member to INSERT" on "public"."apps_poll";

drop policy "User must be course member to SELECT" on "public"."apps_poll";

drop policy "User must be a course member to INSERT" on "public"."apps_poll_option";

drop policy "User must be a course member to UPDATE" on "public"."apps_poll_option";

drop policy "User must be a teacher to DELETE" on "public"."apps_poll_option";

drop policy "User must be course member to SELECT" on "public"."apps_poll_option";

drop policy "User must be a course member to INSERT" on "public"."course_newsfeed";

drop policy "User must be a course member to SELECT" on "public"."course_newsfeed";

drop policy "User must be a course member to INSERT" on "public"."course_newsfeed_comment";

drop policy "User must be a course member to SELECT" on "public"."course_newsfeed_comment";

drop policy "User must be a course member to INSERT" on "public"."group_attendance";

drop policy "User must be a course member to SELECT" on "public"."group_attendance";

drop policy "User must be a course member to UPDATE" on "public"."group_attendance";

drop policy "User must be in course group to INSERT" on "public"."lesson_comment";

drop policy "User must be an course member to DELETE" on "public"."question_answer";

drop policy "User must be an course member to INSERT" on "public"."question_answer";

drop policy "User must be an course member to UPDATE" on "public"."question_answer";

drop policy "User must be a course member to DELETE" on "public"."submission";

drop policy "User must be a course member to INSERT" on "public"."submission";

drop policy "User must be a course member to UPDATE" on "public"."submission";

drop function if exists "public"."is_user_in_group_with_role"(group_id integer);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.is_user_in_course_group_or_admin(group_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  org_id uuid;
  is_admin boolean;
  is_member boolean;
BEGIN
  SELECT organization_id INTO org_id FROM "group" WHERE id = $1 LIMIT 1;
  is_admin := is_org_admin(org_id);
  is_member := is_user_in_course_group($1);
  RETURN is_admin OR is_member;
END;
$function$
;

create policy "Enable access to all users if PUBLIC or to course members when "
on "public"."course"
as permissive
for select
to public
using ((is_published OR is_user_in_course_group_or_admin(group_id)));


create policy "User must be an course member or Admin to perform ALL operation"
on "public"."lesson_completion"
as permissive
for all
to public
with check (is_user_in_course_group_or_admin(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = lesson_completion.lesson_id)
         LIMIT 1))
 LIMIT 1)));


create policy "User must be an admin to INSERT or allow if no existing member"
on "public"."organizationmember"
as permissive
for insert
to public
with check ((is_org_admin() OR (NOT (EXISTS ( SELECT 1
   FROM organizationmember organizationmember_1
  WHERE (organizationmember_1.organization_id = organizationmember_1.organization_id))))));


create policy "User must be a course member to INSERT"
on "public"."apps_poll"
as permissive
for insert
to public
with check (is_user_in_course_group_or_admin(( SELECT groupmember.group_id
   FROM groupmember
  WHERE (groupmember.id = apps_poll."authorId")
 LIMIT 1)));


create policy "User must be course member to SELECT"
on "public"."apps_poll"
as permissive
for select
to public
using (is_user_in_course_group_or_admin(( SELECT groupmember.group_id
   FROM groupmember
  WHERE (groupmember.id = apps_poll."authorId")
 LIMIT 1)));


create policy "User must be a course member to INSERT"
on "public"."apps_poll_option"
as permissive
for insert
to public
with check (is_user_in_course_group_or_admin(( SELECT groupmember.group_id
   FROM groupmember
  WHERE (groupmember.id = ( SELECT apps_poll."authorId"
           FROM apps_poll
          WHERE (apps_poll.id = apps_poll_option.poll_id)
         LIMIT 1))
 LIMIT 1)));


create policy "User must be a course member to UPDATE"
on "public"."apps_poll_option"
as permissive
for update
to public
using (is_user_in_course_group_or_admin(( SELECT groupmember.group_id
   FROM groupmember
  WHERE (groupmember.id = ( SELECT apps_poll."authorId"
           FROM apps_poll
          WHERE (apps_poll.id = apps_poll_option.poll_id)
         LIMIT 1))
 LIMIT 1)))
with check (is_user_in_course_group_or_admin(( SELECT groupmember.group_id
   FROM groupmember
  WHERE (groupmember.id = ( SELECT apps_poll."authorId"
           FROM apps_poll
          WHERE (apps_poll.id = apps_poll_option.poll_id)
         LIMIT 1))
 LIMIT 1)));


create policy "User must be a teacher to DELETE"
on "public"."apps_poll_option"
as permissive
for delete
to public
using (is_user_in_course_group_or_admin(( SELECT groupmember.group_id
   FROM groupmember
  WHERE (groupmember.id = ( SELECT apps_poll."authorId"
           FROM apps_poll
          WHERE (apps_poll.id = apps_poll_option.poll_id)
         LIMIT 1))
 LIMIT 1)));


create policy "User must be course member to SELECT"
on "public"."apps_poll_option"
as permissive
for select
to public
using (is_user_in_course_group_or_admin(( SELECT groupmember.group_id
   FROM groupmember
  WHERE (groupmember.id = ( SELECT apps_poll."authorId"
           FROM apps_poll
          WHERE (apps_poll.id = apps_poll_option.poll_id)
         LIMIT 1))
 LIMIT 1)));


create policy "User must be a course member to INSERT"
on "public"."course_newsfeed"
as permissive
for insert
to public
with check (is_user_in_course_group_or_admin(( SELECT course.group_id
   FROM course
  WHERE (course.id = course_newsfeed.course_id)
 LIMIT 1)));


create policy "User must be a course member to SELECT"
on "public"."course_newsfeed"
as permissive
for select
to public
using (is_user_in_course_group_or_admin(( SELECT course.group_id
   FROM course
  WHERE (course.id = course_newsfeed.course_id)
 LIMIT 1)));


create policy "User must be a course member to INSERT"
on "public"."course_newsfeed_comment"
as permissive
for insert
to public
with check (is_user_in_course_group_or_admin(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT course_newsfeed.course_id
           FROM course_newsfeed
          WHERE (course_newsfeed.id = course_newsfeed_comment.course_newsfeed_id)))
 LIMIT 1)));


create policy "User must be a course member to SELECT"
on "public"."course_newsfeed_comment"
as permissive
for select
to public
using (is_user_in_course_group_or_admin(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT course_newsfeed.course_id
           FROM course_newsfeed
          WHERE (course_newsfeed.id = course_newsfeed_comment.course_newsfeed_id)))
 LIMIT 1)));


create policy "User must be a course member to INSERT"
on "public"."group_attendance"
as permissive
for insert
to public
with check (is_user_in_course_group_or_admin(( SELECT course.group_id
   FROM course
  WHERE (course.id = group_attendance.course_id)
 LIMIT 1)));


create policy "User must be a course member to SELECT"
on "public"."group_attendance"
as permissive
for select
to public
using (is_user_in_course_group_or_admin(( SELECT course.group_id
   FROM course
  WHERE (course.id = group_attendance.course_id)
 LIMIT 1)));


create policy "User must be a course member to UPDATE"
on "public"."group_attendance"
as permissive
for update
to public
using (is_user_in_course_group_or_admin(( SELECT course.group_id
   FROM course
  WHERE (course.id = group_attendance.course_id)
 LIMIT 1)))
with check (is_user_in_course_group_or_admin(( SELECT course.group_id
   FROM course
  WHERE (course.id = group_attendance.course_id)
 LIMIT 1)));


create policy "User must be in course group to INSERT"
on "public"."lesson_comment"
as permissive
for insert
to public
with check (is_user_in_course_group_or_admin(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = lesson_comment.lesson_id)
         LIMIT 1))
 LIMIT 1)));


create policy "User must be an course member to DELETE"
on "public"."question_answer"
as permissive
for delete
to public
using (is_user_in_course_group_or_admin(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = ( SELECT exercise.lesson_id
                   FROM exercise
                  WHERE (exercise.id = ( SELECT question.exercise_id
                           FROM question
                          WHERE (question.id = question_answer.question_id)
                         LIMIT 1))
                 LIMIT 1))
         LIMIT 1))
 LIMIT 1)));


create policy "User must be an course member to INSERT"
on "public"."question_answer"
as permissive
for insert
to public
with check (is_user_in_course_group_or_admin(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = ( SELECT exercise.lesson_id
                   FROM exercise
                  WHERE (exercise.id = ( SELECT question.exercise_id
                           FROM question
                          WHERE (question.id = question_answer.question_id)
                         LIMIT 1))
                 LIMIT 1))
         LIMIT 1))
 LIMIT 1)));


create policy "User must be an course member to UPDATE"
on "public"."question_answer"
as permissive
for update
to public
using (is_user_in_course_group_or_admin(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = ( SELECT exercise.lesson_id
                   FROM exercise
                  WHERE (exercise.id = ( SELECT question.exercise_id
                           FROM question
                          WHERE (question.id = question_answer.question_id)
                         LIMIT 1))
                 LIMIT 1))
         LIMIT 1))
 LIMIT 1)))
with check (is_user_in_course_group_or_admin(( SELECT course.group_id
   FROM course
  WHERE (course.id = ( SELECT lesson.course_id
           FROM lesson
          WHERE (lesson.id = ( SELECT exercise.lesson_id
                   FROM exercise
                  WHERE (exercise.id = ( SELECT question.exercise_id
                           FROM question
                          WHERE (question.id = question_answer.question_id)
                         LIMIT 1))
                 LIMIT 1))
         LIMIT 1))
 LIMIT 1)));


create policy "User must be a course member to DELETE"
on "public"."submission"
as permissive
for delete
to public
using (is_user_in_course_group_or_admin(( SELECT course.group_id
   FROM course
  WHERE (course.id = submission.course_id)
 LIMIT 1)));


create policy "User must be a course member to INSERT"
on "public"."submission"
as permissive
for insert
to public
with check (is_user_in_course_group_or_admin(( SELECT course.group_id
   FROM course
  WHERE (course.id = submission.course_id)
 LIMIT 1)));


create policy "User must be a course member to UPDATE"
on "public"."submission"
as permissive
for update
to public
using (is_user_in_course_group_or_admin(( SELECT course.group_id
   FROM course
  WHERE (course.id = submission.course_id)
 LIMIT 1)))
with check (is_user_in_course_group_or_admin(( SELECT course.group_id
   FROM course
  WHERE (course.id = submission.course_id)
 LIMIT 1)));


drop view if exists "public"."lesson_versions";

alter table "public"."lesson_language" alter column "locale" drop default;

alter table "public"."profile" alter column "locale" drop default;

alter type "public"."LOCALE" rename to "LOCALE__old_version_to_be_dropped";

create type "public"."LOCALE" as enum ('en', 'hi', 'fr', 'pt', 'de', 'vi', 'ru', 'es', 'pl');

alter table "public"."lesson_language" alter column locale type "public"."LOCALE" using locale::text::"public"."LOCALE";

alter table "public"."profile" alter column locale type "public"."LOCALE" using locale::text::"public"."LOCALE";

alter table "public"."lesson_language" alter column "locale" set default 'en'::"LOCALE";

alter table "public"."profile" alter column "locale" set default 'en'::"LOCALE";

drop type "public"."LOCALE__old_version_to_be_dropped";

create or replace view "public"."lesson_versions" as  SELECT llh.old_content,
    llh.new_content,
    llh."timestamp",
    ll.locale,
    ll.lesson_id
   FROM (lesson_language_history llh
     JOIN lesson_language ll ON ((ll.id = llh.lesson_language_id)));


-- Migration: Add documents column to lesson table
-- Description: Add a JSONB column to store document metadata for lessons

alter table "public"."lesson" add column documents jsonb null default '[]'::jsonb;


set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_course_progress(course_id_arg uuid, profile_id_arg uuid)
 RETURNS TABLE(lessons_count bigint, lessons_completed bigint, exercises_count bigint, exercises_completed bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
RETURN QUERY
select
  count(distinct lesson.id) as lessons_count,
  count(distinct lesson_completion.id) as lessons_completed,
  count(distinct exercise.id) as exercises_count,
  count(distinct submission.id) as exercises_completed
from
  course
  join "group" on "group".id = course.group_id
  join groupmember on groupmember.group_id = course.group_id
  join profile on profile.id = groupmember.profile_id
  left join lesson on lesson.course_id = course.id
  left join lesson_completion on lesson_completion.lesson_id = lesson.id
  and lesson_completion.is_complete = true
  and lesson_completion.profile_id = profile.id
  left join exercise on exercise.lesson_id = lesson.id
  left join submission on submission.exercise_id = exercise.id
  and submission.submitted_by = groupmember.id
where
  course.id = course_id_arg
  and profile.id = profile_id_arg;
END;
$function$
;

ALTER TABLE public.lesson_completion
ADD CONSTRAINT unique_lesson_profile UNIQUE (lesson_id, profile_id);


drop view if exists "public"."lesson_versions";

alter table "public"."lesson_language" alter column "locale" drop default;

alter table "public"."profile" alter column "locale" drop default;

alter type "public"."LOCALE" rename to "LOCALE__old_version_to_be_dropped";

create type "public"."LOCALE" as enum ('en', 'hi', 'fr', 'pt', 'de', 'vi', 'ru', 'es', 'pl', 'da');

alter table "public"."lesson_language" alter column locale type "public"."LOCALE" using locale::text::"public"."LOCALE";

alter table "public"."profile" alter column locale type "public"."LOCALE" using locale::text::"public"."LOCALE";

alter table "public"."lesson_language" alter column "locale" set default 'en'::"LOCALE";

alter table "public"."profile" alter column "locale" set default 'en'::"LOCALE";

drop type "public"."LOCALE__old_version_to_be_dropped";

create or replace view "public"."lesson_versions" as  SELECT llh.old_content,
    llh.new_content,
    llh."timestamp",
    ll.locale,
    ll.lesson_id
   FROM (lesson_language_history llh
     JOIN lesson_language ll ON ((ll.id = llh.lesson_language_id)));


drop policy if exists "Public profiles are viewable by everyone." on "public"."profile";

drop policy if exists "Only auth users can read profile" on "public"."profile";

create policy "You can only view your own profile"
on "public"."profile"
as permissive
for select
to authenticated, anon
using ((auth.uid() = id));


-- Add Chinese (Simplified) and Chinese (Traditional) to LOCALE enum

alter type "public"."LOCALE" add value if not exists 'zh';
alter type "public"."LOCALE" add value if not exists 'zh-TW';


