// IndexedDB utility for user management
class UserDB {
    constructor() {
        this.dbName = 'UserAuthDB';
        this.version = 1;
        this.storeName = 'users';
        this.db = null;
    }

    // Initialize the database
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                reject(new Error('Failed to open database'));
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create users object store if it doesn't exist
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'username' });
                    store.createIndex('username', 'username', { unique: true });
                }
            };
        });
    }

    // Register a new user
    async registerUser(username, password, role = 'user') {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            // Check if user already exists
            const checkRequest = store.get(username);
            
            checkRequest.onsuccess = () => {
                if (checkRequest.result) {
                    reject(new Error('Username already exists'));
                    return;
                }

                // Hash password (simple hash for demo - in production use proper hashing)
                const hashedPassword = this.simpleHash(password);
                
                const user = {
                    username: username,
                    password: hashedPassword,
                    rawPassword: password, // Store raw password for admin viewing
                    role: role,
                    createdAt: new Date().toISOString()
                };

                const addRequest = store.add(user);
                
                addRequest.onsuccess = () => {
                    resolve({ success: true, message: 'User registered successfully' });
                };

                addRequest.onerror = () => {
                    reject(new Error('Failed to register user'));
                };
            };

            checkRequest.onerror = () => {
                reject(new Error('Failed to check existing user'));
            };
        });
    }

    // Login user
    async loginUser(username, password) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(username);

            request.onsuccess = () => {
                const user = request.result;
                
                if (!user) {
                    reject(new Error('User not found'));
                    return;
                }

                const hashedPassword = this.simpleHash(password);
                
                if (user.password === hashedPassword) {
                    // Store login session with role information
                    sessionStorage.setItem('currentUser', username);
                    sessionStorage.setItem('userRole', user.role || 'user');
                    resolve({ success: true, message: 'Login successful', user: { username: user.username, role: user.role || 'user' } });
                } else {
                    reject(new Error('Invalid password'));
                }
            };

            request.onerror = () => {
                reject(new Error('Failed to retrieve user'));
            };
        });
    }

    // Check if user is logged in
    isLoggedIn() {
        return sessionStorage.getItem('currentUser') !== null;
    }

    // Get current user
    getCurrentUser() {
        return sessionStorage.getItem('currentUser');
    }

    // Logout user
    logout() {
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('userRole');
    }

    // Get current user role
    getCurrentUserRole() {
        return sessionStorage.getItem('userRole') || 'user';
    }

    // Check if current user is admin
    isAdmin() {
        return this.getCurrentUserRole() === 'admin';
    }

    // Delete a user (admin only)
    async deleteUser(username) {
        if (!this.db) {
            await this.init();
        }

        // Check if current user is admin
        if (!this.isAdmin()) {
            throw new Error('Access denied. Admin privileges required.');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(username);

            request.onsuccess = () => {
                resolve({ success: true, message: `User '${username}' deleted successfully` });
            };

            request.onerror = () => {
                reject(new Error('Failed to delete user'));
            };
        });
    }

    // Initialize admin user if it doesn't exist
    async initializeAdmin() {
        if (!this.db) {
            await this.init();
        }

        try {
            // Check if admin user already exists
            const adminExists = await new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get('Admin');

                request.onsuccess = () => {
                    resolve(request.result !== undefined);
                };

                request.onerror = () => {
                    reject(new Error('Failed to check admin user'));
                };
            });

            if (!adminExists) {
                // Create admin user
                await this.registerUser('Admin', '017823', 'admin');
                console.log('Admin user created successfully');
            }
        } catch (error) {
            console.error('Failed to initialize admin user:', error);
        }
    }

    // Simple hash function (for demo purposes - use proper hashing in production)
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    // Get all users (for debugging)
    async getAllUsers() {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error('Failed to retrieve users'));
            };
        });
    }

    // Check if password is already used by another user
    async isPasswordDuplicate(password, excludeUsername = null) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                const users = request.result;
                const isDuplicate = users.some(user => 
                    user.rawPassword === password && 
                    (excludeUsername === null || user.username !== excludeUsername)
                );
                resolve(isDuplicate);
            };

            request.onerror = () => {
                reject(new Error('Failed to check password duplicates'));
            };
        });
    }

    // Get user's raw password (admin only)
    async getUserPassword(username) {
        if (!this.db) {
            await this.init();
        }

        // Check if current user is admin
        if (!this.isAdmin()) {
            throw new Error('Access denied. Admin privileges required.');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(username);

            request.onsuccess = () => {
                const user = request.result;
                if (!user) {
                    reject(new Error('User not found'));
                    return;
                }
                // Return the raw password stored in the user object
                resolve(user.rawPassword || 'N/A');
            };

            request.onerror = () => {
                reject(new Error('Failed to retrieve user password'));
            };
        });
    }

    // Change user password (admin only)
    async changeUserPassword(username, newPassword) {
        if (!this.db) {
            await this.init();
        }

        // Check if current user is admin
        if (!this.isAdmin()) {
            throw new Error('Access denied. Admin privileges required.');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const getRequest = store.get(username);

            getRequest.onsuccess = () => {
                const user = getRequest.result;
                if (!user) {
                    reject(new Error('User not found'));
                    return;
                }

                // Update password
                user.password = this.simpleHash(newPassword);
                user.rawPassword = newPassword; // Store raw password for admin viewing

                const updateRequest = store.put(user);
                
                updateRequest.onsuccess = () => {
                    resolve({ success: true, message: `Password changed successfully for user '${username}'` });
                };

                updateRequest.onerror = () => {
                    reject(new Error('Failed to update password'));
                };
            };

            getRequest.onerror = () => {
                reject(new Error('Failed to retrieve user'));
            };
        });
    }
}

// Create global instance
const userDB = new UserDB();