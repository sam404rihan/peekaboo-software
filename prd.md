# Product Requirements Document (PRD) – Peekaboo POS

## 1. Executive Summary
**Peekaboo POS** is a Point of Sale (POS) solution tailored for retail businesses requiring a reliable, fast, and feature-rich system. The product bridges the gap between traditional offline registers and modern cloud-based analytics, ensuring businesses can operate even without internet connectivity while maintaining a central source of truth in the cloud.

## 2. Product Vision & Goals
- **Product Vision**: To provide a professional-grade retail management system that is as simple as it is powerful.
- **Goals**:
  - Deliver sub-second product scanning and cart operations.
  - Guarantee data integrity through robust offline queuing and synchronization.
  - Simplify GST compliance and inventory auditing for retail store owners.

## 3. Target User Personas
### A. The Admin (Store Owner)
- **Pain Points**: Difficulty tracking stock movement, manual tax calculations, and lack of real-time sales data.
- **Goals**: Secure business data, accurate financial reports, and centralized inventory management.

### B. The Cashier (Front-of-House)
- **Pain Points**: Slow checkout systems, unreliable internet, and complicated barcode printing.
- **Goals**: Rapidly scan items, handle returns/exchanges easily, and print clear receipts.

## 4. Functional Requirements

### 4.1. Point of Sale (POS)
- **Barcode Input**: Must support standard HID (Keyboard-emulating) barcode scanners.
- **Cart Logic**: Handle discounts, quantity adjustments, and real-time total calculations.
- **Payment Modes**: Support for Cash, Card, and UPI with reference ID capture.
- **Offline Mode**: Sales must be possible while offline, with automatic background synchronization when online.

### 4.2. Inventory & Stock Management
- **Product Catalog**: Manage SKU, Category, Cost, Price, and Tax rates.
- **Inventory Movement Logs**: Every transaction (Sale, Receive, Return, Exchange, Defect) must be logged with a timestamp and user ID.
- **Barcode Printing**: Direct printing of labels in multiple sizes (A4, 2x1).

### 4.3. Financials & Compliance
- **Invoice Sequences**: Automatic, customizable invoice number generation.
- **GST Handling**: Support for multi-tier GST rates (standardized for India).
- **Reports**: Daily sales summaries, inventory movement reports, and GST-ready CSV exports.

### 4.4. Security & Access
- **Role-Based Access Control (RBAC)**: Distinct permissions for Admin (Full access) and Cashier (POS/Receive only).
- **Secure Architecture**: All data access governed by Firestore security rules.

## 5. Non-Functional Requirements
- **Performance**: POS interface must remain responsive during large cart operations.
- **Reliability**: Use of transactional writes in Firestore to prevent partial data updates.
- **Accessibility**: PWA support for mobile, tablet, and desktop usage.
- **Maintainability**: Next.js 15+ App Router and modular component architecture.

## 6. User Stories
1. **As a Cashier**, I want to scan a product barcode and have it immediately added to the cart so I can serve customers faster.
2. **As an Admin**, I want to see a detailed audit trail of why a certain product's stock changed so I can prevent inventory shrinkage.
3. **As a Store Owner**, I want to download a GST report at the end of the month so I can easily file my taxes.
4. **As a Cashier**, I want the system to handle a network dropout gracefully so I don't lose the current transaction.

## 7. Future Scope (Phase 4+)
- **Multi-Location Hub**: Aggregated dashboard for multiple store branches.
- **Customer CRM**: Enhanced loyalty points, birthday alerts, and targeted marketing segments.
- **Supplier Portal**: Streamlined Purchase Order flow and automated replenishments.
- **Native Mobile App**: Wrapper for Android/iOS using Capacitor or similar for native hardware access.
