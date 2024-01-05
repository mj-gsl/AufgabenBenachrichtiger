
const cors = require('cors');
const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000; 

// Enable All CORS Requests
app.use(cors());
app.use(express.static('public'));
// Parse JSON body data
app.use(express.json());
// Token validation endpoint
app.get('/validate-token', async (req, res) => {
    const token = req.query.token;
    if (!token) {
        return res.status(400).send('No token provided');
    }
    try {
        // Make a test request to Trello API to check if the token is valid
        const testResponse = await axios.get(`https://api.trello.com/1/members/me?key=YOUR-API-Key&token=${token}`);
        if (testResponse.status === 200) {
            res.send({ valid: true });
        } else {
            res.send({ valid: false });
        }
    } catch (error) {
        res.status(500).send({ valid: false, error: error.message });
    }
});
//------ check token on the page load --------- We wanted to this API can be store in local, 
//as long as API key is valid, user don't need to renew the API, because we do this to prevent 
//multiple submissions from Trello. 
//Because every time we renew our API-Key, we receive an email. Its Crazy :)

async function checkTokenOnLoad() {
    const savedToken = localStorage.getItem('trello_token');
    if (savedToken) {
        const isValid = await validateToken(savedToken);
        if (isValid) {
            fetchBoards(savedToken);
        } else {
            // Token is not valid, remove it from storage
            localStorage.removeItem('trello_token');
        }
    }
}
async function validateToken(token) {
    try {
        const response = await fetch(`/validate-token?token=${token}`);
        const result = await response.json();
        return result.valid;
    } catch (error) {
        console.error('Error validating token:', error);
        return false;
    }
}
//------------------

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.get('/fetch-boards', async (req, res) => {
    const token = req.query.token;
    console.log('Token received:', token); // Log the token to verify it's correct
    try {
        // Fetching all boards that the member is associated with.
        // Adjust the API call if you need specific filtering.
        const response = await axios.get(`https://api.trello.com/1/members/me/boards?filter=open&fields=name,url&key=API-Key&token=${token}`);
        res.json(response.data.filter(board => board.name && !board.closed)); // Example filter for non-closed boards
    } catch (error) {
        res.status(500).send("Error fetching boards: " + error.message);
    }
});
// Fetch lists from Trello for a given board
app.get('/fetch-lists', async (req, res) => {
    const { boardId, token } = req.query;
    try {
        const response = await axios.get(`https://api.trello.com/1/boards/${boardId}/lists?key=API-Key&token=${token}`);
        res.json(response.data);
    } catch (error) {
        res.status(500).send("Error fetching lists: " + error.message);
    }
});
// Fetch cards from Trello for a given list
app.get('/fetch-cards', async (req, res) => {
    const { listId, token } = req.query;
    try {
        const response = await axios.get(`https://api.trello.com/1/lists/${listId}/cards?key=API-Key&token=${token}`);
        res.json(response.data);
    } catch (error) {
        res.status(500).send("Error fetching cards: " + error.message);
    }
});

app.get('/oauth-callback', (req, res) => {
    // Note: No token is available in req.query.token because it's in the URL fragment
    res.send(`
        <html>
        <body>
        <script>
            // The token is in the URL fragment, not in the query.
            // So we need to parse it from the location.hash (URL fragment)
            const match = window.location.hash.match(/token=([^&]+)/);
            const token = match ? match[1] : null;
            if (token) {
                window.opener.postMessage({ token: token }, '*');
            } else {
                alert('No token found');
            }
            
            window.close();
        </script>
        </body>
        </html>
    `);
});
app.put('/update-card-list', async (req, res) => {
    const { cardId, listId, token } = req.query; // You should probably use req.body for PUT requests
    try {
        // Update the card's list on Trello
        const trelloResponse = await axios.put(`https://api.trello.com/1/cards/${cardId}?idList=${listId}&key=API-Key&token=${token}`);
        
        // Notify via NTFY after successful Trello update
        await notifyNTFY('Card status updated successfully.');
        res.json({ success: true, message: 'Card updated' });
    } catch (error) {
        res.status(500).send(`Error updating card: ${error.message}`);
    }
});

async function notifyNTFY(message) {
    try {
        const auth = Buffer.from('ntfy:Ibdrb3$8bFjHtS3!j4Ze0FM').toString('base64');
        const response = await axios.post('http://NTFY-IP-Add:8080/Topic', { message }, {
            headers: {
                'Authorization': `Basic ${auth}`
            }
        });
        console.log('Notification sent', response.data);
    } catch (error) {
        console.error('Error sending notification:', error);
    }
}
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});