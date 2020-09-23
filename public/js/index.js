let transactions = [];
let myChart;
let db;

const request = indexedDB.open('budget_tracker', 1);

request.onupgradeneeded = function(event) {
	const db = event.target.result;
	db.createObjectStore('new_transaction', { autoIncrement: true });
};

request.onsuccess = function(event) {
	db = event.target.result;

	if (navigator.onLine) {
		// saveRecord();
	}
};

request.onerror = function(event) {
	console.log(event.target.errorCode);
};

// on page load
fetch("/api/transaction")
  .then(response => {
    return response.json();
  })
  .then(data => {
    // save db data on global variable
    transactions = data;

    populateTotal();
    populateTable();
    populateChart();
  });

function populateTotal() {
  // reduce transaction amounts to a single total value
  let total = transactions.reduce((total, t) => {
    return total + parseInt(t.value);
  }, 0);

  let totalEl = document.querySelector("#total");
  totalEl.textContent = total;
}

function populateTable() {
  let tbody = document.querySelector("#tbody");
  tbody.innerHTML = "";

  transactions.forEach(transaction => {
    // create and populate a table row
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${transaction.name}</td>
      <td>${transaction.value}</td>
    `;

    tbody.appendChild(tr);
  });
}

function populateChart() {
  // copy array and reverse it
  let reversed = transactions.slice().reverse();
  let sum = 0;

  // create date labels for chart -- horizontal axis
  let labels = reversed.map(t => {
    let date = new Date(t.date);
    // format dates
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  });

  // create incremental values for chart
  let data = reversed.map(t => {
    sum += parseInt(t.value);
    return sum;
  });

  // remove old chart if it exists
  if (myChart) {
    myChart.destroy();
  }

  let ctx = document.getElementById("myChart").getContext("2d");

  myChart = new Chart(ctx, {
    type: 'line',
      data: {
        labels,
        datasets: [{
            label: "Total Over Time",
            fill: true,
            backgroundColor: "#6666ff",
            data
        }]
    }
  });
}

function sendTransaction(isAdding) {
  let nameEl = document.querySelector("#t-name");
  let amountEl = document.querySelector("#t-amount");
  let errorEl = document.querySelector(".form .error");

  // validate form
  if (nameEl.value === "" || amountEl.value === "") {
    errorEl.textContent = "Missing Information";
    return;
  }
  else {
    errorEl.textContent = "";
  }

  // create record
  let transaction = {
    name: nameEl.value,
    value: amountEl.value,
    date: new Date().toISOString()
  };

  // if subtracting funds, convert amount to negative number
  if (!isAdding) {
    transaction.value *= -1;
  }

  // add to beginning of current array of data
  transactions.unshift(transaction);

  // re-run logic to populate ui with new record
  populateChart();
  populateTable();
  populateTotal();
  
  // also send to server
  fetch("/api/transaction", {
    method: "POST",
    body: JSON.stringify(transaction),
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json"
    }
  })
  .then(response => {    
    return response.json();
  })
  .then(data => {
    if (data.errors) {
      errorEl.textContent = "Missing Information";
    }
    else {
      // clear form
      nameEl.value = "";
      amountEl.value = "";
    }
  })
  .catch(err => {
    // fetch failed, so save in indexed db
    saveRecord(transaction);

    // clear form
    nameEl.value = "";
    amountEl.value = "";
  });
}

function saveRecord(record) {
  const transaction = db.transaction([ 'new_transaction'], 'readwrite');

  const transObjectStore = transaction.objectStore('new_transaction');

  transObjectStore.add(record);
}

function uploadTransaction() {
  const transaction = db.transaction([ 'new_transaction' ], 'readwrite');

  const transObjectStore = transaction.objectStore('new_transaction');

  const getAll = transObjectStore.getAll();

  getAll.onsuccess = function() {
    if (getAll.result.length > 0) {
      // make fetch request here.  can reuse sendTransaction but need to handle add/sub
      fetch('/api/transaction', {
        method: 'POST',
        body    : JSON.stringify(getAll.result),
				headers : {
					Accept         : 'application/json, text/plain, */*',
					'Content-Type' : 'application/json'
				}
      })
      .then((response) => response.json())
				.then((serverResponse) => {
					if (serverResponse.message) {
						throw new Error(serverResponse);
					}
					// open one more transaction
					const transaction = db.transaction([ 'new_transaction' ], 'readwrite');
					// access the new_trans object store
					const transObjectStore = transaction.objectStore('new_transaction');
					// clear all items in your store since it's been successfully added to db
					transObjectStore.clear();

					alert('All saved transactions have been submitted');
				})
				.catch((err) => {
					console.log(err);
				});
    }
  }
}

document.querySelector("#add-btn").onclick = function() {
  sendTransaction(true);
};

document.querySelector("#sub-btn").onclick = function() {
  sendTransaction(false);
};

window.addEventListener('online', uploadTransaction);
