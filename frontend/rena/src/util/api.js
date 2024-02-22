export const apiCall = (url, method, body) => {
    return new Promise((resolve, reject) => {
      fetch(`${url}`, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: method !== 'GET' ? JSON.stringify(body) : undefined,
      })
        .then(response => {
          return response.json();
        }).then((data) => {
          if (data.error) {
            alert(data.error);
          } else {
            resolve(data);
          }
        });
    });
  }
  