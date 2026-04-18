// ============================================
// BLOOD DONOR BD - MAIN APPLICATION
// ============================================

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCnky8bzx3KuFoujU5DSlLRYSZgiAF8840",
  authDomain: "blood-donor-bd-2025.firebaseapp.com",
  projectId: "blood-donor-bd-2025",
  storageBucket: "blood-donor-bd-2025.firebasestorage.app",
  messagingSenderId: "271945142840",
  appId: "1:271945142840:web:b0edefddb55cac5f604ccd"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// App State
let currentUser = null;
let userProfile = null;
let currentPage = 'home';

// Bangladesh Districts List
const bangladeshDistricts = [
  'Bagerhat', 'Bandarban', 'Barguna', 'Barisal', 'Bhola', 'Bogra', 'Brahmanbaria', 'Chandpur',
  'Chapainawabganj', 'Chattogram', 'Chuadanga', 'Comilla', 'Cox\'s Bazar', 'Dhaka', 'Dinajpur',
  'Faridpur', 'Feni', 'Gaibandha', 'Gazipur', 'Gopalganj', 'Habiganj', 'Jamalpur', 'Jashore',
  'Jhalokathi', 'Jhenaidah', 'Joypurhat', 'Khagrachari', 'Khulna', 'Kishoreganj', 'Kurigram',
  'Kushtia', 'Lakshmipur', 'Lalmonirhat', 'Madaripur', 'Magura', 'Manikganj', 'Meherpur',
  'Moulvibazar', 'Munshiganj', 'Mymensingh', 'Naogaon', 'Narail', 'Narayanganj', 'Narsingdi',
  'Natore', 'Netrokona', 'Nilphamari', 'Noakhali', 'Pabna', 'Panchagarh', 'Patuakhali',
  'Pirojpur', 'Rajbari', 'Rajshahi', 'Rangamati', 'Rangpur', 'Satkhira', 'Shariatpur',
  'Sherpur', 'Sirajganj', 'Sunamganj', 'Sylhet', 'Tangail', 'Thakurgaon'
];

// Toast Notification System
class Toast {
  static show(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }
}

// Router System
const router = {
  routes: {
    home: renderHomePage,
    about: renderAboutPage,
    contact: renderContactPage,
    'find-donors': renderFindDonorsPage,
    login: renderLoginPage,
    register: renderRegisterPage,
    dashboard: renderDashboard,
    profile: renderProfilePage,
    certificates: renderCertificatesPage,
    'request-blood': renderRequestBloodPage,
    'my-requests': renderMyRequestsPage,
    'verify-certificate': renderVerifyCertificatePage,
    'dm-donor': renderDmDonorPage
  },
  
  navigate(page) {
    currentPage = page;
    const renderFunc = this.routes[page] || renderHomePage;
    renderFunc();
    this.updateActiveNav(page);
    
    if (page !== 'home') {
      window.history.pushState({}, '', `#${page}`);
    } else {
      window.history.pushState({}, '', '#');
    }
  },
  
  updateActiveNav(page) {
    document.querySelectorAll('.nav-menu a').forEach(link => {
      link.classList.remove('active');
      if (link.dataset.page === page) {
        link.classList.add('active');
      }
    });
  }
};

// Authentication System
const authSystem = {
  async login(email, password) {
    try {
      const result = await auth.signInWithEmailAndPassword(email, password);
      await this.loadUserProfile(result.user.uid);
      Toast.show('Login successful!', 'success');
      
      if (userProfile?.role === 'admin') {
        window.location.href = 'admin.html';
      } else {
        router.navigate('dashboard');
      }
      return true;
    } catch (error) {
      console.error('Login error:', error);
      let message = 'Login failed';
      if (error.code === 'auth/user-not-found') message = 'No account found with this email';
      else if (error.code === 'auth/wrong-password') message = 'Incorrect password';
      else if (error.code === 'auth/invalid-email') message = 'Invalid email address';
      else message = error.message;
      Toast.show(message, 'error');
      return false;
    }
  },
  
  async register(userData) {
    try {
      const result = await auth.createUserWithEmailAndPassword(userData.email, userData.password);
      
      const isDonorType = userData.userType === 'donor';
      
      const profile = {
        uid: result.user.uid,
        email: userData.email,
        fullName: userData.fullName,
        phoneNumber: userData.phoneNumber,
        bloodGroup: userData.bloodGroup || null,
        nidNumber: userData.nidNumber || '',
        userType: userData.userType, // 'donor' or 'seeker'
        isDonor: isDonorType,
        isSeeker: !isDonorType,
        district: userData.district || '',
        upazila: userData.upazila || '',
        address: userData.address || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        isVerified: false,
        approvalStatus: isDonorType ? 'pending' : 'approved', // Seekers auto-approved
        role: 'user',
        certificates: []
      };
      
      await db.collection('users').doc(result.user.uid).set(profile);
      userProfile = profile;
      currentUser = result.user;
      
      if (isDonorType) {
        Toast.show('Registration submitted! Your application is pending admin approval.', 'success');
      } else {
        Toast.show('Registration successful! Welcome to Blood Donor BD.', 'success');
      }
      
      router.navigate('dashboard');
      return true;
    } catch (error) {
      console.error('Registration error:', error);
      let message = 'Registration failed';
      if (error.code === 'auth/email-already-in-use') message = 'Email already registered';
      else if (error.code === 'auth/weak-password') message = 'Password should be at least 6 characters';
      else message = error.message;
      Toast.show(message, 'error');
      return false;
    }
  },
  
  async logout() {
    try {
      await auth.signOut();
      currentUser = null;
      userProfile = null;
      router.navigate('home');
      Toast.show('Logged out successfully', 'success');
    } catch (error) {
      Toast.show('Logout failed', 'error');
    }
  },
  
  async loadUserProfile(uid) {
    try {
      const doc = await db.collection('users').doc(uid).get();
      if (doc.exists) {
        userProfile = { id: doc.id, ...doc.data() };
        currentUser = auth.currentUser;
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }
};

// Certificate System
const certificateSystem = {
  async loadMyCertificates() {
    if (!currentUser) return [];
    
    try {
      const snapshot = await db.collection('certificates')
        .where('userId', '==', currentUser.uid)
        .get();
      
      const certs = [];
      snapshot.forEach(doc => certs.push({ id: doc.id, ...doc.data() }));
      return certs.sort((a, b) => new Date(b.issuedDate) - new Date(a.issuedDate));
    } catch (error) {
      console.error('Error loading certificates:', error);
      return [];
    }
  },
  
  viewCertificate(certificateId) {
    window.open(`certificate.html?id=${certificateId}`, '_blank');
  },
  
  downloadCertificate(certificateId) {
    window.open(`certificate.html?id=${certificateId}`, '_blank');
  }
};

// Contact Tracking System
const contactTracking = {
  async logContact(donorId, seekerId, donorName, seekerName) {
    try {
      await db.collection('contactLogs').add({
        donorId: donorId,
        seekerId: seekerId,
        donorName: donorName,
        seekerName: seekerName,
        contactType: 'phone_reveal',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('Contact logged successfully');
    } catch (error) {
      console.error('Error logging contact:', error);
    }
  }
};

// Page Renderers
function renderHomePage() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="hero-section">
      <h1 style="font-size: 48px; margin-bottom: 20px;">Donate Blood, Save Lives</h1>
      <p style="font-size: 20px; margin-bottom: 32px;">Join the community of life-savers. Every drop counts.</p>
      ${!currentUser ? `
        <div style="display: flex; gap: 16px; justify-content: center;">
          <button onclick="router.navigate('register')" class="btn btn-primary" style="background: white; color: #b71c1c;">Become a Donor</button>
          <button onclick="router.navigate('find-donors')" class="btn btn-outline" style="border-color: white; color: white;">Find Donors</button>
        </div>
      ` : `
        <div style="display: flex; gap: 16px; justify-content: center;">
          <button onclick="router.navigate('request-blood')" class="btn btn-primary" style="background: white; color: #b71c1c;">Request Blood</button>
          <button onclick="router.navigate('find-donors')" class="btn btn-outline" style="border-color: white; color: white;">Find Donors</button>
          <button onclick="router.navigate('dm-donor')" class="btn btn-outline" style="border-color: white; color: white;"><i class="fas fa-comments"></i> DM Donors</button>
        </div>
      `}
    </div>
    
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 32px; margin-top: 48px;">
      <div style="text-align: center; padding: 32px; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <i class="fas fa-certificate" style="font-size: 48px; color: #b71c1c; margin-bottom: 20px;"></i>
        <h3>Digital Certificates</h3>
        <p>Get verified digital certificates after approval</p>
      </div>
      <div style="text-align: center; padding: 32px; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <i class="fas fa-map-marker-alt" style="font-size: 48px; color: #b71c1c; margin-bottom: 20px;"></i>
        <h3>Find Nearby Donors</h3>
        <p>Connect with approved donors in your area</p>
      </div>
      <div style="text-align: center; padding: 32px; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <i class="fas fa-comments" style="font-size: 48px; color: #b71c1c; margin-bottom: 20px;"></i>
        <h3>DM Donors</h3>
        <p>Chat directly with donors and seekers</p>
      </div>
    </div>
  `;
}

function renderAboutPage() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div style="max-width: 800px; margin: 0 auto;">
      <h1 style="margin-bottom: 24px;">About Blood Donor BD</h1>
      <div style="background: white; padding: 32px; border-radius: 12px;">
        <p style="margin-bottom: 16px;">Blood Donor BD is a platform connecting blood donors with those in need across Bangladesh.</p>
        <p style="margin-bottom: 16px;"><strong>Our Mission:</strong> To ensure no one dies due to lack of blood by creating a reliable network of voluntary blood donors.</p>
        <p><strong>How It Works:</strong></p>
        <ul style="margin-top: 12px; padding-left: 20px;">
          <li>Donors register and get verified by our admin team</li>
          <li>Patients can search for donors or post blood requests</li>
          <li>Requests stay active for 24 hours</li>
          <li>Verified donors receive official certificates</li>
        </ul>
      </div>
    </div>
  `;
}

function renderContactPage() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div style="max-width: 800px; margin: 0 auto;">
      <h1 style="margin-bottom: 24px;">Contact Us</h1>
      <div style="background: white; padding: 32px; border-radius: 12px;">
        <div style="display: grid; gap: 20px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <i class="fas fa-phone" style="font-size: 24px; color: #b71c1c;"></i>
            <div><h4>Emergency Blood Bank</h4><p>16263 (24/7 Hotline)</p></div>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <i class="fas fa-phone-alt" style="font-size: 24px; color: #b71c1c;"></i>
            <div><h4>Helpline</h4><p>+880 1234-567890</p></div>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <i class="fas fa-envelope" style="font-size: 24px; color: #b71c1c;"></i>
            <div><h4>Email</h4><p>help@blooddonorbd.com</p></div>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <i class="fas fa-map-marker-alt" style="font-size: 24px; color: #b71c1c;"></i>
            <div><h4>Address</h4><p>Dhaka, Bangladesh</p></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderLoginPage() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <i class="fas fa-heartbeat"></i>
          <h2>Welcome Back</h2>
          <p>Login to your account</p>
        </div>
        
        <form id="loginForm">
          <div class="form-group">
            <label><i class="fas fa-envelope"></i> Email</label>
            <input type="email" id="loginEmail" required placeholder="Enter your email">
          </div>
          
          <div class="form-group">
            <label><i class="fas fa-lock"></i> Password</label>
            <input type="password" id="loginPassword" required placeholder="Enter your password">
          </div>
          
          <button type="submit" class="btn btn-primary btn-block">Login</button>
        </form>
        
        <div class="auth-footer">
          <p>Don't have an account? <a href="#" onclick="router.navigate('register'); return false;">Register here</a></p>
          <p style="margin-top: 8px;"><a href="#" onclick="resetPassword(); return false;">Forgot Password?</a></p>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    await authSystem.login(email, password);
  });
}

async function resetPassword() {
  const email = prompt('Enter your email address to reset password:');
  if (email) {
    try {
      await auth.sendPasswordResetEmail(email);
      Toast.show('Password reset email sent! Check your inbox.', 'success');
    } catch (error) {
      Toast.show('Failed to send reset email: ' + error.message, 'error');
    }
  }
}

function renderRegisterPage() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="auth-container">
      <div class="auth-card" style="max-width: 600px;">
        <div class="auth-header">
          <i class="fas fa-user-plus"></i>
          <h2>Join Blood Donor BD</h2>
          <p>Create your account</p>
        </div>
        
        <form id="registerForm">
          <div class="form-group">
            <label>Register As *</label>
            <select id="regUserType" required onchange="toggleBloodGroupField()">
              <option value="">Select Registration Type</option>
              <option value="donor">🩸 Blood Donor (Requires Approval)</option>
              <option value="seeker">🔍 Donor Seeker (Instant Access)</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Full Name *</label>
            <input type="text" id="regFullName" required placeholder="Enter your full name">
          </div>
          
          <div class="form-group">
            <label>Email *</label>
            <input type="email" id="regEmail" required placeholder="your@email.com">
          </div>
          
          <div class="form-group">
            <label>Phone Number *</label>
            <input type="tel" id="regPhone" required placeholder="01XXXXXXXXX">
          </div>
          
          <div class="form-group" id="nidGroup">
            <label>NID / Birth Registration No. *</label>
            <input type="text" id="regNidNumber" required placeholder="Enter your NID or Birth Registration number">
          </div>
          
          <div class="form-group" id="bloodGroupGroup">
            <label>Blood Group *</label>
            <select id="regBloodGroup">
              <option value="">Select Blood Group (if known)</option>
              <option>A+</option><option>A-</option><option>B+</option><option>B-</option>
              <option>O+</option><option>O-</option><option>AB+</option><option>AB-</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>District *</label>
            <select id="regDistrict" required>
              <option value="">Select District</option>
              ${bangladeshDistricts.map(d => `<option value="${d}">${d}</option>`).join('')}
            </select>
          </div>
          
          <div class="form-group">
            <label>Upazila *</label>
            <input type="text" id="regUpazila" required placeholder="Enter your upazila/thana">
          </div>
          
          <div class="form-group">
            <label>Address (Optional)</label>
            <textarea id="regAddress" rows="2" placeholder="Your full address"></textarea>
          </div>
          
          <div class="form-group">
            <label>Password *</label>
            <input type="password" id="regPassword" required minlength="6" placeholder="At least 6 characters">
          </div>
          
          <div class="form-group">
            <label>Confirm Password *</label>
            <input type="password" id="regConfirmPassword" required placeholder="Re-enter password">
          </div>
          
          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" id="regAgreeTerms" required>
              <span>I agree to the <a href="#" style="color: #b71c1c;">Terms and Conditions</a></span>
            </label>
          </div>
          
          <button type="submit" class="btn btn-primary btn-block">Register</button>
        </form>
        
        <div class="auth-footer">
          <p>Already have an account? <a href="#" onclick="router.navigate('login'); return false;">Login</a></p>
          <p style="font-size: 12px; color: #666; margin-top: 12px;">
            <i class="fas fa-info-circle"></i> Donor registration requires admin approval.
          </p>
        </div>
      </div>
    </div>
  `;
  
  window.toggleBloodGroupField = function() {
    const userType = document.getElementById('regUserType').value;
    const bloodGroupInput = document.getElementById('regBloodGroup');
    const bloodGroupGroup = document.getElementById('bloodGroupGroup');
    
    if (userType === 'donor') {
      bloodGroupInput.required = true;
      bloodGroupGroup.style.display = 'block';
    } else {
      bloodGroupInput.required = false;
      bloodGroupGroup.style.display = 'block';
    }
  };
  
  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const userType = document.getElementById('regUserType').value;
    
    if (!userType) {
      Toast.show('Please select registration type', 'error');
      return;
    }
    
    if (password !== confirmPassword) {
      Toast.show('Passwords do not match', 'error');
      return;
    }
    
    if (password.length < 6) {
      Toast.show('Password must be at least 6 characters', 'error');
      return;
    }
    
    const bloodGroup = document.getElementById('regBloodGroup').value;
    if (userType === 'donor' && !bloodGroup) {
      Toast.show('Blood group is required for donors', 'error');
      return;
    }
    
    const userData = {
      fullName: document.getElementById('regFullName').value.trim(),
      email: document.getElementById('regEmail').value.trim(),
      phoneNumber: document.getElementById('regPhone').value.trim(),
      nidNumber: document.getElementById('regNidNumber').value.trim(),
      bloodGroup: bloodGroup || null,
      district: document.getElementById('regDistrict').value,
      upazila: document.getElementById('regUpazila').value.trim(),
      address: document.getElementById('regAddress').value.trim(),
      userType: userType,
      password: password
    };
    
    await authSystem.register(userData);
  });
}

function renderDashboard() {
  if (!currentUser) {
    router.navigate('login');
    return;
  }
  
  const main = document.getElementById('mainContent');
  const approvalStatus = userProfile?.approvalStatus || 'pending';
  const statusColor = approvalStatus === 'approved' ? '#2e7d32' : approvalStatus === 'rejected' ? '#d32f2f' : '#f57c00';
  const statusText = approvalStatus === 'approved' ? 'Approved' : approvalStatus === 'rejected' ? 'Rejected' : 'Pending Approval';
  const userTypeLabel = userProfile?.isDonor ? 'Blood Donor' : 'Donor Seeker';
  
  main.innerHTML = `
    <h1 style="margin-bottom: 24px;">Welcome, ${userProfile?.fullName?.split(' ')[0] || 'User'}!</h1>
    
    <div style="display: flex; gap: 16px; margin-bottom: 24px;">
      <span class="badge" style="background: ${userProfile?.isDonor ? '#b71c1c' : '#1565c0'}; color: white; padding: 6px 16px; border-radius: 20px;">
        <i class="fas fa-${userProfile?.isDonor ? 'heart' : 'search'}"></i> ${userTypeLabel}
      </span>
    </div>
    
    <div style="background: ${statusColor}10; border-left: 4px solid ${statusColor}; padding: 16px 20px; border-radius: 8px; margin-bottom: 32px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <i class="fas fa-${approvalStatus === 'approved' ? 'check-circle' : approvalStatus === 'rejected' ? 'times-circle' : 'clock'}" style="color: ${statusColor}; font-size: 24px;"></i>
        <div>
          <strong style="color: ${statusColor};">Account Status: ${statusText}</strong>
          <p style="color: #666; font-size: 14px; margin-top: 4px;">
            ${userProfile?.isDonor ? 
              (approvalStatus === 'approved' ? 'Your donor account is verified and active.' : 
               approvalStatus === 'rejected' ? 'Your application was rejected. Please contact support.' : 
               'Your application is under review by our admin team.') : 
              'You can search and contact donors immediately.'}
          </p>
        </div>
      </div>
    </div>
    
    <div class="dashboard-grid">
      ${userProfile?.isDonor ? `
        <div class="stat-card">
          <div class="stat-icon"><i class="fas fa-tint"></i></div>
          <div class="stat-info"><h3>Blood Group</h3><p>${userProfile?.bloodGroup || 'N/A'}</p></div>
        </div>
      ` : ''}
      <div class="stat-card">
        <div class="stat-icon"><i class="fas fa-certificate"></i></div>
        <div class="stat-info"><h3>Certificates</h3><p>${userProfile?.certificates?.length || 0}</p></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon"><i class="fas fa-map-marker-alt"></i></div>
        <div class="stat-info"><h3>Location</h3><p>${userProfile?.district || 'N/A'}</p></div>
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin-top: 24px;">
      <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h3 style="margin-bottom: 20px;">Quick Actions</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <button onclick="router.navigate('find-donors')" class="btn btn-outline"><i class="fas fa-search"></i> Find Donors</button>
          <button onclick="router.navigate('request-blood')" class="btn btn-outline"><i class="fas fa-bell"></i> Request Blood</button>
          <button onclick="router.navigate('dm-donor')" class="btn btn-outline"><i class="fas fa-comments"></i> DM Donors</button>
          ${userProfile?.isDonor ? `
            <button onclick="router.navigate('certificates')" class="btn btn-outline"><i class="fas fa-certificate"></i> My Certificates</button>
          ` : ''}
          <button onclick="router.navigate('profile')" class="btn btn-outline"><i class="fas fa-user-edit"></i> Edit Profile</button>
          ${userProfile?.role === 'admin' ? `<a href="admin.html" class="btn btn-primary"><i class="fas fa-shield-alt"></i> Admin Panel</a>` : ''}
        </div>
      </div>
      
      <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h3 style="margin-bottom: 20px;">Profile Information</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <p><strong>Name:</strong> ${userProfile?.fullName || '-'}</p>
          <p><strong>Email:</strong> ${userProfile?.email || '-'}</p>
          <p><strong>Phone:</strong> ${userProfile?.phoneNumber || '-'}</p>
          <p><strong>NID/Birth Reg:</strong> ${userProfile?.nidNumber || '-'}</p>
          ${userProfile?.isDonor ? `<p><strong>Blood Group:</strong> ${userProfile?.bloodGroup || '-'}</p>` : ''}
          <p><strong>District:</strong> ${userProfile?.district || '-'}, ${userProfile?.upazila || ''}</p>
          <p><strong>Registered:</strong> ${userProfile?.createdAt ? new Date(userProfile.createdAt.toDate()).toLocaleDateString() : '-'}</p>
        </div>
      </div>
    </div>
  `;
}

function renderProfilePage() {
  if (!currentUser) { router.navigate('login'); return; }
  
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="profile-container">
      <div class="profile-header">
        <div class="profile-avatar">${userProfile?.fullName?.charAt(0) || 'U'}</div>
        <div class="profile-info">
          <h2>${userProfile?.fullName}</h2>
          <span class="profile-badge">${userProfile?.isDonor ? 'Blood Donor' : 'Donor Seeker'}</span>
          <span class="profile-badge" style="margin-left: 8px; background: ${userProfile?.approvalStatus === 'approved' ? '#2e7d32' : '#f57c00'};">${userProfile?.approvalStatus || 'pending'}</span>
        </div>
      </div>
      
      <form id="profileForm" class="profile-form">
        <div class="form-group"><label>Full Name</label><input type="text" id="profileFullName" value="${userProfile?.fullName || ''}" required></div>
        <div class="form-group"><label>Phone Number</label><input type="tel" id="profilePhone" value="${userProfile?.phoneNumber || ''}" required></div>
        <div class="form-group"><label>NID / Birth Registration No.</label><input type="text" id="profileNid" value="${userProfile?.nidNumber || ''}" required></div>
        ${userProfile?.isDonor ? `
          <div class="form-group">
            <label>Blood Group</label>
            <select id="profileBloodGroup">
              <option value="">Select</option>
              <option ${userProfile?.bloodGroup === 'A+' ? 'selected' : ''}>A+</option>
              <option ${userProfile?.bloodGroup === 'A-' ? 'selected' : ''}>A-</option>
              <option ${userProfile?.bloodGroup === 'B+' ? 'selected' : ''}>B+</option>
              <option ${userProfile?.bloodGroup === 'B-' ? 'selected' : ''}>B-</option>
              <option ${userProfile?.bloodGroup === 'O+' ? 'selected' : ''}>O+</option>
              <option ${userProfile?.bloodGroup === 'O-' ? 'selected' : ''}>O-</option>
              <option ${userProfile?.bloodGroup === 'AB+' ? 'selected' : ''}>AB+</option>
              <option ${userProfile?.bloodGroup === 'AB-' ? 'selected' : ''}>AB-</option>
            </select>
          </div>
        ` : ''}
        <div class="form-group">
          <label>District</label>
          <select id="profileDistrict">
            <option value="">Select</option>
            ${bangladeshDistricts.map(d => `<option value="${d}" ${userProfile?.district === d ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Upazila</label><input type="text" id="profileUpazila" value="${userProfile?.upazila || ''}"></div>
        <div class="form-group"><label>Address</label><textarea id="profileAddress" rows="3">${userProfile?.address || ''}</textarea></div>
        <button type="submit" class="btn btn-primary">Update Profile</button>
      </form>
    </div>
  `;
  
  document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const updates = {
        fullName: document.getElementById('profileFullName').value.trim(),
        phoneNumber: document.getElementById('profilePhone').value.trim(),
        nidNumber: document.getElementById('profileNid').value.trim(),
        district: document.getElementById('profileDistrict').value,
        upazila: document.getElementById('profileUpazila').value.trim(),
        address: document.getElementById('profileAddress').value.trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      if (userProfile?.isDonor) {
        updates.bloodGroup = document.getElementById('profileBloodGroup').value;
      }
      
      await db.collection('users').doc(currentUser.uid).update(updates);
      await authSystem.loadUserProfile(currentUser.uid);
      Toast.show('Profile updated!', 'success');
      router.navigate('dashboard');
    } catch (error) {
      Toast.show('Failed to update profile', 'error');
    }
  });
}

async function renderFindDonorsPage() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <h1 style="margin-bottom: 24px;">Find Blood Donors</h1>
    <div style="background: white; padding: 24px; border-radius: 12px; margin-bottom: 32px;">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
        <div class="form-group">
          <label>Blood Group</label>
          <select id="searchBloodGroup"><option value="">All</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>O+</option><option>O-</option><option>AB+</option><option>AB-</option></select>
        </div>
        <div class="form-group">
          <label>District</label>
          <select id="searchDistrict"><option value="">All</option>${bangladeshDistricts.map(d => `<option value="${d}">${d}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>&nbsp;</label><button onclick="searchDonors()" class="btn btn-primary btn-block"><i class="fas fa-search"></i> Search</button></div>
      </div>
    </div>
    <div id="donorResults"></div>
  `;
  setTimeout(() => searchDonors(), 100);
}

async function searchDonors() {
  const bloodGroup = document.getElementById('searchBloodGroup')?.value || '';
  const district = document.getElementById('searchDistrict')?.value || '';
  const results = document.getElementById('donorResults');
  if (!results) return;
  
  results.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
  
  try {
    let query = db.collection('users').where('approvalStatus', '==', 'approved').where('isDonor', '==', true);
    if (bloodGroup) query = query.where('bloodGroup', '==', bloodGroup);
    
    const snapshot = await query.limit(50).get();
    let donors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (district) donors = donors.filter(d => d.district === district);
    
    if (donors.length === 0) {
      results.innerHTML = '<div class="empty-state"><i class="fas fa-users-slash"></i><p>No approved donors found.</p></div>';
      return;
    }
    
    results.innerHTML = `<h2 style="margin-bottom: 20px;">${donors.length} Donor(s) Found</h2><div id="donorList"></div>`;
    const donorList = document.getElementById('donorList');
    
    donors.forEach(donor => {
      const card = document.createElement('div');
      card.className = 'request-card';
      card.innerHTML = `
        <div class="request-header"><div><h3>${donor.fullName}</h3><span class="request-blood-group">${donor.bloodGroup}</span></div><span class="badge" style="background:#2e7d32;color:white;padding:4px 12px;border-radius:20px;"><i class="fas fa-check-circle"></i> Verified Donor</span></div>
        <div class="request-details"><div class="request-detail"><i class="fas fa-map-marker-alt"></i><span>${donor.district}, ${donor.upazila || ''}</span></div><div class="request-detail"><i class="fas fa-phone"></i><span>${donor.phoneNumber ? donor.phoneNumber.slice(0,8)+'***' : 'N/A'}</span></div></div>
        <div class="request-actions">
          ${currentUser ? `
            <button onclick="revealContact('${donor.id}', '${donor.phoneNumber}', '${donor.fullName}')" class="btn btn-primary"><i class="fas fa-phone"></i> Reveal Contact</button>
            <button onclick="router.navigate('dm-donor')" class="btn btn-outline"><i class="fas fa-comment"></i> Message</button>
          ` : `<button onclick="router.navigate('login')" class="btn btn-outline">Login to Contact</button>`}
        </div>
      `;
      donorList.appendChild(card);
    });
  } catch (error) {
    results.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Error searching donors.</p></div>';
  }
}

async function revealContact(donorId, phone, donorName) {
  if (!phone) {
    Toast.show('Phone number not available', 'error');
    return;
  }
  
  if (confirm(`Reveal contact number for ${donorName}?`)) {
    // Log the contact
    await contactTracking.logContact(donorId, currentUser.uid, donorName, userProfile.fullName);
    window.open(`tel:${phone}`);
    Toast.show('Contact revealed', 'info');
  }
}

function renderRequestBloodPage() {
  if (!currentUser) { router.navigate('login'); return; }
  
  const main = document.getElementById('mainContent');
  const today = new Date().toISOString().split('T')[0];
  
  main.innerHTML = `
    <div style="max-width: 800px; margin: 0 auto;">
      <h1 style="margin-bottom: 24px;">Request Blood</h1>
      <div style="background: #fff3e0; border-left: 4px solid #f57c00; padding: 16px; border-radius: 8px; margin-bottom: 24px;"><i class="fas fa-info-circle"></i> <strong>Note:</strong> Requests active for 24 hours.</div>
      <div style="background: white; padding: 32px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <form id="bloodRequestForm">
          <div class="form-group"><label>Patient Name *</label><input type="text" id="patientName" required></div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;"><div class="form-group"><label>Age *</label><input type="number" id="patientAge" required></div><div class="form-group"><label>Gender *</label><select id="patientGender" required><option value="">Select</option><option>Male</option><option>Female</option></select></div></div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;"><div class="form-group"><label>Blood Group *</label><select id="requestBloodGroup" required><option value="">Select</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>O+</option><option>O-</option><option>AB+</option><option>AB-</option></select></div><div class="form-group"><label>Units *</label><input type="number" id="unitsNeeded" required value="1"></div></div>
          <div class="form-group"><label>Hospital *</label><input type="text" id="hospitalName" required></div>
          <div class="form-group"><label>Hospital Address *</label><textarea id="hospitalAddress" required rows="2"></textarea></div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;"><div class="form-group"><label>Required By *</label><input type="date" id="requiredBy" required value="${today}"></div><div class="form-group"><label>Urgency *</label><select id="urgency" required><option value="normal">Normal</option><option value="urgent">Urgent</option><option value="emergency">Emergency</option></select></div></div>
          <div class="form-group"><label>Contact Number *</label><input type="tel" id="contactNumber" required value="${userProfile?.phoneNumber || ''}"></div>
          <div class="form-group"><label>Additional Notes</label><textarea id="additionalNotes" rows="2"></textarea></div>
          <button type="submit" class="btn btn-primary btn-block">Submit Request</button>
        </form>
      </div>
    </div>
  `;
  
  document.getElementById('bloodRequestForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const requestData = {
        patientName: document.getElementById('patientName').value.trim(),
        patientAge: parseInt(document.getElementById('patientAge').value),
        patientGender: document.getElementById('patientGender').value,
        bloodGroup: document.getElementById('requestBloodGroup').value,
        unitsNeeded: parseInt(document.getElementById('unitsNeeded').value),
        hospitalName: document.getElementById('hospitalName').value.trim(),
        hospitalAddress: document.getElementById('hospitalAddress').value.trim(),
        requiredBy: document.getElementById('requiredBy').value,
        urgency: document.getElementById('urgency').value,
        contactNumber: document.getElementById('contactNumber').value.trim(),
        additionalNotes: document.getElementById('additionalNotes').value.trim(),
        requesterUid: currentUser.uid,
        requesterName: userProfile.fullName,
        requesterEmail: userProfile.email,
        status: 'active',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        expiresAt: firebase.firestore.Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000))
      };
      await db.collection('bloodRequests').add(requestData);
      Toast.show('Request submitted! Active for 24 hours.', 'success');
      router.navigate('my-requests');
    } catch (error) {
      Toast.show('Failed to submit request', 'error');
    }
  });
}

async function renderMyRequestsPage() {
  if (!currentUser) { router.navigate('login'); return; }
  const main = document.getElementById('mainContent');
  main.innerHTML = `<h1 style="margin-bottom: 24px;">My Blood Requests</h1><div id="myRequestsList"></div>`;
  await loadMyRequests();
}

async function loadMyRequests() {
  const container = document.getElementById('myRequestsList');
  if (!container) return;
  
  try {
    const snapshot = await db.collection('bloodRequests').where('requesterUid', '==', currentUser.uid).get();
    
    if (snapshot.empty) {
      container.innerHTML = `<div class="empty-state"><i class="fas fa-clipboard-list"></i><p>No requests found.</p><button onclick="router.navigate('request-blood')" class="btn btn-primary" style="margin-top:16px;">Create Request</button></div>`;
      return;
    }
    
    const requests = [];
    snapshot.forEach(doc => requests.push({ id: doc.id, ...doc.data() }));
    requests.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
    
    const now = new Date();
    container.innerHTML = '';
    
    requests.forEach(req => {
      const createdAt = req.createdAt?.toDate?.() || new Date();
      const expiresAt = req.expiresAt?.toDate?.() || new Date(createdAt.getTime() + 24*60*60*1000);
      const isExpired = expiresAt < now;
      const status = isExpired && req.status === 'active' ? 'expired' : req.status;
      
      const card = document.createElement('div');
      card.className = 'request-card';
      card.innerHTML = `
        <div class="request-header"><div><h3>${req.patientName}</h3><span class="request-blood-group">${req.bloodGroup}</span></div><span class="badge" style="background:${status==='active'?'#2e7d32':status==='fulfilled'?'#1565c0':'#757575'};color:white;padding:4px 12px;border-radius:20px;">${status==='active'?'Active':status==='fulfilled'?'Fulfilled':'Expired'}</span></div>
        <div class="request-details"><div class="request-detail"><i class="fas fa-hospital"></i><span>${req.hospitalName}</span></div><div class="request-detail"><i class="fas fa-flask"></i><span>${req.unitsNeeded} Unit(s)</span></div><div class="request-detail"><i class="fas fa-calendar"></i><span>Required: ${req.requiredBy}</span></div><div class="request-detail"><i class="fas fa-clock"></i><span>Posted: ${createdAt.toLocaleString()}</span></div></div>
        ${status==='active'?`<div style="margin-top:16px;padding:12px;background:#e8f5e9;border-radius:8px;"><i class="fas fa-hourglass-half"></i><span> Expires in: ${Math.max(0,Math.floor((expiresAt-now)/(1000*60*60)))} hours</span></div>`:''}
      `;
      container.appendChild(card);
    });
  } catch (error) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Error: ${error.message}</p><button onclick="router.navigate('request-blood')" class="btn btn-primary" style="margin-top:16px;">Create Request</button></div>`;
  }
}

async function renderCertificatesPage() {
  if (!currentUser) { router.navigate('login'); return; }
  const main = document.getElementById('mainContent');
  main.innerHTML = `<h1 style="margin-bottom: 24px;">My Certificates</h1><div id="certificateList"></div>`;
  await loadCertificates();
}

async function loadCertificates() {
  const container = document.getElementById('certificateList');
  
  if (!userProfile?.isDonor) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-info-circle"></i><p>Certificates are only available for blood donors.</p></div>`;
    return;
  }
  
  if (userProfile?.approvalStatus !== 'approved') {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-clock"></i><p>Account pending approval. Certificates available after approval.</p></div>`;
    return;
  }
  
  try {
    const certificates = await certificateSystem.loadMyCertificates();
    if (certificates.length === 0) {
      container.innerHTML = `<div class="empty-state"><i class="fas fa-certificate"></i><p>No certificates found.</p></div>`;
      return;
    }
    
    container.innerHTML = '';
    certificates.forEach(cert => {
      const item = document.createElement('div');
      item.className = 'certificate-item';
      item.innerHTML = `
        <div class="certificate-info">
          <div class="certificate-icon"><i class="fas fa-certificate"></i></div>
          <div class="certificate-details">
            <h4>Donor Registration Certificate</h4>
            <p>Certificate ID: ${cert.certificateId}</p>
            <p>Donor ID: ${cert.donorId || 'N/A'}</p>
            <p>Blood Group: ${cert.bloodGroup}</p>
            <p>Issued: ${new Date(cert.issuedDate).toLocaleDateString()}</p>
          </div>
        </div>
        <div class="certificate-actions">
          <button onclick="certificateSystem.viewCertificate('${cert.certificateId}')" class="btn btn-primary"><i class="fas fa-eye"></i> View</button>
          <button onclick="certificateSystem.downloadCertificate('${cert.certificateId}')" class="btn btn-outline"><i class="fas fa-download"></i> Download</button>
        </div>
      `;
      container.appendChild(item);
    });
  } catch (error) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Error loading certificates.</p></div>';
  }
}

function renderVerifyCertificatePage() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div style="max-width:600px;margin:0 auto;">
      <h1 style="margin-bottom:24px;">Verify Certificate</h1>
      <div style="background:white;padding:32px;border-radius:12px;">
        <p>Enter a certificate ID to verify:</p>
        <input type="text" id="certIdInput" class="search-input" style="width:100%;margin:16px 0;padding:14px;border:1px solid #ddd;border-radius:8px;" placeholder="Enter Certificate ID">
        <button onclick="verifyCertificateInput()" class="btn btn-primary btn-block">Verify Certificate</button>
        <div id="verificationResult" style="margin-top:20px;"></div>
      </div>
    </div>
  `;
}

async function verifyCertificateInput() {
  const certId = document.getElementById('certIdInput')?.value.trim();
  const resultDiv = document.getElementById('verificationResult');
  
  if (!certId) {
    Toast.show('Please enter a certificate ID', 'warning');
    return;
  }
  
  resultDiv.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Verifying...</div>';
  
  try {
    const doc = await db.collection('certificates').doc(certId).get();
    if (!doc.exists) {
      resultDiv.innerHTML = `<div style="background:#ffebee;padding:16px;border-radius:8px;border-left:4px solid #d32f2f;"><i class="fas fa-times-circle"></i> Certificate not found.</div>`;
      return;
    }
    const cert = doc.data();
    resultDiv.innerHTML = `
      <div style="background:#e8f5e9;padding:16px;border-radius:8px;border-left:4px solid #2e7d32;">
        <i class="fas fa-check-circle" style="color:#2e7d32;"></i> <strong>Certificate Verified!</strong>
        <p style="margin-top:12px;"><strong>Name:</strong> ${cert.userName}</p>
        <p><strong>Blood Group:</strong> ${cert.bloodGroup}</p>
        <p><strong>Donor ID:</strong> ${cert.donorId || 'N/A'}</p>
        <p><strong>Issued:</strong> ${new Date(cert.issuedDate).toLocaleDateString()}</p>
        <button onclick="certificateSystem.viewCertificate('${certId}')" class="btn btn-primary" style="margin-top:12px;"><i class="fas fa-eye"></i> View Certificate</button>
      </div>
    `;
  } catch (error) {
    resultDiv.innerHTML = `<div style="background:#ffebee;padding:16px;border-radius:8px;">Error verifying certificate.</div>`;
  }
}

// DM Donor Page - Group Chat
async function renderDmDonorPage() {
  if (!currentUser) { router.navigate('login'); return; }
  
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div style="max-width: 1000px; margin: 0 auto;">
      <h1 style="margin-bottom: 24px;"><i class="fas fa-comments"></i> DM for Donor</h1>
      <div style="display: grid; grid-template-columns: 300px 1fr; gap: 20px; height: 70vh; min-height: 500px;">
        <!-- Online Users Sidebar -->
        <div style="background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); display: flex; flex-direction: column;">
          <div style="padding: 16px; border-bottom: 1px solid #eee;">
            <h3 style="margin: 0;"><i class="fas fa-users"></i> Online Users</h3>
          </div>
          <div id="onlineUsersList" style="flex: 1; overflow-y: auto; padding: 12px;">
            <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading users...</div>
          </div>
        </div>
        
        <!-- Chat Area -->
        <div style="background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); display: flex; flex-direction: column;">
          <div style="padding: 16px; border-bottom: 1px solid #eee;">
            <h3 style="margin: 0;"><i class="fas fa-comment-dots"></i> Group Chat</h3>
            <p style="font-size: 12px; color: #666; margin-top: 4px;">Everyone can chat here</p>
          </div>
          <div id="chatMessages" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
            <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading messages...</div>
          </div>
          <div style="padding: 16px; border-top: 1px solid #eee; display: flex; gap: 10px;">
            <input type="text" id="messageInput" placeholder="Type your message..." style="flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 25px; font-size: 14px;">
            <button onclick="sendChatMessage()" class="btn btn-primary" style="border-radius: 25px; padding: 12px 24px;"><i class="fas fa-paper-plane"></i> Send</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  loadOnlineUsers();
  loadChatMessages();
  setupRealtimeChat();
}

async function loadOnlineUsers() {
  const container = document.getElementById('onlineUsersList');
  if (!container) return;
  
  try {
    const snapshot = await db.collection('users')
      .where('approvalStatus', 'in', ['approved', 'pending'])
      .limit(50)
      .get();
    
    const users = [];
    snapshot.forEach(doc => {
      const user = doc.data();
      if (user.uid !== currentUser?.uid) {
        users.push(user);
      }
    });
    
    if (users.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No other users online</p>';
      return;
    }
    
    container.innerHTML = users.map(user => `
      <div style="display: flex; align-items: center; gap: 12px; padding: 10px; border-bottom: 1px solid #f0f0f0;">
        <div style="width: 40px; height: 40px; border-radius: 50%; background: ${user.isDonor ? '#b71c1c' : '#1565c0'}; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
          ${user.fullName?.charAt(0) || 'U'}
        </div>
        <div style="flex: 1;">
          <strong>${user.fullName}</strong>
          <div style="display: flex; gap: 8px; margin-top: 4px;">
            <span class="badge" style="background: ${user.isDonor ? '#b71c1c' : '#1565c0'}; color: white; font-size: 10px; padding: 2px 8px;">
              ${user.isDonor ? '🩸 Donor' : '🔍 Seeker'}
            </span>
            ${user.isDonor ? `<span class="badge" style="background: #2e7d32; color: white; font-size: 10px; padding: 2px 8px;">${user.bloodGroup || ''}</span>` : ''}
          </div>
        </div>
        <div style="width: 10px; height: 10px; border-radius: 50%; background: #4caf50;"></div>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = '<p style="color: red;">Error loading users</p>';
  }
}

async function loadChatMessages() {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  
  try {
    const snapshot = await db.collection('chatMessages')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();
    
    const messages = [];
    snapshot.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));
    messages.reverse();
    
    if (messages.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">No messages yet. Start the conversation!</p>';
      return;
    }
    
    container.innerHTML = messages.map(msg => {
      const isOwnMessage = msg.userId === currentUser?.uid;
      return `
        <div style="display: flex; ${isOwnMessage ? 'justify-content: flex-end;' : ''}">
          <div style="max-width: 70%;">
            ${!isOwnMessage ? `
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="font-weight: 600; font-size: 13px;">${msg.userName}</span>
                <span class="badge" style="background: ${msg.isDonor ? '#b71c1c' : '#1565c0'}; color: white; font-size: 10px; padding: 2px 6px;">
                  ${msg.isDonor ? 'Donor' : 'Seeker'}
                </span>
              </div>
            ` : ''}
            <div style="background: ${isOwnMessage ? '#b71c1c' : '#f0f0f0'}; color: ${isOwnMessage ? 'white' : '#333'}; padding: 10px 15px; border-radius: 18px; word-wrap: break-word;">
              ${msg.message}
            </div>
            <div style="font-size: 10px; color: #999; margin-top: 4px; ${isOwnMessage ? 'text-align: right;' : ''}">
              ${msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'Just now'}
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  } catch (error) {
    container.innerHTML = '<p style="color: red;">Error loading messages</p>';
  }
}

function setupRealtimeChat() {
  db.collection('chatMessages')
    .orderBy('timestamp', 'desc')
    .limit(50)
    .onSnapshot(() => {
      loadChatMessages();
    });
}

async function sendChatMessage() {
  const input = document.getElementById('messageInput');
  const message = input.value.trim();
  
  if (!message) return;
  
  try {
    await db.collection('chatMessages').add({
      userId: currentUser.uid,
      userName: userProfile.fullName,
      isDonor: userProfile.isDonor || false,
      message: message,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    input.value = '';
  } catch (error) {
    Toast.show('Failed to send message', 'error');
  }
}

// Initialize App
auth.onAuthStateChanged(async (user) => {
  document.getElementById('loadingOverlay').style.display = 'none';
  document.getElementById('appContainer').style.display = 'block';
  
  if (user) {
    currentUser = user;
    await authSystem.loadUserProfile(user.uid);
    updateNavigation();
    const hash = window.location.hash.substring(1);
    if (hash && router.routes[hash]) router.navigate(hash);
    else router.navigate('dashboard');
  } else {
    currentUser = null; userProfile = null;
    updateNavigation();
    const hash = window.location.hash.substring(1);
    if (hash && router.routes[hash]) router.navigate(hash);
    else router.navigate('home');
  }
});

function updateNavigation() {
  const navMenu = document.getElementById('navMenu');
  const userInfo = document.getElementById('userInfo');
  const logoutBtn = document.getElementById('logoutBtn');
  if (!navMenu || !userInfo || !logoutBtn) return;
  
  if (currentUser) {
    navMenu.innerHTML = `
      <li><a href="#" data-page="dashboard" onclick="router.navigate('dashboard');return false;">Dashboard</a></li>
      <li><a href="#" data-page="find-donors" onclick="router.navigate('find-donors');return false;">Find Donors</a></li>
      <li><a href="#" data-page="request-blood" onclick="router.navigate('request-blood');return false;">Request Blood</a></li>
      <li><a href="#" data-page="dm-donor" onclick="router.navigate('dm-donor');return false;"><i class="fas fa-comments"></i> DM Donors</a></li>
      ${userProfile?.isDonor ? `<li><a href="#" data-page="certificates" onclick="router.navigate('certificates');return false;">Certificates</a></li>` : ''}
      <li><a href="#" data-page="profile" onclick="router.navigate('profile');return false;">Profile</a></li>
    `;
    userInfo.innerHTML = `<div class="user-avatar">${userProfile?.fullName?.charAt(0) || 'U'}</div><span>${userProfile?.fullName?.split(' ')[0] || 'User'}</span>`;
    logoutBtn.style.display = 'block';
  } else {
    navMenu.innerHTML = `
      <li><a href="#" data-page="home" onclick="router.navigate('home');return false;">Home</a></li>
      <li><a href="#" data-page="find-donors" onclick="router.navigate('find-donors');return false;">Find Donors</a></li>
      <li><a href="#" data-page="about" onclick="router.navigate('about');return false;">About</a></li>
      <li><a href="#" data-page="contact" onclick="router.navigate('contact');return false;">Contact</a></li>
    `;
    userInfo.innerHTML = `<button onclick="router.navigate('login')" class="btn btn-outline">Login</button><button onclick="router.navigate('register')" class="btn btn-primary">Register</button>`;
    logoutBtn.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('logoutBtn')?.addEventListener('click', () => authSystem.logout());
  const mobileBtn = document.querySelector('.mobile-menu-btn');
  const navMenu = document.getElementById('navMenu');
  if (mobileBtn && navMenu) mobileBtn.addEventListener('click', () => navMenu.classList.toggle('active'));
  window.addEventListener('popstate', () => {
    const hash = window.location.hash.substring(1);
    router.navigate(hash && router.routes[hash] ? hash : 'home');
  });
});

// Export to global
window.router = router;
window.authSystem = authSystem;
window.certificateSystem = certificateSystem;
window.contactTracking = contactTracking;
window.revealContact = revealContact;
window.searchDonors = searchDonors;
window.verifyCertificateInput = verifyCertificateInput;
window.resetPassword = resetPassword;
window.sendChatMessage = sendChatMessage;
window.toggleBloodGroupField = toggleBloodGroupField;
