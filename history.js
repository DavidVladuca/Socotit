import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const dataRef = doc(window.db, "soco-data", "shared");
const historyList = document.getElementById('history-list');

async function loadHistory() {
  const snap = await getDoc(dataRef);
  if (!snap.exists()) {
    historyList.innerHTML = "<li>No history yet.</li>";
    return;
  }

  const data = snap.data();
  const history = data.history || [];

  if (history.length === 0) {
    historyList.innerHTML = "<li>No history yet.</li>";
  } else {
    historyList.innerHTML = "";
    history.forEach(h => {
      const li = document.createElement("li");
      li.textContent = `${h.date} — ${capitalize(h.from)} paid ${capitalize(h.to)} €${h.amount.toFixed(2)}`;
      historyList.appendChild(li);
    });
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

loadHistory();
