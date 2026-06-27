ALTER TABLE product_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read product_master" ON product_master;
DROP POLICY IF EXISTS "public_read" ON product_master;
CREATE POLICY "public_read" ON product_master FOR SELECT USING (true);
