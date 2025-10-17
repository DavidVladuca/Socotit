const input = document.getElementById('photo-input');
const status = document.getElementById('status');
const itemsDiv = document.getElementById('items');
const confirmBtn = document.getElementById('confirm');
const selectedSumEl = document.getElementById('selected-sum');
const receiptSumEl = document.getElementById('receipt-sum');

let detectedItems = [];
let receiptTotal = 0;

const translationCache = JSON.parse(localStorage.getItem('translationCache') || "{}");

input.addEventListener('change', async () => {
  const file = input.files[0];
  if (!file) return;

  status.textContent = "⏳ Reading receipt...";
  const { data: { text } } = await Tesseract.recognize(file, 'nld+eng');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  detectedItems = [];
  receiptTotal = 0;
  let lastItem = null;

  const normalPrice = /^([A-Za-zÀ-ÿ0-9\s\.\-\(\)\/]+?)\s+(\d+[.,]\d{2})\s*[A-Z]?$/;
  const qtyPrice = /^([A-Za-zÀ-ÿ0-9\s\.\-\(\)\/]+?)\s+(\d+[.,]?\d*)\s*[xX]\s*(\d+[.,]\d{2})/;

  for (let line of lines) {
    if (/AANTAL|Aantal|Bankpas|EUR|Customer|Bon|Kassa|Betaal|TE BETALEN/i.test(line))
      continue;

    if (/Totaal|TOTAAL|Total/i.test(line)) {
      const num = line.match(/(\d+[.,]\d{2})/);
      if (num) receiptTotal = parseFloat(num[1].replace(',', '.'));
      continue;
    }

    // Detect Lidl discount lines (offers)
    if (/Actieprijs|Lidl Plus korting|In prijs verlaagd/i.test(line)) {
    const discountMatch = line.match(/(-?\d+[.,]\d{2})/);
    if (discountMatch && lastItem) {
        const discountValue = Math.abs(parseFloat(discountMatch[1].replace(',', '.')));
        lastItem.discount = (lastItem.discount || 0) + discountValue;
        lastItem.finalPrice = Math.max(lastItem.finalPrice - discountValue, 0);
    }
    continue;
    }

    const qtyMatch = line.match(qtyPrice);
    if (qtyMatch) {
      const name = qtyMatch[1].trim();
      const qty = parseFloat(qtyMatch[2].replace(',', '.'));
      const unit = parseFloat(qtyMatch[3].replace(',', '.'));
      if (!isNaN(qty) && !isNaN(unit)) {
        const totalPrice = qty * unit;
        const item = {
          nl: name,
          en: null,
          price: totalPrice,
          discount: 0,
          finalPrice: totalPrice,
          fraction: 1.0,
          link: getLidlLink(name)
        };
        detectedItems.push(item);
        lastItem = item;
        continue;
      }
    }

    const prodMatch = line.match(normalPrice);
    if (prodMatch) {
      const name = prodMatch[1].trim();
      const price = parseFloat(prodMatch[2].replace(',', '.'));
      if (isNaN(price) || price <= 0) continue;

      const item = {
        nl: name,
        en: null,
        price,
        discount: 0,
        finalPrice: price,
        fraction: 1.0,
        link: getLidlLink(name)
      };
      detectedItems.push(item);
      lastItem = item;
    }
  }

  receiptSumEl.textContent = receiptTotal > 0
    ? receiptTotal.toFixed(2)
    : detectedItems.reduce((a, b) => a + b.finalPrice, 0).toFixed(2);

  if (detectedItems.length === 0) {
    status.textContent = "⚠️ No items detected.";
    return;
  }

  status.textContent = `✅ Found ${detectedItems.length} items. Translating...`;
  await translateItems(detectedItems);
  renderItems();
  confirmBtn.disabled = false;
  status.textContent = "✅ Ready to select items.";
});

function getLidlLink(name) {
  const query = encodeURIComponent(`${name} site:lidl.nl`);
  return `https://www.google.com/search?q=${query}`;
}

async function translateItems(items) {
  for (const item of items) {
    if (translationCache[item.nl]) {
      item.en = translationCache[item.nl];
      continue;
    }
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(item.nl)}&langpair=nl|en`;
      const resp = await fetch(url);
      const data = await resp.json();
      item.en = data.responseData.translatedText || item.nl;
      translationCache[item.nl] = item.en;
    } catch {
      item.en = item.nl;
    }
  }
  localStorage.setItem('translationCache', JSON.stringify(translationCache));
}

function renderItems() {
  itemsDiv.innerHTML = "<h3>Select items for the other person:</h3>";
  detectedItems.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = "item-row";

    const discountText =
      item.discount > 0
        ? ` (€${item.price.toFixed(2)} − €${item.discount.toFixed(2)} = €${item.finalPrice.toFixed(2)})`
        : ` (€${item.finalPrice.toFixed(2)})`;

    div.innerHTML = `
      <input type="checkbox" id="item${idx}">
      <label for="item${idx}">
        ${item.nl} → ${item.en}${discountText}
        <a href="${item.link}" target="_blank">🔗</a>
        <button title="Set fraction" class="fraction-btn" data-idx="${idx}">⚖️</button>
        <span class="fraction-info" id="fracInfo${idx}" style="margin-left:4px; color:#555;"></span>
      </label>
    `;
    itemsDiv.appendChild(div);

    const checkbox = document.getElementById(`item${idx}`);
    checkbox.addEventListener('change', () => {
    const row = checkbox.closest('.item-row');
    if (checkbox.checked) row.classList.add('checked');
    else row.classList.remove('checked');
    updateSelectedSum();
    });

  });

  // fraction buttons
  document.querySelectorAll('.fraction-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = e.target.dataset.idx;
      const val = prompt("Enter fraction (e.g. 0.5, 2/3, or 1):", detectedItems[idx].fraction);
      if (val) {
        let frac = parseFraction(val);
        if (!isNaN(frac) && frac > 0 && frac <= 5) {
          detectedItems[idx].fraction = frac;
          updateFractionInfo(idx);
          updateSelectedSum();
        } else alert("Invalid fraction. Enter a positive number.");
      }
    });
  });

  updateSelectedSum();
}

function parseFraction(str) {
  if (str.includes('/')) {
    const [a, b] = str.split('/').map(Number);
    return b ? a / b : NaN;
  }
  return parseFloat(str);
}

function updateFractionInfo(idx) {
  const item = detectedItems[idx];
  const percent = (item.fraction * 100).toFixed(0);
  const portion = (item.finalPrice * item.fraction).toFixed(2);
  const span = document.getElementById(`fracInfo${idx}`);
  span.textContent = `${percent}% → €${portion}`;
}

function updateSelectedSum() {
  let total = 0;
  detectedItems.forEach((item, idx) => {
    const cb = document.getElementById(`item${idx}`);
    if (cb && cb.checked) total += item.finalPrice * item.fraction;
    updateFractionInfo(idx); // update info live
  });
  selectedSumEl.textContent = total.toFixed(2);
}

confirmBtn.addEventListener('click', () => {
  const payer = document.getElementById('payer').value;
  const debts = JSON.parse(localStorage.getItem('debts')) || { david: [], popa: [] };

  let selectedTotal = 0;
  detectedItems.forEach((item, idx) => {
    const cb = document.getElementById(`item${idx}`);
    if (cb && cb.checked) selectedTotal += item.finalPrice * item.fraction;
  });

  if (selectedTotal === 0) return alert("No items selected.");

  const other = payer === 'david' ? 'popa' : 'david';
  debts[other].push({
    amount: selectedTotal,
    date: new Date().toLocaleDateString(),
    note: `Lidl receipt (€${receiptTotal.toFixed(2)} total)`
  });

  localStorage.setItem('debts', JSON.stringify(debts));
  alert(`✅ Added €${selectedTotal.toFixed(2)} to ${other}'s debts.`);
  window.location = "index.html";
});