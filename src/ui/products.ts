import { state } from "../state.js";
import { translations } from "../constants.js";
import { renderPage } from "../actions.js";

export function renderFilterControls() {
  const container = document.getElementById("filter-container");
  if (!container) return;

  const label = translations[state.currentLang].filterLabel;
  const allLabel = translations[state.currentLang].allOption;

  let html = `<div class="filter-controls">`;

  html += `<div><label class="filter-label">${label}</label>`;
  html += `<select onchange="applyFilter(this.value)">`;

  state.plantClasses.forEach((type) => {
    const display = type === "All" ? allLabel : type;
    html += `<option value="${type}" ${
      state.currentFilter === type ? "selected" : ""
    }>${display}</option>`;
  });
  html += `</select></div>`;

  html += `<div><input type="text" id="product-search" class="search-input" placeholder="${translations[state.currentLang].searchPlaceholder}" value="${state.searchQuery}" oninput="handleSearch(this.value)"></div>`;

  html += `</div>`;
  container.innerHTML = html;
}

export function updatePaginationControls(totalCount: number) {
  const totalPages = Math.ceil(totalCount / state.itemsPerPage) || 1;

  // Update Header Controls (IDs: prev-btn, next-btn, page-select)
  const prevBtn = document.getElementById("prev-btn") as HTMLButtonElement;
  const nextBtn = document.getElementById("next-btn") as HTMLButtonElement;
  const pageSelect = document.getElementById(
    "page-select"
  ) as HTMLSelectElement;
  const itemsPerPageSelect = document.getElementById(
    "items-per-page-select"
  ) as HTMLSelectElement;

  if (prevBtn) {
    prevBtn.disabled = state.currentPage <= 1;
    prevBtn.onclick = () => renderPage(state.currentPage - 1);
  }

  if (nextBtn) {
    nextBtn.disabled = state.currentPage >= totalPages;
    nextBtn.onclick = () => renderPage(state.currentPage + 1);
  }

  if (pageSelect) {
    if (pageSelect.options.length !== totalPages) {
      pageSelect.innerHTML = "";
      for (let i = 1; i <= totalPages; i++) {
        const opt = document.createElement("option");
        opt.value = i.toString();
        opt.innerText = i.toString();
        pageSelect.appendChild(opt);
      }
    }
    pageSelect.value = state.currentPage.toString();
  }

  if (itemsPerPageSelect) {
    itemsPerPageSelect.value = state.itemsPerPage.toString();
  }

  // Update Footer Container (id="pagination-controls")
  const container = document.getElementById("pagination-controls");
  if (container) {
    let html = `<button class="page-btn" onclick="renderPage(${
      state.currentPage - 1
    })" ${state.currentPage <= 1 ? "disabled" : ""}>${
      translations[state.currentLang].prev
    }</button>`;

    html += `<select onchange="renderPage(parseInt(this.value))" class="page-select">`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<option value="${i}" ${
        i === state.currentPage ? "selected" : ""
      }>${i}</option>`;
    }
    html += `</select>`;

    html += `<button class="page-btn" onclick="renderPage(${
      state.currentPage + 1
    })" ${state.currentPage >= totalPages ? "disabled" : ""}>${
      translations[state.currentLang].next
    }</button>`;

    html += `
        <select onchange="changeItemsPerPage(this.value)" class="items-per-page-select">
          <option value="5" ${state.itemsPerPage === 5 ? "selected" : ""}>${
      translations[state.currentLang].opt5Page
    }</option>
          <option value="10" ${state.itemsPerPage === 10 ? "selected" : ""}>${
      translations[state.currentLang].opt10Page
    }</option>
          <option value="20" ${state.itemsPerPage === 20 ? "selected" : ""}>${
      translations[state.currentLang].opt20Page
    }</option>
        </select>
      `;

    container.innerHTML = html;
  }
}

export function groupSidebarElements() {
  const containerId = "sidebar-container";
  if (document.getElementById(containerId)) return;

  const filter = document.getElementById("filter-container");

  if (!filter) return;

  const wrapper = document.createElement("div");
  wrapper.id = containerId;

  wrapper.className = "sidebar-group-container";

  document.body.appendChild(wrapper);

  if (filter) {
    wrapper.appendChild(filter);
    (filter as HTMLElement).style.position = "static";
  }
}