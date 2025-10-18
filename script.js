import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const dataRef = doc(window.db, "soco-data", "shared");
let debts = { david: [], popa: [] };
let history = [];

async function loadData() {
  const snap = await getDoc(dataRef);
  if (snap.exists()) {
    const data = snap.data();
    debts = data.debts || debts;
    history = data.history || history;
  }
  render();
}

async function saveData() {
  await setDoc(dataRef, { debts, history });
}

function render() {
  ['david', 'popa'].forEach(person => {
    const list = document.getElementById(`${person}-list`);
    list.innerHTML = '';
    let total = 0;

    debts[person].forEach((entry, index) => {
      const li = document.createElement('li');
      li.innerHTML = `
        ${entry.date} — €${entry.amount.toFixed(2)} 
        ${entry.note ? `<small>(${entry.note})</small>` : ''}
        <button class="delete-btn" onclick="deleteDebt('${person}', ${index})">❌</button>
      `;
      list.appendChild(li);
      total += entry.amount;
    });

    document.getElementById(`${person}-total`).textContent = total.toFixed(2);
  });

  saveData();
}

function addDebt(person) {
  const value = parseFloat(prompt("Enter amount (€):"));
  if (!isNaN(value) && value > 0) {
    debts[person].push({ amount: value, date: new Date().toLocaleDateString() });
    render();
  }
}

function deleteDebt(person, index) {
  if (confirm("Delete this debt entry?")) {
    debts[person].splice(index, 1);
    render();
  }
}

function resetDebts(person) {
  const total = debts[person].reduce((sum, e) => sum + e.amount, 0);
  if (total === 0) return alert("No debts to reset.");

  const other = person === 'david' ? 'popa' : 'david';
  history.push({
    date: new Date().toLocaleDateString(),
    from: person,
    to: other,
    amount: total
  });

  debts[person] = [];
  render();
}

loadData();

window.addDebt = addDebt;
window.resetDebts = resetDebts;
window.deleteDebt = deleteDebt;