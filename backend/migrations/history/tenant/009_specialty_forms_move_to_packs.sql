-- Tenant migration 009: hand five specialty forms over to their specialty packs
--
-- tenant/008 seeded the whole 22-template library as `base`. Five of those are not
-- universal — they belong to a specialty, and a practice should get them because it does
-- that specialty, not because it exists:
--
--   phq9-depression-screening   \
--   gad7-anxiety-screening       >  behavioral_health pack v1
--   behavioral-health-intake    /
--   pediatric-wellness-intake      paediatrics pack v2
--   dental-health-history          dentistry pack v2
--
-- tenant/008 is left exactly as it was. An applied migration is a record of what ran, so
-- this is a second, forward migration rather than an edit to the first.
--
-- THREE THINGS ARE DELIBERATELY NOT DELETED, because a form is not just a row:
--
--   * a row the practice has edited (is_customised). The whole provenance mechanism exists
--     so that a practice's own work is never thrown away by a later migration.
--   * a row some form_submission points at. form_submissions.template_id has no
--     ON DELETE clause, so the delete would fail anyway — but the reason it should fail is
--     that a signed form must stay traceable to the template that was signed.
--   * a row some healthcare_offering uses as its consent form. That FK is ON DELETE SET
--     NULL, so a delete would quietly unlink an offering from its consent form instead of
--     erroring. Quiet is worse.
--
-- Anything skipped is reported and simply stays as a `base` row. The specialty pack uses
-- the same slug, so when such a practice later applies the pack the apply engine reports
-- the existing row as a conflict and leaves it alone — which is the correct outcome, not a
-- failure.
--
-- Unqualified names: the runner sets search_path per tenant schema and for `template`.

DO $move$
DECLARE
  slugs text[] := ARRAY[
    'phq9-depression-screening',
    'gad7-anxiety-screening',
    'behavioral-health-intake',
    'pediatric-wellness-intake',
    'dental-health-history'
  ];
  s            text;
  tpl          record;
  n_submissions bigint;
  n_offerings   bigint;
  removed      int := 0;
  kept         int := 0;
BEGIN
  FOREACH s IN ARRAY slugs LOOP
    SELECT id, is_customised, source_pack INTO tpl
      FROM form_templates WHERE slug = s;

    CONTINUE WHEN tpl IS NULL;                      -- never seeded here
    IF tpl.source_pack IS DISTINCT FROM 'base' THEN -- already a pack's, or the practice's own
      kept := kept + 1;
      CONTINUE;
    END IF;

    IF tpl.is_customised THEN
      RAISE NOTICE '009 in %: keeping % — the practice has edited it', current_schema(), s;
      kept := kept + 1;
      CONTINUE;
    END IF;

    SELECT count(*) INTO n_submissions FROM form_submissions WHERE template_id = tpl.id;
    IF n_submissions > 0 THEN
      RAISE NOTICE '009 in %: keeping % — % submission(s) reference it', current_schema(), s, n_submissions;
      kept := kept + 1;
      CONTINUE;
    END IF;

    SELECT count(*) INTO n_offerings FROM healthcare_offerings WHERE consent_form_id = tpl.id;
    IF n_offerings > 0 THEN
      RAISE NOTICE '009 in %: keeping % — % offering(s) use it as a consent form', current_schema(), s, n_offerings;
      kept := kept + 1;
      CONTINUE;
    END IF;

    -- form_template_versions cascades; nothing else points here.
    DELETE FROM form_templates WHERE id = tpl.id;
    removed := removed + 1;
  END LOOP;

  IF removed > 0 OR kept > 0 THEN
    RAISE NOTICE '009 in %: % specialty form(s) handed to packs, % kept in place',
      current_schema(), removed, kept;
  END IF;
END $move$;

-- The specialty form CATEGORIES stay. They are cheap, they are what the pack's templates
-- declare as their category_slug, and removing them would break that link for any practice
-- that keeps one of the forms above.

DO $verify$
DECLARE base_left int; total int;
BEGIN
  SELECT count(*) INTO base_left FROM form_templates
   WHERE source_pack = 'base' AND slug IN (
     'phq9-depression-screening', 'gad7-anxiety-screening', 'behavioral-health-intake',
     'pediatric-wellness-intake', 'dental-health-history');
  SELECT count(*) INTO total FROM form_templates WHERE source_pack = 'base';

  -- base_left > 0 is not a failure: it means those rows were protected for one of the
  -- three reasons above. It is reported so the state is visible rather than assumed.
  IF base_left > 0 THEN
    RAISE NOTICE '009 in %: % specialty form(s) remain as base rows (protected); base library now %',
      current_schema(), base_left, total;
  END IF;
END $verify$;
