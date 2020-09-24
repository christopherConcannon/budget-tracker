let db;

// establish db connection
const request = indexedDB.open('budget_tracker', 1);

// create object store and cache in db
request.onupgradeneeded = function(event) {
	const db = event.target.result;
	db.createObjectStore('new_transaction', { autoIncrement: true });
};

// when connection to db (in onupgradeneeded) is established store reference in global db
request.onsuccess = function(event) {
	db = event.target.result;

  // each time app is loaded, check if app is online, upload saved transactions
	if (navigator.onLine) {
		uploadTransaction();
	}
};

request.onerror = function(event) {
	console.log(event.target.errorCode);
};


// save to indexDb when no internet connection
function saveRecord(record) {
  // open new transaction
  const transaction = db.transaction([ 'new_transaction'], 'readwrite');
  // access object store
  const transObjectStore = transaction.objectStore('new_transaction');
  // add record to object store
  transObjectStore.add(record);
}

// upload indexDB data to server mongoDB once internet connection is reestablished 
function uploadTransaction() {
  // open new transaction with db
  const transaction = db.transaction([ 'new_transaction' ], 'readwrite');

  // get reference to object store
  const transObjectStore = transaction.objectStore('new_transaction');

  // method to get all records
  const getAll = transObjectStore.getAll();

  // on success the .results property will hold the array of data
  getAll.onsuccess = function() {
    if (getAll.result.length > 0) {
      fetch('/api/transaction/bulk', {
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
          
					// if successful, open one more transaction
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

// if outage is temporary, and user has not navigated away, upload when it comes back online
window.addEventListener('online', uploadTransaction);