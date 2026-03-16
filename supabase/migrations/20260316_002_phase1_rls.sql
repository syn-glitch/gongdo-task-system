-- ============================================
-- 📋 Phase 1 RLS 정책 — projects, users만 분리
-- ============================================
-- @version     v1.0.0
-- @updated     2026-03-16 (KST)
-- @agent       슈베이스 DevOps (자비스 개발팀)
-- @description Phase 1 테이블(projects, users)에 대한 RLS 정책.
--              전체 스키마(001)에서 이미 적용된 경우 이 파일은 참고용.
-- ============================================

-- ※ 001_initial_schema.sql에서 전체 실행 완료된 경우
--   이 파일은 별도 실행 불필요 (참고/감사 용도)

-- projects RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "anon_full_access" ON projects
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- users RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "anon_full_access" ON users
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- updated_at 트리거 (projects)
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 이미 존재하면 무시됨 (IF NOT EXISTS는 트리거에 미지원이므로 DO block 사용)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = 'projects'::regclass) THEN
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON projects
      FOR EACH ROW EXECUTE FUNCTION update_modified_column();
  END IF;
END $$;
