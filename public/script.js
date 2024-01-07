
// Store the token globally after logging in with Trello
let trelloToken;

document.getElementById('login-btn').addEventListener('click', async function() {
    const key = '9ab94bc0a68ff724f9f3b6fc7af32e44'; 
    trelloToken = await logInWithTrello(key);
    if (trelloToken) {
        fetchBoards(trelloToken);
    }
});

// Fetch lists for the selected board
async function fetchLists(boardId) {
    if (!boardId) return; 
    try {
        const listsResponse = await fetch(`/fetch-lists?boardId=${boardId}&token=${trelloToken}`);
        const lists = await listsResponse.json();
        populateListDropdown(lists);
        // Automatically fetch cards for the first list, if any
        if (lists.length > 0) {
            fetchCards(lists[0].id);
        }
    } catch (error) {
        console.error('Error fetching lists:', error);
    }
}

// Populate the lists dropdown
function populateListDropdown(lists) {
        const listDropdown = document.getElementById('list-dropdown');
        const newStatusDropdown = document.getElementById('new-status-dropdown');
        listDropdown.innerHTML = ''; // Clear existing options first
        newStatusDropdown.innerHTML = ''; // Clear existing options first
        newStatusDropdown.add(new Option('Select New Status', '')); // Add default option
        lists.forEach(list => {
            const option = new Option(list.name, list.id);
            const statusOption = new Option(list.name, list.id);
            listDropdown.add(option);
            newStatusDropdown.add(statusOption);
        });
}

// Fetch cards for the selected list From Trello
async function fetchCards(listId) {
    if (!listId) return; // Don't fetch if listId is not present
    try {
        const cardsResponse = await fetch(`/fetch-cards?listId=${listId}&token=${trelloToken}`);
        const cards = await cardsResponse.json();
        populateCardDropdown(cards);
    } catch (error) {
        console.error('Error fetching cards:', error);
    }
}

// Populate the cards dropdown
function populateCardDropdown(cards) {
    const cardDropdown = document.getElementById('card-dropdown');
    cardDropdown.innerHTML = ''; // Clear existing options first
    cards.forEach(card => {
        const option = new Option(card.name, card.id);
        cardDropdown.add(option);
    });
}

async function logInWithTrello(key) {
    // First, check if a token already exists in local storage
    const existingToken = localStorage.getItem('trelloToken');
    if (existingToken) {
        // Validate the existing token
        const isValid = await validateToken(existingToken);
        if (isValid) {
            return existingToken;
        } else {
            // If the token is not valid, remove it from storage
            localStorage.removeItem('trelloToken');
        }
    }
    // If no valid token in storage, proceed to log in
    const returnUrl = 'http://localhost:3000/oauth-callback';
    const trelloAuthUrl = `https://trello.com/1/authorize?expiration=1day&name=YourApp&scope=read,write&response_type=token&key=${key}&return_url=${returnUrl}&callback_method=fragment`;
    return new Promise((resolve, reject) => {
        const width = 600, height = 400;
        const left = (screen.width / 2) - (width / 2);
        const top = (screen.height / 2) - (height / 2);
        const authWindow = window.open(
            trelloAuthUrl,
            'TrelloAuth',
            `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=yes, resizable=yes, copyhistory=no, width=${width}, height=${height}, top=${top}, left=${left}`
        );
        window.addEventListener('message', (event) => {
            if (event.origin !== 'http://localhost:3000') return;
            if (event.data && event.data.token) {
                localStorage.setItem('trelloToken', event.data.token); // Save the new token to local storage
                resolve(event.data.token);
                authWindow.close();
            }
        }, false);
    });
}

// Function to validate the token
async function validateToken(token) {
try {
// Replace with an appropriate validation URL or method
const response = await fetch(`/validate-token?token=${token}`);
return response.ok; // Assumes the endpoint returns a success status for valid tokens
} catch (error) {
console.error('Error validating token:', error);
return false;
}
}


async function fetchBoards(token) {
    try {
        const response = await fetch(`/fetch-boards?token=${token}`);
        const boards = await response.json();
        populateBoardDropdown(boards);
    } catch (error) {
        console.error('Error fetching boards:', error);
    }
}

function populateBoardDropdown(boards) {
    const dropdown = document.getElementById('board-dropdown');
    dropdown.innerHTML = ''; // Clear existing options first
    dropdown.add(new Option('Select a Board', ''));

    boards.forEach(board => {
        const option = new Option(board.name, board.id);
        dropdown.add(option);
    });
}

document.getElementById('settings-form').addEventListener('submit', function(event) {
        event.preventDefault();
        const cardId = document.getElementById('card-dropdown').value;
        const newListId = document.getElementById('list-dropdown').value;
        
        if (cardId && newListId && trelloToken) {
            updateCardList(cardId, newListId, trelloToken);
        } else {
            console.error('You must select both a card and a new list.');
        }
    });
// This function is called when the "Update Status" button is clicked
document.getElementById('update-card-status').addEventListener('click', async function() {
    const cardDropdown = document.getElementById('card-dropdown');
    const cardId = cardDropdown.value;
    const cardName = cardDropdown.options[cardDropdown.selectedIndex].text; // Get the card's name
    const newListId = document.getElementById('new-status-dropdown').value;
    
    if (cardId && newListId) {
        await updateCardList(cardId, newListId, trelloToken, cardName);
    } else {
        console.error('You must select a card and a new status.');
    }
});
// This function makes the API call to update the card's list and sends the notification
async function updateCardList(cardId, newListId, token, cardName) {
    try {
        const response = await fetch(`http://localhost:3000/update-card-list?cardId=${cardId}&listId=${newListId}&token=${token}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const result = await response.json();
        if (result.success) {
            console.log('Card status updated successfully.'); // Log the success message
            notifyNTFY('Card status updated successfully.', cardName); // Pass the cardName to the notify function
            
            // Re-fetch cards for the current list to update the dropdown
            const currentListId = document.getElementById('list-dropdown').value;
            if (currentListId) {
                fetchCards(currentListId);
            }
            // Reset the status dropdown to its default value
            document.getElementById('new-status-dropdown').selectedIndex = 0;
            // Reset the card dropdown to its default value
            //document.getElementById('card-dropdown').selectedIndex = 0;
        }
    } catch (error) {
        console.error('Error updating card:', error);
    }
}
// This function sends a notification to the NTFY server with the full message including the card name
async function notifyNTFY(message, cardName) {
    try {
        const fullMessage = `${message} Card: ${cardName}`; // Include the card name in the message
        const auth = Buffer.from('ntfy:Ibdrb3$8bFjHtS3!j4Ze0FM').toString('base64');
        const response = await fetch('http://3.70.155.156:8080/Sima-phone', { //Here i change port from 80 to 8080, because i would like to have a Login page for my NTFY server, By default does not support this Option, so i have with Nginx did that, the users can login to my NTFY server only with user and pass!
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}` // Add the Authorization header for basic auth
            },
            body: JSON.stringify({ message: fullMessage })
        });
        console.log('Notification sent', await response.text());
    } catch (error) {
        console.error('Error sending notification:', error);
    }
}

document.addEventListener('DOMContentLoaded', checkTokenOnLoad);
// Function to check the token when the page loads
async function checkTokenOnLoad() {
    const token = localStorage.getItem('trelloToken');
    if (token) {
        const isValid = await validateToken(token);
        if (isValid) {
            trelloToken = token;
            fetchBoards(trelloToken);
        } else {
            // If the token is not valid, remove it from storage
            localStorage.removeItem('trelloToken');
            console.log('Token is invalid or expired. Please log in again.');
        }
    }
}
