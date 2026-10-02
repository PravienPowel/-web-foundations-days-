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
  const counts = {};

  for (let i = 0; i < notes.length; i++) {
    const category = notes[i].category;

    if (counts[category] === undefined) {
      // first time we see this category, start at 1
      counts[category] = 1;
    } else {
      // seen it before, add 1
      counts[category] = counts[category] + 1;
    }
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
