-- Strip "Copy of " and "Due Diligence" etc. so card names are "TBE" not "Copy of TBE Due Diligence"

CREATE OR REPLACE FUNCTION extract_company_name_from_title(p_title TEXT)
RETURNS TEXT AS $$
DECLARE
  v_clean TEXT;
  v_name  TEXT;
  v_first TEXT;
BEGIN
  IF p_title IS NULL OR LENGTH(TRIM(p_title)) < 2 THEN RETURN NULL; END IF;

  v_clean := TRIM(p_title);

  -- Skip titles that are clearly NOT company names (unchanged)
  IF v_clean ~* '(^|\s)(intern|resume|cv|cover\s*letter|certificate|transcript|letter\s+of|offer\s+letter|contract|agreement|invoice|receipt|manual|handbook|guide|tutorial|template|checklist|agenda|minutes|action\s+items|todo|to-do|meeting\s+notes|quarterly\s+report|annual\s+report|monthly\s+report|weekly\s+update|status\s+update|onboarding|training|policy|procedure|regulation|compliance|audit|tax|payroll|expense|budget|forecast|projection|roadmap|sprint|backlog|changelog|release\s+notes|readme|license|terms|privacy\s+policy|faq)(\s|$|[_-])' THEN
    RETURN NULL;
  END IF;
  IF v_clean ~* '(^|\s)(trading|derivatives|scaling|operations|marketing|strategy|analysis|research|benchmark|comparison|landscape|market\s+overview|industry|sector|thesis|framework|playbook|workflow|process|pipeline|funnel|metrics|kpis|okrs|goals|objectives)(\s|$|[_-])' THEN
    RETURN NULL;
  END IF;
  IF v_clean ~ '\(\d+\)\s*$' THEN RETURN NULL; END IF;
  IF array_length(string_to_array(v_clean, ' '), 1) > 8 THEN RETURN NULL; END IF;

  -- Remove file extension
  v_name := REGEXP_REPLACE(v_clean, '\.[^.]+$', '');

  -- Strip "Copy of " prefix so "Copy of TBE Due Diligence" → "TBE Due Diligence"
  v_name := REGEXP_REPLACE(v_name, '^copy\s+of\s+', '', 'i');
  v_name := TRIM(v_name);

  -- Split on " - " or " – " and take the first segment
  IF v_name ~ '\s+[-–]\s+' THEN
    v_name := SPLIT_PART(v_name, ' - ', 1);
    IF v_name = '' THEN
      v_name := SPLIT_PART(v_clean, ' – ', 1);
    END IF;
  END IF;

  -- Remove document-type suffixes including due diligence, dd, diligence
  v_name := REGEXP_REPLACE(v_name, '\s*[-_]?\s*(due\s*diligence|dd|diligence|pitch\s*deck|pitch|deck|investment\s+deck|investment\s+memo|memo|presentation|report|summary|notes|overview|profile|tearsheet|one[- ]?pager|executive\s+summary|data\s*room|financials|appendix|proposal|brief|intro|introduction|brochure|prospectus|term\s*sheet|cap\s*table)$', '', 'i');

  -- Remove date suffixes
  v_name := REGEXP_REPLACE(v_name, '\s*[-_]?\s*(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec|q[1-4])?\s*\d{4}\s*$', '', 'i');

  v_name := REGEXP_REPLACE(v_name, '[\s_-]+$', '');
  v_name := TRIM(v_name);
  v_name := REPLACE(v_name, '_', ' ');
  v_name := TRIM(v_name);

  -- Prefer first token when the rest looks like doc-type words (e.g. "TBE Due Diligence" → "TBE")
  IF v_name ~ '\s+' THEN
    v_first := SPLIT_PART(v_name, ' ', 1);
    IF LENGTH(v_first) >= 2 AND v_first ~ '^[A-Za-z0-9]' THEN
      v_name := v_first;
    END IF;
  END IF;

  IF LENGTH(v_name) < 2 THEN RETURN NULL; END IF;
  IF array_length(string_to_array(v_name, ' '), 1) > 5 THEN RETURN NULL; END IF;
  IF v_name = LOWER(v_name) AND v_name ~ '\s' THEN RETURN NULL; END IF;

  RETURN v_name;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
