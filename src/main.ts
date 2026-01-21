
import { state } from './state.js';
import { setVersionDisplay, injectLoadingMask, showLoadingMask, hideLoadingMask, togglePasswordVisibility } from './utils.js';
import { applyTranslations, renderFilterControls, toggleCart, toggleHelp, toggleAdminModal, toggleProfileModal, closeImageModal, updateCartUI, injectLoginUI, toggleForgotPasswordForm, updateHamburgerUserInfo, injectAdminButtons, injectOrdersButton, removeAdminButtons, setupHamburgerMenu, toggleOtherPaymentModal as _toggleOtherPaymentModal, initManualPaymentUI, toggleOrdersModal, openReceiptModal, closeReceiptModal, refreshOrdersModal, openOrderDetailsModal, closeOrderDetailsModal, openReceiptImageModal, toggleContactModal } from './ui.js';
import { addToCart, removeFromCart, removeAllFromCart, checkout, cancelCheckout, loginUser, logoutUser, addProduct, syncDatabase, resetDatabaseSchema, applyFilter, changeItemsPerPage, renderPage, toggleLanguage, openImageModal, loginUserEmail, registerUser, toggleRegisterForm, runMigration, fetchDataAndLoad, uploadImagesToCloudinary, fetchPlantClasses, openProfileModal, saveProfile, changePassword, requestPasswordReset, handleSearch, removeDiscount, updateCurrency, updateShippingAddress, submitManualPayment, verifyOrder, unverifyOrder, shipOrder, cancelOrder, restoreSession, restorePreOrder, sendContactMessage } from './actions.js';

// Expose functions to window for HTML event handlers
(window as any).toggleLanguage = toggleLanguage;
(window as any).toggleHelp = toggleHelp;
(window as any).removeAllFromCart = removeAllFromCart;
(window as any).loginUser = loginUser;
(window as any).logoutUser = logoutUser;
(window as any).toggleCart = toggleCart;
(window as any).addToCart = addToCart;
(window as any).removeFromCart = removeFromCart;
(window as any).checkout = checkout;
(window as any).cancelCheckout = cancelCheckout;
(window as any).syncDatabase = syncDatabase;
(window as any).resetDatabaseSchema = resetDatabaseSchema;
(window as any).toggleAdminModal = toggleAdminModal;
(window as any).toggleProfileModal = toggleProfileModal;
(window as any).addProduct = addProduct;
(window as any).openImageModal = openImageModal;
(window as any).closeImageModal = closeImageModal;
(window as any).applyFilter = applyFilter;
(window as any).changeItemsPerPage = changeItemsPerPage;
(window as any).renderPage = renderPage;
(window as any).loginUserEmail = loginUserEmail;
(window as any).registerUser = registerUser;
(window as any).toggleRegisterForm = toggleRegisterForm;
(window as any).runMigration = runMigration;
(window as any).uploadImagesToCloudinary = uploadImagesToCloudinary;
(window as any).openProfileModal = openProfileModal;
(window as any).saveProfile = saveProfile;
(window as any).changePassword = changePassword;
(window as any).toggleForgotPasswordForm = toggleForgotPasswordForm;
(window as any).requestPasswordReset = requestPasswordReset;
(window as any).handleSearch = handleSearch;
(window as any).removeDiscount = removeDiscount;
(window as any).updateCurrency = updateCurrency;
(window as any).updateShippingAddress = updateShippingAddress;
(window as any).restorePreOrder = restorePreOrder;

const toggleOtherPaymentModal = (start_payment: boolean = false) => {
    _toggleOtherPaymentModal(start_payment);
}
(window as any).toggleOtherPaymentModal = toggleOtherPaymentModal;
(window as any).submitManualPayment = submitManualPayment;
(window as any).toggleOrdersModal = toggleOrdersModal;
(window as any).refreshOrdersModal = refreshOrdersModal;
(window as any).verifyOrder = verifyOrder;
(window as any).unverifyOrder = unverifyOrder;
(window as any).shipOrder = shipOrder;
(window as any).cancelOrder = cancelOrder;
(window as any).openReceiptModal = openReceiptModal;
(window as any).closeReceiptModal = closeReceiptModal;
(window as any).openOrderDetailsModal = openOrderDetailsModal;
(window as any).closeOrderDetailsModal = closeOrderDetailsModal;
(window as any).openReceiptImageModal = openReceiptImageModal;
(window as any).toggleContactModal = toggleContactModal;
(window as any).sendContactMessage = sendContactMessage;

(window as any).togglePasswordVisibility = togglePasswordVisibility;

 // Initialize application on page load
 window.onload = function () {
   injectLoadingMask();
   showLoadingMask("Loading...");
   setVersionDisplay();
   
   // Load language preference
   const savedLang = localStorage.getItem('cactusLang');
   if (savedLang) {
       state.currentLang = savedLang;
   }
   applyTranslations();
   fetchPlantClasses();
   
   // Render Filter Controls
   renderFilterControls();
   setupHamburgerMenu();
   initManualPaymentUI();
 
   // Check for persisted login and restore session if user is logged in
   console.log("main.ts: Checking session...");
   const authToken = localStorage.getItem("authToken");
   const persistedEmail = localStorage.getItem("currentUserEmail");

   if (authToken) {
     console.log("main.ts: Found authToken, attempting restore...");
     restoreSession().then(() => {
       if (state.currentUser) {
         console.log("main.ts: Session restored for", state.currentUser);
         const authContainer = document.getElementById("auth-container");
         if (authContainer) authContainer.style.display = "none";
         
         const profileBtn = document.getElementById("profile-btn");
         if (profileBtn) {
           profileBtn.style.display = "block";
           profileBtn.classList.remove("hidden");
         }

         fetchDataAndLoad().then(() => hideLoadingMask());
       } else {
         console.log("main.ts: Restore failed, showing login.");
         hideLoadingMask();
         injectLoginUI();
       }
     });
   } else if (persistedEmail) {
     console.log("main.ts: Found legacy email, restoring...");
     // Restore user email and data
     state.currentUser = persistedEmail;
     const userData = localStorage.getItem("currentUserData");
     if (userData) {
       try {
         state.currentUserData = JSON.parse(userData);
         state.isAdmin = !!(state.currentUserData && state.currentUserData.is_admin);
       } catch (e) {
         console.warn("Failed to parse currentUserData:", e);
       }
     } else {
       console.warn("No localStorage.getItem('currentUserData')");
     }
     
     // Hide the login UI
     const authContainer = document.getElementById("auth-container");
     if (authContainer) {
       authContainer.style.display = "none";
     }
     
     // Show admin buttons if user is admin
     if (state.isAdmin) {
       injectAdminButtons();
     }
     injectOrdersButton();
     
     updateHamburgerUserInfo(state.currentUser, state.isAdmin);
     
     const profileBtn = document.getElementById("profile-btn");
     if (profileBtn) {
       profileBtn.style.display = "block";
       profileBtn.classList.remove("hidden");
     }
     
     // Load and display products and user data
     fetchDataAndLoad().then(() => {
       hideLoadingMask();
     });
   } else {
     console.log("main.ts: No session, showing login.");
     // No user logged in, show the login page
     hideLoadingMask();
     injectLoginUI();
   }

   // Add click listeners to logos
   const logos = document.querySelectorAll('.header-logo, .sidebar-logo, .corner-logo');
   logos.forEach(logo => {
       logo.addEventListener('click', () => {
           if (state.currentUser) {
               toggleContactModal();
           }
       });
       (logo as HTMLElement).style.cursor = 'pointer';
   });



  // Sidebar close listener
   document.addEventListener('click', function(event) {
     const helpDialog = document.getElementById('help-dialog');
     const helpBtn = document.getElementById('help-btn');
     if (helpDialog && helpDialog.style.display !== 'none' && !helpDialog.contains(event.target as Node) && (!helpBtn || !helpBtn.contains(event.target as Node))) {
       helpDialog.style.display = 'none';
     }
 
     const sidebar = document.getElementById('cart-sidebar');
     const toggleBtn = document.getElementById('cart-toggle-btn');
     
     if (!(event.target as Node).isConnected) return;
 
     const imageModal = document.getElementById('image-modal');
     if (imageModal && (imageModal === event.target || imageModal.contains(event.target as Node))) {
       return;
     }

     if (sidebar && sidebar.classList.contains('open') && !sidebar.contains(event.target as Node) && toggleBtn && !toggleBtn.contains(event.target as Node)) {
       toggleCart();
     }
   });
 };
