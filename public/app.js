const BASE_URL = "https://vtu-hub-sigma.vercel.app/api";
let currentUser = null;
let balanceInterval = null;

// -------------------- TABS --------------------
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.target).classList.add('active');
  });
});

// -------------------- NETWORKS & DATA PLANS --------------------
async function loadNetworks() {
  const res = await fetch(`${BASE_URL}/networks`);
  const data = await res.json();
  if(data.success && data.networks){
    const airtimeNetwork = document.getElementById('airtimeNetwork');
    const dataNetwork = document.getElementById('dataNetwork');
    airtimeNetwork.innerHTML = '';
    dataNetwork.innerHTML = '';
    data.networks.forEach(net => {
      const option1 = document.createElement('option'); option1.value = net; option1.innerText = net; airtimeNetwork.appendChild(option1);
      const option2 = document.createElement('option'); option2.value = net; option2.innerText = net; dataNetwork.appendChild(option2);
    });
    loadDataPlans();
  }
}

async function loadDataPlans() {
  const network = document.getElementById('dataNetwork').value;
  const res = await fetch(`${BASE_URL}/data-plans/${network}`);
  const data = await res.json();
  const dataPlan = document.getElementById('dataPlan');
  dataPlan.innerHTML = '';
  if(data.success && data.plans){
    data.plans.forEach(plan => {
      const option = document.createElement('option'); option.value = plan; option.innerText = plan; dataPlan.appendChild(option);
    });
  }
}
document.getElementById('dataNetwork').addEventListener('change', loadDataPlans);

// -------------------- REGISTER --------------------
async function registerUser() {
  const res = await fetch(`${BASE_URL}/register`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      name: document.getElementById('regName').value,
      email: document.getElementById('regEmail').value,
      phone: document.getElementById('regPhone').value,
      password: document.getElementById('regPassword').value
    })
  });
  const data = await res.json();
  document.getElementById('regResult').innerText = JSON.stringify(data, null, 2);
  if(data.success) alert(`Registration successful! Your bonus: ₦${data.balance}`);
}

// -------------------- LOGIN --------------------
async function loginUser() {
  const res = await fetch(`${BASE_URL}/login`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      email: document.getElementById('loginEmail').value,
      password: document.getElementById('loginPassword').value
    })
  });
  const data = await res.json();
  document.getElementById('loginResult').innerText = JSON.stringify(data, null, 2);

  if(data.success){
    currentUser = data.userId;
    localStorage.setItem('token', data.token); // save JWT
    document.getElementById('welcomeMessage').innerText = `Welcome, ${data.name}`;
    document.getElementById('logoutBtn').style.display='inline';
    startAutoRefresh();
  }
}

// -------------------- LOGOUT --------------------
function logoutUser(){
  currentUser = null;
  localStorage.removeItem('token');
  document.getElementById('welcomeMessage').innerText='';
  document.getElementById('logoutBtn').style.display='none';
  stopAutoRefresh();
  alert("Logged out!");
}

// -------------------- BALANCE --------------------
async function loadBalance(){
  if(!currentUser) return;
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE_URL}/balance/${currentUser}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  document.getElementById('balanceResult').innerText = JSON.stringify(data,null,2);
}

// -------------------- AIRTIME --------------------
async function buyAirtime(){
  if(!currentUser) return alert("Please login first!");
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE_URL}/buy-airtime`, {
    method:'POST',
    headers:{'Content-Type':'application/json', 'Authorization': `Bearer ${token}`},
    body:JSON.stringify({
      userId: currentUser,
      network: document.getElementById('airtimeNetwork').value,
      amount: Number(document.getElementById('airtimeAmount').value),
      phone: document.getElementById('airtimePhone').value
    })
  });
  const data = await res.json();
  document.getElementById('airtimeResult').innerText = JSON.stringify(data,null,2);
  if(data.success){
    refreshTransactionsAndBalance();
    alert(`Airtime purchase successful: ₦${data.amount} for ${data.phone}`);
    window.open(`confirmation.html?type=airtime&amount=${data.amount}&phone=${data.phone}`,'_blank');
  }
}

// -------------------- DATA --------------------
async function buyData(){
  if(!currentUser) return alert("Please login first!");
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE_URL}/buy-data`, {
    method:'POST',
    headers:{'Content-Type':'application/json', 'Authorization': `Bearer ${token}`},
    body:JSON.stringify({
      userId: currentUser,
      network: document.getElementById('dataNetwork').value,
      plan: document.getElementById('dataPlan').value,
      phone: document.getElementById('dataPhone').value
    })
  });
  const data = await res.json();
  document.getElementById('dataResult').innerText = JSON.stringify(data,null,2);
  if(data.success){
    refreshTransactionsAndBalance();
    alert(`Data purchase successful: ${data.plan} for ${data.phone}`);
    window.open(`confirmation.html?type=data&plan=${data.plan}&phone=${data.phone}`,'_blank');
  }
}

// -------------------- TRANSACTIONS --------------------
async function getTransactions(){
  if(!currentUser) return;
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE_URL}/transactions/${currentUser}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  const tbody = document.querySelector('#transTable tbody');
  tbody.innerHTML='';
  if(data.success && data.transactions){
    data.transactions.forEach(tr=>{
      const trElem = document.createElement('tr');
      trElem.innerHTML = `<td>${tr.type}</td><td>₦${tr.amount}</td><td>${tr.date}</td>`;
      tbody.appendChild(trElem);
    });
  } else {
    tbody.innerHTML='<tr><td colspan="3">No transactions found</td></tr>';
  }
}

// -------------------- REFRESH --------------------
async function refreshTransactionsAndBalance(){
  await loadBalance();
  await getTransactions();
}

// -------------------- AUTO REFRESH --------------------
function startAutoRefresh(){
  refreshTransactionsAndBalance();
  if(balanceInterval) clearInterval(balanceInterval);
  balanceInterval = setInterval(refreshTransactionsAndBalance, 10000);
}
function stopAutoRefresh(){
  if(balanceInterval) clearInterval(balanceInterval);
}

// -------------------- INIT --------------------
loadNetworks();
