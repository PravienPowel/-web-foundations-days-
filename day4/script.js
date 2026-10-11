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
// ---------- 4. Restore the saved draft when the page loads ----------
const savedDraft = localStorage.getItem(DRAFT_KEY);
if (savedDraft !== null) {
  textarea.value = savedDraft;
}
updateCounts();

// ---------- 5. Clear everything ----------
function clearAll() {
  textarea.value = "";
  localStorage.removeItem(DRAFT_KEY); // remove the saved draft
  updateCounts();                     // counters go back to 0
  textarea.focus();
}

// Clear button
clearBtn.addEventListener("click", clearAll);

// Escape key inside the textarea
textarea.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearAll();
  }
});
// ---------- 6. Dark / light theme ----------
// Restore the saved theme when the page loads
if (localStorage.getItem(THEME_KEY) === "dark") {
  document.body.classList.add("dark");
  themeBtn.textContent = "Light mode";
}

// Switch theme when the button is clicked
themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark"); // add the class if missing, remove it if there

  // Change the button label and save the choice
  if (document.body.classList.contains("dark")) {
    themeBtn.textContent = "Light mode";
    localStorage.setItem(THEME_KEY, "dark");
  } else {
    themeBtn.textContent = "Dark mode";
    localStorage.setItem(THEME_KEY, "light");
  }
});
