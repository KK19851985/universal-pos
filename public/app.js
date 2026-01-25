// Universal POS Frontend Application

class POSApp {
    constructor() {
        this.apiBase = window.location.origin || 'http://localhost:5000';
        this.currentUser = null;
        this.currentOrder = null;
        this.currentBill = null;
        this.products = [];
        this.sessionId = null;
        this.activeTableId = null;
        this.activeTableLabel = null;
        this.activeOrderId = null;
        this.restaurantTables = [];
        this.restaurantTab = 'tables';
        
        // Phase 1: Order Operations
        this.userPermissions = {};
        this.voidReasons = [];
        this.discountTypes = [];
        
        // Kitchen Display
        this.kitchenViewMode = 'kitchen'; // 'checker', 'kitchen', 'completed'
        this.kitchenPage = 0;
        this.kitchenPageSize = 12;
        this.kitchenAutoRefresh = null;
        
        // Loyalty Module
        this.loyaltyTab = 'customers';
        this.loyaltyCustomers = [];
        this.loyaltyPage = 1;
        this.loyaltyPageSize = 50;
        this.loyaltyTotalCustomers = 0;
        
        // Language & Currency
        this.currentLanguage = localStorage.getItem('pos_language') || 'en'; // 'en' or 'my' (Myanmar)
        this.currency = '฿'; // Thai Baht
        this.currencyCode = 'THB';
        
        // Day Management
        this.dayStarted = false;
        this.dayStartTime = null;
        
        // Loyalty Module
        this.loyaltyPage = 1;
        this.loyaltyPageSize = 50;
        this.loyaltyTotalCustomers = 0;
        this.loyaltyTab = 'customers';
        
        // Menu Edit Mode
        this.menuEditMode = false;
        this.categories = [];
        
        // Order Customer (for loyalty)
        this.orderCustomer = null;

        // Translations
        this.translations = {
            en: {
                // Login
                login: 'Login',
                username: 'Username',
                password: 'Password',
                loginSuccess: 'Login successful!',
                logout: 'Logout',
                
                // Modules
                selectModule: 'Select Module',
                restaurant: 'Restaurant',
                restaurantDesc: 'Tables, orders, kitchen, and payments.',
                retail: 'Retail',
                warehouse: 'Warehouse',
                loyalty: 'Loyalty',
                enabled: 'Enabled',
                comingSoon: 'Coming soon',
                
                // Tables
                tables: 'Tables',
                reservations: 'Reservations',
                kitchen: 'Kitchen',
                addTable: 'Add Table',
                refresh: 'Refresh',
                seat: 'Seat',
                reserve: 'Reserve',
                block: 'Block',
                unblock: 'Unblock',
                openPOS: 'Open POS',
                generateBill: 'Generate Bill',
                viewPay: 'View/Pay',
                viewBill: 'View Bill',
                markClean: 'Mark Clean',
                clear: 'Clear',
                capacity: 'Capacity',
                
                // Status
                available: 'Available',
                reserved: 'Reserved',
                seated: 'Seated',
                billed: 'Billed',
                needsCleaning: 'Needs Cleaning',
                blocked: 'Blocked',
                
                // POS
                products: 'Products',
                all: 'All',
                food: 'Food',
                beverages: 'Beverages',
                other: 'Other',
                currentOrder: 'Current Order',
                clearOrder: 'Clear Order',
                sendToKitchen: 'Send to Kitchen',
                pay: 'Pay',
                order: 'Order',
                total: 'Total',
                
                // Payment
                payment: 'Payment',
                cash: 'Cash',
                card: 'Card',
                cancel: 'Cancel',
                confirmPayment: 'Confirm Payment',
                
                // Kitchen
                checker: 'CHECKER',
                kitchenView: 'KITCHEN VIEW',
                completed: 'COMPLETED',
                pendingOrder: 'PENDING ORDER',
                longestWait: 'LONGEST WAIT (MIN)',
                activeTables: 'ACTIVE TABLES',
                itemsInQueue: 'ITEMS IN QUEUE',
                settings: 'SETTING',
                search: 'SEARCH',
                previous: 'PREVIOUS',
                next: 'NEXT',
                
                // Day Management
                startDay: 'Start Day',
                endDay: 'End Day & Print Report',
                dayStarted: 'Day Started',
                confirmEndDay: 'Are you sure you want to end the day? This will print the daily report and log you out.',
                dailyReport: 'Daily Report',
                
                // Messages
                noItems: 'No items in order',
                selectPaymentMethod: 'Please select a payment method',
                sentToKitchen: 'item(s) sent to kitchen!',
                tableSeated: 'Table seated! Opening POS...',
                
                // Menu Management
                editMenu: 'Edit Menu',
                doneEditing: 'Done',
                addItem: 'Add Item',
                addNewItem: 'Add New Menu Item',
                itemName: 'Item Name',
                enterItemName: 'Enter item name...',
                price: 'Price',
                category: 'Category',
                noCategory: 'No Category',
                itemNameRequired: 'Item name is required',
                validPriceRequired: 'Please enter a valid price',
                addedToMenu: 'added to menu',
                removedFromMenu: 'removed from menu',
                confirmRemove: 'Remove this item?',
                
                // Table Management
                editTable: 'Edit Table',
                tableName: 'Table Name',
                tableNumber: 'Table Number',
                shape: 'Shape',
                round: 'Round',
                square: 'Square',
                rectangle: 'Rectangle',
                save: 'Save',
                tableUpdated: 'Table updated successfully',
                tableDeleted: 'Table deleted successfully',
                tableAdded: 'Table added successfully',
                failedToUpdateTable: 'Failed to update table',
                failedToDeleteTable: 'Failed to delete table',
                tableNumberRequired: 'Table number is required',
                confirmDeleteTable: 'Are you sure you want to delete {name}?',
                
                // Misc
                modules: 'Modules',
                table: 'Table',
                guests: 'Guests',
                items: 'Items',
                pending: 'Pending',
                preparing: 'Preparing',
                ready: 'Ready',
                served: 'Served'
            },
            my: {
                // Login
                login: 'ဝင်ရောက်ပါ',
                username: 'အသုံးပြုသူအမည်',
                password: 'စကားဝှက်',
                loginSuccess: 'အောင်မြင်စွာဝင်ရောက်ပြီး!',
                logout: 'ထွက်ပါ',
                
                // Modules
                selectModule: 'မော်ဂျူးရွေးချယ်ပါ',
                restaurant: 'စားသောက်ဆိုင်',
                restaurantDesc: 'စားပွဲများ၊ အော်ဒါများ၊ မီးဖိုချောင်နှင့် ငွေပေးချေမှုများ',
                retail: 'လက်လီ',
                warehouse: 'ဂိုဒေါင်',
                loyalty: 'အစီအစဉ်',
                enabled: 'ဖွင့်ထားသည်',
                comingSoon: 'မကြာမီလာမည်',
                
                // Tables
                tables: 'စားပွဲများ',
                reservations: 'ကြိုတင်မှာယူမှုများ',
                kitchen: 'မီးဖိုချောင်',
                addTable: 'စားပွဲထည့်ပါ',
                refresh: 'ပြန်လည်စတင်',
                seat: 'ထိုင်ပါ',
                reserve: 'ကြိုတင်မှာ',
                block: 'ပိတ်ပါ',
                unblock: 'ဖွင့်ပါ',
                openPOS: 'POS ဖွင့်ပါ',
                generateBill: 'ဘေလ်ထုတ်ပါ',
                viewPay: 'ကြည့်/ပေးချေ',
                viewBill: 'ဘေလ်ကြည့်ပါ',
                markClean: 'သန့်ရှင်းပြီး',
                clear: 'ရှင်းပါ',
                capacity: 'ဆံ့နိုင်မှု',
                
                // Status
                available: 'လွတ်သည်',
                reserved: 'ကြိုတင်မှာထားသည်',
                seated: 'ထိုင်နေသည်',
                billed: 'ဘေလ်ထုတ်ပြီး',
                needsCleaning: 'သန့်ရှင်းရန်လိုသည်',
                blocked: 'ပိတ်ထားသည်',
                
                // POS
                products: 'ပစ္စည်းများ',
                all: 'အားလုံး',
                food: 'အစားအသောက်',
                beverages: 'အဖျော်ယမကာ',
                other: 'အခြား',
                currentOrder: 'လက်ရှိအော်ဒါ',
                clearOrder: 'အော်ဒါရှင်းပါ',
                sendToKitchen: 'မီးဖိုချောင်သို့ပို့ပါ',
                pay: 'ပေးချေပါ',
                order: 'အော်ဒါ',
                total: 'စုစုပေါင်း',
                
                // Payment
                payment: 'ငွေပေးချေမှု',
                cash: 'ငွေသား',
                card: 'ကတ်',
                cancel: 'ပယ်ဖျက်ပါ',
                confirmPayment: 'ပေးချေမှုအတည်ပြုပါ',
                
                // Kitchen
                checker: 'စစ်ဆေးသူ',
                kitchenView: 'မီးဖိုချောင်မြင်ကွင်း',
                completed: 'ပြီးစီးသည်',
                pendingOrder: 'စောင့်ဆိုင်းနေသောအော်ဒါ',
                longestWait: 'အရှည်ကြာဆုံးစောင့်ဆိုင်း(မိနစ်)',
                activeTables: 'လှုပ်ရှားနေသောစားပွဲများ',
                itemsInQueue: 'တန်းစီနေသောပစ္စည်းများ',
                settings: 'ဆက်တင်',
                search: 'ရှာဖွေပါ',
                previous: 'ရှေ့သို့',
                next: 'နောက်သို့',
                
                // Day Management
                startDay: 'နေ့စတင်ပါ',
                endDay: 'နေ့ပိတ်ပြီး အစီရင်ခံစာထုတ်ပါ',
                dayStarted: 'နေ့စတင်ပြီး',
                confirmEndDay: 'နေ့ပိတ်လိုပါသလား? နေ့စဉ်အစီရင်ခံစာထုတ်ပြီး ထွက်သွားပါမည်။',
                dailyReport: 'နေ့စဉ်အစီရင်ခံစာ',
                
                // Messages
                noItems: 'အော်ဒါတွင် ပစ္စည်းမရှိပါ',
                selectPaymentMethod: 'ငွေပေးချေမှုနည်းလမ်းရွေးချယ်ပါ',
                sentToKitchen: 'ပစ္စည်း(များ) မီးဖိုချောင်သို့ပို့ပြီး!',
                tableSeated: 'စားပွဲထိုင်ပြီး! POS ဖွင့်နေသည်...',
                
                // Menu Management
                editMenu: 'မီနူးပြင်ဆင်ပါ',
                doneEditing: 'ပြီးပြီ',
                addItem: 'ထည့်ပါ',
                addNewItem: 'မီနူးအသစ်ထည့်ပါ',
                itemName: 'ပစ္စည်းအမည်',
                enterItemName: 'ပစ္စည်းအမည်ရိုက်ပါ...',
                price: 'စျေးနှုန်း',
                category: 'အမျိုးအစား',
                noCategory: 'အမျိုးအစားမရှိပါ',
                itemNameRequired: 'ပစ္စည်းအမည်လိုအပ်သည်',
                validPriceRequired: 'မှန်ကန်သောစျေးနှုန်းရိုက်ပါ',
                addedToMenu: 'မီနူးသို့ထည့်ပြီး',
                removedFromMenu: 'မီနူးမှဖယ်ရှားပြီး',
                confirmRemove: 'ဖယ်ရှားမှာသေချာပါသလား?',
                
                // Table Management
                editTable: 'စားပွဲပြင်ဆင်ပါ',
                tableName: 'စားပွဲအမည်',
                tableNumber: 'စားပွဲနံပါတ်',
                shape: 'ပုံသဏ္ဍာန်',
                round: 'စက်ဝိုင်း',
                square: 'စတုရန်း',
                rectangle: 'ထောင့်မှန်စတုဂံ',
                save: 'သိမ်းပါ',
                tableUpdated: 'စားပွဲပြင်ဆင်ပြီး',
                tableDeleted: 'စားပွဲဖျက်ပြီး',
                tableAdded: 'စားပွဲထည့်ပြီး',
                failedToUpdateTable: 'စားပွဲပြင်ဆင်မှုမအောင်မြင်ပါ',
                failedToDeleteTable: 'စားပွဲဖျက်မှုမအောင်မြင်ပါ',
                tableNumberRequired: 'စားပွဲနံပါတ်လိုအပ်သည်',
                confirmDeleteTable: '{name} ကိုဖျက်မှာသေချာပါသလား?',
                
                // Misc
                modules: 'မော်ဂျူးများ',
                table: 'စားပွဲ',
                guests: 'ဧည့်သည်များ',
                items: 'ပစ္စည်းများ',
                pending: 'စောင့်ဆိုင်းနေသည်',
                preparing: 'ပြင်ဆင်နေသည်',
                ready: 'အဆင်သင့်ဖြစ်ပြီ',
                served: 'ပေးပြီး'
            }
        };

        this.init();
    }

    // Translation helper
    t(key) {
        return this.translations[this.currentLanguage]?.[key] || this.translations.en[key] || key;
    }
    
    // Toast notification system
    toast(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close">×</button>
        `;
        
        // Click to dismiss
        toast.addEventListener('click', () => this.dismissToast(toast));
        
        container.appendChild(toast);
        
        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => this.dismissToast(toast), duration);
        }
        
        return toast;
    }
    
    dismissToast(toast) {
        if (!toast || toast.classList.contains('toast-exit')) return;
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }
    
    // Toggle language
    toggleLanguage() {
        this.currentLanguage = this.currentLanguage === 'en' ? 'my' : 'en';
        localStorage.setItem('pos_language', this.currentLanguage);
        this.updateUILanguage();
    }
    
    // Update all UI text based on current language
    updateUILanguage() {
        // Update language toggle button
        const langBtn = document.getElementById('language-toggle-btn');
        if (langBtn) {
            langBtn.textContent = this.currentLanguage === 'en' ? '🇲🇲 MY' : '🇬🇧 EN';
        }
        
        // Refresh current view to apply translations
        if (!document.getElementById('login-screen').classList.contains('hidden')) {
            // Update login screen
            document.querySelector('#login-form button[type="submit"]').textContent = this.t('login');
            document.getElementById('username').placeholder = this.t('username');
            document.getElementById('password').placeholder = this.t('password');
        }
        
        // Update other screens as needed
        this.updateStaticLabels();
    }
    
    updateStaticLabels() {
        // Module screen
        const moduleTitle = document.querySelector('.module-header-title');
        if (moduleTitle && !document.getElementById('module-screen').classList.contains('hidden')) {
            moduleTitle.textContent = this.t('selectModule');
        }
        
        // Restaurant tabs
        document.querySelectorAll('.restaurant-tab').forEach(tab => {
            const key = tab.dataset.tab;
            if (key === 'tables') tab.textContent = this.t('tables');
            if (key === 'reservations') tab.textContent = this.t('reservations');
            if (key === 'kitchen') tab.textContent = this.t('kitchen');
        });
    }
    
    // Format currency (integer baht, no decimals)
    formatCurrency(amount) {
        const num = Math.round(Number(amount) || 0);
        return `${this.currency}${num}`;
    }
    
    // Format currency from cents (integer baht, no decimals)
    formatCurrencyFromCents(cents) {
        const num = Math.round((Number(cents) || 0) / 100);
        return `${this.currency}${num}`;
    }

    init() {
        this.bindEvents();
        this.checkDayStatus();
        this.restoreSession(); // Try to restore session before showing login
        this.updateUILanguage();
    }
    
    // Restore session from localStorage
    async restoreSession() {
        const savedUser = localStorage.getItem('pos_user');
        const authToken = localStorage.getItem('authToken');
        
        if (savedUser && authToken) {
            try {
                // Validate token with server
                const response = await fetch(`${this.apiBase}/auth/validate`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ sessionId: authToken })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.valid) {
                        this.currentUser = data.user || JSON.parse(savedUser);
                        this.sessionId = authToken;
                        await this.loadOrderOpsConfig();
                        this.showModuleScreen();
                        this.toast('Session restored', 'success', 2000);
                        return;
                    }
                }
            } catch (e) {
                // Session invalid, clear and show login
            }
            // Clear invalid session
            localStorage.removeItem('pos_user');
            localStorage.removeItem('pos_session');
            localStorage.removeItem('authToken');
        }
        this.showLoginScreen();
    }

    bindEvents() {
        // Login
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.logout();
        });
        document.getElementById('dashboard-logout-btn').addEventListener('click', () => {
            this.logout();
        });
        document.getElementById('restaurant-logout-btn').addEventListener('click', () => {
            this.logout();
        });
        
        // Language toggle
        document.getElementById('language-toggle-btn')?.addEventListener('click', () => {
            this.toggleLanguage();
        });

        // Module selection
        document.getElementById('module-restaurant-btn').addEventListener('click', () => {
            this.openModule('restaurant');
        });

        // Loyalty module card click
        document.querySelector('[data-module="loyalty"]')?.addEventListener('click', () => {
            this.openModule('loyalty');
        });

        document.getElementById('modules-btn').addEventListener('click', () => {
            this.clearTableContext();
            this.showModuleScreen();
        });

        document.getElementById('restaurant-back-btn').addEventListener('click', () => {
            this.showModuleScreen();
        });

        document.getElementById('restaurant-pos-btn').addEventListener('click', () => {
            this.openPOS();
        });

        // Quick toggle from POS back to Tables
        document.getElementById('pos-tables-btn').addEventListener('click', () => {
            this.showRestaurantScreen();
        });

        document.getElementById('add-table-btn').addEventListener('click', () => {
            this.addTable();
        });

        document.getElementById('refresh-tables-btn').addEventListener('click', () => {
            this.loadRestaurantTables();
        });

        document.getElementById('refresh-kitchen-btn').addEventListener('click', () => {
            this.loadKitchenQueue();
        });

        // Kitchen navigation buttons
        document.querySelectorAll('.kitchen-nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                document.querySelectorAll('.kitchen-nav-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                this.kitchenViewMode = view;
                this.loadKitchenQueue();
            });
        });

        document.getElementById('kitchen-search-btn')?.addEventListener('click', () => {
            const query = prompt('Search for order or item:');
            if (query) this.searchKitchenItems(query);
        });

        document.getElementById('kitchen-prev-btn')?.addEventListener('click', () => {
            if (this.kitchenPage > 0) {
                this.kitchenPage--;
                this.loadKitchenQueue();
            }
        });

        document.getElementById('kitchen-next-btn')?.addEventListener('click', () => {
            this.kitchenPage++;
            this.loadKitchenQueue();
        });

        document.querySelector('.kitchen-settings-btn')?.addEventListener('click', () => {
            this.showKitchenSettings();
        });

        document.querySelectorAll('.restaurant-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.setRestaurantTab(e.target.dataset.tab);
            });
        });

        document.getElementById('add-reservation-btn').addEventListener('click', () => {
            this.addReservation();
        });

        document.getElementById('refresh-reservations-btn').addEventListener('click', () => {
            this.loadReservations();
        });

        document.getElementById('add-waitlist-btn').addEventListener('click', () => {
            this.addWaitlistEntry();
        });

        document.getElementById('refresh-waitlist-btn').addEventListener('click', () => {
            this.loadWaitlist();
        });

        document.getElementById('reservation-date').addEventListener('change', () => {
            this.loadReservations();
        });

        // Category tabs
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchCategory(e.target.dataset.category);
            });
        });

        // Menu edit toggle
        document.getElementById('menu-edit-toggle')?.addEventListener('click', () => {
            this.toggleMenuEditMode();
        });

        // Order actions
        document.getElementById('clear-order-btn').addEventListener('click', () => {
            this.clearOrder();
        });

        document.getElementById('print-bill-btn').addEventListener('click', () => {
            if (this.activeOrderId) {
                this.printReceiptToThermal(this.activeOrderId);
            } else {
                this.toast('No order to print. Send items to kitchen first.', 'error');
            }
        });

        document.getElementById('send-kitchen-btn').addEventListener('click', () => {
            this.sendToKitchen();
        });

        document.getElementById('pay-btn').addEventListener('click', () => {
            this.showPaymentModal();
        });

        // Payment modal
        document.querySelectorAll('.payment-method').forEach(method => {
            method.addEventListener('click', (e) => {
                this.selectPaymentMethod(e.target);
            });
        });

        document.getElementById('cancel-payment-btn').addEventListener('click', () => {
            this.hidePaymentModal();
        });

        document.getElementById('confirm-payment-btn').addEventListener('click', () => {
            this.processPayment();
        });

        // Receipt modal
        document.getElementById('close-receipt-btn').addEventListener('click', () => {
            this.hideReceiptModal();
        });

        // ========== LOYALTY MODULE EVENT BINDINGS ==========
        
        // Loyalty nav tabs
        document.querySelectorAll('.loyalty-nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const panel = e.currentTarget.dataset.panel;
                this.setLoyaltyTab(panel);
            });
        });

        // Loyalty module navigation
        document.getElementById('loyalty-modules-btn')?.addEventListener('click', () => {
            this.showModuleScreen();
        });

        // Add customer button
        document.getElementById('loyalty-add-customer-btn')?.addEventListener('click', () => {
            this.showAddCustomerModal();
        });

        // Customer search
        document.getElementById('customer-search-btn')?.addEventListener('click', () => {
            this.searchCustomers();
        });
        document.getElementById('customer-search')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchCustomers();
        });
        // Live search with debounce
        document.getElementById('customer-search')?.addEventListener('input', (e) => {
            clearTimeout(this.customerSearchDebounce);
            this.customerSearchDebounce = setTimeout(() => {
                this.loyaltyPage = 1;
                this.loadLoyaltyCustomers();
            }, 300);
        });

        // Pagination
        document.getElementById('customers-prev-btn')?.addEventListener('click', () => {
            if (this.loyaltyPage > 1) {
                this.loyaltyPage--;
                this.loadLoyaltyCustomers();
            }
        });
        document.getElementById('customers-next-btn')?.addEventListener('click', () => {
            if (this.loyaltyPage * this.loyaltyPageSize < this.loyaltyTotalCustomers) {
                this.loyaltyPage++;
                this.loadLoyaltyCustomers();
            }
        });

        // Close modals
        document.getElementById('close-customer-detail')?.addEventListener('click', () => {
            document.getElementById('customer-detail-modal').classList.add('hidden');
        });
        document.getElementById('close-add-customer')?.addEventListener('click', () => {
            document.getElementById('add-customer-modal').classList.add('hidden');
        });
        document.getElementById('cancel-add-customer')?.addEventListener('click', () => {
            document.getElementById('add-customer-modal').classList.add('hidden');
        });

        // Edit customer modal events
        document.getElementById('close-edit-customer')?.addEventListener('click', () => {
            document.getElementById('edit-customer-modal').classList.add('hidden');
        });
        document.getElementById('cancel-edit-customer')?.addEventListener('click', () => {
            document.getElementById('edit-customer-modal').classList.add('hidden');
        });
        document.getElementById('edit-customer-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCustomerEdit();
        });

        // Delete customer modal events
        document.getElementById('close-delete-customer')?.addEventListener('click', () => {
            document.getElementById('delete-customer-modal').classList.add('hidden');
        });
        document.getElementById('cancel-delete-customer')?.addEventListener('click', () => {
            document.getElementById('delete-customer-modal').classList.add('hidden');
        });
        document.getElementById('delete-customer-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.deleteCustomer();
        });

        // Add customer form
        document.getElementById('add-customer-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createCustomer();
        });

        // ========== CUSTOMER LOOKUP IN POS ==========
        
        document.getElementById('lookup-customer-btn')?.addEventListener('click', () => {
            this.showCustomerLookupModal();
        });
        
        document.getElementById('close-customer-lookup')?.addEventListener('click', () => {
            document.getElementById('customer-lookup-modal').classList.add('hidden');
        });
        
        document.getElementById('customer-lookup-search-btn')?.addEventListener('click', () => {
            this.searchCustomerLookup();
        });
        
        document.getElementById('customer-lookup-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchCustomerLookup();
        });
        
        document.getElementById('customer-lookup-new-btn')?.addEventListener('click', () => {
            document.getElementById('customer-lookup-modal').classList.add('hidden');
            this.showAddCustomerModal();
        });
    }

    // ========================================================================
    // PHASE 1: Load Order Operations Config
    // ========================================================================
    
    async loadOrderOpsConfig() {
        try {
            // Load void reasons (at /config/ not /api/)
            const voidRes = await fetch('/config/void-reasons');
            if (voidRes.ok) {
                this.voidReasons = await voidRes.json();
            }
            
            // Load discount types (at /config/ not /api/)
            const discountRes = await fetch('/config/discount-types');
            if (discountRes.ok) {
                this.discountTypes = await discountRes.json();
            }
            
            // Load user permissions (at /users/ not /api/users/)
            if (this.currentUser?.username) {
                const permRes = await fetch(`/users/me/permissions?userId=${this.currentUser.username}`);
                if (permRes.ok) {
                    const permData = await permRes.json();
                    this.userPermissions = permData.permissions || {};
                }
            }
        } catch (error) {
            console.error('Failed to load order ops config:', error);
        }
    }
    
    hasPermission(permission) {
        return this.userPermissions[permission] === true;
    }
    
    // Day Management
    checkDayStatus() {
        const today = new Date().toISOString().split('T')[0];
        const savedDate = localStorage.getItem('pos_day_date');
        const savedStartTime = localStorage.getItem('pos_day_start');
        
        if (savedDate === today && savedStartTime) {
            this.dayStarted = true;
            this.dayStartTime = new Date(savedStartTime);
        } else {
            this.dayStarted = false;
            this.dayStartTime = null;
        }
    }
    
    async startDay() {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        localStorage.setItem('pos_day_date', today);
        localStorage.setItem('pos_day_start', now.toISOString());
        
        this.dayStarted = true;
        this.dayStartTime = now;
        
        this.showMessage(this.t('dayStarted') + ': ' + now.toLocaleTimeString(), 'success');
        this.updateDayStatusUI();
    }
    
    async endDay() {
        if (!confirm(this.t('confirmEndDay'))) {
            return;
        }
        
        try {
            // Call backend to archive orders and reset kitchen
            const response = await fetch('/api/end-day', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.currentUser.username })
            });
            
            if (!response.ok) {
                const error = await response.json();
                this.toast(error.error || 'Failed to end day', 'error');
                return;
            }
            
            const result = await response.json();
            console.log('Day ended:', result);
            
            // Generate and print daily report
            await this.printDailyReport();
            
            // Clear day status
            localStorage.removeItem('pos_day_date');
            localStorage.removeItem('pos_day_start');
            this.dayStarted = false;
            this.dayStartTime = null;
            
            // Logout
            this.logout();
        } catch (error) {
            this.toast('Failed to end day: ' + error.message, 'error');
        }
    }
    
    async printDailyReport() {
        // Always use midnight today as start time to capture full day's sales
        const startTime = new Date();
        startTime.setHours(0, 0, 0, 0);
        const endTime = new Date();
        
        // Create report modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content daily-report">
                <h2>📊 ${this.t('dailyReport')}</h2>
                <div class="report-header">
                    <p><strong>Date:</strong> ${startTime.toLocaleDateString()}</p>
                    <p><strong>Start:</strong> ${startTime.toLocaleTimeString()}</p>
                    <p><strong>End:</strong> ${endTime.toLocaleTimeString()}</p>
                </div>
                <div class="report-content" id="daily-report-content">
                    <p>Loading report data...</p>
                </div>
                <div class="report-actions">
                    <button id="report-print-btn">🖨️ Print to Thermal</button>
                    <button id="report-close-btn">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add event listeners for buttons
        modal.querySelector('#report-print-btn').addEventListener('click', async () => {
            await this.printDailyReportToThermal(startTime, endTime);
        });
        modal.querySelector('#report-close-btn').addEventListener('click', () => modal.remove());
        
        // Fetch report data from backend
        try {
            const params = new URLSearchParams({
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                _t: Date.now() // Cache buster
            });
            
            console.log('Fetching daily report with params:', params.toString());
            const response = await fetch(`/api/daily-report?${params}`);
            const reportContent = document.getElementById('daily-report-content');
            
            if (!response.ok) {
                reportContent.innerHTML = `<p class="error">Failed to load report data</p>`;
                return;
            }
            
            const data = await response.json();
            console.log('Daily report data:', data);
            
            // Format payments section
            let paymentsHtml = '';
            if (data.payments.cash) {
                paymentsHtml += `<p>Cash: ${this.currency}${Math.round(data.payments.cash.totalCents / 100)} (${data.payments.cash.count} transactions)</p>`;
            }
            if (data.payments.card) {
                paymentsHtml += `<p>Card: ${this.currency}${Math.round(data.payments.card.totalCents / 100)} (${data.payments.card.count} transactions)</p>`;
            }
            if (data.payments.qr) {
                paymentsHtml += `<p>QR: ${this.currency}${Math.round(data.payments.qr.totalCents / 100)} (${data.payments.qr.count} transactions)</p>`;
            }
            if (!paymentsHtml) {
                paymentsHtml = '<p>No payments recorded</p>';
            }
            
            // Format top items section
            let topItemsHtml = '';
            if (data.topItems && data.topItems.length > 0) {
                topItemsHtml = '<ul class="top-items-list">';
                data.topItems.slice(0, 5).forEach(item => {
                    topItemsHtml += `<li>${item.name}: ${item.quantity} sold (${this.currency}${Math.round(item.revenueCents / 100)})</li>`;
                });
                topItemsHtml += '</ul>';
            } else {
                topItemsHtml = '<p>No items sold</p>';
            }
            
            reportContent.innerHTML = `
                <div class="report-section">
                    <h3>Sales Summary</h3>
                    <p>Total Orders: ${data.orders.total}</p>
                    <p>Completed Orders: ${data.orders.completed}</p>
                    <p>Subtotal: ${this.currency}${Math.round(data.orders.subtotalCents / 100)}</p>
                    <p>Tax: ${this.currency}${Math.round(data.orders.taxCents / 100)}</p>
                    <p><strong>Total Revenue: ${this.currency}${Math.round(data.orders.totalRevenueCents / 100)}</strong></p>
                </div>
                <div class="report-section">
                    <h3>Payments</h3>
                    ${paymentsHtml}
                </div>
                <div class="report-section">
                    <h3>Tables Served</h3>
                    <p>Total Tables: ${data.tablesServed}</p>
                </div>
                <div class="report-section">
                    <h3>Top Selling Items</h3>
                    ${topItemsHtml}
                </div>
            `;
        } catch (error) {
            console.error('Failed to load report:', error);
            const reportContent = document.getElementById('daily-report-content');
            if (reportContent) {
                reportContent.innerHTML = `<p class="error">Failed to load report: ${error.message}</p>`;
            }
        }
    }
    
    // Print daily report to thermal printer
    async printDailyReportToThermal(startTime, endTime) {
        try {
            this.toast('Printing report...', 'info');
            
            const response = await fetch(`${this.apiBase}/api/print/daily-report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString(),
                    businessName: 'Rio Chicken',
                    currency: this.currency
                })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                this.toast('Daily report printed! ✅', 'success');
            } else {
                throw new Error(result.error || 'Print failed');
            }
        } catch (error) {
            console.error('Thermal print error:', error);
            this.toast('Print failed: ' + error.message, 'error');
        }
    }
    
    // Print receipt for an order
    async printReceiptToThermal(orderId) {
        try {
            this.toast('Printing receipt...', 'info');
            
            const response = await fetch(`${this.apiBase}/api/print/receipt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: orderId,
                    businessName: 'UNIVERSAL POS'
                })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                this.toast('Receipt printed! 🧾', 'success');
            } else {
                throw new Error(result.error || 'Print failed');
            }
        } catch (error) {
            console.error('Thermal print error:', error);
            this.toast('Print failed: ' + error.message, 'error');
        }
    }
    
    // Print current bill (for the order in progress)
    async printCurrentBill() {
        if (!this.activeOrderId || !this.currentOrder) {
            this.toast('No order to print. Send items to kitchen first.', 'error');
            return;
        }
        
        // Build printable receipt HTML
        const items = this.currentOrder.items.filter(i => !i.voided);
        const subtotal = items.reduce((sum, i) => sum + (i.totalPrice || 0), 0);
        const tax = 0; // No tax for now
        const total = subtotal + tax;
        
        let itemsHtml = items.map(item => `
            <tr>
                <td>${item.quantity}x ${item.name}</td>
                <td style="text-align:right">${this.currency}${(item.totalPrice || 0).toFixed(2)}</td>
            </tr>
        `).join('');
        
        const receiptHtml = `
            <html>
            <head>
                <title>Receipt - Order #${this.activeOrderId}</title>
                <style>
                    body { font-family: monospace; font-size: 12px; width: 80mm; margin: 0 auto; padding: 10px; }
                    h1 { text-align: center; font-size: 16px; margin: 5px 0; }
                    h2 { text-align: center; font-size: 14px; margin: 5px 0; }
                    hr { border: 1px dashed #000; }
                    table { width: 100%; border-collapse: collapse; }
                    td { padding: 2px 0; }
                    .total { font-weight: bold; font-size: 14px; }
                    .center { text-align: center; }
                    .footer { margin-top: 20px; text-align: center; font-size: 10px; }
                </style>
            </head>
            <body>
                <h1>UNIVERSAL POS</h1>
                <hr>
                <h2>RECEIPT</h2>
                <hr>
                <p>Order #: ${this.activeOrderId}</p>
                <p>Table: ${this.activeTableName || 'Walk-in'}</p>
                <p>Date: ${new Date().toLocaleString()}</p>
                <hr>
                <table>${itemsHtml}</table>
                <hr>
                <table>
                    <tr><td>Subtotal:</td><td style="text-align:right">${this.currency}${subtotal.toFixed(2)}</td></tr>
                    <tr><td>Tax:</td><td style="text-align:right">${this.currency}${tax.toFixed(2)}</td></tr>
                    <tr class="total"><td>TOTAL:</td><td style="text-align:right">${this.currency}${total.toFixed(2)}</td></tr>
                </table>
                <hr>
                <p class="footer">Thank you for your visit!</p>
            </body>
            </html>
        `;
        
        // Open print dialog
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        printWindow.document.write(receiptHtml);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    }
    
    updateDayStatusUI() {
        const dayStatusEl = document.getElementById('day-status');
        if (dayStatusEl) {
            if (this.dayStarted) {
                dayStatusEl.innerHTML = `
                    <span class="day-active">🟢 ${this.t('dayStarted')}</span>
                    <button id="end-day-btn" class="end-day-btn">${this.t('endDay')}</button>
                `;
                document.getElementById('end-day-btn')?.addEventListener('click', () => this.endDay());
            } else {
                dayStatusEl.innerHTML = `
                    <button id="start-day-btn" class="start-day-btn">${this.t('startDay')}</button>
                `;
                document.getElementById('start-day-btn')?.addEventListener('click', () => this.startDay());
            }
        }
    }

    // Authentication
    async login() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch(`${this.apiBase}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            const isSuccess = response.ok && (data.success || data.sessionId);
            if (isSuccess) {
                this.currentUser = data.user || { username };
                this.sessionId = data.sessionId || null;
                
                // Save session to localStorage for persistence
                localStorage.setItem('pos_user', JSON.stringify(this.currentUser));
                localStorage.setItem('pos_session', this.sessionId || '');
                
                if (data.token) {
                    localStorage.setItem('authToken', data.token);
                }
                this.showMessage(this.t('loginSuccess'), 'success');
                
                // Load order operations config (void reasons, discount types, permissions)
                await this.loadOrderOpsConfig();
                
                // Check if day needs to be started
                this.checkDayStatus();
                if (!this.dayStarted) {
                    await this.startDay();
                }
                
                this.showModuleScreen();
            } else {
                this.showMessage(data.error || 'Login failed', 'error');
            }
        } catch (error) {
            this.showMessage('Network error', 'error');
        }
    }

    logout() {
        fetch(`${this.apiBase}/auth/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessionId: this.sessionId }),
        });

        // Clear saved session
        localStorage.removeItem('pos_user');
        localStorage.removeItem('pos_session');
        localStorage.removeItem('authToken');
        
        this.currentUser = null;
        this.sessionId = null;
        this.currentOrder = null;
        this.activeTableId = null;
        this.activeTableLabel = null;
        this.activeOrderId = null;
        this.showLoginScreen();
    }

    // Screen management
    showLoginScreen() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('module-screen').classList.add('hidden');
        document.getElementById('restaurant-screen').classList.add('hidden');
        document.getElementById('pos-screen').classList.add('hidden');
        document.getElementById('username').focus();
    }

    showModuleScreen() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('restaurant-screen').classList.add('hidden');
        document.getElementById('pos-screen').classList.add('hidden');
        document.getElementById('loyalty-screen').classList.add('hidden');
        document.getElementById('module-screen').classList.remove('hidden');
        document.getElementById('dashboard-user').textContent = this.currentUser.username;
        this.loadSystemStatus();
    }

    async loadSystemStatus() {
        const container = document.getElementById('system-status-content');
        try {
            const response = await fetch(`${this.apiBase}/build/info`);
            
            // Handle restricted access in production
            if (response.status === 401 || response.status === 403) {
                container.innerHTML = `
                    <div class="status-item">
                        <div class="label">Server Status</div>
                        <div class="value">● Online (restricted)</div>
                    </div>
                `;
                return;
            }
            
            const info = await response.json();
            
            const healthResponse = await fetch(`${this.apiBase}/api/health`);
            const health = await healthResponse.json();
            
            // Build status items - handle missing fields gracefully (production mode)
            let statusItems = `
                <div class="status-item ok">
                    <div class="label">Server Status</div>
                    <div class="value">● Online</div>
                </div>
                <div class="status-item">
                    <div class="label">Port</div>
                    <div class="value">${info.port}</div>
                </div>`;
            
            // Only show database info if provided (development only)
            if (info.dbName) {
                statusItems += `
                <div class="status-item">
                    <div class="label">Database</div>
                    <div class="value">${info.dbName}</div>
                </div>`;
            }
            if (info.dbHost) {
                statusItems += `
                <div class="status-item">
                    <div class="label">DB Host</div>
                    <div class="value">${info.dbHost}:${info.dbPort}</div>
                </div>`;
            }
            
            statusItems += `
                <div class="status-item">
                    <div class="label">Node Version</div>
                    <div class="value">${info.nodeVersion}</div>
                </div>
                <div class="status-item">
                    <div class="label">Money Format</div>
                    <div class="value">${info.moneyFormat || 'decimal'}</div>
                </div>
                <div class="status-item">
                    <div class="label">History Pattern</div>
                    <div class="value">${info.historyPattern || 'n/a'}</div>
                </div>
                <div class="status-item">
                    <div class="label">Hardened Version</div>
                    <div class="value">${info.hardenedVersion || 'n/a'}</div>
                </div>
                <div class="status-item">
                    <div class="label">Environment</div>
                    <div class="value">${info.environment || 'unknown'}</div>
                </div>
                <div class="status-item">
                    <div class="label">Started At</div>
                    <div class="value">${new Date(info.startedAt).toLocaleTimeString()}</div>
                </div>
            `;
            
            container.innerHTML = statusItems;
        } catch (error) {
            container.innerHTML = `
                <div class="status-item error">
                    <div class="label">Server Status</div>
                    <div class="value">● Offline</div>
                </div>
            `;
        }
    }

    showRestaurantScreen() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('module-screen').classList.add('hidden');
        document.getElementById('pos-screen').classList.add('hidden');
        document.getElementById('restaurant-screen').classList.remove('hidden');
        document.getElementById('restaurant-user').textContent = this.currentUser.username;
        const dateInput = document.getElementById('reservation-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().slice(0, 10);
        }
        
        // Update language toggle button text
        const langBtn = document.getElementById('language-toggle-btn');
        if (langBtn) {
            langBtn.textContent = this.currentLanguage === 'en' ? '🇲🇲 MY' : '🇬🇧 EN';
        }
        
        // Update day status
        this.updateDayStatusUI();
        
        this.setRestaurantTab('tables');
        this.loadRestaurantTables();
    }

    showPOSScreen() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('module-screen').classList.add('hidden');
        document.getElementById('restaurant-screen').classList.add('hidden');
        document.getElementById('pos-screen').classList.remove('hidden');
        document.getElementById('current-user').textContent = this.currentUser.username;
        if (this.activeTableId) {
            document.getElementById('table-label').classList.remove('hidden');
            document.getElementById('current-table').textContent = this.activeTableLabel || this.activeTableId;
        } else {
            document.getElementById('table-label').classList.add('hidden');
        }
        // Only create new order if there's no existing order to load
        // (loadExistingOrder will be called separately if activeOrderId is set)
        if (!this.activeOrderId) {
            this.createNewOrder();
        }
    }

    openModule(moduleName) {
        if (moduleName === 'restaurant') {
            this.showRestaurantScreen();
        } else if (moduleName === 'loyalty') {
            this.showLoyaltyScreen();
        }
    }

    openPOS() {
        this.showPOSScreen();
        this.loadProducts();
    }

    setRestaurantTab(tab) {
        this.restaurantTab = tab;
        document.querySelectorAll('.restaurant-tab').forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tab);
        });

        document.getElementById('restaurant-tables-panel').classList.toggle('hidden', tab !== 'tables');
        document.getElementById('restaurant-reservations-panel').classList.toggle('hidden', tab !== 'reservations');
        document.getElementById('restaurant-kitchen-panel').classList.toggle('hidden', tab !== 'kitchen');

        if (tab === 'tables') {
            this.loadRestaurantTables();
        } else if (tab === 'reservations') {
            this.loadReservations();
            this.loadWaitlist();
        } else if (tab === 'kitchen') {
            this.loadKitchenQueue();
        }
    }

    clearTableContext() {
        this.activeTableId = null;
        this.activeTableLabel = null;
        this.activeOrderId = null;
    }

    async loadRestaurantTables() {
        try {
            const response = await fetch(`${this.apiBase}/restaurant/tables`);
            const tables = await response.json();
            this.renderTables(tables);
        } catch (error) {
            console.error('Failed to load tables:', error);
        }
    }

    renderTables(tables) {
        const grid = document.getElementById('table-grid');
        grid.innerHTML = '';
        this.restaurantTables = tables || [];
        
        // Sort tables by table number
        const sortedTables = [...(tables || [])].sort((a, b) => {
            const numA = parseInt(a.table_number) || a.id;
            const numB = parseInt(b.table_number) || b.id;
            return numA - numB;
        });
        
        // Calculate grid layout: 4 tables per row
        const tablesPerRow = 4;
        const totalTables = sortedTables.length;
        const rows = Math.ceil((totalTables + 1) / tablesPerRow); // +1 for add button
        
        sortedTables.forEach((table) => {
            const card = this.createTableCard(table);
            grid.appendChild(card);
        });
        
        // Add the "+" button for adding new tables
        const addCard = document.createElement('div');
        addCard.className = 'table-card-new add-table-card';
        addCard.innerHTML = `
            <div class="add-table-icon">+</div>
            <div class="add-table-text">${this.t('addTable')}</div>
        `;
        addCard.addEventListener('click', () => this.addTable());
        grid.appendChild(addCard);
    }
    
    createTableCard(table) {
        const card = document.createElement('div');
        const status = table.status || 'available';
        card.className = `table-card-new status-${status.replace('_', '-')}`;
        
        // Get status color class for header
        let headerClass = 'table-header-available';
        let statusIcon = '✓';
        let statusText = this.t('available');
        
        switch (status) {
            case 'available':
                headerClass = 'table-header-available';
                statusIcon = '✓';
                statusText = this.t('available');
                break;
            case 'reserved':
                headerClass = 'table-header-reserved';
                statusIcon = '📅';
                statusText = this.t('reserved');
                break;
            case 'seated':
                headerClass = 'table-header-seated';
                statusIcon = '🍽️';
                statusText = this.t('seated');
                break;
            case 'billed':
                headerClass = 'table-header-billed';
                statusIcon = '💵';
                statusText = this.t('billed');
                break;
            case 'needs_cleaning':
                headerClass = 'table-header-cleaning';
                statusIcon = '🧹';
                statusText = this.t('needsCleaning');
                break;
            case 'blocked':
                headerClass = 'table-header-blocked';
                statusIcon = '🚫';
                statusText = this.t('blocked');
                break;
        }
        
        // Build action buttons based on status
        let actionsHtml = '';
        switch (status) {
            case 'available':
                actionsHtml = `
                    <button class="table-action-btn primary" data-action="seat">${this.t('seat')}</button>
                    <button class="table-action-btn secondary" data-action="block">${this.t('block')}</button>
                    <button class="table-action-btn edit" data-action="edit">✏️</button>
                    <button class="table-action-btn delete" data-action="delete">🗑️</button>
                `;
                break;
            case 'reserved':
                actionsHtml = `
                    <button class="table-action-btn primary" data-action="seat">${this.t('seat')}</button>
                `;
                break;
            case 'seated':
                // Show unseat button if no items ordered yet
                const hasItems = table.items && table.items.length > 0;
                actionsHtml = `
                    <button class="table-action-btn primary" data-action="open-pos">${this.t('openPOS')}</button>
                    ${!hasItems ? '<button class="table-action-btn danger" data-action="unseat">✕ Unseat</button>' : '<button class="table-action-btn kitchen" data-action="bill">📋</button>'}
                `;
                break;
            case 'billed':
                actionsHtml = `
                    <button class="table-action-btn primary" data-action="open-pos">${this.t('pay')}</button>
                `;
                break;
            case 'needs_cleaning':
                actionsHtml = `
                    <button class="table-action-btn primary" data-action="clean">✓ ${this.t('clear')}</button>
                `;
                break;
            case 'blocked':
                actionsHtml = `
                    <button class="table-action-btn secondary" data-action="unblock">${this.t('unblock')}</button>
                    <button class="table-action-btn edit" data-action="edit">✏️</button>
                    <button class="table-action-btn delete" data-action="delete">🗑️</button>
                `;
                break;
        }
        
        // Build items list if table has orders
        let itemsHtml = '';
        if (table.items && table.items.length > 0) {
            const itemsList = table.items.slice(0, 5).map(item => 
                `<div class="table-order-item">
                    <span class="item-name">${item.product_name}</span>
                    <span class="item-qty">x${item.quantity}</span>
                </div>`
            ).join('');
            const moreCount = table.items.length > 5 ? `<div class="table-order-more">+${table.items.length - 5} more</div>` : '';
            itemsHtml = `<div class="table-order-items">${itemsList}${moreCount}</div>`;
        }
        
        card.innerHTML = `
            <div class="table-card-header ${headerClass}">
                <div class="table-card-info">
                    <span class="table-icon">🪑</span>
                    <span class="table-number">${table.name || this.t('table') + ' ' + table.table_number}</span>
                </div>
                <div class="table-card-meta">
                    <span class="table-status-badge">${statusIcon} ${statusText}</span>
                </div>
            </div>
            <div class="table-card-body">
                <div class="table-info-row">
                    <span class="table-capacity">${['seated', 'billed'].includes(status) && table.guest_count ? `👥 ${table.guest_count} ${this.t('guests')}` : `${this.t('capacity')}: ${table.capacity}`}</span>
                    ${table.items && table.items.length > 0 ? `<span class="table-item-count">${table.items.length} ${this.t('items')}</span>` : ''}
                </div>
                ${itemsHtml}
            </div>
            <div class="table-card-actions">${actionsHtml}</div>
        `;
        
        // Bind action handlers
        card.querySelectorAll('button[data-action]').forEach((button) => {
            const action = button.dataset.action;
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleTableAction(table, action);
            });
        });
        
        // Click on card opens POS if seated or billed
        if (['seated', 'billed'].includes(status)) {
            card.style.cursor = 'pointer';
            card.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON') {
                    this.handleTableAction(table, 'open-pos');
                }
            });
        }
        
        return card;
    }

    formatStatus(status) {
        const statusLabels = {
            'available': '✓ Available',
            'reserved': '📅 Reserved',
            'seated': '🍽️ Seated',
            'billed': '💵 Billed (Awaiting Payment)',
            'needs_cleaning': '🧹 Needs Cleaning',
            'blocked': '🚫 Blocked',
        };
        return statusLabels[status] || status;
    }

    async handleTableAction(table, action) {
        switch (action) {
            case 'seat':
                await this.seatTable(table.id);
                break;
            case 'unseat':
                await this.unseatTable(table.id);
                break;
            case 'reserve':
                await this.reserveTable(table.id);
                break;
            case 'block':
                await this.blockTable(table.id);
                break;
            case 'unblock':
                await this.unblockTable(table.id);
                break;
            case 'cancel-reserve':
                await this.cancelTableReservation(table.id);
                break;
            case 'open-pos':
                this.selectTable(table);
                break;
            case 'bill':
                await this.generateBill(table);
                break;
            case 'view-bill':
                this.selectTable(table);
                break;
            case 'clean':
                await this.markTableClean(table.id);
                break;
            case 'clear':
                await this.clearTable(table.id);
                break;
            case 'edit':
                this.showEditTableModal(table);
                break;
            case 'delete':
                await this.deleteTable(table);
                break;
        }
    }

    async blockTable(tableId) {
        try {
            const response = await fetch(`${this.apiBase}/restaurant/tables/${tableId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'blocked', userId: this.currentUser.username, notes: 'Blocked by staff' }),
            });

            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to block table', 'error');
                return;
            }

            this.loadRestaurantTables();
        } catch (error) {
            this.showMessage('Failed to block table', 'error');
        }
    }

    async unblockTable(tableId) {
        try {
            const response = await fetch(`${this.apiBase}/restaurant/tables/${tableId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'available', userId: this.currentUser.username, notes: 'Unblocked by staff' }),
            });

            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to unblock table', 'error');
                return;
            }

            this.loadRestaurantTables();
        } catch (error) {
            this.showMessage('Failed to unblock table', 'error');
        }
    }

    async cancelTableReservation(tableId) {
        if (!confirm('Cancel the reservation for this table?')) {
            return;
        }
        try {
            const response = await fetch(`${this.apiBase}/restaurant/tables/${tableId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'available', userId: this.currentUser.username, notes: 'Reservation cancelled' }),
            });

            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to cancel reservation', 'error');
                return;
            }

            this.loadRestaurantTables();
        } catch (error) {
            this.showMessage('Failed to cancel reservation', 'error');
        }
    }

    async generateBill(table) {
        if (!table.order_id) {
            this.showMessage('No active order on this table', 'error');
            return;
        }

        // DOUBLE-CLICK PREVENTION - disable table actions while generating
        if (this.isGeneratingBill) {
            return;
        }
        this.isGeneratingBill = true;

        try {
            // Include customerId if a loyalty customer is linked to the order
            const payload = { userId: this.currentUser.username };
            if (this.orderCustomer) {
                payload.customerId = this.orderCustomer.id;
            }

            const response = await fetch(`/orders/${table.order_id}/bill`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to generate bill', 'error');
                return;
            }

            const bill = await response.json();
            this.showBillModal(bill);
            this.loadRestaurantTables();
        } catch (error) {
            this.showMessage('Failed to generate bill', 'error');
        } finally {
            this.isGeneratingBill = false;
        }
    }

    showBillModal(bill) {
        // Create bill modal if it doesn't exist
        let modal = document.getElementById('bill-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'bill-modal';
            modal.className = 'modal hidden';
            modal.innerHTML = `
                <div class="modal-content bill-modal-content">
                    <h2>📋 Bill</h2>
                    <div id="bill-content"></div>
                    <div class="bill-actions">
                        <button id="close-bill-btn">Close</button>
                        <button id="pay-bill-btn" class="primary">Proceed to Payment</button>
                    </div>
                </div>
            `;
            document.getElementById('app').appendChild(modal);
            
            modal.querySelector('#close-bill-btn').addEventListener('click', () => {
                modal.classList.add('hidden');
            });
            
            modal.querySelector('#pay-bill-btn').addEventListener('click', () => {
                modal.classList.add('hidden');
                // Open POS with the billed order
                const table = this.restaurantTables.find(t => t.order_id === this.currentBill?.orderId);
                if (table) {
                    this.selectTable(table);
                }
            });
        }

        this.currentBill = bill;
        const content = modal.querySelector('#bill-content');
        
        // Build customer info section if loyalty customer is linked
        let customerSection = '';
        if (bill.loyaltyCustomer) {
            customerSection = `
                <div class="bill-customer">
                    <p>👤 <strong>${bill.loyaltyCustomer.name}</strong></p>
                    <p>⭐ ${bill.loyaltyCustomer.points} points</p>
                </div>
            `;
        }
        
        content.innerHTML = `
            <div class="bill-header">
                <p><strong>Order #${bill.orderNumber}</strong></p>
                <p>${new Date().toLocaleString()}</p>
            </div>
            ${customerSection}
            <div class="bill-items">
                ${bill.items.map(item => `
                    <div class="bill-item">
                        <span>${item.name} x${item.quantity}</span>
                        <span>${this.currency}${item.totalPrice.toFixed(0)}</span>
                    </div>
                `).join('')}
            </div>
            <div class="bill-totals">
                <div class="bill-item bill-total">
                    <span><strong>Total</strong></span>
                    <span><strong>${this.currency}${bill.totalAmount.toFixed(0)}</strong></span>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
    }

    async markTableClean(tableId) {
        try {
            const response = await fetch(`${this.apiBase}/restaurant/tables/${tableId}/clear`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.currentUser.username }),
            });

            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to mark table clean', 'error');
                return;
            }

            this.showMessage('Table is now available! ✓', 'success');
            this.loadRestaurantTables();
        } catch (error) {
            this.showMessage('Failed to mark table clean', 'error');
        }
    }

    async reserveTable(tableId) {
        const name = prompt('Reservation name?');
        if (!name) {
            return;
        }
        const partySize = Number(prompt('Party size?', '2'));
        if (!partySize || partySize < 1) {
            return;
        }

        const dateInput = document.getElementById('reservation-date');
        const date = dateInput && dateInput.value ? dateInput.value : new Date().toISOString().slice(0, 10);
        const time = prompt('Time (HH:MM)?', '18:00');
        if (!time) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/restaurant/reservations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerName: name,
                    partySize,
                    requestedDate: date,
                    requestedTime: time,
                    duration: 90,
                    tableId,
                    userId: this.currentUser.username,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to reserve table', 'error');
                return;
            }

            this.loadRestaurantTables();
            this.loadReservations();
        } catch (error) {
            this.showMessage('Failed to reserve table', 'error');
        }
    }

    async seatTable(tableId) {
        // Use modal instead of prompt (prompt may be blocked by CSP in some browsers)
        this.showGuestCountModal(tableId);
    }
    
    showGuestCountModal(tableId) {
        // Remove existing modal if any
        const existingModal = document.getElementById('guest-count-modal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.className = 'modal';  // Use 'modal' class for proper styling
        modal.id = 'guest-count-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>🪑 ${this.t('seat')}</h2>
                <div class="form-group">
                    <label>${this.t('guests')}</label>
                    <input type="number" id="guest-count-input" value="2" min="1" max="50" autofocus>
                </div>
                <div class="modal-actions">
                    <button class="modal-btn cancel" data-action="cancel">${this.t('cancel')}</button>
                    <button class="modal-btn confirm" data-action="confirm">${this.t('seat')}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Focus the input
        setTimeout(() => document.getElementById('guest-count-input')?.focus(), 100);
        
        // Bind event handlers
        modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.querySelector('[data-action="confirm"]').addEventListener('click', async () => {
            const guestCount = parseInt(document.getElementById('guest-count-input').value) || 2;
            modal.remove();
            await this.doSeatTable(tableId, guestCount);
        });
        
        // Enter key submits
        document.getElementById('guest-count-input').addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                const guestCount = parseInt(document.getElementById('guest-count-input').value) || 2;
                modal.remove();
                await this.doSeatTable(tableId, guestCount);
            }
        });
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }
    
    async doSeatTable(tableId, guestCount) {
        if (!guestCount || guestCount < 1) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/restaurant/tables/${tableId}/seat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.currentUser.username,
                    guestCount,
                }),
            });

            const responseData = await response.json();

            if (!response.ok) {
                this.showMessage(responseData.error || 'Failed to seat table', 'error');
                return;
            }

            // Set active table and order, then open POS
            this.activeTableId = tableId;
            this.activeOrderId = responseData.orderId;
            
            // Initialize currentOrder if null
            if (!this.currentOrder) {
                this.currentOrder = { items: [], total: 0 };
            }
            this.currentOrder.id = responseData.orderId;
            
            this.showMessage('Table seated! Opening POS...', 'success');
            this.loadRestaurantTables();
            this.openPOS();
        } catch (error) {
            this.showMessage('Failed to seat table', 'error');
        }
    }

    async clearTable(tableId) {
        try {
            const response = await fetch(`${this.apiBase}/restaurant/tables/${tableId}/clear`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.currentUser.username }),
            });

            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to clear table', 'error');
                return;
            }

            await response.json();
            this.loadRestaurantTables();
        } catch (error) {
            this.showMessage('Failed to clear table', 'error');
        }
    }

    async unseatTable(tableId) {
        // Unseat a table that has no orders - customer left before ordering
        try {
            const response = await fetch(`${this.apiBase}/restaurant/tables/${tableId}/unseat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.currentUser.username }),
            });

            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to unseat table', 'error');
                return;
            }

            this.showMessage('Table is now available', 'success');
            this.loadRestaurantTables();
        } catch (error) {
            this.showMessage('Failed to unseat table', 'error');
        }
    }

    async addTable() {
        // Use modal instead of prompt (prompt may be blocked by CSP)
        this.showAddTableModal();
    }
    
    showAddTableModal() {
        // Remove existing modal if any
        const existingModal = document.getElementById('add-table-modal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'add-table-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>➕ ${this.t('addTable')}</h2>
                <div class="form-group">
                    <label>${this.t('tableNumber')}</label>
                    <input type="text" id="add-table-number" placeholder="1, 2, A1..." autofocus>
                </div>
                <div class="form-group">
                    <label>${this.t('capacity')}</label>
                    <input type="number" id="add-table-capacity" value="4" min="1" max="50">
                </div>
                <div class="modal-actions">
                    <button class="modal-btn cancel" data-action="cancel">${this.t('cancel')}</button>
                    <button class="modal-btn confirm" data-action="confirm">${this.t('addTable')}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Focus the input
        setTimeout(() => document.getElementById('add-table-number')?.focus(), 100);
        
        // Bind event handlers
        modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.querySelector('[data-action="confirm"]').addEventListener('click', async () => {
            const tableNumber = document.getElementById('add-table-number').value.trim();
            const capacity = parseInt(document.getElementById('add-table-capacity').value) || 4;
            
            if (!tableNumber) {
                this.showMessage(this.t('tableNumberRequired'), 'error');
                return;
            }
            
            modal.remove();
            await this.doAddTable(tableNumber, capacity);
        });
        
        // Enter key submits
        modal.querySelectorAll('input').forEach(input => {
            input.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter') {
                    const tableNumber = document.getElementById('add-table-number').value.trim();
                    const capacity = parseInt(document.getElementById('add-table-capacity').value) || 4;
                    
                    if (!tableNumber) {
                        this.showMessage(this.t('tableNumberRequired'), 'error');
                        return;
                    }
                    
                    modal.remove();
                    await this.doAddTable(tableNumber, capacity);
                }
            });
        });
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }
    
    async doAddTable(tableNumber, capacity) {
        try {
            const response = await fetch(`${this.apiBase}/restaurant/tables`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tableNumber, capacity: capacity || 4 }),
            });

            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to add table', 'error');
                return;
            }

            await response.json();
            this.showMessage(this.t('tableAdded'), 'success');
            this.loadRestaurantTables();
        } catch (error) {
            this.showMessage('Failed to add table', 'error');
        }
    }

    showEditTableModal(table) {
        // Remove existing modal if any
        const existingModal = document.getElementById('edit-table-modal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'edit-table-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>✏️ ${this.t('editTable')}</h2>
                <div class="form-group">
                    <label>${this.t('tableName')}</label>
                    <input type="text" id="edit-table-name" value="${table.name || ''}" placeholder="${this.t('table')} ${table.table_number}">
                </div>
                <div class="form-group">
                    <label>${this.t('capacity')}</label>
                    <input type="number" id="edit-table-capacity" value="${table.capacity || 4}" min="1" max="50">
                </div>
                <div class="form-group">
                    <label>${this.t('shape')}</label>
                    <select id="edit-table-shape">
                        <option value="round" ${table.shape === 'round' ? 'selected' : ''}>${this.t('round')}</option>
                        <option value="square" ${table.shape === 'square' ? 'selected' : ''}>${this.t('square')}</option>
                        <option value="rectangle" ${table.shape === 'rectangle' ? 'selected' : ''}>${this.t('rectangle')}</option>
                    </select>
                </div>
                <div class="modal-actions">
                    <button class="modal-btn cancel" data-action="cancel">${this.t('cancel')}</button>
                    <button class="modal-btn confirm" data-action="save">${this.t('save')}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Bind event handlers
        modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.querySelector('[data-action="save"]').addEventListener('click', async () => {
            const name = document.getElementById('edit-table-name').value.trim();
            const capacity = parseInt(document.getElementById('edit-table-capacity').value) || 4;
            const shape = document.getElementById('edit-table-shape').value;
            
            await this.updateTable(table.id, { name, capacity, shape });
            modal.remove();
        });
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }
    
    async updateTable(tableId, data) {
        try {
            const response = await fetch(`${this.apiBase}/restaurant/tables/${tableId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            
            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || this.t('failedToUpdateTable'), 'error');
                return;
            }
            
            this.showMessage(this.t('tableUpdated'), 'success');
            this.loadRestaurantTables();
        } catch (error) {
            this.showMessage(this.t('failedToUpdateTable'), 'error');
        }
    }
    
    async deleteTable(table) {
        const confirmMsg = this.t('confirmDeleteTable').replace('{name}', table.name || `${this.t('table')} ${table.table_number}`);
        if (!confirm(confirmMsg)) {
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/restaurant/tables/${table.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
            });
            
            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || this.t('failedToDeleteTable'), 'error');
                return;
            }
            
            this.showMessage(this.t('tableDeleted'), 'success');
            this.loadRestaurantTables();
        } catch (error) {
            this.showMessage(this.t('failedToDeleteTable'), 'error');
        }
    }

    selectTable(table) {
        console.log('selectTable called with table:', table);
        this.activeTableId = table.id;
        this.activeTableLabel = table.table_number;
        this.activeOrderId = table.order_id || null;
        console.log('selectTable - activeOrderId set to:', this.activeOrderId);
        this.openPOS();
        if (this.activeOrderId) {
            console.log('selectTable - calling loadExistingOrder with:', this.activeOrderId);
            this.loadExistingOrder(this.activeOrderId);
        }
    }

    async loadKitchenQueue() {
        try {
            const response = await fetch(`${this.apiBase}/restaurant/kitchen/queue`);
            const items = await response.json();
            const grid = document.getElementById('kitchen-table-grid');
            const completedList = document.getElementById('completed-list');
            const completedSidebar = document.getElementById('kitchen-completed-sidebar');
            
            // Clear both areas
            grid.innerHTML = '';
            completedList.innerHTML = '';

            // Separate items by status
            const pendingItems = [];
            const completedItems = [];
            
            items.forEach((item) => {
                const status = item.status || 'pending';
                if (status === 'served' || status === 'completed') {
                    completedItems.push(item);
                } else {
                    pendingItems.push(item);
                }
            });

            // Handle different view modes
            if (this.kitchenViewMode === 'checker') {
                this.renderCheckerView(pendingItems, grid);
                completedSidebar.style.display = 'none';
            } else if (this.kitchenViewMode === 'completed') {
                this.renderCompletedView(completedItems, grid);
                completedSidebar.style.display = 'none';
            } else {
                // Kitchen view (default)
                this.renderKitchenView(pendingItems, completedItems, grid, completedList);
                completedSidebar.style.display = 'flex';
            }

            // Update stats
            this.updateKitchenStats(pendingItems, items);
            
        } catch (error) {
            console.error('Failed to load kitchen queue:', error);
        }
    }

    renderCheckerView(items, grid) {
        if (!items.length) {
            grid.innerHTML = `
                <div class="kitchen-empty-state">
                    <div class="icon">☰</div>
                    <div>No items to check</div>
                </div>
            `;
            return;
        }

        // Paginate items
        const startIdx = this.kitchenPage * this.kitchenPageSize;
        const pageItems = items.slice(startIdx, startIdx + this.kitchenPageSize);
        
        if (pageItems.length === 0 && this.kitchenPage > 0) {
            this.kitchenPage = 0;
            this.loadKitchenQueue();
            return;
        }

        // Group by order for checker view
        const orderGroups = {};
        pageItems.forEach(item => {
            const orderId = item.orderId || item.orderid || item.order_id;
            const orderNumber = item.orderNumber || item.ordernumber || item.order_number || orderId;
            if (!orderGroups[orderId]) {
                orderGroups[orderId] = {
                    orderId,
                    orderNumber,
                    tableLabel: item.tableLabel || item.tablelabel || item.table_label || 'Take Away',
                    items: [],
                    createdAt: item.createdAt || item.created_at
                };
            }
            orderGroups[orderId].items.push(item);
        });

        Object.values(orderGroups).forEach(order => {
            const card = document.createElement('div');
            card.className = 'kitchen-table-card checker-card';
            
            // Check if all items are ready
            const allReady = order.items.every(item => (item.status || 'pending') === 'ready');
            
            const itemsHtml = order.items.map(item => {
                const productName = item.productName || item.productname || item.product_name || 'Unknown';
                const quantity = item.quantity || 1;
                const status = item.status || 'pending';
                
                return `
                    <div class="kitchen-item-row" data-item-id="${item.ticketItemId || item.id}" data-status="${status}">
                        <input type="checkbox" class="checker-checkbox" ${status === 'ready' ? 'checked' : ''}>
                        <span class="kitchen-item-qty">${quantity}x</span>
                        <span class="kitchen-item-name">${productName}</span>
                        <span class="kitchen-item-status-badge ${status}">${status.toUpperCase()}</span>
                    </div>
                `;
            }).join('');

            card.innerHTML = `
                <div class="kitchen-table-header ${allReady ? 'ready' : ''}">
                    <div class="kitchen-table-info">
                        <span class="kitchen-table-icon">📋</span>
                        <span class="kitchen-table-number">Order #${order.orderNumber}</span>
                    </div>
                    <div class="kitchen-table-meta">
                        <span>${order.tableLabel}</span>
                    </div>
                </div>
                <div class="kitchen-items-list">${itemsHtml}</div>
                <div class="checker-actions">
                    ${allReady 
                        ? `<button class="checker-complete-btn" data-order-id="${order.orderId}">✓ Complete Order</button>`
                        : `<button class="checker-mark-all-btn" data-order-id="${order.orderId}">✓ Mark All Ready</button>`
                    }
                </div>
            `;

            // Add checkbox click handlers
            card.querySelectorAll('.checker-checkbox').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    const row = e.target.closest('.kitchen-item-row');
                    const itemId = row.dataset.itemId;
                    const newStatus = e.target.checked ? 'ready' : 'preparing';
                    this.advanceKitchenStatus(itemId, e.target.checked ? 'preparing' : 'pending');
                });
            });

            // Mark all ready button
            card.querySelector('.checker-mark-all-btn')?.addEventListener('click', () => {
                this.markAllItemsReady(order.orderId, order.items);
            });

            // Complete order button (when all items are ready)
            card.querySelector('.checker-complete-btn')?.addEventListener('click', () => {
                this.completeOrder(order.orderId);
            });

            grid.appendChild(card);
        });
    }

    renderCompletedView(items, grid) {
        if (!items.length) {
            grid.innerHTML = `
                <div class="kitchen-empty-state">
                    <div class="icon">✓</div>
                    <div>No completed orders</div>
                </div>
            `;
            return;
        }

        // Paginate
        const startIdx = this.kitchenPage * this.kitchenPageSize;
        const pageItems = items.slice(startIdx, startIdx + this.kitchenPageSize);
        
        if (pageItems.length === 0 && this.kitchenPage > 0) {
            this.kitchenPage = 0;
            this.loadKitchenQueue();
            return;
        }

        // Group by order
        const orderGroups = {};
        pageItems.forEach(item => {
            const orderId = item.orderId || item.orderid || item.order_id;
            if (!orderGroups[orderId]) {
                orderGroups[orderId] = {
                    orderId,
                    orderNumber: item.orderNumber || item.ordernumber || orderId,
                    tableLabel: item.tableLabel || item.tablelabel || 'Take Away',
                    items: []
                };
            }
            orderGroups[orderId].items.push(item);
        });

        Object.values(orderGroups).forEach(order => {
            const card = document.createElement('div');
            card.className = 'kitchen-table-card completed-card';
            
            const itemsHtml = order.items.map(item => {
                const productName = item.productName || item.productname || 'Unknown';
                const quantity = item.quantity || 1;
                return `
                    <div class="kitchen-item-row completed-row" data-item-id="${item.ticketItemId || item.id}">
                        <span class="kitchen-item-qty">${quantity}x</span>
                        <span class="kitchen-item-name">${productName}</span>
                        <span class="kitchen-item-status-icon done">✓</span>
                    </div>
                `;
            }).join('');

            card.innerHTML = `
                <div class="kitchen-table-header ready">
                    <div class="kitchen-table-info">
                        <span class="kitchen-table-icon">✓</span>
                        <span class="kitchen-table-number">Order #${order.orderNumber}</span>
                    </div>
                    <div class="kitchen-table-meta">
                        <span>${order.tableLabel}</span>
                    </div>
                </div>
                <div class="kitchen-items-list">${itemsHtml}</div>
                <div class="checker-actions">
                    <button class="reopen-order-btn" data-order-id="${order.orderId}">↩ Reopen Order</button>
                </div>
            `;

            card.querySelector('.reopen-order-btn')?.addEventListener('click', () => {
                this.reopenOrder(order.orderId);
            });

            grid.appendChild(card);
        });
    }

    renderKitchenView(pendingItems, completedItems, grid, completedList) {
        if (!pendingItems.length) {
            grid.innerHTML = `
                <div class="kitchen-empty-state">
                    <div class="icon">🍳</div>
                    <div>No pending orders</div>
                </div>
            `;
        } else {
            // Group items by table
            const tableGroups = {};
            
            pendingItems.forEach((item) => {
                const tableId = item.tableId || item.tableid || item.table_id || 'takeaway';
                const tableLabel = item.tableLabel || item.tablelabel || item.table_label || `Table ${tableId}`;
                
                if (!tableGroups[tableId]) {
                    tableGroups[tableId] = {
                        tableId,
                        tableLabel,
                        items: [],
                        orderNumber: item.orderNumber || item.ordernumber || item.order_number,
                        createdAt: item.createdAt || item.created_at || new Date().toISOString()
                    };
                }
                tableGroups[tableId].items.push(item);
            });

            // Paginate table groups
            const tableArray = Object.values(tableGroups);
            const startIdx = this.kitchenPage * this.kitchenPageSize;
            const pageTables = tableArray.slice(startIdx, startIdx + this.kitchenPageSize);
            
            if (pageTables.length === 0 && this.kitchenPage > 0) {
                this.kitchenPage = 0;
                this.loadKitchenQueue();
                return;
            }

            pageTables.forEach((table) => {
                if (table.items.length === 0) return;
                const card = this.createKitchenTableCard(table);
                grid.appendChild(card);
            });
        }

        // Render completed items in sidebar
        completedItems.slice(0, 20).forEach((item) => {
            const completedEl = this.createCompletedItem(item);
            completedList.appendChild(completedEl);
        });
    }

    async markAllItemsReady(orderId, items) {
        try {
            for (const item of items) {
                const itemId = item.ticketItemId || item.ticketitemid || item.id;
                const currentStatus = item.status || 'pending';
                if (currentStatus !== 'ready' && currentStatus !== 'served') {
                    await fetch(`${this.apiBase}/restaurant/kitchen/items/${itemId}/status`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'ready' }),
                    });
                }
            }
            this.showMessage('All items marked as ready!', 'success');
            this.loadKitchenQueue();
        } catch (error) {
            this.showMessage('Failed to update items', 'error');
        }
    }

    async completeOrder(orderId) {
        try {
            const response = await fetch(`${this.apiBase}/restaurant/kitchen/orders/${orderId}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to complete order', 'error');
                return;
            }

            this.showMessage('Order completed!', 'success');
            this.loadKitchenQueue();
        } catch (error) {
            this.showMessage('Failed to complete order', 'error');
        }
    }

    async reopenOrder(orderId) {
        try {
            const response = await fetch(`${this.apiBase}/restaurant/kitchen/orders/${orderId}/reopen`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to reopen order', 'error');
                return;
            }

            this.showMessage('Order reopened!', 'success');
            this.loadKitchenQueue();
        } catch (error) {
            this.showMessage('Failed to reopen order', 'error');
        }
    }

    showKitchenSettings() {
        const autoRefresh = this.kitchenAutoRefresh ? 'ON' : 'OFF';
        const choice = prompt(
            `Kitchen Settings:\n\n` +
            `1. Toggle Auto-Refresh (currently ${autoRefresh})\n` +
            `2. Set Page Size (currently ${this.kitchenPageSize})\n` +
            `3. Clear All Completed\n\n` +
            `Enter choice (1-3):`
        );
        
        if (choice === '1') {
            if (this.kitchenAutoRefresh) {
                clearInterval(this.kitchenAutoRefresh);
                this.kitchenAutoRefresh = null;
                this.showMessage('Auto-refresh disabled', 'info');
            } else {
                this.kitchenAutoRefresh = setInterval(() => this.loadKitchenQueue(), 10000);
                this.showMessage('Auto-refresh enabled (10s)', 'success');
            }
        } else if (choice === '2') {
            const size = prompt('Enter page size (6, 12, 24):', String(this.kitchenPageSize));
            const num = parseInt(size, 10);
            if ([6, 12, 24].includes(num)) {
                this.kitchenPageSize = num;
                this.kitchenPage = 0;
                this.loadKitchenQueue();
                this.showMessage(`Page size set to ${num}`, 'success');
            }
        } else if (choice === '3') {
            if (confirm('Mark all served items as complete? This cannot be undone.')) {
                this.showMessage('Completed items cleared from view', 'info');
            }
        }
    }

    createKitchenTableCard(table) {
        const card = document.createElement('div');
        card.className = 'kitchen-table-card';
        
        // Calculate wait time
        const createdTime = new Date(table.createdAt);
        const now = new Date();
        const waitMinutes = Math.floor((now - createdTime) / 60000);
        
        // Determine header status based on items
        const statuses = table.items.map(i => i.status || 'pending');
        let headerClass = '';
        if (statuses.every(s => s === 'ready')) {
            headerClass = 'ready';
        } else if (statuses.some(s => s === 'preparing')) {
            headerClass = 'preparing';
        }
        
        // Build items HTML
        const itemsHtml = table.items.map((item) => {
            const productName = item.productName || item.productname || item.product_name || 'Unknown';
            const quantity = item.quantity || 1;
            const status = item.status || 'pending';
            const isTakeAway = table.tableId === 'takeaway';
            
            let statusIcon = '';
            if (status === 'ready') {
                statusIcon = '<span class="kitchen-item-status-icon done">✓</span>';
            } else if (status === 'preparing') {
                statusIcon = '<span class="kitchen-item-status-icon">🔥</span>';
            }
            
            return `
                <div class="kitchen-item-row" data-item-id="${item.ticketItemId || item.ticketitemid || item.id}" data-status="${status}">
                    <span class="kitchen-item-qty">${quantity}x</span>
                    <span class="kitchen-item-name">${productName}</span>
                    ${isTakeAway ? '<span class="kitchen-item-tag">(Take Away)</span>' : ''}
                    ${statusIcon}
                </div>
            `;
        }).join('');
        
        card.innerHTML = `
            <div class="kitchen-table-header ${headerClass}">
                <div class="kitchen-table-info">
                    <span class="kitchen-table-icon">🪑</span>
                    <span class="kitchen-table-number">${table.tableLabel}</span>
                </div>
                <div class="kitchen-table-meta">
                    <span class="kitchen-pending-count">Pending ${table.items.length} item(s)</span>
                    <span class="kitchen-wait-time">⏱ WAIT TIME: ${waitMinutes} min(s)</span>
                </div>
            </div>
            <div class="kitchen-items-list">
                ${itemsHtml}
            </div>
        `;
        
        // Add click handlers for items
        card.querySelectorAll('.kitchen-item-row').forEach((row) => {
            row.addEventListener('click', () => {
                const itemId = row.dataset.itemId;
                const currentStatus = row.dataset.status;
                this.advanceKitchenStatus(itemId, currentStatus);
            });
        });
        
        return card;
    }

    createCompletedItem(item) {
        const el = document.createElement('div');
        el.className = 'completed-item';
        
        const productName = item.productName || item.productname || item.product_name || 'Unknown';
        const tableLabel = item.tableLabel || 'Unknown';
        const ticketId = item.ticketItemId || item.ticketitemid || item.id;
        
        el.innerHTML = `
            <div class="completed-item-header">
                <span class="completed-table-num">${tableLabel}</span>
            </div>
            <div class="completed-item-name">${productName}</div>
            <button class="reopen-btn" data-id="${ticketId}">RE-OPEN</button>
        `;
        
        el.querySelector('.reopen-btn').addEventListener('click', () => {
            this.reopenKitchenItem(ticketId);
        });
        
        return el;
    }

    updateKitchenStats(pendingItems, allItems) {
        // pendingItems is an array of items (not table groups)
        const itemsArray = Array.isArray(pendingItems) ? pendingItems : [];
        const allItemsArray = Array.isArray(allItems) ? allItems : [];
        
        const pendingCount = itemsArray.length;
        
        // Count unique tables from pending items
        const tableSet = new Set();
        itemsArray.forEach(item => {
            const tableId = item.tableId || item.tableid || item.table_id;
            if (tableId) tableSet.add(tableId);
        });
        const activeTablesCount = tableSet.size;
        
        // Calculate longest wait from all items
        let longestWait = 0;
        itemsArray.forEach(item => {
            const createdAt = item.createdAt || item.created_at;
            if (createdAt) {
                const wait = (new Date() - new Date(createdAt)) / 60000;
                if (wait > longestWait) longestWait = wait;
            }
        });
        const waitMins = Math.floor(longestWait);
        const waitSecs = Math.floor((longestWait % 1) * 60);
        
        document.getElementById('stat-pending-orders').textContent = pendingCount;
        document.getElementById('stat-longest-wait').textContent = `${waitMins}:${String(waitSecs).padStart(2, '0')}`;
        document.getElementById('stat-active-tables').textContent = activeTablesCount;
        document.getElementById('stat-queue-items').textContent = allItemsArray.length;
    }

    async reopenKitchenItem(itemId) {
        try {
            const response = await fetch(`${this.apiBase}/restaurant/kitchen/items/${itemId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'pending' }),
            });

            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to reopen item', 'error');
                return;
            }

            this.loadKitchenQueue();
        } catch (error) {
            this.showMessage('Failed to reopen item', 'error');
        }
    }

    async advanceKitchenStatus(itemId, currentStatus) {
        const nextStatus = this.getNextKitchenStatus(currentStatus);
        if (!nextStatus) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/restaurant/kitchen/items/${itemId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: nextStatus }),
            });

            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to update kitchen item', 'error');
                return;
            }

            await response.json();
            this.loadKitchenQueue();
        } catch (error) {
            this.showMessage('Failed to update kitchen item', 'error');
        }
    }

    getNextKitchenStatus(status) {
        const flow = {
            pending: 'preparing',
            preparing: 'ready',
            ready: 'served',
        };
        return flow[status] || null;
    }

    async searchKitchenItems(query) {
        if (!query || !query.trim()) return;
        
        try {
            const response = await fetch(`${this.apiBase}/restaurant/kitchen/queue`);
            const items = await response.json();
            
            const searchTerm = query.toLowerCase().trim();
            const filtered = items.filter(item => {
                const productName = (item.productName || item.productname || item.product_name || '').toLowerCase();
                const orderNumber = String(item.orderNumber || item.ordernumber || item.order_number || '').toLowerCase();
                const tableLabel = (item.tableLabel || item.tablelabel || item.table_label || '').toLowerCase();
                
                return productName.includes(searchTerm) || 
                       orderNumber.includes(searchTerm) || 
                       tableLabel.includes(searchTerm);
            });
            
            if (filtered.length === 0) {
                this.showMessage(`No items found matching "${query}"`, 'info');
                return;
            }
            
            this.showMessage(`Found ${filtered.length} matching item(s)`, 'success');
            this.renderFilteredKitchenQueue(filtered);
        } catch (error) {
            this.showMessage('Search failed', 'error');
        }
    }

    renderFilteredKitchenQueue(items) {
        const grid = document.getElementById('kitchen-table-grid');
        grid.innerHTML = '';

        const tableGroups = {};
        items.forEach(item => {
            const tableId = item.tableId || item.tableid || item.table_id || 'takeaway';
            const tableLabel = item.tableLabel || item.tablelabel || item.table_label || `Table ${tableId}`;
            
            if (!tableGroups[tableId]) {
                tableGroups[tableId] = {
                    tableId,
                    tableLabel,
                    items: [],
                    createdAt: item.createdAt || item.created_at || new Date().toISOString()
                };
            }
            tableGroups[tableId].items.push(item);
        });

        Object.values(tableGroups).forEach(table => {
            if (table.items.length === 0) return;
            const card = this.createKitchenTableCard(table);
            grid.appendChild(card);
        });
    }

    async loadReservations() {
        try {
            const dateInput = document.getElementById('reservation-date');
            const date = dateInput && dateInput.value ? dateInput.value : '';
            const url = date ? `${this.apiBase}/restaurant/reservations?date=${date}` : `${this.apiBase}/restaurant/reservations`;
            const response = await fetch(url);
            const reservations = await response.json();
            this.renderReservations(reservations);
        } catch (error) {
            console.error('Failed to load reservations:', error);
        }
    }

    renderReservations(reservations) {
        const list = document.getElementById('reservation-list');
        list.innerHTML = '';

        if (!reservations || reservations.length === 0) {
            list.innerHTML = '<div>No reservations found.</div>';
            return;
        }

        reservations.forEach((reservation) => {
            const card = document.createElement('div');
            card.className = 'reservation-card';
            card.innerHTML = `
                <div><strong>${reservation.customer_name}</strong> (${reservation.party_size})</div>
                <div>${reservation.requested_date} ${reservation.requested_time}</div>
                <div class="reservation-status">Status: ${reservation.status}</div>
                <div>Table: ${reservation.table_number || 'Unassigned'}</div>
                <div class="reservation-actions">
                    <button data-action="confirm">Confirm</button>
                    <button data-action="arrive">Arrive</button>
                    <button data-action="assign">Assign Table</button>
                    <button data-action="cancel">Cancel</button>
                    <button data-action="no_show">No Show</button>
                </div>
            `;

            card.querySelectorAll('button').forEach((button) => {
                const action = button.dataset.action;
                if (action === 'assign') {
                    button.addEventListener('click', () => this.assignReservationTable(reservation));
                } else if (action === 'arrive') {
                    button.addEventListener('click', () => this.arriveReservation(reservation.id));
                } else {
                    button.addEventListener('click', () => this.updateReservationStatus(reservation.id, action === 'confirm' ? 'confirmed' : action));
                }
            });

            list.appendChild(card);
        });
    }

    async addReservation() {
        const customerName = prompt('Customer name?');
        if (!customerName) return;
        const partySize = Number(prompt('Party size?', '2'));
        if (!partySize || partySize < 1) return;
        const dateInput = document.getElementById('reservation-date');
        const requestedDate = dateInput && dateInput.value ? dateInput.value : new Date().toISOString().slice(0, 10);
        const requestedTime = prompt('Time (HH:MM)?', '18:00');
        if (!requestedTime) return;
        const duration = Number(prompt('Duration (minutes)?', '90')) || 90;

        try {
            const response = await fetch(`${this.apiBase}/restaurant/reservations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerName,
                    partySize,
                    requestedDate,
                    requestedTime,
                    duration,
                    userId: this.currentUser.username,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to create reservation', 'error');
                return;
            }

            this.loadReservations();
        } catch (error) {
            this.showMessage('Failed to create reservation', 'error');
        }
    }

    async updateReservationStatus(reservationId, status) {
        try {
            const response = await fetch(`${this.apiBase}/restaurant/reservations/${reservationId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, userId: this.currentUser.username }),
            });

            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to update reservation', 'error');
                return;
            }

            this.loadReservations();
            this.loadRestaurantTables();
        } catch (error) {
            this.showMessage('Failed to update reservation', 'error');
        }
    }

    async assignReservationTable(reservation) {
        const tableNumber = prompt('Table number to assign?');
        if (!tableNumber) {
            return;
        }
        const table = this.restaurantTables.find(t => String(t.table_number) === String(tableNumber));
        if (!table) {
            this.showMessage('Table not found', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/restaurant/reservations/${reservation.id}/assign-table`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tableId: table.id, userId: this.currentUser.username }),
            });

            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to assign table', 'error');
                return;
            }

            this.loadReservations();
            this.loadRestaurantTables();
        } catch (error) {
            this.showMessage('Failed to assign table', 'error');
        }
    }

    async arriveReservation(reservationId) {
        try {
            const response = await fetch(`${this.apiBase}/restaurant/reservations/${reservationId}/arrive`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.currentUser.username }),
            });

            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to seat reservation', 'error');
                return;
            }

            this.loadReservations();
            this.loadRestaurantTables();
        } catch (error) {
            this.showMessage('Failed to seat reservation', 'error');
        }
    }

    async loadWaitlist() {
        try {
            const response = await fetch(`${this.apiBase}/restaurant/waitlist`);
            const waitlist = await response.json();
            this.renderWaitlist(waitlist);
        } catch (error) {
            console.error('Failed to load waitlist:', error);
        }
    }

    renderWaitlist(waitlist) {
        const list = document.getElementById('waitlist-list');
        list.innerHTML = '';

        if (!waitlist || waitlist.length === 0) {
            list.innerHTML = '<div>No waitlist entries.</div>';
            return;
        }

        waitlist.forEach((entry) => {
            const card = document.createElement('div');
            card.className = 'waitlist-card';
            card.innerHTML = `
                <div><strong>${entry.customer_name}</strong> (${entry.party_size})</div>
                <div class="waitlist-status">Status: ${entry.status}</div>
                <div class="waitlist-actions">
                    <button data-action="notified">Notify</button>
                    <button data-action="seated">Seat</button>
                    <button data-action="cancelled">Cancel</button>
                </div>
            `;

            card.querySelectorAll('button').forEach((button) => {
                const action = button.dataset.action;
                button.addEventListener('click', () => this.updateWaitlistStatus(entry.id, action));
            });

            list.appendChild(card);
        });
    }

    async addWaitlistEntry() {
        const customerName = prompt('Customer name?');
        if (!customerName) return;
        const partySize = Number(prompt('Party size?', '2'));
        if (!partySize || partySize < 1) return;
        const estimatedWaitTime = prompt('Estimated wait time (minutes)?', '20');

        try {
            const response = await fetch(`${this.apiBase}/restaurant/waitlist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerName,
                    partySize,
                    estimatedWaitTime: estimatedWaitTime ? Number(estimatedWaitTime) : null,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to add waitlist entry', 'error');
                return;
            }

            this.loadWaitlist();
        } catch (error) {
            this.showMessage('Failed to add waitlist entry', 'error');
        }
    }

    async updateWaitlistStatus(waitlistId, status) {
        try {
            const response = await fetch(`${this.apiBase}/restaurant/waitlist/${waitlistId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });

            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to update waitlist', 'error');
                return;
            }

            this.loadWaitlist();
        } catch (error) {
            this.showMessage('Failed to update waitlist', 'error');
        }
    }

    // Products
    async loadProducts() {
        try {
            // Load categories first
            await this.loadCategories();
            
            const response = await fetch(`${this.apiBase}/catalog`);
            const products = await response.json();
            this.products = products;
            this.renderProducts();
            return products;
        } catch (error) {
            console.error('Failed to load products:', error);
            return [];
        }
    }
    
    async loadCategories() {
        try {
            const response = await fetch(`${this.apiBase}/api/categories`);
            if (response.ok) {
                this.categories = await response.json();
                this.renderCategoryTabs();
            }
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    }
    
    renderCategoryTabs() {
        const container = document.getElementById('category-tabs');
        if (!container) return;
        
        container.innerHTML = '<button class="category-tab active" data-category="all">All</button>';
        
        this.categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'category-tab';
            btn.dataset.category = cat.name.toLowerCase();
            btn.textContent = cat.name;
            btn.addEventListener('click', () => {
                container.querySelectorAll('.category-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentCategory = cat.name.toLowerCase();
                this.renderProducts(cat.name.toLowerCase());
            });
            container.appendChild(btn);
        });
        
        // Re-bind the "All" button
        container.querySelector('[data-category="all"]').addEventListener('click', (e) => {
            container.querySelectorAll('.category-tab').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            this.currentCategory = 'all';
            this.renderProducts('all');
        });
    }

    renderProducts(category = 'all') {
        const grid = document.getElementById('product-grid');
        grid.innerHTML = '';

        // Add edit mode class to grid container
        const menuSection = grid.parentElement;
        if (this.menuEditMode) {
            menuSection.classList.add('edit-mode');
        } else {
            menuSection.classList.remove('edit-mode');
        }

        const filteredProducts = category === 'all'
            ? this.products
            : this.products.filter(p => p.category && p.category.toLowerCase() === category);

        // Sort products alphabetically by name
        const sortedProducts = [...filteredProducts].sort((a, b) => 
            (a.name || '').localeCompare(b.name || '')
        );

        sortedProducts.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            const price = Number(product.price) || 0;
            card.innerHTML = `
                <button class="delete-btn" data-id="${product.id}" title="Remove item">×</button>
                <button class="edit-btn" data-id="${product.id}" title="Edit item">✏️</button>
                <h3>${product.name}</h3>
                <div class="price">${this.currency}${price.toFixed(0)}</div>
            `;
            
            // Delete button click handler
            const deleteBtn = card.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteProduct(product.id, product.name);
            });
            
            // Edit button click handler
            const editBtn = card.querySelector('.edit-btn');
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showEditProductModal(product);
            });
            
            // Add to order on card click (unless in edit mode)
            card.addEventListener('click', (e) => {
                if (!this.menuEditMode) {
                    this.addToOrder(product);
                }
            });
            
            grid.appendChild(card);
        });

        // Add the "+" card to add new products
        const addCard = document.createElement('div');
        addCard.className = 'add-product-card';
        addCard.innerHTML = `
            <div class="plus-icon">+</div>
            <span>${this.t('addItem')}</span>
        `;
        addCard.addEventListener('click', () => this.showAddProductModal());
        grid.appendChild(addCard);
    }

    toggleMenuEditMode() {
        this.menuEditMode = !this.menuEditMode;
        const editBtn = document.getElementById('menu-edit-toggle');
        if (editBtn) {
            editBtn.textContent = this.menuEditMode ? this.t('doneEditing') : this.t('editMenu');
            editBtn.classList.toggle('active', this.menuEditMode);
        }
        this.renderProducts(this.currentCategory || 'all');
    }

    async showAddProductModal() {
        let modal = document.getElementById('add-product-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'add-product-modal';
            modal.className = 'modal add-product-modal hidden';
            document.getElementById('app').appendChild(modal);
        }

        // Load categories if not loaded
        if (this.categories.length === 0) {
            try {
                const response = await fetch(`${this.apiBase}/api/categories`);
                if (response.ok) {
                    this.categories = await response.json();
                }
            } catch (e) {
                console.log('No categories loaded');
            }
        }

        const categoryOptions = this.categories.map(c => 
            `<option value="${c.id}">${c.name}</option>`
        ).join('');

        modal.innerHTML = `
            <div class="modal-content">
                <h2>${this.t('addNewItem')}</h2>
                <div class="form-group">
                    <label>${this.t('itemName')}:</label>
                    <input type="text" id="new-product-name" placeholder="${this.t('enterItemName')}" required>
                </div>
                <div class="form-group">
                    <label>${this.t('price')} (${this.currency}):</label>
                    <input type="number" id="new-product-price" step="0.01" min="0" placeholder="0.00" required>
                </div>
                <div class="form-group">
                    <label>${this.t('category')}:</label>
                    <select id="new-product-category">
                        <option value="">${this.t('noCategory')}</option>
                        ${categoryOptions}
                    </select>
                </div>
                <div class="modal-actions">
                    <button id="add-product-cancel-btn">${this.t('cancel')}</button>
                    <button class="primary" id="add-product-submit-btn">${this.t('addItem')}</button>
                </div>
            </div>
        `;
        
        // Add event listeners
        modal.querySelector('#add-product-cancel-btn').addEventListener('click', () => this.hideAddProductModal());
        modal.querySelector('#add-product-submit-btn').addEventListener('click', () => this.addProduct());

        modal.classList.remove('hidden');
        document.getElementById('new-product-name').focus();
    }

    hideAddProductModal() {
        const modal = document.getElementById('add-product-modal');
        if (modal) modal.classList.add('hidden');
    }

    async addProduct() {
        const name = document.getElementById('new-product-name').value.trim();
        const price = parseFloat(document.getElementById('new-product-price').value);
        const category = document.getElementById('new-product-category').value || null;

        if (!name) {
            this.toast(this.t('itemNameRequired'), 'warning');
            return;
        }
        if (isNaN(price) || price < 0) {
            this.toast(this.t('validPriceRequired'), 'warning');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/api/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, price, category })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to add product');
            }

            const newProduct = await response.json();
            // Add to local products array
            this.products.push({
                id: newProduct.id,
                name: newProduct.name,
                price: newProduct.base_price || price,
                category: category ? this.categories.find(c => c.id == category)?.name : null
            });

            this.hideAddProductModal();
            this.renderProducts(this.currentCategory || 'all');
            this.showMessage(`${name} ${this.t('addedToMenu')}`, 'success');
        } catch (error) {
            this.toast(error.message, 'error');
        }
    }

    async deleteProduct(productId, productName) {
        if (!confirm(`${this.t('confirmRemove')} "${productName}"?`)) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/api/products/${productId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to remove product');
            }

            // Remove from local products array
            this.products = this.products.filter(p => p.id !== productId);
            this.renderProducts(this.currentCategory || 'all');
            this.showMessage(`${productName} ${this.t('removedFromMenu')}`, 'success');
        } catch (error) {
            this.toast(error.message, 'error');
        }
    }

    async showEditProductModal(product) {
        let modal = document.getElementById('edit-product-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'edit-product-modal';
            modal.className = 'modal edit-product-modal hidden';
            document.getElementById('app').appendChild(modal);
        }

        // Load categories if not loaded
        if (this.categories.length === 0) {
            try {
                const response = await fetch(`${this.apiBase}/api/categories`);
                if (response.ok) {
                    this.categories = await response.json();
                }
            } catch (e) {
                console.log('No categories loaded');
            }
        }

        const currentCategoryId = this.categories.find(c => c.name === product.category)?.id || '';
        const categoryOptions = this.categories.map(c => 
            `<option value="${c.id}" ${c.id == currentCategoryId ? 'selected' : ''}>${c.name}</option>`
        ).join('');

        modal.innerHTML = `
            <div class="modal-content">
                <h2>✏️ Edit Menu Item</h2>
                <input type="hidden" id="edit-product-id" value="${product.id}">
                <div class="form-group">
                    <label>${this.t('itemName')}:</label>
                    <input type="text" id="edit-product-name" value="${product.name}" required>
                </div>
                <div class="form-group">
                    <label>${this.t('price')} (${this.currency}):</label>
                    <input type="number" id="edit-product-price" step="0.01" min="0" value="${product.price || 0}" required>
                </div>
                <div class="form-group">
                    <label>${this.t('category')}:</label>
                    <select id="edit-product-category">
                        <option value="">${this.t('noCategory')}</option>
                        ${categoryOptions}
                    </select>
                </div>
                <div class="modal-actions">
                    <button id="edit-product-cancel-btn">${this.t('cancel')}</button>
                    <button class="primary" id="edit-product-submit-btn">Save Changes</button>
                </div>
            </div>
        `;
        
        // Add event listeners
        modal.querySelector('#edit-product-cancel-btn').addEventListener('click', () => this.hideEditProductModal());
        modal.querySelector('#edit-product-submit-btn').addEventListener('click', () => this.updateProduct());

        modal.classList.remove('hidden');
        document.getElementById('edit-product-name').focus();
    }

    hideEditProductModal() {
        const modal = document.getElementById('edit-product-modal');
        if (modal) modal.classList.add('hidden');
    }

    async updateProduct() {
        const productId = document.getElementById('edit-product-id').value;
        const name = document.getElementById('edit-product-name').value.trim();
        const price = parseFloat(document.getElementById('edit-product-price').value);
        const categoryId = document.getElementById('edit-product-category').value || null;

        if (!name) {
            this.toast(this.t('itemNameRequired'), 'warning');
            return;
        }
        if (isNaN(price) || price < 0) {
            this.toast(this.t('validPriceRequired'), 'warning');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/api/products/${productId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, price, categoryId })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to update product');
            }

            // Update local products array
            const productIndex = this.products.findIndex(p => p.id == productId);
            if (productIndex !== -1) {
                this.products[productIndex].name = name;
                this.products[productIndex].price = price;
                this.products[productIndex].category = categoryId ? this.categories.find(c => c.id == categoryId)?.name : null;
            }

            this.hideEditProductModal();
            this.renderProducts(this.currentCategory || 'all');
            this.showMessage(`${name} updated successfully`, 'success');
        } catch (error) {
            this.toast(error.message, 'error');
        }
    }

    switchCategory(category) {
        this.currentCategory = category;
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        const activeTab = document.querySelector(`[data-category="${category}"]`);
        if (activeTab) activeTab.classList.add('active');
        this.renderProducts(category);
    }

    // Order management
    createNewOrder() {
        this.currentOrder = {
            id: null,
            items: [],
            total: 0,
            idempotencyKey: null,
            paymentKey: null,
        };
        // Clear linked customer for new order
        this.orderCustomer = null;
        this.updateOrderCustomerDisplay();
        this.updateOrderDisplay();
    }

    async loadExistingOrder(orderId) {
        try {
            console.log('loadExistingOrder called with orderId:', orderId);
            if (!this.products.length) {
                await this.loadProducts();
            }
            const response = await fetch(`/orders/${orderId}`);
            console.log('loadExistingOrder response status:', response.status);
            if (!response.ok) {
                this.showMessage('Failed to load existing order', 'error');
                return;
            }
            const order = await response.json();
            console.log('loadExistingOrder order data:', order);
            const items = order.items || [];
            console.log('loadExistingOrder items:', items);
            this.currentOrder = {
                id: order.id,
                items,
                total: items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0),
                idempotencyKey: null,
                paymentKey: null,
            };
            console.log('loadExistingOrder currentOrder set to:', this.currentOrder);
            this.updateOrderDisplay();
        } catch (error) {
            console.error('loadExistingOrder error:', error);
            this.showMessage('Failed to load existing order', 'error');
        }
    }

    addToOrder(product) {
        const existingItem = this.currentOrder.items.find(item => item.productId === product.id && !item.sentToKitchen);

        if (existingItem) {
            existingItem.quantity++;
            existingItem.totalPrice = existingItem.quantity * existingItem.unitPrice;
        } else {
            this.currentOrder.items.push({
                productId: product.id,
                name: product.name,  // Store product name for display and kitchen send
                quantity: 1,
                unitPrice: product.price,
                totalPrice: product.price,
                sentToKitchen: false,
                id: null,  // Will be set after sendToKitchen
            });
        }

        this.updateOrderTotal();
        this.updateOrderDisplay();
    }

    updateOrderTotal() {
        this.currentOrder.total = this.currentOrder.items.reduce((sum, item) => sum + item.totalPrice, 0);
    }

    updateOrderDisplay() {
        const orderItems = document.getElementById('order-items');
        const orderTotal = document.getElementById('order-total');
        const orderNumber = document.getElementById('order-number');

        orderItems.innerHTML = '';
        orderTotal.textContent = this.currentOrder.total.toFixed(0);
        orderNumber.textContent = this.currentOrder.id || 'New';

        this.currentOrder.items.forEach((item, index) => {
            // Use item.name if available (loaded from DB), otherwise find from products
            const product = this.products.find(p => p.id === item.productId);
            const itemName = item.name || (product ? product.name : 'Unknown');
            const itemElement = document.createElement('div');
            
            // Handle voided and comped items
            const isVoided = item.status === 'voided' || item.voided;
            const isComped = item.isComped || item.is_comped;
            const hasDiscount = item.hasDiscount || item.discountApplied;
            
            let itemClass = 'order-item';
            if (item.sentToKitchen) itemClass += ' sent-to-kitchen';
            if (isVoided) itemClass += ' voided';
            if (isComped) itemClass += ' comped';
            if (hasDiscount) itemClass += ' discounted';
            
            itemElement.className = itemClass;
            
            const statusBadge = item.sentToKitchen 
                ? `<span class="kitchen-status ${item.status || 'pending'}">${item.status || 'pending'}</span>` 
                : '';
            
            const voidedBadge = isVoided ? '<span class="void-badge">VOID</span>' : '';
            const compedBadge = isComped ? '<span class="comp-badge">COMP</span>' : '';
            
            // Build discount badge with details - clickable to edit/remove
            let discountBadge = '';
            if (hasDiscount) {
                const discountLabel = item.discountType === 'percentage' 
                    ? `${item.discountValue}%` 
                    : `${this.currency}${item.discountValue}`;
                const savedAmount = item.discountAmountCents 
                    ? (item.discountAmountCents / 100).toFixed(0)
                    : '0.00';
                discountBadge = `<span class="discount-badge clickable" data-index="${index}" title="Click to edit/remove discount">-${discountLabel} (${this.currency}${savedAmount})</span>`;
            }
            
            // Build action buttons based on permissions and item state
            let actionButtonsHtml = '';
            if (item.sentToKitchen && !isVoided && !isComped && this.currentOrder.id) {
                // Show void/discount/comp buttons for kitchen items
                if (this.hasPermission('void_item')) {
                    actionButtonsHtml += `<button class="item-action-btn void-btn" data-action="void" data-index="${index}" title="Void Item">🗑️</button>`;
                }
                if (this.hasPermission('discount_item') && !hasDiscount) {
                    actionButtonsHtml += `<button class="item-action-btn discount-btn" data-action="discount" data-index="${index}" title="Discount">%</button>`;
                }
                if (this.hasPermission('comp_item') && !isComped) {
                    actionButtonsHtml += `<button class="item-action-btn comp-btn" data-action="comp" data-index="${index}" title="Comp (Manager)">🎁</button>`;
                }
            }
            
            itemElement.innerHTML = `
                <div class="item-info">
                    <div>${itemName} ${statusBadge} ${voidedBadge} ${compedBadge} ${discountBadge}</div>
                    <div>${this.currency}${Number(item.unitPrice).toFixed(0)} each</div>
                </div>
                <div class="item-quantity">
                    <button class="quantity-btn qty-minus" data-index="${index}" ${item.sentToKitchen || isVoided ? 'disabled' : ''}>-</button>
                    <span>${item.quantity}</span>
                    <button class="quantity-btn qty-plus" data-index="${index}" ${item.sentToKitchen || isVoided ? 'disabled' : ''}>+</button>
                </div>
                <div class="item-price-actions">
                    <span class="item-total ${isVoided ? 'struck' : ''}">${this.currency}${Number(item.totalPrice).toFixed(0)}</span>
                    <div class="item-actions">${actionButtonsHtml}</div>
                </div>
            `;
            
            // Add event listeners for quantity buttons
            const minusBtn = itemElement.querySelector('.qty-minus');
            const plusBtn = itemElement.querySelector('.qty-plus');
            if (minusBtn) minusBtn.addEventListener('click', () => this.changeQuantity(index, -1));
            if (plusBtn) plusBtn.addEventListener('click', () => this.changeQuantity(index, 1));
            
            // Add event listeners for action buttons
            itemElement.querySelectorAll('.item-action-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const action = btn.dataset.action;
                    const idx = parseInt(btn.dataset.index);
                    if (action === 'void') this.showVoidModal(idx);
                    else if (action === 'discount') this.showDiscountModal(idx);
                    else if (action === 'comp') this.showCompModal(idx);
                });
            });
            
            // Add click listener for discount badge to edit/remove
            const discountBadgeEl = itemElement.querySelector('.discount-badge.clickable');
            if (discountBadgeEl) {
                discountBadgeEl.addEventListener('click', () => {
                    const idx = parseInt(discountBadgeEl.dataset.index);
                    this.showEditDiscountModal(idx);
                });
            }
            
            orderItems.appendChild(itemElement);
        });
    }

    // ========================================================================
    // PHASE 1: Void / Discount / Comp Modals
    // ========================================================================
    
    showVoidModal(itemIndex) {
        const item = this.currentOrder.items[itemIndex];
        const product = this.products.find(p => p.id === item.productId);
        const itemName = item.name || (product ? product.name : 'Unknown');
        
        // Create modal if not exists
        let modal = document.getElementById('void-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'void-modal';
            modal.className = 'modal hidden';
            document.getElementById('app').appendChild(modal);
        }
        
        const reasonOptions = this.voidReasons.map(r => 
            `<option value="${r.id}" data-requires-manager="${r.requiresManager}">${r.description}</option>`
        ).join('');
        
        modal.innerHTML = `
            <div class="modal-content">
                <h2>🗑️ Void Item</h2>
                <p>Item: <strong>${itemName}</strong> x${item.quantity}</p>
                <p>Amount: ${this.currency}${Number(item.totalPrice).toFixed(0)}</p>
                <div class="form-group">
                    <label>Void Reason:</label>
                    <select id="void-reason-select">
                        <option value="">-- Select Reason --</option>
                        ${reasonOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Additional Notes (optional):</label>
                    <input type="text" id="void-reason-text" placeholder="Additional details...">
                </div>
                <div class="modal-actions">
                    <button id="void-cancel-btn">Cancel</button>
                    <button class="danger" id="void-confirm-btn">Void Item</button>
                </div>
            </div>
        `;
        
        // Add event listeners
        modal.querySelector('#void-cancel-btn').addEventListener('click', () => this.hideVoidModal());
        modal.querySelector('#void-confirm-btn').addEventListener('click', () => this.confirmVoid(itemIndex));
        
        modal.classList.remove('hidden');
    }
    
    hideVoidModal() {
        const modal = document.getElementById('void-modal');
        if (modal) modal.classList.add('hidden');
    }
    
    async confirmVoid(itemIndex) {
        const item = this.currentOrder.items[itemIndex];
        const reasonSelect = document.getElementById('void-reason-select');
        const reasonText = document.getElementById('void-reason-text').value;
        const reasonId = reasonSelect.value ? Number(reasonSelect.value) : null;
        
        // DOUBLE-CLICK PREVENTION
        const confirmBtn = document.getElementById('void-confirm-btn');
        if (confirmBtn && confirmBtn.disabled) {
            return; // Already processing
        }
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Processing...';
        }
        
        const resetButton = () => {
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Confirm Void';
            }
        };
        
        if (!reasonId && !reasonText) {
            this.toast('Please select a void reason or provide details', 'warning');
            resetButton();
            return;
        }
        
        // Validate item has database ID
        if (!item.id) {
            this.toast('Item must be sent to kitchen before it can be voided', 'error');
            resetButton();
            return;
        }
        
        if (!this.currentOrder.id) {
            this.toast('Order not saved. Send items to kitchen first.', 'error');
            resetButton();
            return;
        }
        
        try {
            const response = await fetch(`/orders/${this.currentOrder.id}/items/${item.id}/void`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.currentUser.username,
                    reasonId,
                    reasonText
                })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                // Show specific error with status code
                const errorMsg = result.error || 'Failed to void item';
                if (response.status === 403) {
                    this.toast(`Permission denied: ${errorMsg}`, 'error');
                } else if (response.status === 409) {
                    this.toast(`Conflict: ${errorMsg}`, 'warning');
                } else {
                    this.toast(`Error: ${errorMsg}`, 'error');
                }
                resetButton();
                return;
            }
            
            // Update local item state
            item.status = 'voided';
            item.voided = true;
            item.totalPrice = 0;
            item.totalPriceCents = 0;
            
            // Update order total from server response
            if (result.newOrderTotal !== undefined) {
                this.currentOrder.total = Number(result.newOrderTotal);
            } else if (result.newOrderTotalCents !== undefined) {
                this.currentOrder.total = result.newOrderTotalCents / 100;
            } else {
                // Fallback: recalculate locally
                this.currentOrder.total = this.currentOrder.items
                    .filter(i => !i.voided)
                    .reduce((sum, i) => sum + Number(i.totalPrice || 0), 0);
            }
            
            this.updateOrderDisplay();
            this.hideVoidModal();
            this.showMessage('Item voided successfully', 'success');
        } catch (error) {
            this.toast('Failed to void item: ' + error.message, 'error');
            resetButton();
        }
    }
    
    showDiscountModal(itemIndex) {
        const item = this.currentOrder.items[itemIndex];
        const product = this.products.find(p => p.id === item.productId);
        const itemName = item.name || (product ? product.name : 'Unknown');
        
        let modal = document.getElementById('discount-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'discount-modal';
            modal.className = 'modal hidden';
            document.getElementById('app').appendChild(modal);
        }
        
        const discountOptions = this.discountTypes
            .filter(d => !d.requiresManager || this.hasPermission('manager_override'))
            .map(d => `<option value="${d.id}">${d.name} (${d.type === 'percentage' ? d.value + '%' : this.currency + d.value})</option>`)
            .join('');
        
        modal.innerHTML = `
            <div class="modal-content">
                <h2>% Discount Item</h2>
                <p>Item: <strong>${itemName}</strong> x${item.quantity}</p>
                <p>Current Price: ${this.currency}${Number(item.totalPrice).toFixed(0)}</p>
                <div class="form-group">
                    <label>Discount Type:</label>
                    <select id="discount-type-select">
                        <option value="">-- Select Discount --</option>
                        ${discountOptions}
                        <option value="custom">Custom...</option>
                    </select>
                </div>
                <div id="custom-discount-fields" class="hidden">
                    <div class="form-group">
                        <label>Type:</label>
                        <select id="custom-discount-type">
                            <option value="percentage">Percentage</option>
                            <option value="fixed_amount">Fixed Amount</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Value:</label>
                        <input type="number" id="custom-discount-value" placeholder="10" min="0">
                    </div>
                </div>
                <div class="form-group">
                    <label>Reason (optional):</label>
                    <input type="text" id="discount-reason" placeholder="Reason for discount...">
                </div>
                <div class="modal-actions">
                    <button id="discount-cancel-btn">Cancel</button>
                    <button class="primary" id="discount-confirm-btn">Apply Discount</button>
                </div>
            </div>
        `;
        
        // Add event listeners for buttons
        modal.querySelector('#discount-cancel-btn').addEventListener('click', () => this.hideDiscountModal());
        modal.querySelector('#discount-confirm-btn').addEventListener('click', () => this.confirmDiscount(itemIndex));
        
        // Toggle custom fields
        modal.querySelector('#discount-type-select').addEventListener('change', (e) => {
            const customFields = modal.querySelector('#custom-discount-fields');
            customFields.classList.toggle('hidden', e.target.value !== 'custom');
        });
        
        modal.classList.remove('hidden');
    }
    
    hideDiscountModal() {
        const modal = document.getElementById('discount-modal');
        if (modal) modal.classList.add('hidden');
    }
    
    async confirmDiscount(itemIndex) {
        const item = this.currentOrder.items[itemIndex];
        const typeSelect = document.getElementById('discount-type-select');
        const reason = document.getElementById('discount-reason').value;
        
        // DOUBLE-CLICK PREVENTION
        const confirmBtn = document.getElementById('discount-confirm-btn');
        if (confirmBtn && confirmBtn.disabled) {
            return; // Already processing
        }
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Processing...';
        }
        
        const resetButton = () => {
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Apply Discount';
            }
        };
        
        let body = {
            userId: this.currentUser.username,
            reason
        };
        
        if (typeSelect.value === 'custom') {
            body.discountType = document.getElementById('custom-discount-type').value;
            body.discountValue = Number(document.getElementById('custom-discount-value').value);
            
            if (!body.discountValue || body.discountValue <= 0) {
                this.toast('Please enter a valid discount value', 'warning');
                resetButton();
                return;
            }
        } else if (typeSelect.value) {
            body.discountTypeId = Number(typeSelect.value);
        } else {
            this.toast('Please select a discount type', 'warning');
            resetButton();
            return;
        }
        
        try {
            const response = await fetch(`/orders/${this.currentOrder.id}/items/${item.id}/discount`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            
            if (!response.ok) {
                const error = await response.json();
                this.toast(error.error || 'Failed to apply discount', 'error');
                resetButton();
                return;
            }
            
            const result = await response.json();
            
            // Update local item state with discount details
            item.totalPrice = (result.newAmountCents || 0) / 100;
            item.hasDiscount = true;
            item.discountApplied = true;
            item.discountType = result.discountType;
            item.discountValue = result.discountValue;
            item.discountAmountCents = result.discountAmountCents;
            item.originalAmountCents = result.originalAmountCents;
            
            // Update order total
            this.currentOrder.total = (result.newOrderTotalCents || 0) / 100;
            
            this.updateOrderDisplay();
            this.hideDiscountModal();
            this.showMessage(`Discount applied: -${this.currency}${(result.discountAmountCents / 100).toFixed(0)}`, 'success');
        } catch (error) {
            this.toast('Failed to apply discount: ' + error.message, 'error');
            resetButton();
        }
    }
    
    showEditDiscountModal(itemIndex) {
        const item = this.currentOrder.items[itemIndex];
        const product = this.products.find(p => p.id === item.productId);
        const itemName = item.name || (product ? product.name : 'Unknown');
        
        const discountLabel = item.discountType === 'percentage' 
            ? `${item.discountValue}%` 
            : `${this.currency}${item.discountValue}`;
        const savedAmount = item.discountAmountCents 
            ? (item.discountAmountCents / 100).toFixed(0)
            : '0.00';
        const originalPrice = item.originalAmountCents 
            ? (item.originalAmountCents / 100).toFixed(0)
            : '0.00';
        
        let modal = document.getElementById('edit-discount-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'edit-discount-modal';
            modal.className = 'modal hidden';
            document.getElementById('app').appendChild(modal);
        }
        
        modal.innerHTML = `
            <div class="modal-content">
                <h2>✏️ Edit Discount</h2>
                <p>Item: <strong>${itemName}</strong> x${item.quantity}</p>
                <div class="discount-details">
                    <p>Original Price: <strong>${this.currency}${originalPrice}</strong></p>
                    <p>Current Discount: <strong>${discountLabel}</strong> (-${this.currency}${savedAmount})</p>
                    <p>Current Price: <strong>${this.currency}${Number(item.totalPrice).toFixed(0)}</strong></p>
                </div>
                <div class="modal-actions">
                    <button id="remove-discount-btn" class="btn-danger">🗑️ Remove Discount</button>
                    <button id="change-discount-btn" class="btn-primary">✏️ Change Discount</button>
                    <button id="cancel-edit-discount-btn" class="btn-secondary">Cancel</button>
                </div>
            </div>
        `;
        
        modal.classList.remove('hidden');
        
        modal.querySelector('#remove-discount-btn').addEventListener('click', () => this.removeDiscount(itemIndex));
        modal.querySelector('#change-discount-btn').addEventListener('click', () => {
            this.hideEditDiscountModal();
            // First remove the discount, then show modal to apply new one
            this.removeDiscountAndReapply(itemIndex);
        });
        modal.querySelector('#cancel-edit-discount-btn').addEventListener('click', () => this.hideEditDiscountModal());
    }
    
    hideEditDiscountModal() {
        const modal = document.getElementById('edit-discount-modal');
        if (modal) modal.classList.add('hidden');
    }
    
    async removeDiscount(itemIndex) {
        const item = this.currentOrder.items[itemIndex];
        
        if (!item.id || !this.currentOrder.id) {
            this.toast('Cannot remove discount: item not in database', 'error');
            return;
        }
        
        const removeBtn = document.getElementById('remove-discount-btn');
        if (removeBtn) {
            removeBtn.disabled = true;
            removeBtn.textContent = 'Removing...';
        }
        
        try {
            const response = await fetch(`/orders/${this.currentOrder.id}/items/${item.id}/discount`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.currentUser.username })
            });
            
            if (!response.ok) {
                const error = await response.json();
                this.toast(error.error || 'Failed to remove discount', 'error');
                if (removeBtn) {
                    removeBtn.disabled = false;
                    removeBtn.textContent = '🗑️ Remove Discount';
                }
                return;
            }
            
            const result = await response.json();
            
            // Update local item state - restore original price
            item.totalPrice = (result.restoredAmountCents || 0) / 100;
            item.hasDiscount = false;
            item.discountApplied = false;
            item.discountType = null;
            item.discountValue = null;
            item.discountAmountCents = null;
            item.originalAmountCents = null;
            
            // Update order total
            this.currentOrder.total = (result.newOrderTotalCents || 0) / 100;
            
            this.updateOrderDisplay();
            this.hideEditDiscountModal();
            this.showMessage('Discount removed successfully', 'success');
        } catch (error) {
            this.toast('Failed to remove discount: ' + error.message, 'error');
            if (removeBtn) {
                removeBtn.disabled = false;
                removeBtn.textContent = '🗑️ Remove Discount';
            }
        }
    }
    
    async removeDiscountAndReapply(itemIndex) {
        const item = this.currentOrder.items[itemIndex];
        
        if (!item.id || !this.currentOrder.id) {
            this.showDiscountModal(itemIndex);
            return;
        }
        
        try {
            const response = await fetch(`/orders/${this.currentOrder.id}/items/${item.id}/discount`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.currentUser.username })
            });
            
            if (response.ok) {
                const result = await response.json();
                // Update local state
                item.totalPrice = (result.restoredAmountCents || 0) / 100;
                item.hasDiscount = false;
                item.discountApplied = false;
                item.discountType = null;
                item.discountValue = null;
                item.discountAmountCents = null;
                item.originalAmountCents = null;
                this.currentOrder.total = (result.newOrderTotalCents || 0) / 100;
            }
        } catch (e) {
            // Continue to show discount modal even if remove failed
        }
        
        // Show the discount modal to apply a new discount
        this.showDiscountModal(itemIndex);
    }
    
    showCompModal(itemIndex) {
        const item = this.currentOrder.items[itemIndex];
        const product = this.products.find(p => p.id === item.productId);
        const itemName = item.name || (product ? product.name : 'Unknown');
        const unitPrice = Number(item.unitPrice) || (Number(item.totalPrice) / item.quantity);
        
        let modal = document.getElementById('comp-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'comp-modal';
            modal.className = 'modal hidden';
            document.getElementById('app').appendChild(modal);
        }
        
        // Show quantity selector if more than 1 item
        const quantitySelector = item.quantity > 1 ? `
            <div class="form-group">
                <label>Quantity to Comp:</label>
                <div class="comp-quantity-selector">
                    <button type="button" class="qty-btn" id="comp-qty-minus">-</button>
                    <input type="number" id="comp-quantity" value="1" min="1" max="${item.quantity}" readonly>
                    <button type="button" class="qty-btn" id="comp-qty-plus">+</button>
                    <span class="qty-max">of ${item.quantity}</span>
                </div>
                <p class="comp-amount-preview">Comp Amount: <strong id="comp-amount-display">${this.currency}${unitPrice.toFixed(0)}</strong></p>
            </div>
        ` : '';
        
        const compAmount = item.quantity > 1 ? unitPrice : Number(item.totalPrice);
        
        modal.innerHTML = `
            <div class="modal-content">
                <h2>🎁 Comp Item (Manager)</h2>
                <p>Item: <strong>${itemName}</strong> x${item.quantity}</p>
                <p>Unit Price: <strong>${this.currency}${unitPrice.toFixed(0)}</strong></p>
                ${quantitySelector}
                ${item.quantity === 1 ? `<p>Amount to Comp: <strong>${this.currency}${Number(item.totalPrice).toFixed(0)}</strong></p>` : ''}
                <div class="form-group">
                    <label>Comp Reason (required):</label>
                    <input type="text" id="comp-reason" placeholder="Reason for comp..." required>
                </div>
                <p class="warning">⚠️ This action requires manager approval and will be logged.</p>
                <div class="modal-actions">
                    <button id="comp-cancel-btn">Cancel</button>
                    <button class="danger" id="comp-confirm-btn">Comp Item</button>
                </div>
            </div>
        `;
        
        // Add event listeners
        modal.querySelector('#comp-cancel-btn').addEventListener('click', () => this.hideCompModal());
        modal.querySelector('#comp-confirm-btn').addEventListener('click', () => this.confirmComp(itemIndex));
        
        // Quantity selector event listeners
        if (item.quantity > 1) {
            const qtyInput = modal.querySelector('#comp-quantity');
            const amountDisplay = modal.querySelector('#comp-amount-display');
            
            modal.querySelector('#comp-qty-minus').addEventListener('click', () => {
                const current = parseInt(qtyInput.value);
                if (current > 1) {
                    qtyInput.value = current - 1;
                    amountDisplay.textContent = `${this.currency}${(unitPrice * (current - 1)).toFixed(0)}`;
                }
            });
            
            modal.querySelector('#comp-qty-plus').addEventListener('click', () => {
                const current = parseInt(qtyInput.value);
                if (current < item.quantity) {
                    qtyInput.value = current + 1;
                    amountDisplay.textContent = `${this.currency}${(unitPrice * (current + 1)).toFixed(0)}`;
                }
            });
        }
        
        modal.classList.remove('hidden');
    }
    
    hideCompModal() {
        const modal = document.getElementById('comp-modal');
        if (modal) modal.classList.add('hidden');
    }
    
    async confirmComp(itemIndex) {
        const item = this.currentOrder.items[itemIndex];
        const reason = document.getElementById('comp-reason').value.trim();
        
        // Get comp quantity (defaults to full quantity if no selector)
        const compQtyInput = document.getElementById('comp-quantity');
        const compQuantity = compQtyInput ? parseInt(compQtyInput.value) : item.quantity;
        
        // DOUBLE-CLICK PREVENTION
        const confirmBtn = document.getElementById('comp-confirm-btn');
        if (confirmBtn && confirmBtn.disabled) {
            return; // Already processing
        }
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Processing...';
        }
        
        const resetButton = () => {
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Confirm Comp';
            }
        };
        
        if (!reason) {
            this.toast('Comp reason is required', 'warning');
            resetButton();
            return;
        }
        
        try {
            const response = await fetch(`/orders/${this.currentOrder.id}/items/${item.id}/comp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.currentUser.username,
                    reason,
                    compQuantity // Send the quantity to comp
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                this.toast(error.error || 'Failed to comp item', 'error');
                resetButton();
                return;
            }
            
            const result = await response.json();
            
            // Update local state based on whether it was partial or full comp
            if (result.isPartialComp && result.newCompedItem) {
                // Partial comp - original item quantity reduced, new comped item added
                item.quantity = result.remainingQuantity;
                item.totalPrice = (result.remainingAmountCents || 0) / 100;
                
                // Add the new comped item to local order items
                const compedItem = {
                    id: result.newCompedItem.id,
                    productId: item.productId,
                    name: item.name,
                    quantity: result.compQuantity,
                    unitPrice: item.unitPrice,
                    totalPrice: 0,
                    isComped: true,
                    is_comped: true,
                    sentToKitchen: item.sentToKitchen,
                    status: item.status
                };
                this.currentOrder.items.push(compedItem);
            } else {
                // Full comp - entire item is comped
                item.totalPrice = 0;
                item.isComped = true;
                item.is_comped = true;
            }
            
            // Update order total
            this.currentOrder.total = (result.newOrderTotalCents || 0) / 100;
            
            this.updateOrderDisplay();
            this.hideCompModal();
            this.showMessage(`${compQuantity} item(s) comped successfully`, 'success');
        } catch (error) {
            this.toast('Failed to comp item: ' + error.message, 'error');
            resetButton();
        }
    }

    changeQuantity(index, delta) {
        const item = this.currentOrder.items[index];
        item.quantity += delta;

        if (item.quantity <= 0) {
            this.currentOrder.items.splice(index, 1);
        } else {
            item.totalPrice = item.quantity * item.unitPrice;
        }

        this.updateOrderTotal();
        this.updateOrderDisplay();
    }

    clearOrder() {
        if (confirm('Clear the current order?')) {
            this.createNewOrder();
        }
    }

    // Send to Kitchen
    async sendToKitchen() {
        if (!this.currentOrder || this.currentOrder.items.length === 0) {
            this.showMessage('No items in order to send', 'error');
            return;
        }

        // Filter items not yet sent to kitchen (pending status)
        const itemsToSend = this.currentOrder.items.filter(item => !item.sentToKitchen);
        
        if (itemsToSend.length === 0) {
            this.showMessage('All items already sent to kitchen', 'info');
            return;
        }

        // DOUBLE-CLICK PREVENTION
        const sendBtn = document.getElementById('send-kitchen-btn');
        if (sendBtn && sendBtn.disabled) {
            return; // Already processing
        }
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.textContent = 'Sending...';
        }

        try {
            const response = await fetch(`${this.apiBase}/restaurant/kitchen/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: this.activeOrderId,
                    items: itemsToSend.map(item => ({
                        productId: item.productId,
                        productName: item.name,
                        quantity: item.quantity,
                        notes: item.notes || ''
                    })),
                    tableId: this.activeTableId,
                    userId: this.currentUser.username
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to send to kitchen', 'error');
                return;
            }

            const result = await response.json();
            
            // Update order ID if a new order was created
            if (result.orderId) {
                this.activeOrderId = result.orderId;
                this.currentOrder.id = result.orderId;
            }

            // Map returned item IDs back to local items
            // The server returns items in the same order they were sent
            if (result.items && result.items.length === itemsToSend.length) {
                itemsToSend.forEach((localItem, i) => {
                    const serverItem = result.items[i];
                    localItem.id = serverItem.id;  // Database ID - CRITICAL for void/discount/comp
                    localItem.name = serverItem.productName || localItem.name;
                    localItem.sentToKitchen = true;
                    localItem.status = serverItem.status || 'pending';
                    localItem.unitPriceCents = serverItem.unitPriceCents;
                    localItem.totalPriceCents = serverItem.totalPriceCents;
                    // Keep unitPrice/totalPrice in dollars for display
                    localItem.unitPrice = serverItem.unitPriceCents / 100;
                    localItem.totalPrice = serverItem.totalPriceCents / 100;
                });
            } else {
                // Fallback: mark as sent without IDs (void/discount/comp won't work)
                console.warn('Item count mismatch - void/discount/comp may not work');
                itemsToSend.forEach(item => {
                    item.sentToKitchen = true;
                    item.status = 'pending';
                });
            }
            
            // Recalculate order total from server values
            this.currentOrder.total = this.currentOrder.items
                .filter(i => !i.voided)
                .reduce((sum, i) => sum + Number(i.totalPrice || 0), 0);
            
            this.updateOrderDisplay();
            this.showMessage(`${itemsToSend.length} item(s) sent to kitchen! 🔥`, 'success');
            
            // Re-enable button after success (though screen changes)
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.textContent = 'Send to Kitchen';
            }
            
            // AUTO-PRINT: Print bill after sending to kitchen to thermal printer
            // Note: Backend already auto-prints, so this is disabled to avoid double printing
            // this.printReceiptToThermal(this.activeOrderId);
            
            // Redirect to Kitchen tab
            this.showRestaurantScreen();
            this.setRestaurantTab('kitchen');
        } catch (error) {
            this.showMessage('Failed to send to kitchen', 'error');
            // Re-enable button on error
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.textContent = 'Send to Kitchen';
            }
        }
    }

    // Payment
    showPaymentModal() {
        if (this.currentOrder.items.length === 0) {
            this.showMessage('No items in order', 'error');
            return;
        }

        document.getElementById('payment-total').textContent = this.currentOrder.total.toFixed(0);
        
        // Initialize payment methods for each item
        this.itemPaymentMethods = {};
        const itemsList = document.getElementById('payment-items-list');
        itemsList.innerHTML = this.currentOrder.items.map((item, index) => {
            this.itemPaymentMethods[index] = 'cash'; // Default to cash
            const itemTotal = (item.unitPrice * item.quantity).toFixed(0);
            return `
                <div class="payment-item-row" data-index="${index}">
                    <div class="payment-item-info">
                        <span class="payment-item-name">${item.name} x${item.quantity}</span>
                        <span class="payment-item-price">฿${itemTotal}</span>
                    </div>
                    <div class="payment-item-methods">
                        <button class="item-payment-btn selected" data-index="${index}" data-method="cash">💵 Cash</button>
                        <button class="item-payment-btn" data-index="${index}" data-method="qr">📱 QR</button>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add event listeners for item payment buttons
        itemsList.querySelectorAll('.item-payment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.target.dataset.index;
                const method = e.target.dataset.method;
                this.setItemPaymentMethod(index, method);
            });
        });
        
        // Add event listeners for quick select buttons
        document.querySelectorAll('.quick-select-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const method = e.target.dataset.method;
                this.setAllPaymentMethods(method);
            });
        });
        
        this.updatePaymentSummary();
        document.getElementById('payment-modal').classList.remove('hidden');
    }
    
    setItemPaymentMethod(index, method) {
        this.itemPaymentMethods[index] = method;
        const row = document.querySelector(`.payment-item-row[data-index="${index}"]`);
        row.querySelectorAll('.item-payment-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.method === method);
        });
        this.updatePaymentSummary();
    }
    
    setAllPaymentMethods(method) {
        Object.keys(this.itemPaymentMethods).forEach(index => {
            this.setItemPaymentMethod(index, method);
        });
    }
    
    updatePaymentSummary() {
        let cashTotal = 0;
        let qrTotal = 0;
        
        this.currentOrder.items.forEach((item, index) => {
            const itemTotal = item.unitPrice * item.quantity;
            if (this.itemPaymentMethods[index] === 'cash') {
                cashTotal += itemTotal;
            } else {
                qrTotal += itemTotal;
            }
        });
        
        document.getElementById('cash-total').textContent = `฿${cashTotal.toFixed(0)}`;
        document.getElementById('qr-total').textContent = `฿${qrTotal.toFixed(0)}`;
    }

    hidePaymentModal() {
        document.getElementById('payment-modal').classList.add('hidden');
        document.querySelectorAll('.payment-method').forEach(method => {
            method.classList.remove('selected');
        });
    }

    selectPaymentMethod(element) {
        document.querySelectorAll('.payment-method').forEach(method => {
            method.classList.remove('selected');
        });
        element.classList.add('selected');
    }

    async processPayment() {
        // Calculate cash and QR totals
        let cashTotal = 0;
        let qrTotal = 0;
        
        this.currentOrder.items.forEach((item, index) => {
            const itemTotal = item.unitPrice * item.quantity;
            if (this.itemPaymentMethods[index] === 'cash') {
                cashTotal += itemTotal;
            } else {
                qrTotal += itemTotal;
            }
        });
        
        // DOUBLE-CLICK PREVENTION: Check if payment is already in progress
        const confirmBtn = document.getElementById('confirm-payment-btn');
        if (confirmBtn.disabled) {
            return; // Already processing
        }
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Processing...';

        // Check if items have been sent to kitchen
        const unsent = this.currentOrder.items.filter(item => !item.sentToKitchen);
        if (unsent.length > 0 && this.currentOrder.items.length === unsent.length) {
            this.showMessage('Please send items to kitchen first before payment', 'error');
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirm Payment';
            return;
        }

        // Determine primary payment method (for backend compatibility)
        const method = cashTotal >= qrTotal ? 'cash' : 'qr';

        try {
            // First, create the order if not already created
            if (!this.currentOrder.id) {
                if (!this.currentOrder.idempotencyKey) {
                    this.currentOrder.idempotencyKey = this.createIdempotencyKey('order');
                }
                const orderResponse = await fetch('/orders', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userId: this.currentUser.username, // Using username as userId for simplicity
                        deviceId: 'web-device',
                        items: this.currentOrder.items,
                        orderId: this.activeOrderId,
                        tableId: this.activeTableId,
                        idempotencyKey: this.currentOrder.idempotencyKey,
                    }),
                });

                const orderData = await orderResponse.json();
                this.currentOrder.id = orderData.id;
                this.activeOrderId = orderData.id;
            }

            // Generate bill if not already billed
            const orderCheck = await fetch(`/orders/${this.currentOrder.id}`);
            const orderData = await orderCheck.json();
            
            if (orderData.status !== 'billed' && orderData.status !== 'paid') {
                // Include customerId if a loyalty customer is linked
                const billPayload = { userId: this.currentUser.username };
                if (this.orderCustomer) {
                    billPayload.customerId = this.orderCustomer.id;
                }
                
                const billResponse = await fetch(`/orders/${this.currentOrder.id}/bill`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(billPayload),
                });
                
                if (!billResponse.ok) {
                    const error = await billResponse.json();
                    this.showMessage(error.error || 'Failed to generate bill', 'error');
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'Confirm Payment';
                    return;
                }
            }

            // Process payment with split info
            if (!this.currentOrder.paymentKey) {
                this.currentOrder.paymentKey = this.createIdempotencyKey('payment');
            }
            const paymentResponse = await fetch(`${this.apiBase}/payments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    orderId: this.currentOrder.id,
                    amount: this.currentOrder.total,
                    method,
                    cashAmount: cashTotal,
                    qrAmount: qrTotal,
                    idempotencyKey: this.currentOrder.paymentKey,
                }),
            });

            const paymentData = await paymentResponse.json();

            if (paymentResponse.ok) {
                // Store split payment info for receipt
                this.lastPaymentSplit = { cashTotal, qrTotal };
                
                // Close the order to set table to needs_cleaning
                await fetch(`/orders/${this.currentOrder.id}/close`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: this.currentUser.username }),
                });

                // ========== LOYALTY: Earn points if customer linked ==========
                if (this.orderCustomer) {
                    try {
                        const earnResponse = await fetch(`${this.apiBase}/loyalty/earn`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                customerId: this.orderCustomer.id,
                                orderId: this.currentOrder.id,
                                amountSpent: this.currentOrder.total,
                            }),
                        });
                        if (earnResponse.ok) {
                            const earnData = await earnResponse.json();
                            this.showMessage(`${this.orderCustomer.first_name} earned ${earnData.pointsEarned} points! Balance: ${earnData.newBalance}`, 'success');
                        }
                    } catch (loyaltyError) {
                        console.error('Failed to award loyalty points:', loyaltyError);
                        // Don't fail the payment, just log
                    }
                }

                this.showReceipt();
                this.createNewOrder();
                this.orderCustomer = null;  // Clear customer after payment
                this.updateOrderCustomerDisplay();
                this.activeOrderId = null;
                this.activeTableId = null;
                this.activeTableLabel = null;
                
                // Show success message
                this.showMessage('Payment successful! Table ready for cleaning.', 'success');
                
                // Return to tables tab after a short delay to let user see receipt
                setTimeout(() => {
                    this.hideReceiptModal();
                    this.showRestaurantScreen();
                    this.setRestaurantTab('tables');
                }, 2000);
            } else {
                this.showMessage(paymentData.error || 'Payment failed', 'error');
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Confirm Payment';
            }
        } catch (error) {
            console.error('Payment error:', error);
            this.showMessage('Payment error: ' + error.message, 'error');
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirm Payment';
        }

        this.hidePaymentModal();
    }

    showReceipt() {
        const receiptContent = document.getElementById('receipt-content');
        const split = this.lastPaymentSplit || { cashTotal: 0, qrTotal: 0 };
        
        let paymentInfo = '';
        if (split.cashTotal > 0 && split.qrTotal > 0) {
            paymentInfo = `
                <div class="receipt-item" style="border-top: 1px dashed #ccc; padding-top: 0.5rem; margin-top: 0.5rem;">
                    <span>💵 Cash</span>
                    <span>${this.currency}${split.cashTotal.toFixed(0)}</span>
                </div>
                <div class="receipt-item">
                    <span>📱 QR Transfer</span>
                    <span>${this.currency}${split.qrTotal.toFixed(0)}</span>
                </div>
            `;
        } else if (split.qrTotal > 0) {
            paymentInfo = `
                <div class="receipt-item" style="border-top: 1px dashed #ccc; padding-top: 0.5rem; margin-top: 0.5rem;">
                    <span>Payment Method</span>
                    <span>📱 QR Transfer</span>
                </div>
            `;
        } else {
            paymentInfo = `
                <div class="receipt-item" style="border-top: 1px dashed #ccc; padding-top: 0.5rem; margin-top: 0.5rem;">
                    <span>Payment Method</span>
                    <span>💵 Cash</span>
                </div>
            `;
        }
        
        receiptContent.innerHTML = `
            <div style="text-align: center; margin-bottom: 1rem;">
                <h3>Universal POS</h3>
                <p>Order #${this.currentOrder.id}</p>
                <p>${new Date().toLocaleString()}</p>
            </div>
            ${this.currentOrder.items.map(item => {
                const product = this.products.find(p => p.id === item.productId);
                return `
                    <div class="receipt-item">
                        <span>${product.name} x${item.quantity}</span>
                        <span>${this.currency}${item.totalPrice.toFixed(0)}</span>
                    </div>
                `;
            }).join('')}
            <div class="receipt-item receipt-total">
                <span>Total</span>
                <span>${this.currency}${this.currentOrder.total.toFixed(0)}</span>
            </div>
            ${paymentInfo}
        `;

        document.getElementById('receipt-modal').classList.remove('hidden');
    }

    hideReceiptModal() {
        document.getElementById('receipt-modal').classList.add('hidden');
    }

    // Utility - showMessage with toast notifications
    showMessage(message, type = 'info') {
        // Map old type names to toast types
        const typeMap = {
            'success': 'success',
            'error': 'error',
            'warning': 'warning',
            'info': 'info',
            'danger': 'error'
        };
        const toastType = typeMap[type] || 'info';
        
        // On login screen, also show in the message element
        const messageElement = document.getElementById('login-message');
        if (!document.getElementById('login-screen').classList.contains('hidden') && messageElement) {
            messageElement.textContent = message;
            messageElement.className = type;
            setTimeout(() => {
                messageElement.textContent = '';
                messageElement.className = '';
            }, 3000);
        }
        
        // Always show toast
        this.toast(message, toastType);
    }

    createIdempotencyKey(prefix) {
        const bytes = new Uint8Array(16);
        if (window.crypto && window.crypto.getRandomValues) {
            window.crypto.getRandomValues(bytes);
        } else {
            for (let i = 0; i < bytes.length; i++) {
                bytes[i] = Math.floor(Math.random() * 256);
            }
        }
        const hex = Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');
        return `${prefix}-${Date.now()}-${hex}`;
    }

    // ==================== LOYALTY MODULE ====================

    showLoyaltyScreen() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('module-screen').classList.add('hidden');
        document.getElementById('pos-screen').classList.add('hidden');
        document.getElementById('restaurant-screen').classList.add('hidden');
        document.getElementById('loyalty-screen').classList.remove('hidden');
        document.getElementById('loyalty-user').textContent = this.currentUser?.username || '';
        
        // Initialize loyalty state
        this.loyaltyPage = 1;
        this.loyaltyPageSize = 50;
        this.loyaltyTotalCustomers = 0;
        this.loyaltyTab = 'customers';
        
        this.setLoyaltyTab('customers');
    }

    setLoyaltyTab(tab) {
        this.loyaltyTab = tab;
        
        document.querySelectorAll('.loyalty-nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.panel === tab);
        });
        
        document.getElementById('loyalty-customers-panel').classList.toggle('hidden', tab !== 'customers');
        document.getElementById('loyalty-dashboard-panel').classList.toggle('hidden', tab !== 'dashboard');
        document.getElementById('loyalty-programs-panel').classList.toggle('hidden', tab !== 'programs');
        
        if (tab === 'customers') {
            this.loadLoyaltyCustomers();
        } else if (tab === 'dashboard') {
            this.loadLoyaltyStats();
        } else if (tab === 'programs') {
            this.loadLoyaltyPrograms();
        }
    }

    async loadLoyaltyCustomers() {
        try {
            const searchInput = document.getElementById('customer-search');
            const search = searchInput?.value?.trim() || '';
            
            const url = `${this.apiBase}/loyalty/customers?page=${this.loyaltyPage}&limit=${this.loyaltyPageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
            const response = await fetch(url);
            const data = await response.json();
            
            this.loyaltyTotalCustomers = data.total || 0;
            
            const grid = document.getElementById('customers-list');
            if (!data.customers || data.customers.length === 0) {
                grid.innerHTML = `
                    <div class="loyalty-empty-state">
                        <div class="icon">👥</div>
                        <div>No customers found</div>
                        <p>Add your first customer to get started</p>
                    </div>
                `;
                return;
            }
            
            grid.innerHTML = data.customers.map(customer => {
                const fullName = `${customer.first_name} ${customer.last_name}`;
                const highlightedName = this.highlightMatch(fullName, search);
                const highlightedPhone = this.highlightMatch(customer.phone || 'No phone', search);
                const highlightedEmail = this.highlightMatch(customer.email || 'No email', search);
                const highlightedLoyalty = this.highlightMatch(customer.loyalty_number || '', search);
                
                return `
                    <div class="customer-card" data-customer-id="${customer.id}">
                        <div class="customer-card-header">
                            <span class="customer-name">${highlightedName}</span>
                            <span class="customer-points-badge">⭐ ${customer.current_points || 0} pts</span>
                        </div>
                        <div class="customer-card-body">
                            <p>📞 ${highlightedPhone}</p>
                            <p>📧 ${highlightedEmail}</p>
                            <p class="customer-loyalty-number">${highlightedLoyalty}</p>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Attach click handlers
            grid.querySelectorAll('.customer-card').forEach(card => {
                card.addEventListener('click', () => {
                    const customerId = Number(card.dataset.customerId);
                    this.showCustomerDetail(customerId);
                });
            });
            
            // Update pagination
            const totalPages = Math.ceil(this.loyaltyTotalCustomers / this.loyaltyPageSize);
            document.getElementById('customers-page-info').textContent = `Page ${this.loyaltyPage} of ${totalPages || 1}`;
            document.getElementById('customers-prev-btn').disabled = this.loyaltyPage <= 1;
            document.getElementById('customers-next-btn').disabled = this.loyaltyPage >= totalPages;
            
        } catch (error) {
            console.error('Failed to load customers:', error);
            this.showMessage('Failed to load customers', 'error');
        }
    }

    searchCustomers() {
        this.loyaltyPage = 1;
        this.loadLoyaltyCustomers();
    }

    // Highlight matching text in customer search
    highlightMatch(text, search) {
        if (!search || !text) return text || '';
        const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark class="search-highlight">$1</mark>');
    }

    async showCustomerDetail(customerId) {
        try {
            const response = await fetch(`${this.apiBase}/loyalty/customers/${customerId}`);
            const data = await response.json();
            
            if (!data.customer) {
                this.showMessage('Customer not found', 'error');
                return;
            }
            
            const { customer, transactions, orders } = data;
            
            document.getElementById('customer-detail-title').textContent = `${customer.first_name} ${customer.last_name}`;
            
            const content = document.getElementById('customer-detail-content');
            content.innerHTML = `
                <div class="customer-detail-header">
                    <div class="customer-detail-info">
                        <h3>${customer.first_name} ${customer.last_name}</h3>
                        <p>📞 ${customer.phone || 'No phone'}</p>
                        <p>📧 ${customer.email || 'No email'}</p>
                        <p>🎂 ${customer.date_of_birth || 'No DOB'}</p>
                        <p class="customer-loyalty-number">🎫 ${customer.loyalty_number || ''}</p>
                        <p>📊 ${customer.total_visits || 0} visits · ${this.formatCurrency(customer.total_spent || 0)} spent</p>
                    </div>
                    <div class="customer-points-display">
                        <div class="points-value">${customer.current_points || 0}</div>
                        <div class="points-label">Points Balance</div>
                    </div>
                </div>
                
                <div class="customer-actions">
                    <button class="adjust-points-btn" data-customer-id="${customer.id}">⚡ Adjust Points</button>
                    <button class="edit-customer-btn" data-customer-id="${customer.id}">✏️ Edit</button>
                    <button class="delete-customer-btn" data-customer-id="${customer.id}" data-customer-name="${(customer.first_name + ' ' + customer.last_name).replace(/"/g, '&quot;')}">🗑️ Delete</button>
                </div>
                
                <div class="customer-detail-sections">
                    <div class="customer-detail-section">
                        <h4>Recent Transactions</h4>
                        <div class="transaction-list">
                            ${transactions && transactions.length > 0 
                                ? transactions.map(t => `
                                    <div class="transaction-item">
                                        <div class="transaction-info">
                                            <span>${t.description || t.transaction_type}</span>
                                            <small>${new Date(t.created_at).toLocaleDateString()}</small>
                                        </div>
                                        <span class="transaction-points ${t.points > 0 ? 'positive' : 'negative'}">
                                            ${t.points > 0 ? '+' : ''}${t.points}
                                        </span>
                                    </div>
                                `).join('')
                                : '<div class="no-data">No transactions yet</div>'
                            }
                        </div>
                    </div>
                    
                    <div class="customer-detail-section">
                        <h4>Recent Orders</h4>
                        <div class="transaction-list">
                            ${orders && orders.length > 0 
                                ? orders.map(o => `
                                    <div class="transaction-item">
                                        <div class="transaction-info">
                                            <span>Order #${o.order_number}</span>
                                            <small>${new Date(o.created_at).toLocaleDateString()}</small>
                                        </div>
                                        <span>${this.formatCurrency(o.total_amount || 0)}</span>
                                    </div>
                                `).join('')
                                : '<div class="no-data">No orders yet</div>'
                            }
                        </div>
                    </div>
                </div>
            `;
            
            // Attach event handlers for action buttons
            const detailContent = document.getElementById('customer-detail-content');
            detailContent.querySelector('.adjust-points-btn')?.addEventListener('click', () => {
                this.adjustCustomerPoints(customer.id);
            });
            detailContent.querySelector('.edit-customer-btn')?.addEventListener('click', () => {
                this.editCustomer(customer.id);
            });
            detailContent.querySelector('.delete-customer-btn')?.addEventListener('click', (e) => {
                const btn = e.currentTarget;
                this.showDeleteCustomerModal(Number(btn.dataset.customerId), btn.dataset.customerName);
            });
            
            document.getElementById('customer-detail-modal').classList.remove('hidden');
        } catch (error) {
            console.error('Failed to load customer:', error);
            this.showMessage('Failed to load customer details', 'error');
        }
    }

    showAddCustomerModal() {
        document.getElementById('add-customer-form').reset();
        document.getElementById('add-customer-modal').classList.remove('hidden');
    }

    async createCustomer() {
        const firstName = document.getElementById('new-customer-firstname').value.trim();
        const lastName = document.getElementById('new-customer-lastname').value.trim();
        const phone = document.getElementById('new-customer-phone').value.trim();
        const email = document.getElementById('new-customer-email').value.trim();
        const dateOfBirth = document.getElementById('new-customer-dob').value;
        
        if (!firstName || !lastName) {
            this.showMessage('First name and last name are required', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/loyalty/customers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firstName, lastName, phone, email, dateOfBirth }),
            });
            
            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to create customer', 'error');
                return;
            }
            
            const result = await response.json();
            this.showMessage(`Customer created! Loyalty #: ${result.loyaltyNumber}`, 'success');
            document.getElementById('add-customer-modal').classList.add('hidden');
            this.loadLoyaltyCustomers();
        } catch (error) {
            console.error('Failed to create customer:', error);
            this.showMessage('Failed to create customer', 'error');
        }
    }

    async adjustCustomerPoints(customerId) {
        const pointsStr = prompt('Enter points adjustment (positive to add, negative to subtract):');
        if (!pointsStr) return;
        
        const points = parseInt(pointsStr, 10);
        if (isNaN(points) || points === 0) {
            this.showMessage('Please enter a valid number', 'error');
            return;
        }
        
        const reason = prompt('Reason for adjustment:');
        if (!reason || !reason.trim()) {
            this.showMessage('Reason is required', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/loyalty/adjust`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId, points, reason }),
            });
            
            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to adjust points', 'error');
                return;
            }
            
            const result = await response.json();
            this.showMessage(`Points adjusted: ${result.previousBalance} → ${result.newBalance}`, 'success');
            this.showCustomerDetail(customerId);
        } catch (error) {
            console.error('Failed to adjust points:', error);
            this.showMessage('Failed to adjust points', 'error');
        }
    }

    async editCustomer(customerId) {
        try {
            const response = await fetch(`${this.apiBase}/loyalty/customers/${customerId}`);
            const data = await response.json();
            
            if (!data.customer) {
                this.showMessage('Customer not found', 'error');
                return;
            }
            
            const customer = data.customer;
            
            // Populate the edit form
            document.getElementById('edit-customer-id').value = customer.id;
            document.getElementById('edit-customer-firstname').value = customer.first_name || '';
            document.getElementById('edit-customer-lastname').value = customer.last_name || '';
            document.getElementById('edit-customer-phone').value = customer.phone || '';
            document.getElementById('edit-customer-email').value = customer.email || '';
            document.getElementById('edit-customer-dob').value = customer.date_of_birth || '';
            
            document.getElementById('edit-customer-modal').classList.remove('hidden');
        } catch (error) {
            console.error('Failed to load customer for editing:', error);
            this.showMessage('Failed to load customer details', 'error');
        }
    }

    async saveCustomerEdit() {
        const customerId = document.getElementById('edit-customer-id').value;
        const firstName = document.getElementById('edit-customer-firstname').value.trim();
        const lastName = document.getElementById('edit-customer-lastname').value.trim();
        const phone = document.getElementById('edit-customer-phone').value.trim() || null;
        const email = document.getElementById('edit-customer-email').value.trim() || null;
        const dateOfBirth = document.getElementById('edit-customer-dob').value || null;
        
        if (!firstName || !lastName) {
            this.showMessage('First name and last name are required', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/loyalty/customers/${customerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firstName, lastName, phone, email, dateOfBirth }),
            });
            
            console.log('Update response status:', response.status);
            const result = await response.json();
            console.log('Update response body:', result);
            
            if (!response.ok) {
                this.showMessage(result.error || 'Failed to update customer', 'error');
                return;
            }
            
            this.showMessage('Customer updated successfully', 'success');
            document.getElementById('edit-customer-modal').classList.add('hidden');
            document.getElementById('customer-detail-modal').classList.add('hidden');
            this.loadLoyaltyCustomers();
        } catch (error) {
            console.error('Failed to update customer:', error);
            this.showMessage('Failed to update customer', 'error');
        }
    }

    showDeleteCustomerModal(customerId, customerName) {
        document.getElementById('delete-customer-id').value = customerId;
        document.getElementById('delete-customer-name').textContent = customerName;
        document.getElementById('delete-auth-username').value = '';
        document.getElementById('delete-auth-password').value = '';
        document.getElementById('delete-customer-modal').classList.remove('hidden');
    }

    async deleteCustomer() {
        const customerId = document.getElementById('delete-customer-id').value;
        const username = document.getElementById('delete-auth-username').value.trim();
        const password = document.getElementById('delete-auth-password').value;
        
        if (!username || !password) {
            this.showMessage('Username and password are required', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/loyalty/customers/${customerId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            
            if (!response.ok) {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to delete customer', 'error');
                return;
            }
            
            const result = await response.json();
            this.showMessage(result.message || 'Customer deleted successfully', 'success');
            document.getElementById('delete-customer-modal').classList.add('hidden');
            document.getElementById('customer-detail-modal').classList.add('hidden');
            this.loadLoyaltyCustomers();
        } catch (error) {
            console.error('Failed to delete customer:', error);
            this.showMessage('Failed to delete customer', 'error');
        }
    }

    async loadLoyaltyStats() {
        try {
            const response = await fetch(`${this.apiBase}/loyalty/stats`);
            const data = await response.json();
            
            const { stats, recentTransactions, topCustomers } = data;
            
            // Stats cards
            const statsGrid = document.getElementById('loyalty-stats');
            statsGrid.innerHTML = `
                <div class="stat-card">
                    <div class="stat-value">${stats.total_customers || 0}</div>
                    <div class="stat-label">Total Customers</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.loyalty_members || 0}</div>
                    <div class="stat-label">Loyalty Members</div>
                </div>
                <div class="stat-card gold">
                    <div class="stat-value">${Number(stats.total_outstanding_points || 0).toLocaleString()}</div>
                    <div class="stat-label">Outstanding Points</div>
                </div>
                <div class="stat-card green">
                    <div class="stat-value">${Number(stats.total_points_earned || 0).toLocaleString()}</div>
                    <div class="stat-label">Total Earned</div>
                </div>
            `;
            
            // Recent activity
            const activityList = document.getElementById('recent-activity-list');
            if (recentTransactions && recentTransactions.length > 0) {
                activityList.innerHTML = recentTransactions.map(t => `
                    <div class="activity-item">
                        <div class="activity-info">
                            <span class="activity-customer">${t.first_name} ${t.last_name}</span>
                            <span class="activity-description">${t.description || t.transaction_type}</span>
                        </div>
                        <span class="activity-points ${t.transaction_type}">${t.points > 0 ? '+' : ''}${t.points}</span>
                    </div>
                `).join('');
            } else {
                activityList.innerHTML = '<div class="no-data">No recent activity</div>';
            }
            
            // Top customers
            const topList = document.getElementById('top-customers-list');
            if (topCustomers && topCustomers.length > 0) {
                topList.innerHTML = topCustomers.map(c => `
                    <div class="top-customer-item" onclick="app.showCustomerDetail(${c.id})">
                        <div class="top-customer-info">
                            <span class="top-customer-name">${c.first_name} ${c.last_name}</span>
                            <span class="top-customer-spent">${this.formatCurrency(c.total_spent || 0)} spent</span>
                        </div>
                        <span class="top-customer-points">${c.total_points_earned || 0} pts earned</span>
                    </div>
                `).join('');
            } else {
                topList.innerHTML = '<div class="no-data">No top customers yet</div>';
            }
            
        } catch (error) {
            console.error('Failed to load loyalty stats:', error);
            this.showMessage('Failed to load loyalty stats', 'error');
        }
    }

    async loadLoyaltyPrograms() {
        try {
            const response = await fetch(`${this.apiBase}/loyalty/programs`);
            const programs = await response.json();
            
            const grid = document.getElementById('programs-list');
            
            if (!programs || programs.length === 0) {
                grid.innerHTML = `
                    <div class="loyalty-empty-state">
                        <div class="icon">⭐</div>
                        <div>No loyalty programs yet</div>
                        <p>A default program will be created when the first customer is added</p>
                    </div>
                `;
                return;
            }
            
            grid.innerHTML = programs.map(p => `
                <div class="program-card">
                    <h3>${p.name}</h3>
                    <p>${p.description || 'No description'}</p>
                    <div class="program-stats">
                        <div class="program-stat">
                            <div class="value">${p.member_count || 0}</div>
                            <div class="label">Members</div>
                        </div>
                        <div class="program-stat">
                            <div class="value">${p.points_per_dollar || 1}x</div>
                            <div class="label">Points/Dollar</div>
                        </div>
                        <div class="program-stat">
                            <div class="value">${this.formatCurrency(p.redemption_rate || 0.01)}</div>
                            <div class="label">Per Point</div>
                        </div>
                    </div>
                </div>
            `).join('');
            
        } catch (error) {
            console.error('Failed to load programs:', error);
            this.showMessage('Failed to load loyalty programs', 'error');
        }
    }

    // ==================== CUSTOMER LOOKUP IN POS ====================

    showCustomerLookupModal() {
        document.getElementById('customer-lookup-input').value = '';
        document.getElementById('customer-lookup-results').innerHTML = `
            <div class="customer-lookup-empty">
                Type phone, name, or loyalty number to search
            </div>
        `;
        document.getElementById('customer-lookup-modal').classList.remove('hidden');
        document.getElementById('customer-lookup-input').focus();
    }

    async searchCustomerLookup() {
        const query = document.getElementById('customer-lookup-input').value.trim();
        if (query.length < 2) {
            document.getElementById('customer-lookup-results').innerHTML = `
                <div class="customer-lookup-empty">
                    Enter at least 2 characters to search
                </div>
            `;
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/loyalty/lookup?q=${encodeURIComponent(query)}`);
            const customers = await response.json();

            const resultsDiv = document.getElementById('customer-lookup-results');
            
            if (!customers || customers.length === 0) {
                resultsDiv.innerHTML = `
                    <div class="customer-lookup-empty">
                        No customers found matching "${query}"
                    </div>
                `;
                return;
            }

            resultsDiv.innerHTML = customers.map(c => `
                <div class="customer-lookup-item" data-customer='${JSON.stringify(c).replace(/'/g, "&#39;")}'>
                    <div class="customer-lookup-item-info">
                        <span class="customer-lookup-item-name">${c.first_name} ${c.last_name}</span>
                        <span class="customer-lookup-item-phone">${c.phone || c.loyalty_number || 'No contact'}</span>
                    </div>
                    <span class="customer-lookup-item-points">⭐ ${c.current_points || 0}</span>
                </div>
            `).join('');

            // Attach click handlers
            resultsDiv.querySelectorAll('.customer-lookup-item').forEach(item => {
                item.addEventListener('click', () => {
                    const customerData = JSON.parse(item.dataset.customer.replace(/&#39;/g, "'"));
                    this.selectOrderCustomer(customerData);
                });
            });

        } catch (error) {
            console.error('Customer lookup failed:', error);
            this.showMessage('Customer lookup failed', 'error');
        }
    }

    selectOrderCustomer(customer) {
        this.orderCustomer = customer;
        this.updateOrderCustomerDisplay();
        document.getElementById('customer-lookup-modal').classList.add('hidden');
        this.showMessage(`Customer ${customer.first_name} ${customer.last_name} linked to order`, 'success');
    }

    removeOrderCustomer() {
        this.orderCustomer = null;
        this.updateOrderCustomerDisplay();
    }

    updateOrderCustomerDisplay() {
        const container = document.getElementById('order-customer');
        
        if (this.orderCustomer) {
            container.innerHTML = `
                <div class="order-customer-selected">
                    <div class="order-customer-info">
                        <span class="order-customer-name">👤 ${this.orderCustomer.first_name} ${this.orderCustomer.last_name}</span>
                        <span class="order-customer-points">⭐ ${this.orderCustomer.current_points || 0} points</span>
                    </div>
                    <button class="order-customer-remove" onclick="app.removeOrderCustomer()">✕</button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <button id="lookup-customer-btn" class="lookup-customer-btn" onclick="app.showCustomerLookupModal()">
                    👤 Add Customer
                </button>
            `;
        }
    }
}

// Initialize the app
const app = new POSApp();
