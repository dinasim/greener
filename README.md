# 🌱 Greener

<div align="center">
  <img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&weight=600&size=50&duration=4000&pause=1000&color=00B04F&background=FFFFFF&center=true&vCenter=true&width=800&height=100&lines=GREENER;Sustainable+Living+Platform;Grow+Share+Thrive" alt="Greener - Sustainable Living Platform" />
</div>

<div align="center">
  <h3>🌱 The All-in-One Platform for plants</h3>
  <p><strong>Empowering individuals and businesses to grow, care, and thrive plant 
---

## 🎯 Overview

Greener is a full-featured, cloud-native platform for sustainable commerce, connecting individuals and businesses around plants, eco-products, and green services. The app supports both consumer and business personas, offering a rich set of features for each, including marketplace, inventory, business analytics, plant care, and real-time communication.

---

## 🎯 Key Value Propositions

- 🌿 **Sustainable Commerce Hub:** Curated marketplace for plants, eco-products, and green services
- 👥 **Dual Persona Support:** Tailored experiences for both consumers and businesses
- 🌱 **Plant Care Assistant:** AI-powered plant care chat with watering reminders and health tips
- 📊 **Business Intelligence:** Real-time analytics and insights for sellers and administrators
- 💬 **Community Engagement:** Integrated chat, reviews, forums, and social features
- 🔒 **Secure Authentication:** Custom authentication system with encrypted password storage
- 📱 **Cross-Platform:** Native mobile experience with web compatibility
- ⚡ **Real-Time Features:** Live notifications and messaging via SignalR

---

## 🚀 Quick Start

### Prerequisites

```bash
# Required versions
Node.js >= 16.0.0
npm >= 8.0.0
Python >= 3.9.0
Azure CLI >= 2.0.0
```

### 🔧 Local Development

```bash
# Clone and setup
git clone https://github.com/dinasim/greener.git
cd greener

# Install dependencies
npm install

# Start development server
npm run dev

# Optional: Start backend locally
cd backend && func start
```

### 🌐 Production Deployment

```bash
# Deploy to Azure Static Web Apps
az staticwebapp create \
  --name greener-app \
  --resource-group greener-rg \
  --source https://github.com/dinasim/greener

# Deploy Azure Functions
func azure functionapp publish greener-functions
```

---

## 🏗️ Architecture

### System Overview

```
┌───────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ React Native  │    │ Azure Static    │    │ Azure Functions │
│ Frontend      │◄──►│ Web Apps        │◄──►│ (Backend)       │
└───────────────┘    └─────────────────┘    └─────────────────┘
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Custom Auth   │    │ Azure SignalR   │    │ Azure Cosmos DB │
│ (Hash Storage)│    │ (Real-time)     │    │ (Database)      │
└───────────────┘    └─────────────────┘    └─────────────────┘
```

### Technology Stack

<div align="center">
  <img src="https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB"/>
  <img src="https://img.shields.io/badge/Azure_Functions-0062AD?style=for-the-badge&logo=azure-functions&logoColor=white"/>
  <img src="https://img.shields.io/badge/Azure_Cosmos_DB-4DB33D?style=for-the-badge&logo=azure-cosmos-db&logoColor=white"/>
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white"/>
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/Custom_Auth-4CAF50?style=for-the-badge&logo=key&logoColor=white"/>
  <img src="https://img.shields.io/badge/SignalR-0082C9?style=for-the-badge&logo=signalr&logoColor=white"/>
  <img src="https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white"/>
</div>

---

## 🌟 Core Features

### 🏠 Home Experience

**For Consumers:**
- Personalized Home Screen: Quick access to marketplace, favorites, plant care, and community
- Plant Care Assistant: AI-powered plant care chat, watering reminders, and plant health tips
- My Plants: Manage your own plant collection, add new plants, track care schedules, and get tailored advice
- Favorites & Wishlist: Save favorite products, plants, and sellers for easy access
- Community Forum: Participate in plant care discussions, ask questions, and share tips

**For Businesses:**
- Business Welcome Screen: Onboarding for new businesses, with clear navigation to sign up, sign in, or switch persona
- Business Dashboard: Real-time KPIs, sales analytics, inventory status, and order management
- Inventory Management: Add, edit, and track products, manage stock, and publish to the marketplace
- Customer Management: View customer profiles, order history, and respond to reviews
- Business Insights: Visual dashboards for sales, top products, customer segmentation, and revenue trends

### 🛒 Marketplace Experience

- Product Discovery: Advanced search, filtering, and categorization for plants and eco-products
- Seller Profiles: Individual and business storefronts with branding, product showcases, and reviews
- Product Listings: Detailed product pages with images, descriptions, pricing, and seller information
- Order Management: Complete cart functionality, checkout, payment, order tracking, and history
- Review System: Rate and review products, sellers, and buyers with detailed feedback

### 🌱 Plant Management

- Add/Edit Plants: Users can add their own plants, upload images, and track care schedules
- Plant Details: Scientific and common names, care instructions, watering/fertilizing schedules, and origin
- Plant Inventory (Business): Businesses can manage large inventories, bulk upload, and publish to marketplace
- Care Tracking: Monitor plant health, growth progress, and maintenance history

### 📈 Business Intelligence Dashboard

- Sales Analytics: Real-time sales data, trends, and comprehensive KPIs
- Inventory Reports: Stock level monitoring with automated alerts and reorder suggestions
- Customer Insights: Analyze customer behavior, segment users, and target marketing strategies
- Revenue Dashboards: Financial overviews with profit/loss tracking and market trend analysis

### 💬 Real-time Communication

- Instant Messaging: Live chat between buyers and sellers with message history and notifications
- Push Notifications: Real-time alerts for orders, messages, reviews, and system updates
- Community Engagement: Forums, Q&A, and social features for plant lovers and eco-enthusiasts
- Review System: Comprehensive feedback mechanism with rating aggregation

### 🔐 Security & Data Management

- Custom Authentication: Secure password hashing with salt-based encryption and session management
- Role-based Access: Multi-level permissions for consumers, business users, and administrators
- Data Protection: Secure storage in Azure Cosmos DB with encryption at rest
- Session Management: Secure login sessions with automatic timeout protection

---

## 📚 Code Structure

### Frontend Architecture

- **App.js:** App entry point, navigation setup, theming, and context providers
- **/screens/:** All main screens (Marketplace, Profile, Home, Business, Registration, Login, Plant Care, Forum, etc.)
- **/components/:** Reusable UI elements (KPI widgets, charts, product cards, chat bubbles, custom buttons, etc.)
- **/services/:** API abstraction for backend communication (marketplace, business, plant care, maps, etc.)
- **/context/:** Global state management using React Context (forms, authentication, business logic)
- **/Business/:** Business-specific screens and services for seller functionality
- **/marketplace/:** Marketplace screens, navigation, and related services

### Backend Architecture

- **Azure Functions:** Stateless microservices for user, marketplace, business, order, chat, and analytics
- **Cosmos DB:** NoSQL database for users, products, orders, reviews, plants, and chat messages
- **SignalR:** Real-time messaging and notifications system
- **Authentication:** Custom auth with secure password hashing and session management

---

## 📞 Contact & Support

**📧 Email:** danis.sim101@gmail.com

---

## 📊 Repository Stats

<div align="center">
  <img src="https://github-readme-stats.vercel.app/api?username=dinasim&repo=greener&theme=vue-dark&show_icons=true&hide_border=true&count_private=true"/>
  <img src="https://github-readme-stats.vercel.app/api/top-langs/?username=dinasim&theme=vue-dark&show_icons=true&hide_border=true&layout=compact"/>
</div>

---

## 📜 License

Greener 2025

---

## 🙏 Acknowledgments

This is a university project developed under the guidance of:

- Nir Levi – Course Instructor
- Omer Avramovich – Teaching Assistant
---

<div align="center">
  <strong>⭐ Star this repository if you believe in sustainable commerce!</strong>
  <br/> <br/>
  <a href="https://github.com/dinasim/greener">
    <img src="https://img.shields.io/badge/View%20on-GitHub-black?style=for-the-badge&logo=github" alt="View on GitHub"/>
  </a>
</div>

© 2025 Greener Platform. Building a
