# Sales Management API

A Node.js-based REST API for user authentication and sales record management using MongoDB and Express.js.


# Project Structure

models/
routes/
controller/
middleware/
workers/
files/
app.js
README.md


# Tech Stack

Node.js
Express.js
MongoDB + Mongoose
JWT Authentication
Bcrypt
Worker Threads for CSV processing


# Authentication APIs

1. Register User

URL: POST /register

Body:
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}

Response:
{
  "user": { "name": "John Doe", "email": "john@example.com" },
  "message": "New User registered Successfully..."
}


2. Login User

URL: POST /login

Body:
{
  "email": "john@example.com",
  "password": "password123"
}

Response:
{
  "name": "John Doe",
  "email": "john@example.com",
  "token": "JWT_TOKEN",
  "message": "Login Successful..."
}


3. Logout User

URL: POST /logout

Headers:
Authorization: Bearer <JWT_TOKEN>

Response:
{
  "message": "Logout Successfully..."
}


# Sales APIs

1. Fetch Sales Records

URL: GET /fetch

Headers: Requires Authorization

Query Params (optional):
limit=10
pageNo=1
sortBy=Country
sortOrder=1
search=india

Response:
{
  "data": [...],
  "paginationDetails": {
    "totalRecords": 100,
    "totalPages": 10,
    "currentPage": 1,
    "limit": 10
  },
  "message": "Sales Data fetched successfully...."
}


2. Insert Sales Record

URL: POST /addSalesRecord

Headers: Requires Authorization

Body: All required sales fields

Response:
{
  "newRecord": {...},
  "message": "Sales Record Created Successfully..."
}


3. Update Sales Record

URL: PATCH /updateSalesRecord/:id

Headers: Requires Authorization

Body: Any updatable fields

Response:
{
  "updatedData": {...},
  "message": "Sales record Updated Successfully..."
}


4. Delete Sales Record

URL: DELETE /deleteSalesRecord/:id

Headers: Requires Authorization

Response:
{
  "deletedData": {...},
  "message": "Sales record deleted successfully..."
}


# Authorization

All sales-related APIs require JWT token in the Authorization header:
Authorization: Bearer <your_token_here>


# Environment Variables (.env)

PORT=3000
MONGO_URI=mongodb://localhost:27017/salesDB
SECRET_KEY=your_jwt_secret
SALT_ROUNDS=10


# How to Setup Locally

1. Clone the repository:
https://github.com/Kartik-Dianapps/Csv_Assignment_Multithreading.git

2. Navigate to the project folder:
cd Csv_Assignment_Multithreading

3. Install all dependencies:
npm install

4. Add a .env file in the root directory with your MongoDB URI and secret keys.

5. Run the project:
npm run dev or nodemon app.js