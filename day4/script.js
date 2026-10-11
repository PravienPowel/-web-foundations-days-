// ---------- 1. Select the elements ----------
const textarea = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const clearBtn = document.querySelector("#clear-btn");
const themeBtn = document.querySelector("#theme-toggle");

// Names we use to save things in localStorage
const DRAFT_KEY = "draft";
const THEME_KEY = "theme";

// ---------- 2. Update both counters and the warning colours ----------
function updateCounts() {
  const text = textarea.value;
  const chars = text.length;

  // Count words: split on spaces, but an empty box means 0 words
  const trimmed = text.trim();
  let words = 0;
  if (trimmed !== "") {
    words = trimmed.split(/\s+/).length;
  }

  charCount.textContent = `${chars} / 200 characters`;
  wordCount.textContent = `${words} words`;

  // Remove both classes first, then add the right one
  charCount.classList.remove("warning");
  charCount.classList.remove("over");
  if (chars > 200) {
    charCount.classList.add("over");
  } else if (chars > 180) {
    charCount.classList.add("warning");
  }
}

// ---------- 3. Every time the user types ----------
textarea.addEventListener("input", () => {
  updateCounts();
  localStorage.setItem(DRAFT_KEY, textarea.value); // save the draft
});
