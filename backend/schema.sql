CREATE TABLE users(id SERIAL PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT, role TEXT, active BOOLEAN DEFAULT true);
CREATE TABLE reports(id SERIAL PRIMARY KEY, title TEXT, content TEXT, author_id INT);
CREATE TABLE analysis(id SERIAL PRIMARY KEY, title TEXT, content TEXT, author_id INT);
CREATE TABLE audit_logs(id SERIAL PRIMARY KEY, user_id INT, action TEXT, created_at TIMESTAMP DEFAULT now());