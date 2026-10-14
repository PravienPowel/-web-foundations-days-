# School database design

## The tables

**students** stores one row per student: an id, their name and their email.
The email is UNIQUE so two students can't register with the same one.

**courses** stores one row per course: an id, the title and the credits.

**enrolments** stores the fact that a student is on a course. Each row has
a student_id, a course_id and a grade. The grade can be empty until the
student is marked. There is a UNIQUE rule on (student_id, course_id) so the
same student can't enrol on the same course twice.

## Relationships

- One student has many enrolments, and one course has many enrolments.
  Each of these is **one-to-many**, and the enrolments table holds the
  foreign keys (student_id and course_id).
- Between students and courses the relationship is **many-to-many**: a
  student can take many courses, and a course has many students.

A join table is needed because a single column can't hold a list of ids
cleanly (like "1,2,3"), which is hard to search and update. The enrolments
table solves this by storing one row per pair. It is also the right place
for the grade, because the grade belongs to the pair (this student on this
course), not to the student or the course alone.

## Index

I would add an index on enrolments(course_id):

CREATE INDEX idx_enrolments_course_id ON enrolments(course_id);

The UNIQUE rule already gives an index that helps when searching by
student_id first, but looking up "all students on a course" or counting
students per course searches by course_id. With thousands of enrolments,
the index lets the database jump straight to the right rows instead of
reading the whole table. The cost is that inserts are slightly slower, which
is fine here because we read enrolments far more often than we write them.

## SQL or NoSQL?

I would choose SQL (for example SQLite or PostgreSQL). The data is clearly
structured and full of relationships: students, courses and enrolments all
link to each other, and I need JOINs to answer questions like "which
students are on this course?". SQL also enforces the rules for me, such as
a unique email and no duplicate enrolments, and grades are the kind of data
where being correct matters. A document database could store everything in
one document per student, but then course details would be copied in many
places and updating a course title would be messy.
