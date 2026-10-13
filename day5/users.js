// ---------- 1. Select the elements ----------
const loadBtn = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const statusMessage = document.querySelector("#status");
const usersList = document.querySelector("#users-list");

const API_URL = "https://jsonplaceholder.typicode.com/users";

// ---------- 2. The loaded users are stored here ----------
let users = [];

// ---------- 3. Draw any list of users on the page ----------
function renderUsers(list) {
  usersList.innerHTML = ""; // clear the old list

  // Users were loaded but none match the filter
  if (list.length === 0 && users.length > 0) {
    const message = document.createElement("li");
    message.textContent = "No users match your filter.";
    usersList.appendChild(message);
    return;
  }

  list.forEach((user) => {
    const li = document.createElement("li");

    const name = document.createElement("strong");
    name.textContent = user.name;

    const email = document.createElement("p");
    email.textContent = "Email: " + user.email;

    const city = document.createElement("p");
    city.textContent = "City: " + user.address.city;

    const company = document.createElement("p");
    company.textContent = "Company: " + user.company.name;

    li.appendChild(name);
    li.appendChild(email);
    li.appendChild(city);
    li.appendChild(company);
    usersList.appendChild(li);
  });
}

// ---------- 4. Show only the users that match the filter box ----------
function applyFilter() {
  const searchText = filterInput.value.trim().toLowerCase();

  // filter the stored array: no new request is made
  const matches = users.filter((user) =>
    user.name.toLowerCase().includes(searchText)
  );

  renderUsers(matches);
}

// ---------- 5. Load the users from the API ----------
async function loadUsers() {
  // Loading state
  statusMessage.textContent = "Loading users...";
  loadBtn.disabled = true;

  try {
    const response = await fetch(API_URL);

    // fetch does not throw on 404 or 500, so we check response.ok
    if (!response.ok) {
      throw new Error("Server responded with status " + response.status);
    }

    users = await response.json();
    applyFilter(); // draw the users (respects the filter box)

    // Success state
    statusMessage.textContent = "Loaded " + users.length + " users.";
  } catch (error) {
    // Error state (network failure or bad status)
    statusMessage.textContent = "Could not load users. Please try again.";
    console.error("Load failed:", error.message);
  } finally {
    // Runs whether it worked or failed
    loadBtn.disabled = false;
  }
}

// ---------- 6. Listen for the button and the filter box ----------
loadBtn.addEventListener("click", loadUsers);
filterInput.addEventListener("input", applyFilter);
