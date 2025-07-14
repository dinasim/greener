# 🌱 Greener

<div align="center">
  <img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&weight=600&size=50&duration=4000&pause=1000&color=00B04F&background=FFFFFF&center=true&vCenter=true&width=800&height=100&lines=GREENER;Sustainable+Living+Platform;Grow+Share+Thrive" alt="Greener - Sustainable Living Platform" />
</div>

<div align="center">
  <h3>🌿 Greener — The All-in-One Platform for Plant Lovers & Green Businesses</h3>
  <p><strong>Empowering individuals and businesses to grow, share, and thrive with plants and eco-products.</strong></p>
</div>

---

## 📌 Overview

**Greener** is a modern, cloud-native platform for sustainable living. It connects plant enthusiasts and green businesses through a feature-rich ecosystem that includes a marketplace, plant care assistant, inventory management, real-time chat, and business analytics.

* ✅ Mobile-first (React Native)
* ✅ Azure-based scalable backend
* ✅ Designed for both consumers & eco-businesses
* ✅ Real-time, AI-powered, and secure

---

## 💡 Why Greener?

* 🌿 **Sustainable Marketplace** — Discover eco-products, plants, and services from vetted sellers
* 👥 **Dual Personas** — Custom user journeys for individuals and business owners
* 🤖 **AI Plant Assistant** — Watering reminders, health tips, and chat-based care advice
* 📈 **Business Insights** — Dashboards, KPIs, and customer intelligence for decision-making
* 💬 **Community & Messaging** — Forums, reviews, and SignalR-powered real-time chat
* 🔐 **Secure & Scalable** — Custom authentication, RBAC, and encrypted Cosmos DB storage

---

## 🚀 Getting Started

### ⚙️ Prerequisites

```bash
Node.js >= 16.0.0
npm >= 8.0.0
Python >= 3.9.0
Azure CLI >= 2.0.0
```

### 🧪 Local Development

```bash
# Clone the repo
git clone https://github.com/dinasim/greener.git
cd greener

# Install frontend dependencies
npm install

# Start the React Native frontend
npm run dev

# Start backend locally (in separate terminal)
cd backend
func start
```

---

## 🧰 System Architecture

```
frontend/
│
├── App.js
├── /screens/           # All user and business screens (Home, Marketplace, Profile, Business, PlantCare, etc.)
├── /components/        # Shared UI components (KPI widgets, cards, charts, chat, etc.)
├── /services/          # API clients (marketplaceApi.js, businessApi.js, plantApi.js, chatApi.js, etc.)
├── /context/           # React context for global state (auth, forms, business, etc.)
├── /Business/          # Business persona screens and logic (dashboard, inventory, insights, etc.)
└── /marketplace/       # Marketplace screens, navigation, and services

backend/
│
├── /user/              # User registration, profile, authentication (custom hash+salt)
├── /marketplace/       # Product, plant, and service listings, reviews, search
├── /order/             # Order creation, management, and tracking
├── /chat/              # Real-time chat and notifications (SignalR)
├── /analytics/         # Business analytics, KPIs, dashboards
├── /auth/              # Custom authentication endpoints
└── shared/             # Shared utilities, Cosmos DB models, helpers

```

- **Frontend:** Built with React Native for cross-platform support (mobile & web), modularized by feature and persona.
- **Backend:** Azure Functions (Python). Cosmos DB for all persistent data. SignalR for real-time chat and notifications. Custom authentication with secure password hashing and RBAC.

---

## 🧰 Tech Stack

<div align="center">
  <img src="https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB"/>
  <img src="https://img.shields.io/badge/Azure_Functions-0062AD?style=for-the-badge&logo=azure-functions&logoColor=white"/>
  <img src="https://img.shields.io/badge/Cosmos_DB-4DB33D?style=for-the-badge&logo=azure-cosmos-db&logoColor=white"/>
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/SignalR-0082C9?style=for-the-badge&logo=signalr&logoColor=white"/>
  <img src="https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white"/>
  <img src="https://img.shields.io/badge/Custom_Auth-4CAF50?style=for-the-badge&logo=key&logoColor=white"/>
</div>

---

## ✨ Key Features

### 👤 Consumer Experience

* 🌱 AI-Powered Plant Assistant
* 💧 Watering reminders & care schedules
* 🛒 Personalized marketplace & wishlists
* 📚 My Plants dashboard
* 🧑‍🧳 Community forums

### 💼 Business Experience

* 📊 Business dashboard & analytics
* 🛋️ Inventory and order management
* 👨‍💼 Customer profile insights
* 🌐 Online storefront with branding

### ⚖️ Admin & Security

* 🔐 Role-based access (consumer, business, admin)
* 🛡️ Secure session handling
* 📃 Encrypted Cosmos DB storage
* 🔒 password hashing

---

## 📂 Codebase Structure

### Frontend

- `/screens/` — All user and business screens (Home, Marketplace, Profile, Business, PlantCare, etc.)
- `/components/` — Shared UI components (KPI widgets, cards, charts, chat, etc.)
- `/services/` — API clients for marketplace, business, plant care, chat, etc.
- `/context/` — React context for global state (auth, forms, business, etc.)
- `/Business/` — Business persona screens and logic (dashboard, inventory, insights, etc.)
- `/marketplace/` — Marketplace screens, navigation, and services

### Backend

- `/user/` — User registration, profile, authentication (custom hash+salt)
- `/marketplace/` — Product, plant, and service listings, reviews, search
- `/order/` — Order creation, management, and tracking
- `/chat/` — Real-time chat and notifications (SignalR)
- `/analytics/` — Business analytics, KPIs, dashboards
- `/auth/` — Custom authentication endpoints
- `/shared/` — Shared utilities, Cosmos DB models, helpers

---

## 📢 Contact

**Email:** [danis.sim101@gmail.com](mailto:danis.sim101@gmail.com)

---

## 📜 License

© 2025 Greener 

---

## 🙏 Acknowledgments

Developed as part of a university project at Tel Aviv University.

* Nir Levi – Course Instructor
* Omer Avramovich – Teaching Assistant

---

<div align="center">
  <strong>⭐ Star this repository if you believe in sustainable commerce!</strong><br/><br/>
  <a href="https://github.com/dinasim/greener">
    <img src="https://img.shields.io/badge/View%20on-GitHub-black?style=for-the-badge&logo=github" alt="View on GitHub"/>
