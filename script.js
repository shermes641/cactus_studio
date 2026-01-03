// State for the shopping cart
let cart = [];
let isAdmin = false;
let editingProductId = null;

// --- SECURITY / ADMIN CHECK LOGIC ---
// Simple hash-based admin check. If URL ends in #admin, prompts for password.
function checkAdminAccess() {
  // Check if URL ends with #admin
  if (window.location.hash === "#admin") {
    const password = prompt("Enter Admin Password:");
    if (password === "LILY") {
      isAdmin = true;
      // Show the admin button
      document.getElementById("admin-btn").style.display = "inline-block";
      // Open the modal immediately
      toggleAdminModal();
      alert("Welcome back, Lily! Admin mode enabled.");
    } else {
      alert("Incorrect Password.");
      // Remove the hash to prevent loop
      history.pushState(
        "",
        document.title,
        window.location.pathname + window.location.search
      );
    }
  }
}

// Initialize application on page load
window.onload = function () {
  const storedProducts = localStorage.getItem('cactusProducts');
  if (storedProducts) {
    try {
      products = JSON.parse(storedProducts);
    } catch (e) {
      console.error("Error loading products from localStorage:", e);
    }
  }
  const storedCart = localStorage.getItem('cactusCart');
  if (storedCart) {
    try {
      cart = JSON.parse(storedCart);
      updateCartUI();
    } catch (e) {
      console.error("Error loading cart from localStorage:", e);
    }
  }
  renderProducts();
  localStorage.setItem('cactusProducts', JSON.stringify(products));
  checkAdminAccess();
};

// Listen for hash changes to trigger admin check dynamically
window.addEventListener("hashchange", checkAdminAccess);
// ------------------------------------

// 2. Render Products
// --- UPDATED: Render Products with Clickable Images ---
// Dynamically generates HTML for the product grid based on the 'products' array
function renderProducts() {
  const grid = document.getElementById("product-grid");
  grid.innerHTML = "";
  products.forEach((product) => {
    // Check if scientific name exists
    const sciName = product.scientific
      ? `<div style="color:#666; font-style:italic; font-size:0.9rem; margin-bottom:5px;">${product.scientific}</div>`
      : "";

    grid.innerHTML += `
        <div class="product-card">
            <!-- Added onclick event here for zooming -->
            <img src="${product.image}" class="product-image" alt="${
      product.name
    }" 
                 onclick="openImageModal(${
                   product.id
                 })" style="cursor:zoom-in;">
            
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                ${sciName}
                <div class="product-price">$${product.price.toFixed(2)}</div>
                <button class="add-btn" onclick="addToCart(${
                  product.id
                })">Add to Cart</button>
            </div>
        </div>
    `;
  });
}

// --- NEW: Image Zoom Functions ---

// Opens the full-screen image modal for a specific product
function openImageModal(id) {
  const product = products.find((p) => p.id === id);
  if (!product) return;

  if (isAdmin) {
    document.getElementById("new-name").value = product.name;
    document.getElementById("new-price").value = product.price;
    document.getElementById("new-image").value = product.image;
    editingProductId = product.id;

    const btn = document.querySelector("#admin-modal .add-btn");
    if (btn) btn.innerText = "Update Product";

    const adminModal = document.getElementById("admin-modal");
    if (adminModal.style.display !== "flex") {
      adminModal.style.display = "flex";
    }
    return;
  }

  const modal = document.getElementById("image-modal");
  const img = document.getElementById("modal-img");
  const btn = document.getElementById("modal-add-btn");

  // Set Image
  img.src = product.image;

  // Configure the button to add THIS specific product
  // We use event.stopPropagation() inside the inline call to ensure logic flows correctly if needed,
  // but here we rely on the container's onclick to close it.
  btn.onclick = function () {
    addToCart(product.id);
    // The modal is closed automatically because this button is inside the div
    // which has onclick="closeImageModal()" (event bubbling).
  };

  modal.style.display = "flex";
}

// Closes the image zoom modal
function closeImageModal() {
  document.getElementById("image-modal").style.display = "none";
}

// 3. Admin / Upload Functions
// Toggles the visibility of the admin product upload modal
function toggleAdminModal() {
  const modal = document.getElementById("admin-modal");
  const isClosed = modal.style.display !== "flex";
  modal.style.display = isClosed ? "flex" : "none";

  if (isClosed) {
    editingProductId = null;
    document.getElementById("new-name").value = "";
    document.getElementById("new-price").value = "";
    document.getElementById("new-image").value = "";
    const btn = document.querySelector("#admin-modal .add-btn");
    if (btn) btn.innerText = "Add to Inventory";
  }
}

// Adds a new product to the 'products' array and re-renders the grid
function addProduct() {
  const name = document.getElementById("new-name").value;
  const price = parseFloat(document.getElementById("new-price").value);
  const image = document.getElementById("new-image").value;

  if (name && price && image) {
    if (editingProductId) {
      const product = products.find((p) => p.id === editingProductId);
      if (product) {
        product.name = name;
        product.price = price;
        product.image = image;
        alert("Cactus updated!");
      }
    } else {
      const newProduct = {
        id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1,
        name: name,
        price: price,
        image: image,
      };
      products.push(newProduct);
      alert("Cactus added to inventory!");
    }
    localStorage.setItem('cactusProducts', JSON.stringify(products));
    renderProducts();
    // Close modal
    toggleAdminModal();
    // Clear inputs
    document.getElementById("new-name").value = "";
    document.getElementById("new-price").value = "";
    document.getElementById("new-image").value = "";

    editingProductId = null;
    const btn = document.querySelector("#admin-modal .add-btn");
    if (btn) btn.innerText = "Add to Inventory";
  } else {
    alert("Please fill in all fields.");
  }
}

// 4. Cart Functions
// Toggles the visibility of the cart sidebar
function toggleCart() {
  const sidebar = document.getElementById("cart-sidebar");
  sidebar.classList.toggle("open");
}

// Adds a product to the cart array and updates the UI
function addToCart(id) {
  const product = products.find((p) => p.id === id);
  cart.push(product);
  localStorage.setItem('cactusCart', JSON.stringify(cart));
  updateCartUI();
  toggleCart();
}

// Re-renders the cart sidebar contents based on the 'cart' array
function updateCartUI() {
  const cartItemsDiv = document.getElementById("cart-items");
  const cartCount = document.getElementById("cart-count");
  const cartTotal = document.getElementById("cart-total");
  const cartFooter = document.getElementById("cart-footer");

  cartCount.innerText = cart.length;

  if (cart.length === 0) {
    cartItemsDiv.innerHTML = "<p>Your cart is empty.</p>";
    cartFooter.style.display = "none";
  } else {
    cartItemsDiv.innerHTML = "";
    let total = 0;
    cart.forEach((item, index) => {
      total += item.price;
      cartItemsDiv.innerHTML += `
                <div class="cart-item">
                    <div>
                        <strong>${item.name}</strong><br>
                        $${item.price.toFixed(2)}
                    </div>
                    <button onclick="removeFromCart(${index})" style="background:none; border:none; color:red; cursor:pointer;">Remove</button>
                </div>
            `;
    });
    cartTotal.innerText = total.toFixed(2);
    cartFooter.style.display = "block";
  }
}

// Removes an item from the cart by index
function removeFromCart(index) {
  cart.splice(index, 1);
  localStorage.setItem('cactusCart', JSON.stringify(cart));
  updateCartUI();
}

// Placeholder for checkout functionality
function checkout() {
  alert("This would go to payment!");
}

// 1. Initial Database (Array of Objects)
// Mock data for the cactus inventory
let products = [
  // --- CACTI ---
  {
    id: 1,
    name: "Golden Barrel",
    scientific: "Echinocactus grusonii",
    price: 25.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Echinocactus_grusonii.jpg?width=500",
  },
  {
    id: 2,
    name: "Bunny Ears",
    scientific: "Opuntia microdasys",
    price: 18.5,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Opuntia_microdasys.jpg?width=500",
  },
  {
    id: 3,
    name: "Saguaro Giant",
    scientific: "Carnegiea gigantea",
    price: 145.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Carnegiea_gigantea.jpg?width=500",
  },
  {
    id: 4,
    name: "Old Man Cactus",
    scientific: "Cephalocereus senilis",
    price: 35.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Cephalocereus_senilis.jpg?width=500",
  },
  //{ id: 5, name: "Organ Pipe", scientific: "Stenocereus thurberi", price: 55.00, image: "https://commons.wikimedia.org/wiki/Special:FilePath/Stenocereus_thurberi.jpg?width=500" },
  {
    id: 6,
    name: "Prickly Pear",
    scientific: "Opuntia ficus-indica",
    price: 22.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Opuntia_ficus-indica.jpg?width=500",
  },
  {
    id: 7,
    name: "Christmas Cactus",
    scientific: "Schlumbergera truncata",
    price: 22.5,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Schlumbergera_truncata.jpg?width=500",
  },
  {
    id: 8,
    name: "Fairy Castle",
    scientific: "Acanthocereus tetragonus",
    price: 29.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Acanthocereus_tetragonus.jpg?width=500",
  },
  {
    id: 9,
    name: "Bishop's Cap",
    scientific: "Astrophytum myriostigma",
    price: 34.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Astrophytum_myriostigma.jpg?width=500",
  },
  {
    id: 10,
    name: "Crown of Thorns",
    scientific: "Euphorbia milii",
    price: 27.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Euphorbia_milii.jpg?width=500",
  },
  {
    id: 11,
    name: "Rat Tail Cactus",
    scientific: "Disocactus flagelliformis",
    price: 19.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Disocactus_flagelliformis.jpg?width=500",
  },
  //{ id: 12, name: "Fishbone Cactus", scientific: "Epiphyllum anguliger", price: 31.00, image: "https://commons.wikimedia.org/wiki/Special:FilePath/Epiphyllum_anguliger.jpg?width=500" },
  {
    id: 13,
    name: "Ladyfinger",
    scientific: "Mammillaria elongata",
    price: 22.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Mammillaria_elongata.jpg?width=500",
  },
  {
    id: 14,
    name: "Sand Dollar",
    scientific: "Astrophytum asterias",
    price: 40.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Astrophytum_asterias.jpg?width=500",
  },
  {
    id: 15,
    name: "Peanut Cactus",
    scientific: "Echinopsis chamaecereus",
    price: 19.5,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Echinopsis_chamaecereus.jpg?width=500",
  },
  {
    id: 16,
    name: "Thimble Cactus",
    scientific: "Mammillaria gracilis",
    price: 14.5,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Mammillaria_gracilis.jpg?width=500",
  },
  {
    id: 17,
    name: "Silver Torch",
    scientific: "Cleistocactus strausii",
    price: 48.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Cleistocactus_strausii.jpg?width=500",
  },
  {
    id: 18,
    name: "Mexican Fence Post",
    scientific: "Pachycereus marginatus",
    price: 60.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Pachycereus_marginatus.jpg?width=500",
  },
  {
    id: 19,
    name: "Snowball Cactus",
    scientific: "Mammillaria candida",
    price: 30.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Mammillaria_candida.jpg?width=500",
  },
  {
    id: 20,
    name: "Balloon Cactus",
    scientific: "Parodia magnifica",
    price: 37.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Parodia_magnifica.jpg?width=500",
  },
  //{ id: 21, name: "Blue Torch", scientific: "Pilosocereus pachycladus", price: 50.00, image: "https://commons.wikimedia.org/wiki/Special:FilePath/Pilosocereus_pachycladus.jpg?width=500" },
  {
    id: 22,
    name: "Paper Spine",
    scientific: "Tephrocactus articulatus",
    price: 26.5,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Tephrocactus_articulatus.jpg?width=500",
  },
  //{ id: 23, name: "Totem Pole", scientific: "Lophocereus schottii", price: 65.00, image: "https://commons.wikimedia.org/wiki/Special:FilePath/Lophocereus_schottii.jpg?width=500" },
  {
    id: 24,
    name: "Devil's Tongue",
    scientific: "Ferocactus latispinus",
    price: 33.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Ferocactus_latispinus.jpg?width=500",
  },
  {
    id: 25,
    name: "Beavertail",
    scientific: "Opuntia basilaris",
    price: 28.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Opuntia_basilaris.jpg?width=500",
  },
  {
    id: 26,
    name: "Easter Cactus",
    scientific: "Hatiora gaertneri",
    price: 21.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Hatiora_gaertneri.jpg?width=500",
  },
  {
    id: 27,
    name: "Mistletoe Cactus",
    scientific: "Rhipsalis baccifera",
    price: 35.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Rhipsalis_baccifera.jpg?width=500",
  },
  {
    id: 28,
    name: "Tiger Jaws",
    scientific: "Faucaria tigrina",
    price: 16.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Faucaria_tigrina.jpg?width=500",
  },
  {
    id: 29,
    name: "Moon Cactus",
    scientific: "Gymnocalycium mihanovichii",
    price: 15.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Gymnocalycium_mihanovichii.jpg?width=500",
  },
  {
    id: 30,
    name: "Apple Cactus",
    scientific: "Cereus repandus",
    price: 45.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Cereus_repandus.jpg?width=500",
  },

  // --- SUCCULENTS ---
  {
    id: 31,
    name: "Aloe Vera",
    scientific: "Aloe vera",
    price: 15.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Aloe_vera.jpg?width=500",
  },
  {
    id: 32,
    name: "Jade Plant",
    scientific: "Crassula ovata",
    price: 24.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Crassula_ovata.jpg?width=500",
  },
  {
    id: 33,
    name: "Mexican Snowball",
    scientific: "Echeveria elegans",
    price: 12.5,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Echeveria_elegans.jpg?width=500",
  },
  {
    id: 34,
    name: "Zebra Haworthia",
    scientific: "Haworthia fasciata",
    price: 14.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Haworthia_fasciata.jpg?width=500",
  },
  {
    id: 35,
    name: "String of Pearls",
    scientific: "Senecio rowleyanus",
    price: 30.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Senecio_rowleyanus.jpg?width=500",
  },
  {
    id: 36,
    name: "Pencil Cactus",
    scientific: "Euphorbia tirucalli",
    price: 28.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Euphorbia_tirucalli.jpg?width=500",
  },
  {
    id: 37,
    name: "Ghost Plant",
    scientific: "Graptopetalum paraguayense",
    price: 14.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Graptopetalum_paraguayense.jpg?width=500",
  },
  //{ id: 38, name: "Paddle Plant", scientific: "Kalanchoe thyrsiflora", price: 26.00, image: "https://commons.wikimedia.org/wiki/Special:FilePath/Kalanchoe_thyrsiflora.jpg?width=500" },
  {
    id: 39,
    name: "Snake Plant",
    scientific: "Sansevieria trifasciata",
    price: 38.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Sansevieria_trifasciata.jpg?width=500",
  },
  {
    id: 40,
    name: "Burro's Tail",
    scientific: "Sedum morganianum",
    price: 23.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Sedum_morganianum.jpg?width=500",
  },
  {
    id: 41,
    name: "Panda Plant",
    scientific: "Kalanchoe tomentosa",
    price: 17.5,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Kalanchoe_tomentosa.jpg?width=500",
  },
  //{ id: 42, name: "Living Stone", scientific: "Lithops karasmontana", price: 18.00, image: "https://commons.wikimedia.org/wiki/Special:FilePath/Lithops_karasmontana.jpg?width=500" },
  {
    id: 43,
    name: "Pink Lady",
    scientific: "Callisia repens",
    price: 13.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Callisia_repens.jpg?width=500",
  },
  {
    id: 44,
    name: "Hens and Chicks",
    scientific: "Sempervivum tectorum",
    price: 11.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Sempervivum_tectorum.jpg?width=500",
  },
  {
    id: 45,
    name: "Blue Chalksticks",
    scientific: "Senecio serpens",
    price: 21.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Senecio_serpens.jpg?width=500",
  },
  {
    id: 46,
    name: "Coral Cactus",
    scientific: "Euphorbia lactea",
    price: 45.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Euphorbia_lactea.jpg?width=500",
  },
  {
    id: 47,
    name: "Jelly Bean",
    scientific: "Sedum rubrotinctum",
    price: 12.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Sedum_rubrotinctum.jpg?width=500",
  },
  //{ id: 48, name: "Window Haworthia", scientific: "Haworthia cooperi", price: 22.00, image: "https://commons.wikimedia.org/wiki/Special:FilePath/Haworthia_cooperi.jpg?width=500" },
  {
    id: 49,
    name: "Lipstick Echeveria",
    scientific: "Echeveria agavoides",
    price: 15.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Echeveria_agavoides.jpg?width=500",
  },
  {
    id: 50,
    name: "Tree Houseleek",
    scientific: "Aeonium arboreum",
    price: 32.0,
    image:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Aeonium_arboreum.jpg?width=500",
  },
];
