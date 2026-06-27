-- 상품 카탈로그 테이블은 공개 읽기 허용 (anon 포함)
ALTER TABLE product_master         ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_policy         ENABLE ROW LEVEL SECURITY;
ALTER TABLE eligibility_rules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_search_keyword ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_map            ENABLE ROW LEVEL SECURITY;
ALTER TABLE screen_mapping         ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_definition        ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_list              ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents              ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_mapping        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read product_master"         ON product_master         FOR SELECT USING (true);
CREATE POLICY "public read product_policy"         ON product_policy         FOR SELECT USING (true);
CREATE POLICY "public read eligibility_rules"      ON eligibility_rules      FOR SELECT USING (true);
CREATE POLICY "public read product_search_keyword" ON product_search_keyword FOR SELECT USING (true);
CREATE POLICY "public read routing_map"            ON routing_map            FOR SELECT USING (true);
CREATE POLICY "public read screen_mapping"         ON screen_mapping         FOR SELECT USING (true);
CREATE POLICY "public read slot_definition"        ON slot_definition        FOR SELECT USING (true);
CREATE POLICY "public read code_list"              ON code_list              FOR SELECT USING (true);
CREATE POLICY "public read documents"              ON documents              FOR SELECT USING (true);
CREATE POLICY "public read consent_mapping"        ON consent_mapping        FOR SELECT USING (true);
