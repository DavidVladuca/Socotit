const historyList = document.getElementById('history-list');
const history = JSON.parse(localStorage.getItem('history')) || [];

if (history.length === 0) {
  historyList.innerHTML = "<li>No history yet.</li>";
} else {
  history.forEach(h => {
    const li = document.createElement('li');
    li.textContent = `${h.date} — ${capitalize(h.from)} paid ${capitalize(h.to)} €${h.amount.toFixed(2)}`;
    historyList.appendChild(li);
  });
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
