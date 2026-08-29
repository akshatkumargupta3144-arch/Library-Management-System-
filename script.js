// --- INITIAL STATE ---
const initialBooks = [
  { id: 101, title: "Clean Code", author: "Robert C. Martin", isbn: "978-0132350884", status: "Available" },
  { id: 102, title: "The Pragmatic Programmer", author: "Andrew Hunt", isbn: "978-0201616224", status: "Available" },
  { id: 103, title: "Design Patterns", author: "Erich Gamma", isbn: "978-0201633610", status: "Available" }
];

const initialMembers = [
  { id: 1001, name: "Alex Johnson", email: "alex@example.com" },
  { id: 1002, name: "Sophia Chen", email: "sophia@example.com" }
];

let books = JSON.parse(localStorage.getItem('lms_books')) || initialBooks;
let members = JSON.parse(localStorage.getItem('lms_members')) || initialMembers;
let transactions = JSON.parse(localStorage.getItem('lms_transactions')) || [];
let currentPendingReturnId = null;

function saveData() {
  localStorage.setItem('lms_books', JSON.stringify(books));
  localStorage.setItem('lms_members', JSON.stringify(members));
  localStorage.setItem('lms_transactions', JSON.stringify(transactions));
  renderAll();
}

// --- UI & THEME TOGGLES ---
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function toggleDarkMode() {
  const isDark = document.body.getAttribute('data-theme') === 'dark';
  document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
}

function showSection(sectionId) {
  document.querySelectorAll('.section').forEach(sec => sec.style.display = 'none');
  document.querySelectorAll('.sidebar .nav-btn').forEach(btn => btn.classList.remove('active'));

  const target = document.getElementById(sectionId);
  if (target) target.style.display = 'block';

  const activeBtn = Array.from(document.querySelectorAll('.sidebar .nav-btn'))
    .find(btn => btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(sectionId));
  if (activeBtn) activeBtn.classList.add('active');

  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

// --- FINE SYSTEM & CALCULATIONS ---
function getFineAmount(issueDateStr) {
  const issueDate = new Date(issueDateStr);
  const diffDays = Math.ceil(Math.abs(new Date() - issueDate) / (1000 * 60 * 60 * 24));
  return diffDays > 14 ? (diffDays - 14) * 1 : 0;
}

function getDueDate(issueDateStr) {
  const d = new Date(issueDateStr);
  d.setDate(d.getDate() + 14);
  return d.toLocaleDateString();
}

// --- BOOKS CRUD ---
function addBook(e) {
  e.preventDefault();
  const title = document.getElementById('book-title').value.trim();
  const author = document.getElementById('book-author').value.trim();
  const isbn = document.getElementById('book-isbn').value.trim();

  books.push({ id: Date.now(), title, author, isbn, status: 'Available' });
  document.getElementById('book-form').reset();
  saveData();
}

function deleteBook(id) {
  books = books.filter(b => b.id !== id);
  saveData();
}

// --- MEMBERS CRUD ---
function addMember(e) {
  e.preventDefault();
  const name = document.getElementById('member-name').value.trim();
  const email = document.getElementById('member-email').value.trim();

  members.push({ id: Date.now(), name, email });
  document.getElementById('member-form').reset();
  saveData();
}

function deleteMember(id) {
  members = members.filter(m => m.id !== id);
  saveData();
}

// --- ISSUE & RETURN SYSTEM WITH MODAL ---
function issueBook(e) {
  e.preventDefault();
  const bookId = Number(document.getElementById('issue-book-select').value);
  const memberId = Number(document.getElementById('issue-member-select').value);

  const book = books.find(b => b.id === bookId);
  const member = members.find(m => m.id === memberId);

  if (!book || !member || book.status === 'Issued') return;

  book.status = 'Issued';
  transactions.push({
    id: Date.now(),
    bookId: book.id,
    bookTitle: book.title,
    memberId: member.id,
    memberName: member.name,
    issueDate: new Date().toLocaleDateString(),
    rawIssueDate: new Date().toISOString(),
    returned: false
  });

  document.getElementById('issue-form').reset();
  saveData();
}

function initiateReturn(transactionId) {
  const trans = transactions.find(t => t.id === transactionId);
  if (!trans) return;

  const fine = getFineAmount(trans.rawIssueDate);
  if (fine > 0) {
    currentPendingReturnId = transactionId;
    document.getElementById('modal-fine-text').textContent = 
      `Member ${trans.memberName} owes a fine of $${fine}.00 for late return. Confirm payment to complete return.`;
    document.getElementById('confirm-pay-btn').onclick = () => processReturn(transactionId);
    document.getElementById('fine-modal').style.display = 'flex';
  } else {
    processReturn(transactionId);
  }
}

function processReturn(transactionId) {
  const trans = transactions.find(t => t.id === transactionId);
  if (!trans) return;

  trans.returned = true;
  const book = books.find(b => b.id === trans.bookId);
  if (book) book.status = 'Available';

  closeFineModal();
  saveData();
}

function closeFineModal() {
  document.getElementById('fine-modal').style.display = 'none';
}

// --- DATA EXPORT FEATURE ---
function exportData(format) {
  const dataStr = format === 'csv' ? convertToCSV(books) : JSON.stringify(books, null, 2);
  const blob = new Blob([dataStr], { type: format === 'csv' ? 'text/csv' : 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `library_books.${format}`;
  a.click();
}

function convertToCSV(arr) {
  const keys = Object.keys(arr[0] || {});
  return [keys.join(','), ...arr.map(row => keys.map(k => `"${row[k]}"`).join(','))].join('\n');
}

// --- RENDER FUNCTIONS ---
function renderAll() {
  renderBooks();
  renderMembers();
  renderIssueDropdowns();
  renderTransactions();
  renderStats();
}

function renderBooks() {
  const tbody = document.getElementById('books-table-body');
  const searchVal = (document.getElementById('search-book')?.value || '').toLowerCase();
  const statusVal = document.getElementById('filter-book-status')?.value || 'ALL';

  if (!tbody) return;

  const filtered = books.filter(b => {
    const matchesSearch = b.title.toLowerCase().includes(searchVal) || b.author.toLowerCase().includes(searchVal);
    const matchesStatus = statusVal === 'ALL' || b.status === statusVal;
    return matchesSearch && matchesStatus;
  });

  tbody.innerHTML = filtered.map(b => `
    <tr>
      <td>#${b.id}</td>
      <td><strong>${b.title}</strong></td>
      <td>${b.author}</td>
      <td><code>${b.isbn}</code></td>
      <td><span class="badge ${b.status === 'Available' ? 'badge-available' : 'badge-issued'}">${b.status}</span></td>
      <td><button onclick="deleteBook(${b.id})">Delete</button></td>
    </tr>
  `).join('');
}

function renderMembers() {
  const tbody = document.getElementById('members-table-body');
  const searchVal = (document.getElementById('search-member')?.value || '').toLowerCase();
  if (!tbody) return;

  const filtered = members.filter(m => m.name.toLowerCase().includes(searchVal) || m.email.toLowerCase().includes(searchVal));

  tbody.innerHTML = filtered.map(m => `
    <tr>
      <td>#${m.id}</td>
      <td><strong>${m.name}</strong></td>
      <td>${m.email}</td>
      <td><button onclick="deleteMember(${m.id})">Delete</button></td>
    </tr>
  `).join('');
}

function renderIssueDropdowns() {
  const bookSelect = document.getElementById('issue-book-select');
  const memberSelect = document.getElementById('issue-member-select');

  if (!bookSelect || !memberSelect) return;

  const avail = books.filter(b => b.status === 'Available');
  bookSelect.innerHTML = '<option value="">Select Available Book</option>' + avail.map(b => `<option value="${b.id}">${b.title}</option>`).join('');
  memberSelect.innerHTML = '<option value="">Select Member</option>' + members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
}

function renderTransactions() {
  const issuedBody = document.getElementById('issued-table-body');
  const recentBody = document.getElementById('recent-issues-table');

  const activeTrans = transactions.filter(t => !t.returned);

  if (issuedBody) {
    issuedBody.innerHTML = activeTrans.map(t => {
      const fine = getFineAmount(t.rawIssueDate);
      return `
        <tr>
          <td><strong>${t.bookTitle}</strong></td>
          <td>${t.memberName}</td>
          <td>${t.issueDate}</td>
          <td>${getDueDate(t.rawIssueDate)}</td>
          <td><strong style="color:${fine > 0 ? '#ef4444' : 'inherit'};">$${fine}.00</strong></td>
          <td><button class="btn-primary" onclick="initiateReturn(${t.id})">Return</button></td>
        </tr>
      `;
    }).join('');
  }

  if (recentBody) {
    recentBody.innerHTML = transactions.slice(-5).reverse().map(t => `
      <tr>
        <td><strong>${t.bookTitle}</strong></td>
        <td>${t.memberName}</td>
        <td>${t.issueDate}</td>
        <td>${getDueDate(t.rawIssueDate)}</td>
        <td><span class="badge ${t.returned ? 'badge-available' : 'badge-issued'}">${t.returned ? 'Returned' : 'Issued'}</span></td>
      </tr>
    `).join('');
  }
}

function renderStats() {
  document.getElementById('stat-total-books').textContent = books.length;
  document.getElementById('stat-issued-books').textContent = books.filter(b => b.status === 'Issued').length;
  document.getElementById('stat-total-members').textContent = members.length;
  
  const overdueCount = transactions.filter(t => !t.returned && getFineAmount(t.rawIssueDate) > 0).length;
  document.getElementById('stat-overdue-books').textContent = overdueCount;
}

document.addEventListener('DOMContentLoaded', () => {
  renderAll();
  showSection('dashboard');
});



const API_URL = 'http://localhost:5000/api';
let isRegisterMode = false;

function toggleAuthMode() {
  isRegisterMode = !isRegisterMode;
  document.getElementById('auth-title').textContent = isRegisterMode ? 'Register Admin' : 'Admin Login';
  document.getElementById('auth-btn').textContent = isRegisterMode ? 'Register' : 'Login';
  document.getElementById('auth-toggle').textContent = isRegisterMode ? 'Already have an account? Login' : "Don't have an account? Register";
}

async function handleAuth(e) {
  e.preventDefault();
  const username = document.getElementById('auth-username').value;
  const password = document.getElementById('auth-password').value;
  const endpoint = isRegisterMode ? '/register' : '/login';

  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();
  if (res.ok) {
    if (isRegisterMode) {
      alert('Registration successful! Please login.');
      toggleAuthMode();
    } else {
      localStorage.setItem('lms_token', data.token);
      document.getElementById('auth-modal').style.display = 'none';
      loadBackendData();
    }
  } else {
    alert(data.message);
  }
}

async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('lms_token');
  if (!token) {
    document.getElementById('auth-modal').style.display = 'flex';
    return;
  }
  options.headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
  return fetch(url, options);
}