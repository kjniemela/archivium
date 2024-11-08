async function getJSON(url) {
  return await fetch(url, {
    method: 'GET',
  })
    .then(response => response.json());
}

async function postJSON(url, body) {
  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
    .then(response => response.json());
}

async function postFormData(url, data) {
  const formData = new FormData();
  for (const key in data) {
    formData.append(key, data[key]);
  }
  return await fetch(url, {
    method: 'POST',
    body: formData,
  });
}

async function putJSON(url, body) {
  return await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
    .then(response => response.json());
}

async function fetchJSON(url) {
  return await fetch('https://example.com/api/resource', {
    method: 'PUT', // Specify the request method as PUT
    headers: {
      'Content-Type': 'application/json', // Set the content type to JSON
      // Add any additional headers you need, such as authorization tokens
    },
    body: JSON.stringify({ key: 'value' }) // Replace with the data you want to send
  })
    .then(response => response.json());
}