-- ============================================
-- 📋 공도 업무 관리 — Supabase 초기 스키마
-- ============================================
-- @version     v1.0.0
-- @updated     2026-03-16 (KST)
-- @agent       슈베이스 DevOps (자비스 개발팀)
-- @description Google Sheets → Supabase 마이그레이션 Phase 1~4 전체 스키마
-- ============================================

-- ━━━ Phase 1: 기반 테이블 ━━━

-- projects
CREATE TABLE IF NOT EXISTS projects (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  code          TEXT UNIQUE,
  is_active     BOOLEAN DEFAULT true,
  slack_channel TEXT,
  description   TEXT,
  status        TEXT DEFAULT '활성'
    CHECK (status IN ('활성', '대기', '완료')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- users
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  slack_id      TEXT,
  email         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ━━━ Phase 2: 핵심 테이블 ━━━

-- tasks
CREATE TABLE IF NOT EXISTS tasks (
  id              BIGSERIAL PRIMARY KEY,
  task_id         TEXT NOT NULL UNIQUE,
  task_type       TEXT,
  status          TEXT DEFAULT '대기'
    CHECK (status IN ('대기', '진행중', '완료', '보류', '삭제됨', '수락대기')),
  project_id      BIGINT REFERENCES projects(id),
  title           TEXT NOT NULL,
  description     TEXT,
  assignee        TEXT,
  requester       TEXT,
  due_date        DATE,
  predecessor     TEXT,
  priority        TEXT DEFAULT '중간'
    CHECK (priority IN ('🔥 높음', '중간', '낮음')),
  slack_link      TEXT,
  calendar_id     TEXT,
  start_time      TIMESTAMPTZ,
  end_time        TIMESTAMPTZ,
  duration_min    INTEGER,
  start_date      DATE,
  creator         TEXT,
  cc_assignees    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- ━━━ Phase 3: 연결 테이블 ━━━

-- task_references
CREATE TABLE IF NOT EXISTS task_references (
  id            BIGSERIAL PRIMARY KEY,
  ref_id        TEXT NOT NULL UNIQUE,
  task_id       TEXT REFERENCES tasks(task_id),
  author        TEXT,
  content       TEXT,
  action_type   TEXT DEFAULT 'ADD',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- notes
CREATE TABLE IF NOT EXISTS notes (
  id              BIGSERIAL PRIMARY KEY,
  note_id         TEXT NOT NULL UNIQUE,
  title           TEXT,
  content         TEXT,
  tags            TEXT,
  linked_task_id  TEXT REFERENCES tasks(task_id),
  author          TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ━━━ Phase 4: 로그 + 보조 테이블 ━━━

-- action_logs
CREATE TABLE IF NOT EXISTS action_logs (
  id            BIGSERIAL PRIMARY KEY,
  user_name     TEXT,
  action        TEXT,
  task_id       TEXT,
  old_value     TEXT,
  new_value     TEXT,
  source        TEXT,
  details       TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_logs_task ON action_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_created ON action_logs(created_at);

-- calendar_events
CREATE TABLE IF NOT EXISTS calendar_events (
  id            BIGSERIAL PRIMARY KEY,
  event_id      TEXT UNIQUE,
  event_name    TEXT,
  event_type    TEXT,
  title         TEXT,
  start_date    TIMESTAMPTZ,
  end_date      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- token_usage
CREATE TABLE IF NOT EXISTS token_usage (
  id              BIGSERIAL PRIMARY KEY,
  function_name   TEXT,
  user_name       TEXT,
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  total_tokens    INTEGER,
  model           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- agent_tasks
CREATE TABLE IF NOT EXISTS agent_tasks (
  id            BIGSERIAL PRIMARY KEY,
  task_id       TEXT UNIQUE,
  description   TEXT,
  status        TEXT,
  team          TEXT,
  doc_link      TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- agent_logs
CREATE TABLE IF NOT EXISTS agent_logs (
  id            BIGSERIAL PRIMARY KEY,
  task_id       TEXT,
  team          TEXT,
  action        TEXT,
  message       TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- expenses
CREATE TABLE IF NOT EXISTS expenses (
  id            BIGSERIAL PRIMARY KEY,
  plan_id       TEXT UNIQUE,
  item          TEXT,
  amount        NUMERIC,
  due_date      DATE,
  category      TEXT,
  status        TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- memo_edit_logs
CREATE TABLE IF NOT EXISTS memo_edit_logs (
  id            BIGSERIAL PRIMARY KEY,
  user_name     TEXT,
  action        TEXT,
  edit_date     DATE,
  edit_time     TIME,
  success       BOOLEAN,
  error_code    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ━━━ 트리거: updated_at 자동 갱신 ━━━

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- duration_min 자동 계산 트리거
CREATE OR REPLACE FUNCTION calc_duration_min()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    NEW.duration_min = CAST(EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60 AS INTEGER);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_duration_min BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION calc_duration_min();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ━━━ RLS 정책 ━━━

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE memo_edit_logs ENABLE ROW LEVEL SECURITY;

-- anon 키 전체 접근 허용 (GAS 서버에서만 호출)
CREATE POLICY "anon_full_access" ON projects FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON users FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON tasks FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON task_references FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON notes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON action_logs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON calendar_events FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON token_usage FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON agent_tasks FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON agent_logs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON expenses FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_access" ON memo_edit_logs FOR ALL TO anon USING (true) WITH CHECK (true);
