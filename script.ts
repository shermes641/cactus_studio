
import { state } from './src/state.js';
import { setVersionDisplay, injectLoadingMask, showLoadingMask, hideLoadingMask } from './src/utils.js';
import { applyTranslations, renderFilterControls, toggleCart, toggleHelp, toggleAdminModal, closeImageModal, updateCartUI, injectLoginUI } from './src/ui.js';
import { addToCart, removeFromCart, removeAllFromCart, checkout, loginUser, logoutUser, addProduct, syncDatabase, resetDatabaseSchema, applyFilter, changeItemsPerPage, renderPage, toggleLanguage, openImageModal, loginUserEmail, registerUser, toggleRegisterForm, runMigration, openCloudinaryUpload, uploadToCloudinary, fetchDataAndLoad, uploadImagesToCloudinary } from './src/actions.js';

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
(window as any).syncDatabase = syncDatabase;
(window as any).resetDatabaseSchema = resetDatabaseSchema;
(window as any).toggleAdminModal = toggleAdminModal;
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
(window as any).openCloudinaryUpload = openCloudinaryUpload;
(window as any).uploadToCloudinary = uploadToCloudinary;
(window as any).uploadImagesToCloudinary = uploadImagesToCloudinary;

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
   
   // Render Filter Controls
   renderFilterControls();
 
   // Check for persisted login and restore session if user is logged in
   const persistedEmail = localStorage.getItem("currentUserEmail");
   if (persistedEmail) {
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
     }
     
     // Hide the login UI
     const authContainer = document.getElementById("auth-container");
     if (authContainer) {
       authContainer.style.display = "none";
     }
     
     // Show admin buttons if user is admin
     if (state.isAdmin) {
       const adminBtn = document.getElementById("admin-btn");
       if (adminBtn) adminBtn.style.display = "inline-block";
       const syncBtn = document.getElementById("sync-btn");
       if (syncBtn) {
         syncBtn.style.display = "inline-block";
         let uploadImagesBtn = document.getElementById("upload-images-btn");
         if (!uploadImagesBtn) {
           uploadImagesBtn = document.createElement("button");
           uploadImagesBtn.id = "upload-images-btn";
           uploadImagesBtn.innerText = "Upload Imgs";
           uploadImagesBtn.className = syncBtn.className;
           uploadImagesBtn.style.marginLeft = "10px";
           uploadImagesBtn.style.backgroundColor = "#17a2b8";
           uploadImagesBtn.style.color = "white";
           uploadImagesBtn.onclick = () => uploadImagesToCloudinary();
           if (syncBtn.parentNode) syncBtn.parentNode.insertBefore(uploadImagesBtn, syncBtn.nextSibling);
         }
         uploadImagesBtn.style.display = "inline-block";
       }
       const migrateBtn = document.getElementById("run-migrate-btn");
       if (migrateBtn) migrateBtn.style.display = "inline-block";
       localStorage.setItem("adminSession", "true");
     }
     
     // Load and display products and user data
     fetchDataAndLoad().then(() => hideLoadingMask());
   } else {
     // No user logged in, show the login page
     hideLoadingMask();
     injectLoginUI();
   }




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
 
     if (sidebar && sidebar.classList.contains('open') && !sidebar.contains(event.target as Node) && toggleBtn && !toggleBtn.contains(event.target as Node)) {
       toggleCart();
     }
   });
 };
 
 // Listen for hash changes to trigger admin check dynamically
 //window.addEventListener("hashchange", checkAdminAccess);
