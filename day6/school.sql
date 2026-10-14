-- Day 6: School database (students, courses, enrolments)

PRAGMA foreign_keys = ON;

-- 1. TABLES

CREATE TABLE students (
  id     INTEGER PRIMARY KEY,
  name   TEXT NOT NULL,
  email  TEXT NOT NULL UNIQUE      -- no two students share an email
);

CREATE TABLE courses (
  id       INTEGER PRIMARY KEY,
  title    TEXT NOT NULL,
  credits  INTEGER NOT NULL DEFAULT 3
);

-- join table: one row = one student on one course
CREATE TABLE enrolments (
  id          INTEGER PRIMARY KEY,
  student_id  INTEGER NOT NULL,
  course_id   INTEGER NOT NULL,
  grade       INTEGER CHECK (grade BETWEEN 0 AND 100),  -- empty until marked
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id)  REFERENCES courses(id)  ON DELETE CASCADE,
  UNIQUE (student_id, course_id)   -- same student can't join the same course twice
);

-- 2. SAMPLE DATA

INSERT INTO students (name, email) VALUES
  ('Amina Otieno', 'amina@example.com'),
  ('Brian Kamau',  'brian@example.com'),
  ('Cynthia Wanjiru', 'cynthia@example.com'),
  ('David Mwangi', 'david@example.com');

INSERT INTO courses (title, credits) VALUES
  ('Web Development', 4),
  ('Databases', 3),
  ('Networking', 3);

INSERT INTO enrolments (student_id, course_id, grade) VALUES
  (1, 1, 78),
  (1, 2, 85),
  (2, 1, 64),
  (2, 3, NULL),
  (3, 2, 90),
  (3, 1, NULL);

-- David (id 4) has no enrolments on purpose, for query 4.

-- 3. QUERIES

-- Query 1: all courses for one student (by name)
SELECT courses.title, enrolments.grade
FROM students
JOIN enrolments ON enrolments.student_id = students.id
JOIN courses    ON enrolments.course_id  = courses.id
WHERE students.name = 'Amina Otieno';

-- Query 2: all students on one course
SELECT students.name, students.email
FROM courses
JOIN enrolments ON enrolments.course_id  = courses.id
JOIN students   ON enrolments.student_id = students.id
WHERE courses.title = 'Web Development';

-- Query 3: number of students per course
-- LEFT JOIN so a course with 0 students still shows up
SELECT courses.title, COUNT(enrolments.id) AS student_count
FROM courses
LEFT JOIN enrolments ON enrolments.course_id = courses.id
GROUP BY courses.id, courses.title;

-- Query 4: students who have no enrolments
SELECT students.name, students.email
FROM students
LEFT JOIN enrolments ON enrolments.student_id = students.id
WHERE enrolments.id IS NULL;

-- Query 5: update one enrolment's grade (Brian's Networking grade)
UPDATE enrolments
SET grade = 72
WHERE student_id = 2 AND course_id = 3;

-- check the update worked
SELECT * FROM enrolments WHERE student_id = 2 AND course_id = 3;
