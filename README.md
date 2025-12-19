# 🎫 Ticket Booking Web Application

A full-stack ticket booking platform where users can browse tickets, request bookings, vendors manage ticket requests, and admins oversee the system with revenue insights.

---

## 🚀 Features

### 👤 User

- Register & login
- Browse available tickets
- Search tickets by **From → To** location
- Request to book tickets
- View booked tickets with status:

  - Requested
  - Approved
  - Rejected

- Manage profile information

---

### 🧑‍💼 Vendor

- Add tickets with:

  - From location
  - To location
  - Price
  - Available quantity
  - Perks (optional)

- View booking requests
- Approve or reject booking requests
- View ticket status clearly in dashboard

---

### 🛡️ Admin

- View all users, vendors, and tickets
- Approve or block vendors
- Monitor platform performance
- Revenue overview dashboard:

  - Total Revenue
  - Total Tickets Sold
  - Total Tickets Added

- Interactive charts using **Recharts**

---

## 📊 Dashboard & Analytics

- Revenue data visualized using:

  - Radial Bar Charts
  - Pie Charts

- Real-time data fetched from backend APIs

---

## 🧾 Ticket Status Flow

- User submits booking → **Requested**
- Vendor reviews request:

  - Approves → **Approved**
  - Rejects → **Rejected**

---

## 💱 Currency

- All prices and revenue amounts are calculated and displayed in **Bangladeshi Taka (BDT)**.

---

## 🛠️ Tech Stack

### Frontend

- React
- React Router
- Tailwind CSS
- Recharts
- Axios

### Backend

- Node.js
- Express.js
- MongoDB
- FB Authentication

---

## 🔐 Authentication & Authorization

- Role-based access:

  - User
  - Vendor
  - Admin

- Protected routes
- Secure API endpoints

## 📌 Notes

- Location inputs are flexible but must be meaningful and not empty
- Users cannot delete approved bookings
- Color coding in dashboards is used for better UI clarity (optional enhancement)

---

## 📄 License

This project is created for educational and demonstration purposes.
