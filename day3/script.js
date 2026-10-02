// Our notes data (starting data from the assignment)
let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

// searchNotes: returns the notes whose text contains the word (ignores upper/lower case)
function searchNotes(word) {
  const search = word.toLowerCase();
  return notes.filter((note) => note.text.toLowerCase().includes(search));
}

// Tests for searchNotes
console.log(searchNotes("call"));       // expected: 1 note, "Call mum"
console.log(searchNotes("JAVASCRIPT")); // expected: 1 note, "Revise JavaScript arrays" (case ignored)
console.log(searchNotes("xyz"));        // expected: [] (no results)
// longestNote: returns the note with the most characters, or null if there are no notes
function longestNote() {
  // Handle the empty array first
  if (notes.length === 0) {
    return null;
  }

  // Start by assuming the first note is the longest
  let longest = notes[0];

  // Check the rest of the notes and keep the longer one
  for (let i = 1; i < notes.length; i++) {
    if (notes[i].text.length > longest.text.length) {
      longest = notes[i];
    }
  }

  return longest;
}

// Tests for longestNote
console.log(longestNote()); // expected: the note "Email the project report to Grace" (id 3)

// Edge case: empty array. We swap the array for an empty one, test, then put it back.
const savedNotes = notes;
notes = [];
console.log(longestNote()); // expected: null
notes = savedNotes;
// countByCategory: returns an object counting notes per category
function countByCategory() {
  // Start every category at 0 so none are missing
  const counts = { personal: 0, work: 0, study: 0 };

  for (let i = 0; i < notes.length; i++) {
    counts[notes[i].category] = counts[notes[i].category] + 1;
  }

  return counts;
}

// Tests for countByCategory
console.log(countByCategory()); // expected: { personal: 2, study: 2, work: 1 }

// Edge case: empty array
const savedNotes2 = notes;
notes = [];
console.log(countByCategory()); // expected: {} (empty object)
notes = savedNotes2;
// getSummary: returns a sentence like "5 notes: 2 personal, 1 work, 2 study."
function getSummary() {
  const counts = countByCategory();

  // If a category has no notes it won't be in counts, so use 0 instead
  const personal = counts.personal || 0;
  const work = counts.work || 0;
  const study = counts.study || 0;

  // Use "note" for exactly one note, "notes" for everything else
  let word = "notes";
  if (notes.length === 1) {
    word = "note";
  }

  return `${notes.length} ${word}: ${personal} personal, ${work} work, ${study} study.`;
}

// Tests for getSummary
console.log(getSummary()); // expected: "5 notes: 2 personal, 1 work, 2 study."

// Edge case: exactly one note
const savedNotes3 = notes;
notes = [notes[0]];
console.log(getSummary()); // expected: "1 note: 1 personal, 0 work, 0 study."
notes = savedNotes3;
// isDuplicate: true if a note with the same text already exists
// (ignores upper/lower case and extra spaces at the start and end)
function isDuplicate(text) {
  const cleaned = text.trim().toLowerCase();
  return notes.some((note) => note.text.trim().toLowerCase() === cleaned);
}

// Tests for isDuplicate
console.log(isDuplicate("call mum"));      // expected: true (same text, different case)
console.log(isDuplicate("  CALL MUM  "));  // expected: true (extra spaces and capitals ignored)
console.log(isDuplicate("Learn arrays"));  // expected: false (not in the list)
// addNote: adds a note only if the text is 1-200 characters, not a duplicate,
// and the category is personal, work or study.
// Returns true when added, false otherwise (and logs the reason).
function addNote(text, category) {
  const cleaned = text.trim();

  // Check the length
  if (cleaned.length < 1 || cleaned.length > 200) {
    console.log("Rejected: note must be 1-200 characters.");
    return false;
  }

  // Check for a duplicate
  if (isDuplicate(cleaned)) {
    console.log("Rejected: that note already exists.");
    return false;
  }

  // Check the category
  const allowed = ["personal", "work", "study"];
  if (!allowed.includes(category)) {
    console.log("Rejected: category must be personal, work or study.");
    return false;
  }

  // All good, add the note
  notes.push({
    id: Date.now(), // a simple unique id
    text: cleaned,
    category: category,
  });
  console.log("Added: " + cleaned);
  return true;
}

// Tests for addNote
console.log(addNote("Learn arrays", "study"));   // expected: Added message, then true
console.log(addNote("call mum", "personal"));    // expected: Rejected (duplicate), then false
console.log(addNote("   ", "work"));             // expected: Rejected (1-200 characters), then false
console.log(addNote("a".repeat(201), "work"));   // expected: Rejected (1-200 characters), then false
console.log(addNote("Pay rent", "holiday"));     // expected: Rejected (bad category), then false
console.log(getSummary());                       // expected: "6 notes: 2 personal, 1 work, 3 study."
