-- =====================================================
-- Smart Farming System - Assistant Chat & Upload Storage
-- =====================================================
-- Version: 1.0.0
-- Date: April 7, 2026
-- Description: Adds database tables for assistant chat history
--              and uploaded document storage metadata.
-- =====================================================

-- =====================================================
-- ASSISTANT CHAT
-- =====================================================

CREATE TABLE assistant_chat_sessions (
  chat_id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  language VARCHAR(2) DEFAULT 'en' CHECK (language IN ('bn', 'en')),
  title TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  message_count INTEGER DEFAULT 0,
  last_provider VARCHAR(50),
  last_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_assistant_chat_sessions_user_id ON assistant_chat_sessions(user_id);
CREATE INDEX idx_assistant_chat_sessions_updated_at ON assistant_chat_sessions(updated_at DESC);
CREATE INDEX idx_assistant_chat_sessions_last_message_at ON assistant_chat_sessions(last_message_at DESC);

CREATE TABLE assistant_chat_messages (
  message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id TEXT NOT NULL REFERENCES assistant_chat_sessions(chat_id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  message_text TEXT NOT NULL,
  image_ref TEXT,
  image_base64 TEXT,
  provider VARCHAR(50),
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_assistant_chat_messages_chat_id ON assistant_chat_messages(chat_id);
CREATE INDEX idx_assistant_chat_messages_created_at ON assistant_chat_messages(created_at DESC);
CREATE INDEX idx_assistant_chat_messages_role ON assistant_chat_messages(role);

CREATE TRIGGER update_assistant_chat_sessions_updated_at
  BEFORE UPDATE ON assistant_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- UPLOADED DOCUMENTS
-- =====================================================

CREATE TABLE uploaded_documents (
  document_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  document_type VARCHAR(50) NOT NULL DEFAULT 'other' CHECK (
    document_type IN (
      'doctor_certificate',
      'doctor_resume',
      'profile_photo',
      'supporting_file',
      'other'
    )
  ),
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL UNIQUE,
  content_type VARCHAR(100) NOT NULL,
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes >= 0),
  sha256 VARCHAR(64) NOT NULL UNIQUE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_uploaded_documents_user_id ON uploaded_documents(user_id);
CREATE INDEX idx_uploaded_documents_document_type ON uploaded_documents(document_type);
CREATE INDEX idx_uploaded_documents_uploaded_at ON uploaded_documents(uploaded_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE assistant_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY assistant_chat_sessions_select_own ON assistant_chat_sessions
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY assistant_chat_sessions_insert_own ON assistant_chat_sessions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM users WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY assistant_chat_sessions_update_own ON assistant_chat_sessions
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users WHERE user_id = auth.uid() AND role = 'admin'
    )
  ) WITH CHECK (
    user_id = auth.uid()
    OR user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM users WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY assistant_chat_messages_select_own ON assistant_chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM assistant_chat_sessions s
      WHERE s.chat_id = assistant_chat_messages.chat_id
        AND (
          s.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM users WHERE user_id = auth.uid() AND role = 'admin'
          )
        )
    )
  );

CREATE POLICY assistant_chat_messages_insert_own ON assistant_chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM assistant_chat_sessions s
      WHERE s.chat_id = assistant_chat_messages.chat_id
        AND (
          s.user_id = auth.uid()
          OR s.user_id IS NULL
          OR EXISTS (
            SELECT 1 FROM users WHERE user_id = auth.uid() AND role = 'admin'
          )
        )
    )
  );

CREATE POLICY uploaded_documents_select_own ON uploaded_documents
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY uploaded_documents_insert_own ON uploaded_documents
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM users WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY uploaded_documents_delete_own ON uploaded_documents
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE assistant_chat_sessions IS 'Assistant chat session metadata and summary information';
COMMENT ON TABLE assistant_chat_messages IS 'Stored assistant and user messages for realtime chat history';
COMMENT ON TABLE uploaded_documents IS 'Uploaded file metadata for doctor verification and other attachments';

INSERT INTO schema_migrations (version, description)
VALUES ('003_system_storage_tables', 'Adds assistant chat and uploaded document storage tables')
ON CONFLICT (version) DO NOTHING;